// Входящие Telegram webhook. JWT выключен — Telegram его не шлёт.
// Реплай «через неделю» на карточку поступления или отзыв → ответ на WB.
// Агентский telegram-router на проде не подменяем этим файлом, если там Карина.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramToken } from '../_shared/telegram-routing.ts';
import { applyRestockTelegramReply } from '../_shared/wb-restock-apply.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
};

const OWNER = (Deno.env.get('TELEGRAM_ALERT_USERNAME') || 'maraWuW').replace(/^@/, '');

const BOT_TOKEN_ENV: Record<string, string> = {
    notify: 'TELEGRAM_BOT_TOKEN',
    karina: 'KARINA_BOT_TOKEN',
    saule: 'SAULE_BOT_TOKEN',
    amina: 'AMINA_BOT_TOKEN',
    anton: 'ANTON_BOT_TOKEN',
    alina: 'ALINA_BOT_TOKEN',
    alina2: 'ALINA_SECOND_BOT_TOKEN',
    muha: 'MUHA_BOT_TOKEN',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const url = new URL(req.url);
    const botId = (url.searchParams.get('bot') || 'notify').toLowerCase();

    if (req.method === 'GET') {
        return json({ ok: true, bot: botId, restock: true });
    }

    const expectedSecret = (Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '').trim();
    const gotSecret = (req.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '').trim();
    if (expectedSecret && gotSecret !== expectedSecret) {
        return json({ ok: false, error: 'bad_secret' }, 401);
    }

    const update = await req.json().catch(() => null);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);
    const replyToken = tokenForBot(botId);

    const result = await applyRestockTelegramReply(admin, update, {
        ownerUsername: OWNER,
        reviewsChatId: (Deno.env.get('TELEGRAM_CHAT_REVIEWS') ?? '').trim(),
        send: (text, replyToId) => sendTelegram(replyToken, extractChatId(update), text, replyToId),
        react: (emoji, messageId) => reactMessage(replyToken, extractChatId(update), messageId, emoji),
    });

    return json({ ok: true, ...result });
});

function extractChatId(update: unknown): string {
    const rec = update && typeof update === 'object' ? update as Record<string, unknown> : {};
    const msg = (rec.message || rec.edited_message) && typeof (rec.message || rec.edited_message) === 'object'
        ? (rec.message || rec.edited_message) as Record<string, unknown>
        : {};
    const chat = msg.chat && typeof msg.chat === 'object' ? msg.chat as Record<string, unknown> : {};
    return String(chat.id ?? '').trim();
}

function tokenForBot(botId: string): string {
    const key = BOT_TOKEN_ENV[botId];
    const direct = key ? (Deno.env.get(key) ?? '').trim() : '';
    return direct || getTelegramToken();
}

async function sendTelegram(token: string, chatId: string, text: string, replyTo?: number): Promise<void> {
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                reply_to_message_id: replyTo || undefined,
                disable_web_page_preview: true,
            }),
        });
    } catch {
        // webhook must still 200
    }
}

async function reactMessage(token: string, chatId: string, messageId: number, emoji: string): Promise<void> {
    if (!token || !chatId || !messageId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                reaction: [{ type: 'emoji', emoji }],
            }),
        });
    } catch {
        // ignore
    }
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
