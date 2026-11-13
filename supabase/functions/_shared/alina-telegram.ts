import { getAdminClient } from './alina-db.ts';
import { parseAlinaBusinessUpdate } from './alina-business-update.ts';
import { handleAlinaClientMessage, logAlinaRawEvent, type AlinaReply } from './alina-selfbuy.ts';

type BotId = 'alina' | 'alina2';
type ClientUpdate = Extract<NonNullable<ReturnType<typeof parseAlinaBusinessUpdate>>, { kind: 'client' }>;

export async function processAlinaTelegramUpdate(
    botId: BotId,
    envToken: string,
    update: Parameters<typeof parseAlinaBusinessUpdate>[0],
): Promise<void> {
    const message = parseAlinaBusinessUpdate(update);
    if (!message) return;
    const admin = getAdminClient();
    const { data: bot, error: botError } = await admin.from('telegram_bots')
        .select('is_enabled, deleted_at').eq('id', botId).maybeSingle();
    if (botError) throw new Error('Alina bot registry is unavailable');
    if (!bot?.is_enabled || bot.deleted_at) return;
    if (message.kind === 'owner') {
        await logAlinaRawEvent(message.chatId, 'owner_message', { message_id: message.messageId });
        return;
    }

    const { data: credentials } = await admin.from('telegram_bot_secrets')
        .select('token').eq('bot_id', botId).maybeSingle();
    const token = String(credentials?.token || envToken).trim();
    if (!token) return;

    const delivery = { bot_id: botId, update_id: message.updateId };
    const { error } = await admin.from('alina_selfbuy_events').insert({
        event_type: 'telegram_delivery',
        chat_id: message.chatId,
        payload: delivery,
    });
    if (error?.code === '23505') return;
    if (error) throw new Error('Alina event storage is unavailable');

    try {
        const { replies, photos } = await handleAlinaClientMessage({
            ...message,
            hasPhoto: Boolean(message.photoFileId),
            botToken: token,
            sourceAccount: 'business',
        });
        for (const photo of photos || []) {
            if (!await sendPhoto(token, message, photo)) {
                const fallback = [photo.caption, photo.url].filter(Boolean).join('\n');
                if (fallback && !await sendText(token, message, fallback)) {
                    throw new Error('photo_fallback');
                }
            }
        }
        for (const reply of replies) {
            if (!await sendText(token, message, reply)) throw new Error('text_delivery');
        }
        await logAlinaRawEvent(message.chatId, 'business_out', {
            ...delivery,
            messages: replies.length,
            photos: photos?.length || 0,
        });
    } catch {
        // The CRM may already have advanced. Replaying the update could advance it twice.
        await logAlinaRawEvent(message.chatId, 'business_error', delivery);
        console.error('[alina] Telegram update failed after being claimed');
    }
}

async function sendText(token: string, message: ClientUpdate, text: string): Promise<boolean> {
    return telegramSend(token, 'sendMessage', JSON.stringify({
        chat_id: message.chatId,
        business_connection_id: message.connectionId,
        text,
    }));
}

async function sendPhoto(
    token: string,
    message: ClientUpdate,
    photo: NonNullable<AlinaReply['photos']>[number],
): Promise<boolean> {
    const form = new FormData();
    form.set('chat_id', String(message.chatId));
    form.set('business_connection_id', message.connectionId);
    if (photo.caption) form.set('caption', photo.caption);
    if (photo.bytes) {
        form.set('photo', new Blob([new Uint8Array(photo.bytes)], { type: photo.mime }), photo.filename || 'product.jpg');
    } else if (photo.url) {
        form.set('photo', photo.url);
    } else {
        return false;
    }
    return telegramSend(token, 'sendPhoto', form);
}

async function telegramSend(token: string, method: string, body: string | FormData): Promise<boolean> {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
        signal: AbortSignal.timeout(10_000),
        body,
    }).catch(() => null);
    if (!response?.ok) return false;
    return (await response.json().catch(() => null))?.ok === true;
}
