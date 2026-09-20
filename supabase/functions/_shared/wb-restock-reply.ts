/** Вопросы WB → короткий реплай в Telegram → полный ответ покупателю. */

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
    status?: string | null;
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
        action: 'unmatched';
        chatId: string;
        replyToId: number;
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

export const TG_HEART = '\u2764';
export const TG_THUMBS_DOWN = '\u{1F44E}';

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
    return `Здравствуйте! Этот товар будет в наличии ${normalizeWhenPhrase(when)}.`;
}

export type QuestionTopic = 'restock' | 'lining' | 'height' | 'model' | 'size' | 'color' | 'compose' | 'general';

export function isUselessStaffReply(raw: string): boolean {
    const t = normalizeReply(raw).toLowerCase().replace(/ё/g, 'е');
    return !t || /^(хз|нз|не знаю|\?+|-+|\.+)$/i.test(t);
}

export function inferQuestionTopic(text: string): QuestionTopic {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (isRestockQuestion(t)) return 'restock';
    if (/подклад/.test(t)) return 'lining';
    if (/рост/.test(t)) return 'height';
    if (/параметр|обхват|на фото/.test(t)) return 'model';
    if (/размер/.test(t)) return 'size';
    if (/состав|ткан/.test(t)) return 'compose';
    if (/цвет/.test(t)) return 'color';
    return 'general';
}

function inferPolarity(reply: string): 'yes' | 'no' | null {
    const t = normalizeReply(reply).toLowerCase().replace(/ё/g, 'е');
    if (t.split(/\s+/).filter(Boolean).length > 2) return null;
    if (/^(да+|yes|есть|ага|угу|конечно)(?:\s|$)/i.test(t) || t === '+') return 'yes';
    if (/^(нет|нету|no)(?:\s|$)/i.test(t) || t === '-') return 'no';
    return null;
}

function extractHeightCm(reply: string): string | null {
    const m = normalizeReply(reply).match(/\b(1[4-9]\d|200)\b/);
    return m ? m[1] : null;
}

export function greetBuyerAnswer(body: string): string {
    const t = normalizeReply(body).replace(/^[,\s]+/, '');
    if (!t) return 'Здравствуйте!';
    if (/^здравствуйте/i.test(t)) return ensureSentence(t);
    const cap = t.charAt(0).toLocaleUpperCase('ru-RU') + t.slice(1);
    return ensureSentence(`Здравствуйте! ${cap}`);
}

function ensureSentence(raw: string): string {
    const t = normalizeReply(raw);
    if (!t) return t;
    if (/[.!?…]$/.test(t)) return t;
    return `${t}.`;
}

function expandFact(topic: QuestionTopic, reply: string): string {
    const polarity = inferPolarity(reply);
    if (topic === 'lining') {
        if (polarity === 'yes') return 'Да, подклад есть';
        if (polarity === 'no') return 'Нет, подклада нет';
        return reply;
    }
    if (topic === 'height') {
        const cm = extractHeightCm(reply);
        if (cm && normalizeReply(reply).split(/\s+/).length <= 4) {
            return `Костюм рассчитан на рост ${cm}`;
        }
        return reply;
    }
    if (topic === 'model') {
        if (normalizeReply(reply).length >= 12) return reply;
        return `Параметры модели на фото: ${reply}`;
    }
    if (topic === 'restock') {
        if (polarity === 'yes') return 'Да, этот товар будет в наличии';
        if (polarity === 'no') return 'К сожалению, точной даты поступления пока нет';
        return reply;
    }
    if (topic === 'size') {
        if (polarity === 'yes') return 'Да, такой размер есть';
        if (polarity === 'no') return 'Такого размера сейчас нет';
        return reply;
    }
    return reply;
}

/** Короткий реплай менеджера → письмо покупателю. Без вопроса — только срок или уже длинный текст. */
export function resolveStaffAnswer(
    raw: string,
    questionText = '',
): { when: string; wbText: string } | null {
    const text = normalizeReply(raw);
    if (!text || isUselessStaffReply(text)) return null;
    const when = extractRestockWhen(text);
    if (when) return { when, wbText: buildWbRestockAnswer(when) };
    const asked = String(questionText || '').trim();
    if (asked) {
        return { when: text.slice(0, 120), wbText: greetBuyerAnswer(expandFact(inferQuestionTopic(asked), text)) };
    }
    const words = text.split(/\s+/).filter(Boolean);
    if (text.length < 8 && words.length < 3) return null;
    return { when: text.slice(0, 120), wbText: greetBuyerAnswer(text) };
}

/** Срок → шаблон; иначе короткий реплай дополняем до письма покупателю. */
export function resolveRestockAnswer(raw: string, questionText = ''): { when: string; wbText: string } | null {
    return resolveStaffAnswer(raw, questionText);
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

/** Все свежие неотвеченные вопросы — в Telegram, не только про поступление. */
export function pickOpenQuestions(payload: unknown, maxAgeDays = 45): RestockQuestion[] {
    return collectQuestions(payload).filter((q) => (
        Boolean(q.text) && isFreshQuestion(q.createdDate, maxAgeDays)
    ));
}

export function questionCardKind(text: string): 'поступление' | 'вопрос' {
    return isRestockQuestion(text) ? 'поступление' : 'вопрос';
}

/** Срок без даты с WB. Не выдумываем «через несколько дней». */
export const AUTO_RESTOCK_WHEN = 'в ближайшее время';

const AUTO_FACT: Record<Exclude<QuestionTopic, 'restock'>, string> = {
    lining: 'Информация о подкладе указана в описании карточки',
    height: 'Рекомендуемый рост и размерная сетка есть в карточке товара',
    model: 'Параметры модели указаны в описании и на фото карточки',
    size: 'Актуальные размеры смотрите в карточке — наличие по складам обновляется',
    color: 'Актуальные цвета и наличие указаны в карточке товара',
    compose: 'Состав ткани указан в характеристиках карточки',
    general: 'Спасибо за вопрос. Актуальная информация есть в карточке товара. Если нужно уточнить — напишите нам ещё раз',
};

/** Консервативный автоответ: без дат поставки и без выдуманных фактов о товаре. */
export function buildAutoQuestionAnswer(text: string): {
    topic: QuestionTopic;
    when: string;
    wbText: string;
} {
    const topic = inferQuestionTopic(text);
    if (topic === 'restock') {
        return { topic, when: AUTO_RESTOCK_WHEN, wbText: buildWbRestockAnswer(AUTO_RESTOCK_WHEN) };
    }
    return { topic, when: topic, wbText: greetBuyerAnswer(AUTO_FACT[topic]) };
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

function cardProductName(q: RestockQuestion): string {
    return String(q.article || q.product || '').trim() || (q.nmId ? String(q.nmId) : 'товар');
}

export function formatRestockTelegramCard(opts: {
    cabinetName: string;
    cabinetId: string;
    question: RestockQuestion;
    mention?: string;
}): string {
    const q = opts.question;
    const who = opts.mention ? `${opts.mention} ` : '';
    const ask = shortQuestionQuote(q.text);
    const lines = [`${who}${questionCardKind(q.text)}`, cardProductName(q)];
    if (ask) lines.push(`«${ask}»`);
    return lines.join('\n');
}

/** Карточка после автоответа: тег + что ушло на WB, чтобы реплаем поправить. */
export function formatAutoAnswerTelegramCard(opts: {
    cabinetName: string;
    cabinetId: string;
    question: RestockQuestion;
    answer: string;
    mention?: string;
}): string {
    const q = opts.question;
    const who = opts.mention ? `${opts.mention} ` : '';
    const ask = shortQuestionQuote(q.text);
    const sent = String(opts.answer || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    const lines = [`${who}автоответ · ${questionCardKind(q.text)}`, cardProductName(q)];
    if (ask) lines.push(`«${ask}»`);
    if (sent) lines.push(`ушло: ${sent}`);
    return lines.join('\n');
}

export function wbQuestionAnswerPayload(id: string, text: string) {
    return {
        id: String(id || '').trim(),
        wasViewed: true,
        answer: { text: String(text || '').trim() },
        state: 'wbRu',
    };
}

export function isAlreadyAnsweredWb(res: { ok: boolean; status: number; data: unknown; text: string }): boolean {
    if (res.ok) return false;
    const raw = `${res.status} ${JSON.stringify(res.data || '')} ${res.text || ''}`;
    return /already|уже отвеч|has answer|answered/i.test(raw);
}

export async function answerWbQuestion(token: string, id: string, text: string) {
    const url = `${FEEDBACKS_API}/api/v1/questions`;
    const payload = wbQuestionAnswerPayload(id, text);
    const first = await wbSend(url, token, 'PATCH', payload);
    if (first.ok || isAlreadyAnsweredWb(first)) return first.ok ? first : { ...first, ok: true };
    const raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
    if (!raw) return first;
    const retry = await wbSend(url, `Bearer ${raw}`, 'PATCH', payload);
    if (retry.ok || isAlreadyAnsweredWb(retry)) return retry.ok ? retry : { ...retry, ok: true };
    return retry.ok || retry.status !== first.status ? retry : first;
}

export function parseRestockCardMeta(text: string): RestockCardMeta | null {
    const t = String(text || '');
    const m = t.match(/#nrq\s+q=([^\s]+)\s+c=([0-9a-f-]{8,})/i);
    if (!m) return null;
    return { questionId: m[1], cabinetId: m[2] };
}

const CARD_KIND_RE = /автоответ|поступление|вопрос/i;

/** Карточка Карины: «@maraWuW поступление|вопрос|автоответ / артикул / цитата». Без #nrq. */
export function isRestockCardText(text: string): boolean {
    const t = String(text || '').trim();
    if (!t) return false;
    if (parseRestockCardMeta(t)) return true;
    // \b не работает с кириллицей — после вида карточки обычный пробел/перевод строки.
    return /(?:^|\n)\s*@?\S*[^\S\n]*(?:автоответ|поступление|вопрос)(?:\s|$)/i.test(t);
}

function stripCardKindPrefix(line: string): string {
    return String(line || '')
        .replace(/^@\S+\s*/, '')
        .replace(/^автоответ\s*[·•.\-:]+\s*/i, '')
        .replace(/^(поступление|вопрос)\s+/i, '')
        .split(/[«"]/)[0]
        .trim();
}

export function restockCardArticleLine(text: string): string {
    const raw = String(text || '').replace(/\r/g, '');
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const start = lines.findIndex((l) => CARD_KIND_RE.test(l));
    if (start < 0) {
        const m = raw.match(/(?:автоответ\s*[·•.\-:]+\s*)?(?:поступление|вопрос)\s+([^\s«"]+)/i);
        return m ? m[1].trim() : '';
    }
    const same = stripCardKindPrefix(lines[start]);
    if (same && !CARD_KIND_RE.test(same) && !/^ушло:/i.test(same)) return same;
    const next = lines[start + 1] || '';
    if (!next || /^[«"]/.test(next) || CARD_KIND_RE.test(next) || /^ушло:/i.test(next)) return '';
    return next.split(/[«"]/)[0].trim();
}

/** Карточка + ответ в одном сообщении (реплай-цитата без reply_to, пересылка в WhatsApp-виде). */
export function peelCardAndAnswer(raw: string): { card: string; answer: string } | null {
    const text = String(raw || '').replace(/\r/g, '').trim();
    if (!text) return null;
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
        const last = lines[lines.length - 1];
        const head = lines.slice(0, -1).join('\n');
        if (
            isRestockCardText(head) &&
            !/^[«"]/.test(last) &&
            !/^ушло:/i.test(last) &&
            resolveStaffAnswer(last, head)
        ) {
            return { card: head, answer: last };
        }
    }
    // Срок внутри «ушло: …» — это автоответ, не реплай менеджера.
    if (/(?:^|\s)ушло:/i.test(text)) return null;
    const when = extractRestockWhen(text);
    if (when && isRestockCardText(text)) {
        const folded = text.toLowerCase().replace(/ё/g, 'е');
        const needle = when.toLowerCase().replace(/ё/g, 'е');
        const idx = folded.lastIndexOf(needle);
        if (idx >= 8) {
            const card = text.slice(0, idx).trim();
            const answer = text.slice(idx).trim();
            if (card && answer && isRestockCardText(card)) return { card, answer };
        }
    }
    return null;
}

/** Свои карточки и голые сообщения ботов не считаем ответом менеджера. */
export function isRestockInboundCandidate(msg: {
    text: string;
    replyToText: string;
    replyToMessageId: number | null;
    isBot: boolean;
}): boolean {
    if (peelCardAndAnswer(msg.text)) return true;
    if (isRestockCardText(msg.text) && !msg.replyToMessageId) return false;
    if (msg.isBot && !msg.replyToMessageId) return false;
    return true;
}

export function normalizeTelegramReactionEmoji(emoji: string): string {
    const raw = String(emoji || '').trim();
    if (!raw) return TG_HEART;
    if (raw.includes('\u2764') || raw.includes('\u2665') || raw === '❤️' || raw === '❤') return TG_HEART;
    if (raw.includes('👎') || raw === TG_THUMBS_DOWN) return TG_THUMBS_DOWN;
    return raw;
}

export async function setTelegramReaction(
    tokens: Array<string | undefined | null>,
    chatId: string | number,
    messageId: number,
    emoji: string,
): Promise<{ ok: boolean; error?: string }> {
    if (chatId == null || chatId === '' || !Number(messageId)) {
        return { ok: false, error: 'no_target' };
    }
    const reaction = [{ type: 'emoji' as const, emoji: normalizeTelegramReactionEmoji(emoji) }];
    const seen = new Set<string>();
    let lastErr = 'no_token';
    for (const raw of tokens) {
        const token = String(raw || '').trim();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    reaction,
                }),
            });
            if (res.ok) return { ok: true };
            lastErr = (await res.text()).slice(0, 300);
            console.warn('[restock] setMessageReaction', res.status, lastErr);
        } catch (e) {
            lastErr = String(e);
            console.warn('[restock] setMessageReaction error', lastErr);
        }
    }
    return { ok: false, error: lastErr };
}

export function matchPendingByText(
    haystack: string,
    rows: Array<{ question_id: string; nm_id?: number | null; article?: string | null; product?: string | null; question_text?: string | null }>,
): string | null {
    const h = String(haystack || '').toLowerCase();
    if (!h || !rows.length) return null;
    const cardArt = restockCardArticleLine(haystack).toLowerCase();
    let best: { id: string; score: number } | null = null;
    for (const row of rows) {
        let score = 0;
        if (row.nm_id && h.includes(String(row.nm_id))) score += 5;
        const art = String(row.article || '').toLowerCase();
        if (art && h.includes(art)) score += 4;
        if (cardArt && art && (cardArt === art || cardArt.includes(art) || art.includes(cardArt))) score += 6;
        for (const w of art.split(/[^a-zа-я0-9]+/i).filter((x) => x.length >= 4)) {
            if (h.includes(w)) score += 1;
        }
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

function pickTelegramMessage(update: unknown): Record<string, unknown> | null {
    const rec = update && typeof update === 'object' ? update as Record<string, unknown> : {};
    for (const key of [
        'message',
        'edited_message',
        'business_message',
        'edited_business_message',
        'channel_post',
        'edited_channel_post',
    ]) {
        if (rec[key] && typeof rec[key] === 'object') return rec[key] as Record<string, unknown>;
    }
    return null;
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
    const msg = pickTelegramMessage(update);
    if (!msg) return null;
    const chat = msg.chat && typeof msg.chat === 'object' ? msg.chat as Record<string, unknown> : {};
    const from = msg.from && typeof msg.from === 'object' ? msg.from as Record<string, unknown> : {};
    const reply = msg.reply_to_message && typeof msg.reply_to_message === 'object'
        ? msg.reply_to_message as Record<string, unknown>
        : {};
    const quote = msg.quote && typeof msg.quote === 'object' ? msg.quote as Record<string, unknown> : {};
    const external = msg.external_reply && typeof msg.external_reply === 'object'
        ? msg.external_reply as Record<string, unknown>
        : {};
    const chatId = String(chat.id ?? '').trim();
    const messageId = Number(msg.message_id || 0);
    if (!chatId || !messageId) return null;
    const rawText = String(msg.text || msg.caption || '');
    const peeled = peelCardAndAnswer(rawText);
    const replyToText = String(reply.text || reply.caption || quote.text || peeled?.card || '');
    const replyToMessageId = Number(reply.message_id || external.message_id || 0) || null;
    return {
        chatId,
        messageId,
        text: peeled ? peeled.answer : rawText,
        fromUsername: String(from.username || ''),
        replyToText,
        replyToMessageId,
        isBot: from.is_bot === true,
    };
}

function finishInbound(
    input: {
        chatId: string;
        messageId: number;
        text: string;
    },
    row: Pick<PendingRestockRow, 'question_id' | 'cabinet_id' | 'question_text'>,
    via: 'card_meta' | 'tg_message' | 'pending_match' | 'single_pending',
): RestockInboundDecision {
    const chatId = String(input.chatId || '');
    const replyToId = input.messageId;
    const resolved = resolveStaffAnswer(input.text, String(row.question_text || ''));
    if (!resolved) {
        return {
            action: 'hint',
            chatId,
            replyToId,
            questionId: row.question_id,
            cabinetId: row.cabinet_id,
        };
    }
    return {
        action: 'answer',
        questionId: row.question_id,
        cabinetId: row.cabinet_id,
        when: resolved.when,
        wbText: resolved.wbText,
        chatId,
        replyToId,
        via,
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
    const peeled = peelCardAndAnswer(input.text);
    const text = peeled ? peeled.answer : input.text;
    const replyToText = input.replyToText || peeled?.card || '';
    const work = { ...input, text, replyToText };
    const meta = parseRestockCardMeta(replyToText);

    if (meta) {
        const row = input.pending.find((r) => r.question_id === meta.questionId) || {
            question_id: meta.questionId,
            cabinet_id: meta.cabinetId,
            question_text: '',
        };
        return finishInbound(work, row, 'card_meta');
    }

    const byTg = input.replyToMessageId
        ? input.pending.find((r) => Number(r.telegram_message_id) === Number(input.replyToMessageId))
        : null;
    if (byTg) return finishInbound(work, byTg, 'tg_message');

    const hay = [replyToText, peeled?.card, text].filter(Boolean).join('\n');
    const canAnswer = Boolean(resolveStaffAnswer(text, replyToText));
    if (canAnswer && hay.trim()) {
        const matched = matchPendingByText(hay, input.pending);
        const row = input.pending.find((r) => r.question_id === matched);
        if (row) return finishInbound(work, row, 'pending_match');
    }

    const resolved = resolveStaffAnswer(text, '');
    const owner = String(input.ownerUsername || '').replace(/^@/, '').toLowerCase();
    const from = String(input.fromUsername || '').replace(/^@/, '').toLowerCase();
    const fromOwner = Boolean(owner && from && owner === from);

    if (resolved && isWhenOnlyReply(text) && input.pending.length === 1) {
        return finishInbound(work, input.pending[0], 'single_pending');
    }

    if (fromOwner && isWhenOnlyReply(text) && resolved) {
        const matched = matchPendingByText(replyToText || text, input.pending);
        const row = input.pending.find((r) => r.question_id === matched);
        if (row) return finishInbound(work, row, 'pending_match');
    }

    const repliedToCard = Boolean((input.replyToMessageId || peeled) && isRestockCardText(replyToText));
    if (repliedToCard) {
        if (!resolveStaffAnswer(text, replyToText)) {
            return { action: 'hint', chatId, replyToId };
        }
        return { action: 'unmatched', chatId, replyToId };
    }

    return { action: 'ignore' };
}
