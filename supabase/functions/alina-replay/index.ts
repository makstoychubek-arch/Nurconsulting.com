// Ответить клиенту, которому Алина не ответила (по слову владельца): прогоняет его сообщение через ту же логику Алины и отправляет ответ.
// Только сервис. body: { chat_id, text, dry_run? }. Фото моделей уходят как обычно. Менеджеру ничего не эскалирует.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { handleAlinaClientMessage } from '../_shared/alina-selfbuy.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const chatId = Number(body.chat_id), text = String(body.text || '').trim();
    if (!Number.isSafeInteger(chatId) || !text) return json({ ok: false, error: 'chat_id и text обязательны' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const token = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    if (!token || !conn) return json({ ok: false, error: 'нет токена или business_connection_id' }, 503);
    const { data: lead } = await admin.from('alina_selfbuy_leads').select('username, full_name').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const reply = await handleAlinaClientMessage({
        chatId, userId: chatId, username: (lead as { username?: string } | null)?.username || undefined, fullName: (lead as { full_name?: string } | null)?.full_name || undefined,
        text, hasPhoto: false, botToken: token, sourceAccount: 'business',
    } as never);
    if (body.dry_run === true) return json({ ok: true, dry_run: true, replies: reply.replies, photos: (reply.photos || []).map((p) => p.caption || p.filename) });
    const sent: string[] = [];
    for (const ph of reply.photos || []) {
        const form = new FormData();
        form.set('chat_id', String(chatId)); form.set('business_connection_id', conn);
        if (ph.caption) form.set('caption', ph.caption);
        if (ph.bytes) form.set('photo', new Blob([new Uint8Array(ph.bytes)], { type: ph.mime || 'image/jpeg' }), ph.filename || 'p.jpg'); else if (ph.url) form.set('photo', ph.url); else continue;
        const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) }).then((x) => x.json()).catch(() => null);
        if (r?.ok) await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', kind: 'photo', text: ph.caption || '', by: 'replay', mid: r.result?.message_id ?? null } });
    }
    for (const t of reply.replies) {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ chat_id: chatId, business_connection_id: conn, text: t }),
        }).then((x) => x.json()).catch(() => null);
        if (r?.ok) { sent.push(t); await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text: t, by: 'replay', mid: r.result?.message_id ?? null } }); }
    }
    return json({ ok: true, sent });
});
