// Входящие Telegram webhook. JWT выключен — Telegram его не шлёт.
// Сейчас: реплай на карточку поступления → ответ на вопрос WB.
// Неизвестные чаты игнорируем. Тим-чат не используем, если это не TELEGRAM_CHAT_REVIEWS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramToken } from '../_shared/telegram-routing.ts';
import { wbError } from '../_shared/wb-agent-wow.ts';
import {
    answerWbQuestion,
    buildWbRestockAnswer,
    decideRestockInbound,
    isAllowedRestockChat,
    unwrapTelegramMessage,
    type PendingRestockRow,
} from '../_shared/wb-restock-reply.ts';

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
    if (!msg || msg.isBot) return json({ ok: true, ignored: true });

    const reviewsChat = (Deno.env.get('TELEGRAM_CHAT_REVIEWS') ?? '').trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: pendingRows } = await admin
        .from('wb_restock_questions')
        .select('question_id, cabinet_id, nm_id, article, product, question_text, telegram_message_id, telegram_chat_id')
        .eq('status', 'pending');

    const pending = (pendingRows || []) as Array<PendingRestockRow & { telegram_chat_id?: string | null }>;
    const pendingChats = pending.map((r) => String(r.telegram_chat_id || '')).filter(Boolean);
    if (!isAllowedRestockChat(msg.chatId, reviewsChat, pendingChats)) {
        return json({ ok: true, ignored: 'unknown_chat' });
    }

    const decision = decideRestockInbound({
        chatId: msg.chatId,
        messageId: msg.messageId,
        text: msg.text,
        fromUsername: msg.fromUsername,
        ownerUsername: OWNER,
        replyToText: msg.replyToText,
        replyToMessageId: msg.replyToMessageId,
        pending,
    });

    const replyToken = tokenForBot(botId);
    if (decision.action === 'ignore') return json({ ok: true, ignored: true });

    if (decision.action === 'hint') {
        await reactTelegram(replyToken, decision.chatId, decision.replyToId, '👎');
        return json({ ok: true, hint: true });
    }

    const { data: cabinet } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', decision.cabinetId)
        .maybeSingle();
    const wbToken = sanitizeWbToken(cabinet?.wb_token);
    if (!wbToken) {
        await reactTelegram(replyToken, decision.chatId, decision.replyToId, '👎');
        return json({ ok: false, error: 'no_wb_token' });
    }

    const answer = decision.wbText || buildWbRestockAnswer(decision.when);
    const posted = await answerWbQuestion(wbToken, decision.questionId, answer);
    if (!posted.ok) {
        const err = wbError(posted);
        await admin.from('wb_restock_questions').update({
            error_text: err,
            when_text: decision.when,
            wb_answer: answer,
            updated_at: new Date().toISOString(),
        }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);
        await reactTelegram(replyToken, decision.chatId, decision.replyToId, '👎');
        return json({ ok: false, error: err });
    }

    await admin.from('wb_restock_questions').update({
        status: 'answered',
        when_text: decision.when,
        wb_answer: answer,
        error_text: null,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);

    await reactTelegram(replyToken, decision.chatId, decision.replyToId, '❤');
    return json({ ok: true, answered: true, via: decision.via, question_id: decision.questionId });
});

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

async function reactTelegram(token: string, chatId: string, messageId?: number, emoji = '❤'): Promise<void> {
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
        // webhook must still 200
    }
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
