/** Реплай в Telegram → ответ на вопрос или отзыв WB про поступление. */

import { FEEDBACKS_API, wbError, wbSend } from './wb-agent-wow.ts';
import {
    answerWbFeedback,
    answerWbQuestion,
    buildWbRestockAnswer,
    collectFeedbacks,
    collectQuestions,
    decideRestockInbound,
    isAllowedRestockChat,
    isRestockQuestion,
    looksLikeRestockCard,
    matchPendingByText,
    unwrapTelegramMessage,
    type PendingRestockRow,
    type RestockKind,
} from './wb-restock-reply.ts';

export type RestockApplyResult =
    | { handled: false }
    | { handled: true; kind: 'hint' | 'answered' | 'error'; detail?: string };

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

type Target = {
    cabinetId: string;
    id: string;
    kind: RestockKind;
};

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
        .select('question_id, cabinet_id, nm_id, article, product, question_text, telegram_message_id, telegram_chat_id, kind')
        .eq('status', 'pending');

    const pending = (pendingRows || []) as Array<PendingRestockRow & { telegram_chat_id?: string | null }>;
    const pendingChats = pending.map((r) => String(r.telegram_chat_id || '')).filter(Boolean);
    const allowed = isAllowedRestockChat(msg.chatId, opts.reviewsChatId, pendingChats)
        || looksLikeRestockCard(msg.replyToText);
    if (!allowed) return { handled: false };

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
        await opts.send('завтра / через неделю / через 2 недели', decision.replyToId);
        return { handled: true, kind: 'hint' };
    }

    let target: Target | null = null;
    let when = '';
    let replyToId = msg.messageId;

    if (decision.action === 'answer') {
        when = decision.when;
        replyToId = decision.replyToId;
        target = {
            cabinetId: decision.cabinetId,
            id: decision.questionId,
            kind: decision.kind === 'feedback' ? 'feedback' : 'question',
        };
        const row = pending.find((r) => r.question_id === decision.questionId);
        if (row?.kind === 'feedback') target.kind = 'feedback';
    } else {
        when = decision.when;
        replyToId = decision.replyToId;
        target = await resolveRestockTarget(admin, pending, decision.haystack, msg.replyToMessageId);
    }

    if (!target) {
        await opts.send('не нашла этот вопрос на WB — напишите ещё раз реплаем на карточку', replyToId);
        return { handled: true, kind: 'error', detail: 'not_found' };
    }

    const { data: cabinet } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', target.cabinetId)
        .maybeSingle();
    const wbToken = sanitizeWbToken(cabinet?.wb_token);
    if (!wbToken) {
        if (opts.react) await opts.react('👎', replyToId);
        await opts.send('нет токена WB у кабинета', replyToId);
        return { handled: true, kind: 'error', detail: 'no_wb_token' };
    }

    const answer = buildWbRestockAnswer(when);
    const posted = target.kind === 'feedback'
        ? await answerWbFeedback(wbToken, target.id, answer)
        : await answerWbQuestion(wbToken, target.id, answer);

    if (!posted.ok) {
        const err = wbError(posted);
        await admin.from('wb_restock_questions').upsert({
            cabinet_id: target.cabinetId,
            question_id: target.id,
            status: 'pending',
            error_text: err,
            when_text: when,
            wb_answer: answer,
            telegram_chat_id: msg.chatId,
            telegram_message_id: msg.replyToMessageId,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'cabinet_id,question_id' });
        if (opts.react) await opts.react('👎', replyToId);
        await opts.send(`не смогла ответить на WB: ${err}`, replyToId);
        return { handled: true, kind: 'error', detail: err };
    }

    await admin.from('wb_restock_questions').upsert({
        cabinet_id: target.cabinetId,
        question_id: target.id,
        status: 'answered',
        when_text: when,
        wb_answer: answer,
        error_text: null,
        telegram_chat_id: msg.chatId,
        telegram_message_id: msg.replyToMessageId,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'cabinet_id,question_id' });

    if (opts.react) await opts.react('❤', replyToId);
    await opts.send(`Готово. На WB ушёл ответ:\n${answer}`, replyToId);
    return { handled: true, kind: 'answered', detail: target.kind };
}

// deno-lint-ignore no-explicit-any
async function resolveRestockTarget(
    admin: any,
    pending: PendingRestockRow[],
    haystack: string,
    replyToMessageId: number | null,
): Promise<Target | null> {
    const byPending = matchPendingByText(haystack, pending);
    const row = pending.find((r) => r.question_id === byPending);
    if (row) {
        return {
            cabinetId: row.cabinet_id,
            id: row.question_id,
            kind: row.kind === 'feedback' ? 'feedback' : 'question',
        };
    }

    if (replyToMessageId) {
        try {
            const log = await admin
                .from('review_reply_log')
                .select('cabinet_id, review_text, nm_id, product_name')
                .eq('tg_message_id', replyToMessageId)
                .maybeSingle();
            const hit = log?.data as { cabinet_id?: string; review_text?: string; nm_id?: number | null; product_name?: string | null } | null;
            if (hit?.review_text) {
                haystack = `${haystack}\n${hit.review_text}\n${hit.product_name || ''}\n${hit.nm_id || ''}`;
            }
        } catch {
            // таблица модерации отзывов может отсутствовать
        }
    }

    const { data: cabinets } = await admin
        .from('cabinets')
        .select('id, wb_token')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');

    for (const cab of cabinets || []) {
        const token = sanitizeWbToken(cab.wb_token);
        if (!token) continue;
        const fb = await wbSend(
            `${FEEDBACKS_API}/api/v1/feedbacks?isAnswered=false&take=50&skip=0&order=dateDesc`,
            token,
        );
        if (fb.ok) {
            const list = collectFeedbacks(fb.data).filter((q) => isRestockQuestion(q.text));
            const id = matchPendingByText(haystack, list.map((q) => ({
                question_id: q.id,
                nm_id: q.nmId,
                article: q.article,
                product: q.product,
                question_text: q.text,
            })));
            if (id) return { cabinetId: cab.id, id, kind: 'feedback' };
            const exact = list.find((q) => haystack.includes(q.text.slice(0, 40)) || (q.text && haystack.includes(q.text.slice(0, 24))));
            if (exact) return { cabinetId: cab.id, id: exact.id, kind: 'feedback' };
        }
        const qs = await wbSend(
            `${FEEDBACKS_API}/api/v1/questions?isAnswered=false&take=50&skip=0&order=dateDesc`,
            token,
        );
        if (qs.ok) {
            const list = collectQuestions(qs.data).filter((q) => isRestockQuestion(q.text));
            const id = matchPendingByText(haystack, list.map((q) => ({
                question_id: q.id,
                nm_id: q.nmId,
                article: q.article,
                product: q.product,
                question_text: q.text,
            })));
            if (id) return { cabinetId: cab.id, id, kind: 'question' };
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return null;
}
