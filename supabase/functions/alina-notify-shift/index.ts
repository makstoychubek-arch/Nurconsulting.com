// Уведомление клиентам, чью запись перенесли на другую дату (по слову владельца, после правки плана раздач).
// Только сервис. body: { model, date: 'дд.мм.гггг' (новая дата), reason?: строка, dry_run?: true, text?: полный текст вместо шаблона }.
// Находит в листе «Раздачи Пижам» строки модели на новую дату с логином и пишет каждому один раз.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function dayWords(date: string): string {
    const m = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return date;
    const msk = new Date(Date.now() + 3 * 3600_000);
    const today = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate());
    const diff = Math.round((Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) - today) / 86400_000);
    const base = `${Number(m[1])} ${MONTHS[Number(m[2]) - 1]}`;
    return diff === 1 ? `завтра, ${base}` : diff === 0 ? `сегодня, ${base}` : base;
}

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const model = String(body.model || '').trim(), date = String(body.date || '').trim();
    if (!model || !/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return json({ ok: false, error: 'model и date (дд.мм.гггг) обязательны' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const token = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
    if (!token) return json({ ok: false, error: 'нет доступа к таблице' }, 503);
    const sr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:D900`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    const rows = ((await sr?.json().catch(() => null))?.values || []) as string[][];
    const who = rows.slice(1).filter((r) => String(r[0] || '').trim() === model && String(r[3] || '').trim() === date && String(r[2] || '').trim())
        .map((r) => String(r[2]).replace(/^@/, '').trim());
    const reason = String(body.reason || 'неполадок на WB').trim();
    const text = String(body.text || '').trim() || `Здравствуйте! Из-за ${reason} «${model.replace(/^Пижама\s+/i, '')}» сегодня недоступна, поэтому ваша запись перенесена на ${dayWords(date)}. Всё в силе, напишите мне в этот день, и начнём 🙌`;
    if (body.dry_run === true) return json({ ok: true, dry_run: true, text, who });
    const botToken = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    if (!botToken || !conn) return json({ ok: false, error: 'нет токена или business_connection_id' }, 503);
    const sent: string[] = [], skipped: string[] = [], failed: string[] = [];
    for (const tg of who) {
        const { data: lead } = await admin.from('alina_selfbuy_leads').select('chat_id').ilike('username', tg).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const chatId = (lead as { chat_id?: number } | null)?.chat_id;
        if (!chatId) { failed.push(tg); continue; }
        const { data: done } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', chatId).eq('event_type', 'shift_notified').eq('payload->>date', date).eq('payload->>model', model).limit(1);
        if (done && done.length) { skipped.push(tg); continue; }
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ chat_id: chatId, business_connection_id: conn, text }) }).then((x) => x.json()).catch(() => null);
        if (r?.ok) {
            sent.push(tg);
            await admin.from('alina_selfbuy_events').insert([
                { event_type: 'shift_notified', chat_id: chatId, payload: { date, model } },
                { event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text, by: 'shift_notice', mid: r.result?.message_id ?? null } },
            ]);
        } else failed.push(tg);
    }
    return json({ ok: true, sent, skipped, failed });
});
