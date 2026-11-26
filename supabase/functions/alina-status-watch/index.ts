// Наблюдение за статусами менеджера в таблице (шаги 2–3). Раз в 10 минут читает «Раздачи Пижам», сравнивает со снимком alina_settings.statusSnap
// и пишет события status_watch (что Алина сказала бы клиенту). Клиентам НИЧЕГО не отправляет, «Менеджер ведёт» пока тоже не глушит. Только сервис.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { parseRazdachiSheet, colLetter, normTg } from '../_shared/alina-razdachi.ts';
import { sheetStatusOf } from '../_shared/alina-razdachi-sync.ts';
import { planStatusChanges } from '../_shared/alina-status-watch.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'нет ключа Google' }, 503);
    const token = await googleAccessToken(sa);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:Z1500`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!res?.ok) return json({ ok: false, error: 'таблица недоступна', status: res?.status });
    const values = ((await res.json().catch(() => null))?.values || []) as string[][];
    const sheet = parseRazdachiSheet(values);
    if (!sheet || sheet.col.status == null) return json({ ok: false, error: 'нет колонки «Статус»' });
    const idCol = sheet.headers.findIndex((h) => h.trim().toLowerCase() === 'id');
    // Разовая заливка статусов (alina_settings.statusBackfill {run:true, logins:[...]}): заполняет ТОЛЬКО пустые «Статус» у строк с логином
    // по заявке клиента (нет заявки: «Заказ оформлен», если есть цена, иначе «Записан»). Отчёт: alina_settings.statusBackfillReport.
    const { data: bf } = await admin.from('alina_settings').select('value').eq('key', 'statusBackfill').maybeSingle();
    const bfv = (bf?.value ?? null) as { run?: boolean; logins?: string[] } | null;
    if (bfv?.run) {
        const sc = sheet.col.status!;
        const { data: ld } = await admin.from('alina_selfbuy_leads').select('username, status, updated_at').not('username', 'is', null).order('updated_at', { ascending: true }).limit(3000);
        const latest = new Map<string, string>();
        for (const l of (ld || []) as Array<{ username: string; status: string }>) latest.set(normTg(l.username), l.status);
        const data: Array<{ range: string; values: string[][] }> = [];
        const filled: string[] = [];
        for (const rw of sheet.rows) {
            if (!rw.tg || String(rw.cells[sc] ?? '').trim() !== '') continue;
            const priceIdx = sheet.col.price;
            const hasPrice = priceIdx != null && String(rw.cells[priceIdx] ?? '').trim() !== '';
            const st = sheetStatusOf(latest.get(rw.tg)) || (hasPrice ? 'Заказ оформлен' : 'Записан');
            data.push({ range: `'${TAB}'!${colLetter(sc)}${rw.row}`, values: [[st]] });
            filled.push(`${rw.row}:${rw.tg}:${st}`);
        }
        let applied = false;
        if (data.length) {
            const w = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) }).catch(() => null);
            applied = Boolean(w?.ok);
        }
        const want = (bfv.logins || []).map((x) => normTg(x));
        const peek = sheet.rows.filter((rw) => want.includes(rw.tg)).map((rw) => ({ row: rw.row, cells: rw.cells }));
        await admin.from('alina_settings').upsert({ key: 'statusBackfillReport', value: { at: new Date().toISOString(), applied, count: data.length, filled: filled.slice(0, 400), peek, headers: sheet.headers } });
        await admin.from('alina_settings').upsert({ key: 'statusBackfill', value: { run: false } });
    }
    // Разовое освобождение строк по слову владельца (alina_settings.statusRelease {items:[{tg,date,model}], run:true}): очищает логин, дату отзыва, плановую выплату и статус.
    const { data: rl } = await admin.from('alina_settings').select('value').eq('key', 'statusRelease').maybeSingle();
    const rlv = (rl?.value ?? null) as { run?: boolean; items?: Array<{ tg: string; date: string; model: string }> } | null;
    if (rlv?.run && rlv.items?.length) {
        const out: string[] = [];
        const data: Array<{ range: string; values: string[][] }> = [];
        for (const it of rlv.items) {
            const hit = sheet.rows.filter((rw) => rw.tg === normTg(it.tg) && rw.model === it.model && rw.date === it.date);
            if (hit.length !== 1) { out.push(`${it.tg}: строк ${hit.length}, пропуск`); continue; }
            const rw = hit[0];
            if (sheet.col.price != null && String(rw.cells[sheet.col.price] ?? '').trim() !== '') { out.push(`${it.tg}: в строке уже есть заказ, пропуск`); continue; }
            for (const f of ['tg', 'review_date', 'payout_plan', 'status']) {
                const ci = sheet.col[f];
                if (ci != null) data.push({ range: `'${TAB}'!${colLetter(ci)}${rw.row}`, values: [['']] });
            }
            out.push(`${it.tg}: строка ${rw.row} освобождена`);
        }
        let applied = false;
        if (data.length) {
            const w = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) }).catch(() => null);
            applied = Boolean(w?.ok);
        }
        await admin.from('alina_settings').upsert({ key: 'statusRelease', value: { run: false, at: new Date().toISOString(), applied, out } });
    }
    const { data: snapRow } = await admin.from('alina_settings').select('value').eq('key', 'statusSnap').maybeSingle();
    const prev = (snapRow?.value ?? null) as Record<string, string> | null;
    const { snap, changes } = planStatusChanges(prev, sheet, idCol >= 0 ? idCol : undefined);
    for (const c of changes) {
        await admin.from('alina_selfbuy_events').insert({ lead_id: null, chat_id: 0, event_type: 'status_watch', payload: { ...c, mode: 'dry' } });
    }
    // Ручная смена статуса Алины в таблице (владелец, 26 ноября 2026): бот принимает её как шаг заявки и дальше ведёт клиента с этого шага. Клиенту ничего не пишем.
    const adopted: string[] = [];
    if (prev != null) {
        const REVERSE: Record<string, string> = {
            'Условия отправлены': 'tz_sent', 'Ищет товар': 'key_sent', 'Корзина': 'wait_cart', 'Ждёт получения': 'wait_pickup',
            'Забрал': 'wait_shk', 'ШК получен': 'wait_review', 'Отзыв на согласовании': 'wait_reels', 'Записан': 'closed',
        };
        const sc = sheet.col.status!;
        for (const r of sheet.rows) {
            if (!r.tg) continue;
            const st = String(r.cells[sc] ?? '').trim();
            const key = idCol >= 0 && String(r.cells[idCol] ?? '').trim() ? `id:${String(r.cells[idCol]).trim()}` : `${r.tg}|${r.date}|${r.model}`;
            const was = prev[key] ?? '';
            if (!st || st === was || !(st in REVERSE) && st !== 'Заказ оформлен') continue;
            const { data: lead } = await admin.from('alina_selfbuy_leads').select('id, chat_id, status, product_name, bank_details, notes').ilike('username', r.tg).order('updated_at', { ascending: false }).limit(1).maybeSingle();
            const l = lead as { id: string; chat_id: number; status: string; product_name: string | null; bank_details: string | null; notes: string | null } | null;
            if (!l) continue;
            if (sheetStatusOf(l.status) === st) continue; // бот сам поставил этот статус (или он совпадает с шагом заявки)
            if (sheetStatusOf(l.status) !== was && was) continue; // бот менял заявку после снимка: не перебиваем
            let to = REVERSE[st];
            if (st === 'Заказ оформлен') {
                const hasSize = /размер:\S+/.test(l.notes || ''), hasInt = /интеграция:\S+/.test(l.notes || '');
                to = !hasSize ? 'wait_size' : !l.bank_details ? 'wait_bank' : !hasInt ? 'wait_integration' : 'wait_pickup';
            }
            if (!to || to === l.status) continue;
            await admin.from('alina_selfbuy_leads').update({ status: to, updated_at: new Date().toISOString() }).eq('id', l.id);
            await admin.from('alina_selfbuy_events').insert({ lead_id: l.id, chat_id: l.chat_id, event_type: 'status_adopted', payload: { row: r.row, from_bot: l.status, sheet: st, to } });
            adopted.push(`${r.tg} стр.${r.row}: ${l.status} → ${to} (таблица: ${st})`);
        }
    }
    await admin.from('alina_settings').upsert({ key: 'statusSnap', value: snap });
    return json({ ok: true, baseline: prev == null, rows: Object.keys(snap).length, changes, adopted });
});
