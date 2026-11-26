// Следит, появилась ли карточка модели в поиске/карточках WB (публичный card.wb.ru), и когда появилась, напоминает всем записанным на модель.
// Только сервис (cron каждые 10 минут). Настройка alina_settings.wbWatch: { nm, model, active, notified }.
// body: { probe: true, nm? } вернуть, что отдал WB; { notify: true } разослать напоминание принудительно.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { managerGroupId } from '../_shared/alina-manager.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function cardInfo(nm: number): Promise<{ ok: boolean; status: number; available: boolean | null; qty?: number }> {
    for (const v of ['v4', 'v2']) {
        const res = await fetch(`https://card.wb.ru/cards/${v}/detail?appType=1&curr=rub&dest=-1257786&nm=${nm}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12_000) }).catch(() => null);
        if (!res) continue;
        if (!res.ok) return { ok: false, status: res.status, available: null };
        const d = await res.json().catch(() => null);
        const p = d?.data?.products?.[0] ?? d?.products?.[0];
        if (!p) return { ok: true, status: 200, available: false };
        const qty = Number(p.totalQuantity ?? 0) || (p.sizes || []).reduce((s: number, z: any) => s + (z.stocks || []).reduce((a: number, t: any) => a + (Number(t.qty) || 0), 0), 0);
        return { ok: true, status: 200, available: qty > 0, qty };
    }
    return { ok: false, status: 0, available: null };
}

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    if (body.probe === true) return json({ ok: true, card: await cardInfo(Number(body.nm) || 1939974887) });
    const { data: row } = await admin.from('alina_settings').select('value').eq('key', 'wbWatch').maybeSingle();
    const w = (row as { value?: { nm?: number; model?: string; active?: boolean; notified?: boolean } } | null)?.value;
    if (!w?.active || !w.nm || !w.model) return json({ ok: true, skipped: 'нет активного наблюдения' });
    if (w.notified && body.notify !== true) return json({ ok: true, skipped: 'уже напомнила' });
    const card = body.notify === true ? { ok: true, status: 200, available: true } : await cardInfo(w.nm);
    if (!card.available) return json({ ok: true, waiting: true, card });
    // Появилась: берём записанных на модель в таблице (будущие даты) и пишем каждому.
    const token = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
    const sr = token ? await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:D700`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null) : null;
    const rows = ((await sr?.json().catch(() => null))?.values || []) as string[][];
    const who: { tg: string; date: string }[] = [];
    for (const r of rows.slice(1)) {
        if (String(r[0] || '').trim() !== w.model) continue;
        const tg = String(r[2] || '').replace(/^@/, '').trim();
        if (tg) who.push({ tg, date: String(r[3] || '').trim() });
    }
    const botToken = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    const sent: string[] = [], failed: string[] = [];
    for (const p of who) {
        const { data: lead } = await admin.from('alina_selfbuy_leads').select('chat_id').ilike('username', p.tg).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const chatId = (lead as { chat_id?: number } | null)?.chat_id;
        if (!chatId) { failed.push(p.tg); continue; }
        const text = `${w.model.replace(/^Пижама\s+/i, '')} снова в продаже на WB ✅ Ваше место на ${p.date} в силе. Напишите мне, когда будете готовы начать 🙌`;
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ chat_id: chatId, business_connection_id: conn, text }) }).then((x) => x.json()).catch(() => null);
        if (r?.ok) { sent.push(p.tg); await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text, by: 'wb_watch', mid: r.result?.message_id ?? null } }); } else failed.push(p.tg);
    }
    const group = await managerGroupId();
    if (group && botToken) await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: group, text: `${w.model} появилась на WB. Напомнила ${sent.length} клиентам${failed.length ? `, не смогла: ${failed.join(', ')}` : ''}.` }) }).catch(() => null);
    await admin.from('alina_settings').upsert({ key: 'wbWatch', value: { ...w, notified: true, notified_at: new Date().toISOString() } });
    return json({ ok: true, notified: sent.length, failed });
});
