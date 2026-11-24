// Продолжить диалог, который Алина пропустила (например, из-за ложной передачи менеджеру): обработать последнее сообщение клиента так, как будто оно пришло сейчас.
// Только сервис. Берёт business_connection_id из обращений к менеджерам или допусков этого чата.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { processAlinaTelegramUpdate } from '../_shared/alina-telegram.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const chatId = Number(body.chat_id);
    const text = String(body.text || '').trim();
    if (!Number.isSafeInteger(chatId) || (!text && !body.say)) return json({ ok: false, error: 'chat_id и text обязательны' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').eq('client_chat_id', chatId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    let connectionId = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    if (!connectionId) {
        const { data: a } = await admin.from('alina_admissions').select('connection_id').eq('chat_id', chatId).limit(1).maybeSingle();
        connectionId = String((a as { connection_id?: string } | null)?.connection_id || '');
    }
    if (!connectionId) {
        // Подключение бизнес-аккаунта одно на все чаты: берём последнее известное
        const { data: any1 } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        connectionId = String((any1 as { business_connection_id?: string } | null)?.business_connection_id || '');
    }
    if (!connectionId) return json({ ok: false, error: 'нет business_connection_id' }, 404);
    // Режим «сказать»: отправить клиенту готовый текст от имени Алины (по слову владельца), без разбора сообщения.
    if (body.say) {
        const token = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
        const say = String(body.say).slice(0, 1500);
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ chat_id: chatId, business_connection_id: connectionId, text: say }),
        }).catch(() => null);
        const ok = Boolean(res?.ok && (await res.json().catch(() => null))?.ok === true);
        if (ok) await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text: say, by: 'owner_request' } });
        return json({ ok });
    }
    const updateId = 9_000_000_000 + Math.floor(Date.now() / 1000) % 1_000_000_000;
    await processAlinaTelegramUpdate('alina', (Deno.env.get('ALINA_BOT_TOKEN') || '').trim(), {
        update_id: updateId,
        business_message: {
            business_connection_id: connectionId,
            message_id: updateId,
            chat: { id: chatId, type: 'private' },
            from: { id: chatId, is_bot: false, username: String(body.username || '') || undefined, first_name: String(body.first_name || '') || undefined },
            text,
        },
    } as never);
    return json({ ok: true, update_id: updateId });
});
