/** Реплай в Telegram → официальный PATCH /api/v1/questions на WB. */

import { wbError } from './wb-agent-wow.ts';
import {
    answerWbQuestion,
    buildWbRestockAnswer,
    decideRestockInbound,
    extractRestockWhen,
    isAllowedRestockChat,
    isRestockCardText,
    isRestockInboundCandidate,
    peelCardAndAnswer,
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

const PENDING_FIELDS =
    'question_id, cabinet_id, nm_id, article, product, question_text, telegram_message_id, telegram_chat_id, status';

// deno-lint-ignore no-explicit-any
export async function applyRestockTelegramReply(
    admin: any,
    update: unknown,
    opts: {
        ownerUsername: string;
        reviewsChatId: string;
        send?: (text: string, replyToId: number) => Promise<void>;
        react?: (emoji: string, messageId: number) => Promise<void>;
    },
): Promise<RestockApplyResult> {
    const msg = unwrapTelegramMessage(update);
    if (!msg || !isRestockInboundCandidate(msg)) return { handled: false };

    const { data: pendingRows, error: pendingErr } = await admin
        .from('wb_restock_questions')
        .select(PENDING_FIELDS)
        .in('status', ['pending', 'answered']);
    if (pendingErr) {
        console.warn('[restock] pending select', pendingErr.message);
    }

    let pending = (pendingRows || []) as Array<PendingRestockRow & { telegram_chat_id?: string | null }>;

    // Реплай на уже закрытую карточку (автоответ / WB ушло, ❤ не встало) — подмешиваем эту строку.
    // В комментариях к каналу message_id копии ≠ id поста — берём и origin.
    const replyIds = (msg.replyToMessageIds && msg.replyToMessageIds.length)
        ? msg.replyToMessageIds
        : (msg.replyToMessageId ? [msg.replyToMessageId] : []);
    let extraFound = false;
    if (replyIds.length) {
        const { data: byId } = await admin
            .from('wb_restock_questions')
            .select(PENDING_FIELDS)
            .in('telegram_message_id', replyIds);
        for (const extra of (byId || []) as Array<PendingRestockRow & { telegram_chat_id?: string | null }>) {
            if (
                extra?.question_id &&
                !pending.some((r) => r.question_id === extra.question_id && r.cabinet_id === extra.cabinet_id)
            ) {
                pending = [...pending, extra];
            }
            if (extra?.question_id) extraFound = true;
        }
    }

    const pendingChats = pending.map((r) => String(r.telegram_chat_id || '')).filter(Boolean);
    const cardReply = isRestockCardText(msg.replyToText) || Boolean(peelCardAndAnswer(msg.text));
    if (!isAllowedRestockChat(msg.chatId, opts.reviewsChatId, pendingChats) && !cardReply && !extraFound) {
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
        replyToMessageIds: replyIds,
        pending,
    });

    if (decision.action === 'ignore') {
        if (isRestockCardText(msg.replyToText) || extractRestockWhen(msg.text)) {
            console.warn('[restock] ignore', msg.text.slice(0, 80), 'reply_to', msg.replyToMessageId);
        }
        return { handled: false };
    }

    if (decision.action === 'hint' || decision.action === 'unmatched') {
        if (decision.action === 'hint' && decision.questionId && decision.cabinetId) {
            await admin.from('wb_restock_questions').update({
                error_text: 'need_when_or_text',
                when_text: msg.text.slice(0, 120),
                updated_at: new Date().toISOString(),
            }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);
        }
        if (decision.action === 'unmatched') {
            console.warn('[restock] unmatched card reply', msg.text.slice(0, 80));
        }
        if (opts.react) await opts.react('👎', decision.replyToId);
        return { handled: true, kind: 'hint', detail: decision.action };
    }

    const row = pending.find((r) => (
        r.question_id === decision.questionId && r.cabinet_id === decision.cabinetId
    ));
    const alreadyAnswered = row?.status === 'answered';

    const { data: cabinet } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', decision.cabinetId)
        .maybeSingle();
    const wbToken = sanitizeWbToken(cabinet?.wb_token);
    if (!wbToken) {
        if (opts.react) await opts.react('👎', decision.replyToId);
        return {
            handled: true,
            kind: 'error',
            detail: 'no_wb_token',
        };
    }

    const answer = decision.wbText || buildWbRestockAnswer(decision.when);
    const posted = await answerWbQuestion(wbToken, decision.questionId, answer, { acceptAlready: false });
    if (!posted.ok) {
        const err = wbError(posted);
        await admin.from('wb_restock_questions').update({
            error_text: err,
            when_text: decision.when,
            wb_answer: answer,
            updated_at: new Date().toISOString(),
        }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);
        if (opts.react) await opts.react('👎', decision.replyToId);
        return { handled: true, kind: 'error', detail: err };
    }

    await admin.from('wb_restock_questions').update({
        status: 'answered',
        when_text: decision.when,
        wb_answer: answer,
        error_text: null,
        ...(alreadyAnswered ? {} : { answered_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
    }).eq('cabinet_id', decision.cabinetId).eq('question_id', decision.questionId);

    if (opts.react) await opts.react('❤', decision.replyToId);
    return { handled: true, kind: 'answered', detail: alreadyAnswered ? 'already_answered' : decision.via };
}
