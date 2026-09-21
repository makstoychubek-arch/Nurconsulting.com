// Входящие Telegram webhook. JWT выключен — Telegram его не шлёт.
// Реплай на карточку поступления → ответ на вопрос WB.
// Тим-чат: пригласительная ссылка и короткий пинг («алоо»). Иначе молчим.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { applyRestockTelegramReply } from '../_shared/wb-restock-apply.ts';
import { setTelegramReaction, unwrapTelegramMessage } from '../_shared/wb-restock-reply.ts';
import { isTeamChatId, replyTeamChat } from '../_shared/team-chat-invite.ts';

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
    const msg = unwrapTelegramMessage(update);
    if (!msg) return json({ ok: true, ignored: true });

    const reviewsChat = (Deno.env.get('TELEGRAM_CHAT_REVIEWS') ?? '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);
    const replyToken = tokenForBot(botId);
    const teamChat = getTelegramChatId('team');

    const restock = await applyRestockTelegramReply(admin, update, {
        ownerUsername: OWNER,
        reviewsChatId: reviewsChat,
        react: (emoji, messageId) => setTelegramReaction(
            [replyToken, getTelegramToken()],
            msg.chatId,
            messageId,
            emoji,
        ).then(() => undefined),
    });
    if (restock.handled) return json({ ok: true, ...restock });

    if (isTeamChatId(msg.chatId, teamChat)) {
        const { data: cabinets } = await admin.from('cabinets').select('id, name, wb_token');
        const team = await replyTeamChat({ text: msg.text, cabinets: cabinets || [] });
        if (team.text) await sendTelegram(replyToken, msg.chatId, team.text, msg.messageId);
        return json({ ok: true, team: team.kind });
    }

    return json({ ok: true, ignored: 'unknown_chat' });
});

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

function tokenForBot(botId: string): string {
    const key = BOT_TOKEN_ENV[botId];
    const direct = key ? (Deno.env.get(key) ?? '').trim() : '';
    return direct || getTelegramToken();
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
