/** Реплай в Telegram → официальный PATCH /api/v1/questions на WB. */

import { wbError } from './wb-agent-wow.ts';
import {
    answerWbQuestion,
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
        react?: (emoji: string, messageId: number) => Promise<void>;
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
        if (decision.questionId && decision.cabinetId) {
            await admin.from('wb_restock_questions').update({
                error_text: 'need_when_or_text',
                when_text: msg.text.slice(0, 120),
                updated_at: new Date().toISOString(),
            }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);
        }
        await opts.send('завтра / через неделю / через 2 недели', decision.replyToId);
        return { handled: true, kind: 'hint' };
    }

    const { data: cabinet } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', decision.cabinetId)
        .maybeSingle();
    const wbToken = sanitizeWbToken(cabinet?.wb_token);
    if (!wbToken) {
        if (opts.react) await opts.react('👎', decision.replyToId);
        else await opts.send('нет токена', decision.replyToId);
        return { handled: true, kind: 'error', detail: 'no_wb_token' };
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
        if (opts.react) await opts.react('👎', decision.replyToId);
        else await opts.send('не смогла', decision.replyToId);
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

    if (opts.react) await opts.react('❤', decision.replyToId);
    else await opts.send('готово', decision.replyToId);
    return { handled: true, kind: 'answered', detail: decision.via };
}
