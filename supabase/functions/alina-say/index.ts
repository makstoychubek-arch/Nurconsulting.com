// Отправить клиенту готовый текст от имени Алины (по слову владельца). Только сервис. Без тяжёлых модулей, чтобы функция всегда запускалась.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { pajamaPhotoFor } from '../_shared/alina-pajama-photos.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const chatId = Number(body.chat_id);
    // Диагностика вебхука Telegram: сколько обновлений ждёт и какая последняя ошибка доставки (без токена и адреса)
    if (body.webhook_info) {
        const tk = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
        const wi = await fetch(`https://api.telegram.org/bot${tk}/getWebhookInfo`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null);
        const r0 = wi?.result || {};
        return json({ ok: wi?.ok === true, pending: r0.pending_update_count, last_error_date: r0.last_error_date ? new Date(r0.last_error_date * 1000).toISOString() : null, last_error: String(r0.last_error_message || '').slice(0, 160), has_url: Boolean(r0.url), allowed: r0.allowed_updates });
    }
    const say = String(body.say || '').trim().slice(0, 3800);
    const photoModel = String(body.photo_model || '').trim();
    const delLast = Math.min(10, Math.max(0, Number(body.delete_last_alina) || 0));
    if (!Number.isSafeInteger(chatId) || (!say && !delLast && !photoModel)) return json({ ok: false, error: 'chat_id и say (или delete_last_alina) обязательны' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    const token = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    if (!conn || !token) return json({ ok: false, error: 'нет business_connection_id или токена' }, 503);
    // Удалить последние N сообщений Алины в чате (по слову владельца): номера берём из журнала, удаляет Telegram (deleteBusinessMessages)
    if (delLast) {
        const { data: rows } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', chatId).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'alina').not('payload->>mid', 'is', null).order('created_at', { ascending: false }).limit(delLast);
        const ids = ((rows || []) as Array<{ payload: { mid?: number } }>).map((x) => Number(x.payload?.mid)).filter((n) => Number.isSafeInteger(n) && n > 0);
        if (!ids.length) return json({ ok: false, error: 'нет номеров сообщений в журнале (они пишутся с этой версии)' });
        const r = await fetch(`https://api.telegram.org/bot${token}/deleteBusinessMessages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ business_connection_id: conn, message_ids: ids }),
        }).catch(() => null);
        const d = r ? await r.json().catch(() => null) : null;
        return json({ ok: d?.ok === true, deleted: ids.length, telegram: d?.ok === true ? undefined : String(d?.description || 'нет ответа').slice(0, 120) });
    }
    // Своё фото модели (по слову владельца): { chat_id, photo_model: 'Пижама 2в1 шоколадный' }, текст say уходит подписью.
    if (photoModel) {
        const shot = pajamaPhotoFor(photoModel);
        if (!shot) return json({ ok: false, error: 'нет своего фото для этой модели' }, 404);
        const form = new FormData();
        form.set('chat_id', String(chatId));
        form.set('business_connection_id', conn);
        if (say) form.set('caption', say);
        form.set('photo', new Blob([new Uint8Array(shot.bytes)], { type: shot.mime }), shot.filename);
        const pr = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) }).catch(() => null);
        const pd = pr ? await pr.json().catch(() => null) : null;
        const pok = pd?.ok === true;
        if (pok) await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', kind: 'photo', text: say || shot.caption, by: 'owner_request', mid: pd?.result?.message_id ?? null } });
        return json({ ok: pok, telegram: pok ? undefined : String(pd?.description || 'нет ответа').slice(0, 120) });
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ chat_id: chatId, business_connection_id: conn, text: say }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    const ok = data?.ok === true;
    if (ok) await admin.from('alina_selfbuy_events').insert({ event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text: say, by: 'owner_request', mid: data?.result?.message_id ?? null } });
    // Алина 2.0: ожидаемый ответ. { expect: { kind: 'start_deal' | 'book', model, date? } }: «да» клиента выполнит это предложение.
    const ex = body.expect as { kind?: string; model?: string; date?: string } | undefined;
    if (ok && ex && (ex.kind === 'start_deal' || ex.kind === 'book') && ex.model) {
        await admin.from('alina_selfbuy_events').insert({ event_type: 'expect', chat_id: chatId, payload: { kind: ex.kind, model: String(ex.model), date: ex.date ? String(ex.date) : undefined, by: 'owner_request' } });
    }
    return json({ ok, telegram: ok ? undefined : String(data?.description || 'нет ответа').slice(0, 120) });
});
