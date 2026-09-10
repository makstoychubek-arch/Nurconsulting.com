/** Общий шаг: короткий реплай в Telegram → POST questions/answer на WB. */

import { FEEDBACKS_API, wbError, wbSend } from './wb-agent-wow.ts';
import {
    buildWbRestockAnswer,
    decideRestockInbound,
    isAllowedRestockChat,
    unwrapTelegramMessage,
    type PendingRestockRow,
} from './wb-restock-reply.ts';

export type RestockApplyResult =
    | { handled: false }
    | { handled: true; kind: 'hint' | 'answered' | 'error'; detail?: string };

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

// deno-lint-ignore no-explicit-any
export async function applyRestockTelegramReply(
    admin: any,
    update: unknown,
    opts: {
        ownerUsername: string;
        reviewsChatId: string;
        send: (text: string, replyToId: number) => Promise<void>;
    },
): Promise<RestockApplyResult> {
    const msg = unwrapTelegramMessage(update);
    if (!msg || msg.isBot) return { handled: false };

    const { data: pendingRows } = await admin
        .from('wb_restock_questions')
        .select('question_id, cabinet_id, nm_id, article, product, question_text, telegram_message_id, telegram_chat_id')
        .eq('status', 'pending');

    const pending = (pendingRows || []) as Array<PendingRestockRow & { telegram_chat_id?: string | null }>;
    const pendingChats = pending.map((r) => String(r.telegram_chat_id || '')).filter(Boolean);
    if (!isAllowedRestockChat(msg.chatId, opts.reviewsChatId, pendingChats)) {
        return { handled: false };
    }

    const decision = decideRestockInbound({
        chatId: msg.chatId,
        messageId: msg.messageId,
        text: msg.text,
        fromUsername: msg.fromUsername,
        ownerUsername: opts.ownerUsername,
        replyToText: msg.replyToText,
        replyToMessageId: msg.replyToMessageId,
        pending,
    });

    if (decision.action === 'ignore') return { handled: false };
    if (decision.action === 'hint') {
        await opts.send('Напишите реплаем одно: завтра / через неделю / через 2 недели', decision.replyToId);
        return { handled: true, kind: 'hint' };
    }

    const { data: cabinet } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', decision.cabinetId)
        .maybeSingle();
    const wbToken = sanitizeWbToken(cabinet?.wb_token);
    if (!wbToken) {
        await opts.send('Нет токена WB у кабинета — ответить на вопрос не могу.', decision.replyToId);
        return { handled: true, kind: 'error', detail: 'no_wb_token' };
    }

    const answer = buildWbRestockAnswer(decision.when);
    const posted = await wbSend(`${FEEDBACKS_API}/api/v1/questions/answer`, wbToken, 'POST', {
        id: decision.questionId,
        text: answer,
    });
    if (!posted.ok) {
        const err = wbError(posted);
        await admin.from('wb_restock_questions').update({
            error_text: err,
            when_text: decision.when,
            wb_answer: answer,
            updated_at: new Date().toISOString(),
        }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);
        await opts.send(`Не смог ответить на WB: ${err}`, decision.replyToId);
        return { handled: true, kind: 'error', detail: err };
    }

    await admin.from('wb_restock_questions').update({
        status: 'answered',
        when_text: decision.when,
        wb_answer: answer,
        error_text: null,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);

    await opts.send(`Готово. На WB ушёл ответ:\n${answer}`, decision.replyToId);
    return { handled: true, kind: 'answered', detail: decision.via };
}
