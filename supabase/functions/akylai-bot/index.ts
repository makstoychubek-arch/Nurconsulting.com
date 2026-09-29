// Supabase Edge Function: akylai-bot — вебхук Telegram-бота Акылай.
// JWT выключен (Telegram его не шлёт); вместо него — секрет вебхука
// AKYLAI_WEBHOOK_SECRET в заголовке X-Telegram-Bot-Api-Secret-Token.
//
//  /start <код>  — привязка личного чата к кабинету (код одноразовый, 24 ч);
//  кнопки        — «Опубликовать» / «Изменить» / «Включить автопубликацию»;
//  реплай        — новый текст ответа после «Изменить»;
//  my_chat_member — клиент заблокировал / разблокировал бота.
// Только личные чаты. Каждая кнопка проверяет, что чат принадлежит кабинету.
// deno-lint-ignore-file no-explicit-any

import {
    AKYLAI_AUTO_OFFER_AFTER, autoOfferKeyboard, BOT_TEXT, checkLink, parseCallback, parseStartCode,
} from '../_shared/akylai-core.ts';
import {
    adminClient, agentLog, background, cabinetWbToken, env, FEEDBACKS_API, json, kickReviews, notifyNr, tg, wbFetch,
} from '../_shared/akylai-server.ts';
import { sha256Hex } from '../_shared/secret-box.ts';

const say = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
    tg('sendMessage', { chat_id: chatId, text, ...extra });

async function clientEmail(admin: any, userId: string): Promise<string> {
    const { data } = await admin.from('spaces').select('email').eq('user_id', userId).maybeSingle();
    return String(data?.email || '');
}

async function handleStart(admin: any, chatId: number, text: string) {
    const code = parseStartCode(text);
    const { data: linked } = await admin.from('akylai_chats').select('cabinet_id').eq('chat_id', chatId).limit(1);
    if (!code) {
        await say(chatId, linked?.length ? BOT_TEXT.alreadyConnected : BOT_TEXT.noCode);
        return;
    }

    const { data: link } = await admin.from('akylai_links')
        .select('id, cabinet_id, user_id, expires_at, used_at').eq('code_hash', await sha256Hex(code)).maybeSingle();
    const check = checkLink(link);

    if (check === 'used') {
        // Повторное нажатие Start по той же ссылке тем же человеком.
        const { data: same } = await admin.from('akylai_chats').select('chat_id')
            .eq('cabinet_id', link.cabinet_id).eq('chat_id', chatId).maybeSingle();
        await say(chatId, same ? BOT_TEXT.alreadyConnected : BOT_TEXT.linkBad);
        return;
    }
    if (check !== 'ok') {
        await agentLog(admin, link?.cabinet_id ?? null, 'link_rejected', { reason: check });
        await say(chatId, BOT_TEXT.linkBad);
        return;
    }

    // Код гасим сразу: второй /start с ним уже не пройдёт.
    const { data: burned } = await admin.from('akylai_links')
        .update({ used_at: new Date().toISOString() }).eq('id', link.id).is('used_at', null).select('id');
    if (!burned?.length) {
        await say(chatId, BOT_TEXT.linkBad);
        return;
    }

    const { data: prev } = await admin.from('akylai_chats').select('chat_id').eq('cabinet_id', link.cabinet_id).maybeSingle();
    const now = new Date().toISOString();
    await admin.from('akylai_chats').upsert(
        { cabinet_id: link.cabinet_id, chat_id: chatId, blocked: false, updated_at: now },
        { onConflict: 'cabinet_id' },
    );
    await admin.from('akylai_settings').upsert({ cabinet_id: link.cabinet_id, enabled: true, updated_at: now }, { onConflict: 'cabinet_id' });
    await say(chatId, BOT_TEXT.connected);
    await agentLog(admin, link.cabinet_id, 'telegram_connected', { first: !prev });

    if (!prev) {
        const { data: cab } = await admin.from('cabinets').select('name').eq('id', link.cabinet_id).maybeSingle();
        await notifyNr(`🆕 Новый клиент: ${cab?.name || 'без названия'}, ${await clientEmail(admin, link.user_id) || '—'}`);
    }
    // Первые ответы — сразу, не дожидаясь расписания.
    background(kickReviews(link.cabinet_id));
}

async function chatOwnsCabinet(admin: any, chatId: number, cabinetId: string): Promise<boolean> {
    const { data } = await admin.from('akylai_chats').select('chat_id').eq('cabinet_id', cabinetId).maybeSingle();
    return !!data && Number(data.chat_id) === Number(chatId);
}

async function publish(admin: any, reply: any, text: string): Promise<'ok' | 'token' | 'fail'> {
    let token = '';
    try { token = await cabinetWbToken(admin, reply.cabinet_id); } catch { token = ''; }
    if (!token) return 'token';
    const res = await wbFetch(`${FEEDBACKS_API}/api/v1/feedbacks/answer`, token, 'POST', { id: reply.feedback_id, text });
    if (!res.ok) {
        await agentLog(admin, reply.cabinet_id, 'publish_failed', { reply_id: reply.id, status: res.status, wb: res.text });
        return res.status === 401 ? 'token' : 'fail';
    }
    await admin.from('akylai_replies')
        .update({ status: 'published', reply_text: text, published_at: new Date().toISOString() }).eq('id', reply.id);
    const { data: count } = await admin.rpc('akylai_bump_published', { p_cabinet_id: reply.cabinet_id });
    const { data: st } = await admin.from('akylai_settings')
        .select('auto_publish, auto_offer_sent').eq('cabinet_id', reply.cabinet_id).maybeSingle();
    if (Number(count) >= AKYLAI_AUTO_OFFER_AFTER && st && !st.auto_publish && !st.auto_offer_sent) {
        await admin.from('akylai_settings').update({ auto_offer_sent: true }).eq('cabinet_id', reply.cabinet_id);
        const { data: chat } = await admin.from('akylai_chats').select('chat_id').eq('cabinet_id', reply.cabinet_id).maybeSingle();
        if (chat) await say(chat.chat_id, BOT_TEXT.autoOffer, { reply_markup: autoOfferKeyboard(reply.cabinet_id) });
    }
    return 'ok';
}

async function handleCallback(admin: any, cq: any) {
    const chatId = Number(cq.message?.chat?.id);
    const messageId = cq.message?.message_id;
    const answer = (text: string) => tg('answerCallbackQuery', { callback_query_id: cq.id, text });
    const cb = parseCallback(cq.data);
    if (!cb || !chatId) return answer('Кнопка устарела');

    if (cb.action === 'auto') {
        if (!(await chatOwnsCabinet(admin, chatId, cb.id))) return answer('Недоступно');
        await admin.from('akylai_settings').update({ auto_publish: true, updated_at: new Date().toISOString() }).eq('cabinet_id', cb.id);
        await agentLog(admin, cb.id, 'auto_publish_on', {});
        await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
        await say(chatId, BOT_TEXT.autoOn);
        return answer('Готово');
    }

    const { data: reply } = await admin.from('akylai_replies')
        .select('id, cabinet_id, feedback_id, reply_text, status').eq('id', cb.id).maybeSingle();
    if (!reply || !(await chatOwnsCabinet(admin, chatId, reply.cabinet_id))) return answer('Недоступно');
    // Атомарный захват: двойное нажатие не опубликует ответ дважды.
    const nextStatus = cb.action === 'edit' ? 'editing' : 'publishing';
    const { data: claimed } = await admin.from('akylai_replies')
        .update({ status: nextStatus }).eq('id', reply.id).eq('status', 'pending').select('id');
    if (!claimed?.length) return answer('Этот отзыв уже обработан');

    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });

    if (cb.action === 'edit') {
        const prompt = await say(chatId, BOT_TEXT.editPrompt, {
            reply_to_message_id: messageId,
            reply_markup: { force_reply: true, input_field_placeholder: 'Новый текст ответа' },
        });
        await admin.from('akylai_replies')
            .update({ status: 'editing', tg_message_id: prompt.data?.result?.message_id ?? null }).eq('id', reply.id);
        return answer('Жду новый текст');
    }

    const r = await publish(admin, reply, reply.reply_text);
    if (r === 'ok') {
        await say(chatId, BOT_TEXT.published, { reply_to_message_id: messageId });
        return answer('Опубликовано');
    }
    // Не вышло — возвращаем статус и кнопки, чтобы можно было повторить.
    await admin.from('akylai_replies').update({ status: 'pending' }).eq('id', reply.id);
    await tg('editMessageReplyMarkup', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[
            { text: 'Опубликовать', callback_data: `ak:pub:${reply.id}` },
            { text: 'Изменить', callback_data: `ak:edit:${reply.id}` },
        ]] },
    });
    await say(chatId, r === 'token'
        ? 'Токен Wildberries перестал работать — обновите его на странице «Агенты» на сайте NR Space.'
        : BOT_TEXT.publishFailed);
    return answer('Не получилось');
}

async function handleEditedText(admin: any, msg: any) {
    const chatId = Number(msg.chat.id);
    const promptId = msg.reply_to_message?.message_id;
    const text = String(msg.text || '').trim();
    if (!promptId || !text) return;

    const { data: reply } = await admin.from('akylai_replies')
        .select('id, cabinet_id, feedback_id, status').eq('status', 'editing').eq('tg_message_id', promptId).maybeSingle();
    if (!reply || !(await chatOwnsCabinet(admin, chatId, reply.cabinet_id))) return;
    if (text.length < 2 || text.length > 1000) {
        await say(chatId, 'Текст ответа должен быть от 2 до 1000 символов. Ответьте на моё сообщение ещё раз.');
        return;
    }
    // Захват editing → publishing: повторный реплай не опубликует дважды.
    const { data: claimed } = await admin.from('akylai_replies')
        .update({ status: 'publishing' }).eq('id', reply.id).eq('status', 'editing').select('id');
    if (!claimed?.length) return;

    const r = await publish(admin, reply, text);
    if (r === 'ok') await say(chatId, BOT_TEXT.published, { reply_to_message_id: msg.message_id });
    else {
        await admin.from('akylai_replies').update({ status: 'editing' }).eq('id', reply.id);
        await say(chatId, r === 'token'
            ? 'Токен Wildberries перестал работать — обновите его на странице «Агенты» на сайте NR Space.'
            : BOT_TEXT.publishFailed);
    }
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return json({ ok: true });

    const secret = env('AKYLAI_WEBHOOK_SECRET');
    const got = (req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '').trim();
    if (!secret || got !== secret) return json({ ok: false }, 401);

    const admin = adminClient();
    const update = await req.json().catch(() => null);
    try {
        if (update?.callback_query) {
            if (update.callback_query.message?.chat?.type === 'private') await handleCallback(admin, update.callback_query);
            return json({ ok: true });
        }

        const member = update?.my_chat_member;
        if (member?.chat?.type === 'private') {
            const status = String(member.new_chat_member?.status || '');
            const blocked = status === 'kicked';
            await admin.from('akylai_chats')
                .update({ blocked, updated_at: new Date().toISOString() }).eq('chat_id', member.chat.id);
            await agentLog(admin, null, blocked ? 'bot_blocked' : 'bot_unblocked', { chat: 'private' });
            return json({ ok: true });
        }

        const msg = update?.message;
        if (!msg || msg.chat?.type !== 'private') return json({ ok: true, ignored: true });
        const text = String(msg.text || '');
        if (text.startsWith('/start')) await handleStart(admin, Number(msg.chat.id), text);
        else if (msg.reply_to_message) await handleEditedText(admin, msg);
        return json({ ok: true });
    } catch (e) {
        console.error('[akylai-bot]', e);
        await agentLog(admin, null, 'bot_crashed', { error: String((e as Error)?.message || e).slice(0, 300) });
        // Telegram повторяет запросы с ошибкой — отвечаем 200, чтобы не зациклиться.
        return json({ ok: true });
    }
});
