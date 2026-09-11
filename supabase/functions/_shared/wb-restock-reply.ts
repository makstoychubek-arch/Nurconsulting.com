/** Вопросы WB «когда поступит?» → короткий реплай в Telegram → ответ покупателю. */

import { FEEDBACKS_API, wbSend } from './wb-agent-wow.ts';

export const RESTOCK_CARD_MARK = '#nrq';

const RESTOCK_RE =
    /поступл|в наличии|когда будет|когда появи|ожидается|ожидаете|будет ли|нет размера|restock|поставк|приедет|привезут|когда ждать|ждём|ждем\b/i;

const WHEN_RES: RegExp[] = [
    /через\s+\d+\s*(?:день|дня|дней|неделю|недели|недель|месяц|месяца|месяцев)/i,
    /через\s+(?:пару|несколько)\s+(?:дней|недель)/i,
    /через\s+(?:неделю|две\s+недели|три\s+недели|месяц)/i,
    /на\s+следующей\s+неделе/i,
    /послезавтра/i,
    /завтра/i,
    /\b\d+\s*(?:день|дня|дней|неделю|недели|недель)\b/i,
];

export type RestockQuestion = {
    id: string;
    text: string;
    nmId: number;
    article: string;
    product: string;
    createdDate: string;
};

export type RestockCardMeta = {
    questionId: string;
    cabinetId: string;
};

export type PendingRestockRow = {
    question_id: string;
    cabinet_id: string;
    nm_id?: number | null;
    article?: string | null;
    product?: string | null;
    question_text?: string | null;
    telegram_message_id?: number | null;
};

export type RestockInboundDecision =
    | { action: 'ignore' }
    | {
        action: 'hint';
        chatId: string;
        replyToId: number;
        questionId?: string;
        cabinetId?: string;
    }
    | {
        action: 'answer';
        questionId: string;
        cabinetId: string;
        when: string;
        wbText: string;
        chatId: string;
        replyToId: number;
        via: 'card_meta' | 'tg_message' | 'pending_match' | 'single_pending';
    };

export function normalizeReply(raw: string): string {
    return String(raw || '').replace(/\s+/g, ' ').trim();
}

export function isRestockQuestion(text: string): boolean {
    return RESTOCK_RE.test(String(text || ''));
}

export function extractRestockWhen(raw: string): string | null {
    const t = normalizeReply(raw);
    if (!t) return null;
    for (const re of WHEN_RES) {
        const m = t.match(re);
        if (m) return normalizeWhenPhrase(m[0]);
    }
    return null;
}

export function isWhenOnlyReply(raw: string): boolean {
    const when = extractRestockWhen(raw);
    if (!when) return false;
    const rest = normalizeReply(raw)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(when.toLowerCase().replace(/ё/g, 'е'), '')
        .replace(/пожалуйста|плиз|please|ок+|да+|хорошо|ладно|[.!?,@]/gi, '')
        .trim();
    return rest.length <= 16;
}

export function normalizeWhenPhrase(raw: string): string {
    const phrase = normalizeReply(raw).replace(/[.]+$/, '');
    if (!phrase) return '';
    return phrase.charAt(0).toLocaleLowerCase('ru-RU') + phrase.slice(1);
}

export function buildWbRestockAnswer(when: string): string {
    return `Здравствуйте, этот товар будет в наличии ${normalizeWhenPhrase(when)}.`;
}

/** Срок → шаблон; свой текст реплая на карточку уходит на WB как есть. */
export function resolveRestockAnswer(raw: string): { when: string; wbText: string } | null {
    const text = normalizeReply(raw);
    if (!text) return null;
    const when = extractRestockWhen(text);
    if (when) return { when, wbText: buildWbRestockAnswer(when) };
    const words = text.split(/\s+/).filter(Boolean);
    if (text.length < 8 && words.length < 3) return null;
    return { when: text.slice(0, 120), wbText: text };
}

export function cabinetLegalName(name: string): string {
    const raw = String(name || '').trim();
    if (!raw) return 'Кабинет';
    if (/zevina\s*2|зевин[аa]?\s*2/i.test(raw)) return 'ОсОО «Айлин Стиль»';
    if (/zevina|зевин|ailin|уркунбаев/i.test(raw)) return 'ИП Уркунбаев К.А.';
    if (/elium|элиум|айзада/i.test(raw)) return 'ИП Айзада';
    if (/^baza$|^baz\.a$|бейшеев/i.test(raw)) return 'ИП Бейшеев А.Д.';
    return raw;
}

/** Официальный GET /api/v1/new-feedbacks-questions — только флаги, не список. */
export type NewFeedbacksQuestions = {
    hasNewQuestions: boolean;
    hasNewFeedbacks: boolean;
};

export function parseNewFeedbacksQuestions(payload: unknown): NewFeedbacksQuestions {
    const rec = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const inner = rec.data && typeof rec.data === 'object' ? rec.data as Record<string, unknown> : rec;
    return {
        hasNewQuestions: inner.hasNewQuestions === true,
        hasNewFeedbacks: inner.hasNewFeedbacks === true,
    };
}

export function collectQuestions(payload: unknown): RestockQuestion[] {
    const rec = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const inner = rec.data && typeof rec.data === 'object' ? rec.data as Record<string, unknown> : rec;
    const list = Array.isArray(inner.questions)
        ? inner.questions
        : Array.isArray(rec.questions)
            ? rec.questions
            : [];
    const out: RestockQuestion[] = [];
    for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const q = row as Record<string, unknown>;
        const pd = q.productDetails && typeof q.productDetails === 'object'
            ? q.productDetails as Record<string, unknown>
            : (q.product && typeof q.product === 'object' ? q.product as Record<string, unknown> : {});
        const id = String(q.id || q.questionId || '').trim();
        if (!id) continue;
        out.push({
            id,
            text: String(q.text || q.questionText || '').trim(),
            nmId: Number(pd.nmId || pd.nmID || q.nmId || 0) || 0,
            article: String(pd.supplierArticle || pd.vendorCode || pd.sa_name || '').trim(),
            product: String(pd.nmName || pd.productName || q.productName || '').trim(),
            createdDate: String(q.createdDate || q.createdAt || '').trim(),
        });
    }
    return out;
}

export function pickRestockQuestions(payload: unknown, maxAgeDays = 45): RestockQuestion[] {
    return collectQuestions(payload).filter((q) => (
        isRestockQuestion(q.text) && isFreshQuestion(q.createdDate, maxAgeDays)
    ));
}

export function isFreshQuestion(createdDate: string, maxAgeDays = 45): boolean {
    if (!createdDate) return true;
    const ms = Date.parse(createdDate);
    if (!Number.isFinite(ms)) return true;
    return (Date.now() - ms) <= maxAgeDays * 86400000;
}

export function shortQuestionQuote(text: string): string {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(здравствуйте|добрый день|добрый вечер|доброе утро)[!.\s,]*/i, '')
        .trim()
        .slice(0, 140);
}

export function formatRestockTelegramCard(opts: {
    cabinetName: string;
    cabinetId: string;
    question: RestockQuestion;
    mention?: string;
}): string {
    const q = opts.question;
    const who = opts.mention ? `${opts.mention} ` : '';
    const name = String(q.article || q.product || '').trim() || (q.nmId ? String(q.nmId) : 'товар');
    const ask = shortQuestionQuote(q.text);
    const lines = [`${who}поступление`, name];
    if (ask) lines.push(`«${ask}»`);
    return lines.join('\n');
}

export function wbQuestionAnswerPayload(id: string, text: string) {
    return {
        id: String(id || '').trim(),
        answer: { text: String(text || '').trim() },
        state: 'wbRu',
    };
}

export async function answerWbQuestion(token: string, id: string, text: string) {
    const url = `${FEEDBACKS_API}/api/v1/questions`;
    const payload = wbQuestionAnswerPayload(id, text);
    const first = await wbSend(url, token, 'PATCH', payload);
    if (first.ok) return first;
    const raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
    if (!raw) return first;
    const retry = await wbSend(url, `Bearer ${raw}`, 'PATCH', payload);
    return retry.ok || retry.status !== first.status ? retry : first;
}

export function parseRestockCardMeta(text: string): RestockCardMeta | null {
    const t = String(text || '');
    const m = t.match(/#nrq\s+q=([^\s]+)\s+c=([0-9a-f-]{8,})/i);
    if (!m) return null;
    return { questionId: m[1], cabinetId: m[2] };
}

export function matchPendingByText(
    haystack: string,
    rows: Array<{ question_id: string; nm_id?: number | null; article?: string | null; product?: string | null; question_text?: string | null }>,
): string | null {
    const h = String(haystack || '').toLowerCase();
    if (!h || !rows.length) return null;
    let best: { id: string; score: number } | null = null;
    for (const row of rows) {
        let score = 0;
        if (row.nm_id && h.includes(String(row.nm_id))) score += 5;
        const art = String(row.article || '').toLowerCase();
        if (art && h.includes(art)) score += 4;
        const product = String(row.product || '').toLowerCase();
        for (const w of product.split(/[^a-zа-я0-9]+/i).filter((x) => x.length >= 5)) {
            if (h.includes(w)) score += 1;
        }
        const qtext = String(row.question_text || '').toLowerCase();
        for (const w of qtext.split(/[^a-zа-я0-9]+/i).filter((x) => x.length >= 6)) {
            if (h.includes(w)) score += 1;
        }
        if (score > 0 && (!best || score > best.score)) best = { id: row.question_id, score };
    }
    return best && best.score >= 2 ? best.id : null;
}

export function ownerMention(username: string): string {
    const u = String(username || '').replace(/^@/, '').trim();
    return u ? `@${u}` : '';
}

export function isAllowedRestockChat(
    chatId: string,
    reviewsChatId: string,
    pendingChatIds: string[] = [],
): boolean {
    const id = String(chatId || '').trim();
    if (!id) return false;
    const norm = (v: string) => String(v || '').trim().replace(/^-/, '');
    const nid = norm(id);
    const reviews = String(reviewsChatId || '').trim();
    if (reviews && (id === reviews || nid === norm(reviews))) return true;
    return pendingChatIds.some((c) => {
        const raw = String(c || '').trim();
        return raw && (raw === id || norm(raw) === nid);
    });
}

export function unwrapTelegramMessage(update: unknown): {
    chatId: string;
    messageId: number;
    text: string;
    fromUsername: string;
    replyToText: string;
    replyToMessageId: number | null;
    isBot: boolean;
} | null {
    const rec = update && typeof update === 'object' ? update as Record<string, unknown> : {};
    const msg = (rec.message || rec.edited_message) && typeof (rec.message || rec.edited_message) === 'object'
        ? (rec.message || rec.edited_message) as Record<string, unknown>
        : null;
    if (!msg) return null;
    const chat = msg.chat && typeof msg.chat === 'object' ? msg.chat as Record<string, unknown> : {};
    const from = msg.from && typeof msg.from === 'object' ? msg.from as Record<string, unknown> : {};
    const reply = msg.reply_to_message && typeof msg.reply_to_message === 'object'
        ? msg.reply_to_message as Record<string, unknown>
        : {};
    const chatId = String(chat.id ?? '').trim();
    const messageId = Number(msg.message_id || 0);
    if (!chatId || !messageId) return null;
    return {
        chatId,
        messageId,
        text: String(msg.text || msg.caption || ''),
        fromUsername: String(from.username || ''),
        replyToText: String(reply.text || reply.caption || ''),
        replyToMessageId: Number(reply.message_id || 0) || null,
        isBot: from.is_bot === true,
    };
}

export function decideRestockInbound(input: {
    chatId: string;
    messageId: number;
    text: string;
    fromUsername: string;
    ownerUsername: string;
    replyToText: string;
    replyToMessageId: number | null;
    pending: PendingRestockRow[];
}): RestockInboundDecision {
    const chatId = String(input.chatId || '');
    const replyToId = input.messageId;
    const resolved = resolveRestockAnswer(input.text);
    const meta = parseRestockCardMeta(input.replyToText);

    if (meta) {
        if (!resolved) {
            return {
                action: 'hint',
                chatId,
                replyToId,
                questionId: meta.questionId,
                cabinetId: meta.cabinetId,
            };
        }
        return {
            action: 'answer',
            questionId: meta.questionId,
            cabinetId: meta.cabinetId,
            when: resolved.when,
            wbText: resolved.wbText,
            chatId,
            replyToId,
            via: 'card_meta',
        };
    }

    const byTg = input.replyToMessageId
        ? input.pending.find((r) => Number(r.telegram_message_id) === Number(input.replyToMessageId))
        : null;
    if (byTg) {
        if (!resolved) {
            return {
                action: 'hint',
                chatId,
                replyToId,
                questionId: byTg.question_id,
                cabinetId: byTg.cabinet_id,
            };
        }
        return {
            action: 'answer',
            questionId: byTg.question_id,
            cabinetId: byTg.cabinet_id,
            when: resolved.when,
            wbText: resolved.wbText,
            chatId,
            replyToId,
            via: 'tg_message',
        };
    }

    if (input.replyToMessageId && resolved) {
        const matched = matchPendingByText(input.replyToText, input.pending);
        const row = input.pending.find((r) => r.question_id === matched);
        if (row) {
            return {
                action: 'answer',
                questionId: row.question_id,
                cabinetId: row.cabinet_id,
                when: resolved.when,
                wbText: resolved.wbText,
                chatId,
                replyToId,
                via: 'pending_match',
            };
        }
    }

    const owner = String(input.ownerUsername || '').replace(/^@/, '').toLowerCase();
    const from = String(input.fromUsername || '').replace(/^@/, '').toLowerCase();
    const fromOwner = Boolean(owner && from && owner === from);

    if (fromOwner && isWhenOnlyReply(input.text) && resolved) {
        if (input.pending.length === 1) {
            const row = input.pending[0];
            return {
                action: 'answer',
                questionId: row.question_id,
                cabinetId: row.cabinet_id,
                when: resolved.when,
                wbText: resolved.wbText,
                chatId,
                replyToId,
                via: 'single_pending',
            };
        }
        const matched = matchPendingByText(input.replyToText || input.text, input.pending);
        const row = input.pending.find((r) => r.question_id === matched);
        if (row) {
            return {
                action: 'answer',
                questionId: row.question_id,
                cabinetId: row.cabinet_id,
                when: resolved.when,
                wbText: resolved.wbText,
                chatId,
                replyToId,
                via: 'pending_match',
            };
        }
    }

    return { action: 'ignore' };
}
