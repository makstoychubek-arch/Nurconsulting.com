// Алина 2.0, «страж»: каждые 3 минуты (1) ловит клиентов, которым Алина не ответила дольше 4 минут, и сообщает в группу менеджеров;
// (2) лист ожидания: если на сегодня освободилось место, предлагает его первому из тех, кому утром или днём отказали «мест нет» (10 минут на ответ, потом следующему).
// Настройки: alina_settings.guardian {watchdog: true, waitlist: 'off'|'dry'|'live'}. По умолчанию страж включён, лист ожидания в режиме 'dry' (только пишет в журнал, что предложил бы). Только сервис.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { managerGroupId } from '../_shared/alina-manager.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isAck } from '../_shared/alina-guard.ts';
import { isFreeRow, isModelBlocked, normModel, normTg, parseRazdachiSheet, setBlockedModels, todayMskKey } from '../_shared/alina-razdachi.ts';
import { ALINA_VERSION } from '../_shared/alina-version.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}‍️\p{P}]*$/u;

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const token = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    const now = Date.now();
    const msk = new Date(now + 3 * 3600_000);
    const hm = msk.getUTCHours() * 60 + msk.getUTCMinutes();
    const { data: gs } = await admin.from('alina_settings').select('value').eq('key', 'guardian').maybeSingle();
    const cfg = { watchdog: true, waitlist: 'dry', ...(((gs as { value?: Record<string, unknown> } | null)?.value) || {}) } as { watchdog: boolean; waitlist: string };
    const out: Record<string, unknown> = { version: ALINA_VERSION };

    // ── 1. Страж молчания ─────────────────────────────────────────────────────────────────────────────
    if (cfg.watchdog) {
        const { data: logs } = await admin.from('alina_selfbuy_events').select('chat_id, created_at, payload').eq('event_type', 'chat_log')
            .gt('created_at', new Date(now - 45 * 60_000).toISOString()).order('created_at', { ascending: true }).limit(1500);
        const last = new Map<number, { created_at: string; payload: { dir?: string; text?: string; username?: string } }>();
        for (const e of (logs || []) as Array<{ chat_id: number; created_at: string; payload: { dir?: string; text?: string; username?: string } }>) last.set(e.chat_id, e);
        const alerts: string[] = [];
        for (const [chatId, e] of last) {
            if (e.payload?.dir !== 'client') continue;
            const ageMin = (now - Date.parse(e.created_at)) / 60_000;
            const text = String(e.payload?.text || '').trim();
            if (ageMin < 4 || !text || isAck(text) || EMOJI_ONLY.test(text) || /^(спасибо|благодарю|ок|хорошо)\b/i.test(text)) continue;
            const { data: seen } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', chatId).eq('event_type', 'silence_alert')
                .gt('created_at', new Date(now - 60 * 60_000).toISOString()).limit(1);
            if (seen && seen.length) continue;
            await admin.from('alina_selfbuy_events').insert({ chat_id: chatId, event_type: 'silence_alert', payload: { text: text.slice(0, 120), age_min: Math.round(ageMin) } });
            const who = e.payload?.username ? '@' + e.payload.username : `чат ${chatId}`;
            alerts.push(`${who} ждёт ${Math.round(ageMin)} мин: «${text.slice(0, 100)}»`);
        }
        if (alerts.length) {
            const group = await managerGroupId();
            if (group && token) {
                await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
                    body: JSON.stringify({ chat_id: group, text: `⚠️ Алина не ответила:\n${alerts.join('\n')}` }),
                }).catch(() => null);
            }
        }
        out.silence = alerts;
    }

    // ── 2. Лист ожидания ─────────────────────────────────────────────────────────────────────────────
    if (cfg.waitlist !== 'off' && hm >= 8 * 60 && hm < 20 * 60 + 30) {
        const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
        const gtoken = sa ? await googleAccessToken(sa).catch(() => '') : '';
        const res = gtoken ? await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:Z2000`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${gtoken}` }, signal: AbortSignal.timeout(20000) }).catch(() => null) : null;
        const values = res?.ok ? ((await res.json().catch(() => null))?.values || []) as string[][] : null;
        const sheet = values ? parseRazdachiSheet(values) : null;
        if (sheet) {
            const { data: bm } = await admin.from('alina_settings').select('value').eq('key', 'blockedModels').maybeSingle();
            setBlockedModels(Array.isArray((bm as { value?: unknown } | null)?.value) ? ((bm as { value: string[] }).value) : []);
            const today = todayMskKey();
            const free = sheet.rows.filter((r) => r.date === today && isFreeRow(r) && !isModelBlocked(r.model));
            const models = [...new Set(free.map((r) => r.model))];
            const holders = new Set(sheet.rows.filter((r) => r.date === today && r.tg).map((r) => r.tg));
            const dayStart = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - 3 * 3600_000).toISOString();
            for (const model of models.slice(0, 1)) {
                const { data: recent } = await admin.from('alina_selfbuy_events').select('chat_id, created_at, payload').in('event_type', ['waitlist_offer', 'waitlist_offer_dry'])
                    .gt('created_at', dayStart).order('created_at', { ascending: false }).limit(60);
                const offers = (recent || []) as Array<{ chat_id: number; created_at: string; payload: { model?: string } }>;
                const lastForModel = offers.find((o) => normModel(String(o.payload?.model || '')) === normModel(model));
                if (lastForModel && now - Date.parse(lastForModel.created_at) < 10 * 60_000) { out.waiting = `${model}: ждём ответа ${lastForModel.chat_id}`; continue; }
                const triedChats = new Set(offers.filter((o) => normModel(String(o.payload?.model || '')) === normModel(model)).map((o) => o.chat_id));
                const { data: cand } = await admin.from('alina_selfbuy_events').select('chat_id, created_at').eq('event_type', 'closed_no_slots')
                    .gt('created_at', dayStart).order('created_at', { ascending: true }).limit(80);
                const seenChat = new Set<number>();
                for (const c of (cand || []) as Array<{ chat_id: number; created_at: string }>) {
                    if (seenChat.has(c.chat_id) || triedChats.has(c.chat_id)) continue;
                    seenChat.add(c.chat_id);
                    const { data: lead } = await admin.from('alina_selfbuy_leads').select('username, status').eq('chat_id', c.chat_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
                    const l = lead as { username?: string | null; status?: string } | null;
                    if (!l?.username || !['closed', 'new', 'ask_ad', 'ask_type'].includes(String(l.status))) continue;
                    if (holders.has(normTg(l.username))) continue;
                    const { data: booked } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', c.chat_id).eq('event_type', 'slot_booked').gt('created_at', c.created_at).limit(1);
                    if (booked && booked.length) continue;
                    // клиент уже отказался или сам ушёл: не беспокоим
                    const { data: lastC } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', c.chat_id).eq('event_type', 'chat_log').eq('payload->>dir', 'client').order('created_at', { ascending: false }).limit(1).maybeSingle();
                    if (/^(нет|не надо|не нужно|отмена|стоп)\b|не\s+актуально/i.test(String((lastC as { payload?: { text?: string } } | null)?.payload?.text || ''))) continue;
                    const short = model.replace(/^Пижама\s+/i, '');
                    const text = `Освободилось место на сегодня: ${short} 🙌 Заказать нужно сегодня до 22:00 МСК. Берёте?`;
                    if (cfg.waitlist !== 'live') {
                        await admin.from('alina_selfbuy_events').insert({ chat_id: c.chat_id, event_type: 'waitlist_offer_dry', payload: { model, username: l.username, text } });
                        out.offer_dry = { chat_id: c.chat_id, username: l.username, model };
                        break;
                    }
                    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
                    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
                    if (!conn || !token) break;
                    const sr = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ chat_id: c.chat_id, business_connection_id: conn, text }) }).then((x) => x.json()).catch(() => null);
                    if (sr?.ok) {
                        await admin.from('alina_selfbuy_events').insert([
                            { chat_id: c.chat_id, event_type: 'waitlist_offer', payload: { model, username: l.username } },
                            { chat_id: c.chat_id, event_type: 'expect', payload: { kind: 'start_deal', model } },
                            { chat_id: c.chat_id, event_type: 'chat_log', payload: { dir: 'alina', text, by: 'waitlist', mid: sr?.result?.message_id ?? null } },
                        ]);
                        out.offer = { chat_id: c.chat_id, username: l.username, model };
                    }
                    break;
                }
            }
            out.free_today = models;
        } else out.sheet = 'не прочиталась';
    }
    // ── 3. Сверка заявок с таблицей ──────────────────────────────────────────────────────────────────
    // Клиент ищет товар или собирает заказ, а его строку в таблице перенесли на другую дату (так вышло с «лапшой вишней» 25 → 28 ноября): останавливаем заявку,
    // один раз честно пишем «место перенесено на …, сегодня ничего делать не нужно». Настройка guardian.reconcile: off | dry | live (по умолчанию live).
    const recMode = String((gs as { value?: Record<string, unknown> } | null)?.value?.reconcile || 'live');
    if (recMode !== 'off' && hm >= 8 * 60 && hm < 23 * 60) {
        try {
            const sa2 = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
            const gt2 = sa2 ? await googleAccessToken(sa2).catch(() => '') : '';
            const r2 = gt2 ? await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:Z2000`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${gt2}` }, signal: AbortSignal.timeout(20000) }).catch(() => null) : null;
            const sh2 = r2?.ok ? parseRazdachiSheet(((await r2.json().catch(() => null))?.values || []) as string[][]) : null;
            if (sh2) {
                const today2 = todayMskKey();
                const toKey = (d: string) => { const m = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}${m[2]}${m[1]}` : ''; };
                const { data: act } = await admin.from('alina_selfbuy_leads').select('id, chat_id, username, status, product_name')
                    .in('status', ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order']).gt('updated_at', new Date(now - 48 * 3600_000).toISOString()).limit(40);
                const moved: string[] = [];
                for (const l of (act || []) as Array<{ id: string; chat_id: number; username: string | null; status: string; product_name: string | null }>) {
                    if (!l.username) continue;
                    const mine = sh2.rows.filter((r) => r.tg === normTg(l.username) && (!l.product_name || normModel(r.model) === normModel(l.product_name)));
                    if (!mine.length || mine.some((r) => r.date === today2)) continue;
                    const later = mine.filter((r) => toKey(r.date) > toKey(today2)).sort((a, b) => toKey(a.date).localeCompare(toKey(b.date)))[0];
                    if (!later) continue;
                    const { data: sent } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', l.chat_id).eq('event_type', 'moved_notice').eq('payload->>date', later.date).limit(1);
                    if (sent && sent.length) continue;
                    const model = later.model.replace(/^Пижама\s+/i, '');
                    const text = `Простите за путаницу 🙏 Ваше место перенесено на ${later.date.slice(0, 5)}: ${model}. Сегодня искать и заказывать не нужно, напишите в этот день, и начнём 🙌`;
                    if (recMode === 'dry') { moved.push(`${l.username} → ${later.date} (пробно)`); continue; }
                    const { data: q2 } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
                    const conn2 = String((q2 as { business_connection_id?: string } | null)?.business_connection_id || '');
                    if (!conn2 || !token) continue;
                    const sr2 = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ chat_id: l.chat_id, business_connection_id: conn2, text }) }).then((x) => x.json()).catch(() => null);
                    if (sr2?.ok) {
                        await admin.from('alina_selfbuy_leads').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', l.id);
                        await admin.from('alina_selfbuy_events').insert([
                            { chat_id: l.chat_id, event_type: 'moved_notice', payload: { date: later.date, model: later.model, username: l.username } },
                            { chat_id: l.chat_id, event_type: 'chat_log', payload: { dir: 'alina', text, by: 'guardian' } },
                        ]);
                        moved.push(`${l.username} → ${later.date}`);
                    }
                }
                out.moved = moved;
            }
        } catch (e) { out.reconcile_error = String((e as Error)?.message || e).slice(0, 120); }
    }
    return json({ ok: true, ...out });
});
