// Акылай — младший менеджер по отзывам. Общие правила без сети и базы:
// тексты для клиента, шаг мастера, одноразовые ссылки в Telegram,
// стоп-правила ответов и сборка запроса к модели. Всё тестируется напрямую.

import type { AkylaiTokenProblem } from './akylai-token.ts';

/** Сколько ответов Акылай готовит одному кабинету за сутки. */
export const AKYLAI_DAILY_LIMIT = 100;
/** После стольких опубликованных ответов Акылай предлагает автопубликацию. */
export const AKYLAI_AUTO_OFFER_AFTER = 20;
/** Сколько живёт ссылка на подключение Telegram. */
export const AKYLAI_LINK_TTL_MS = 24 * 60 * 60 * 1000;
/** Сколько отзывов берём из WB за один проход по кабинету. */
export const AKYLAI_BATCH = 20;

export type AkylaiFace = 'smile' | 'serious' | 'neutral';

/** Коды, которые сервер отдаёт сайту. Тексты WB и ошибки базы наружу не уходят. */
export type AkylaiErrorCode =
    | AkylaiTokenProblem
    | 'CHECK_FAILED'
    | 'ALREADY_CONNECTED'
    | 'OTHER_SHOP'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

const TOKEN_MESSAGES: Record<AkylaiErrorCode, string> = {
    EMPTY: 'Вставьте токен целиком — я сама его проверю.',
    MALFORMED: 'Это не похоже на токен Wildberries. Скопируйте его заново целиком, без пробелов.',
    EXPIRED: 'Срок действия этого токена уже закончился. Создайте новый токен и вставьте его сюда.',
    NOT_PERSONAL: 'Выбран не тот тип токена. Создайте новый с типом «Персональный».',
    NO_FEEDBACKS: 'В токене нет категории «Вопросы и отзывы». Создайте новый и отметьте её.',
    READ_ONLY: 'Токен создан «только для чтения» — с ним я не смогу публиковать ответы. Создайте новый без этой галочки.',
    MISSING_CATEGORIES: 'В токене отмечены не все категории. Создайте новый токен и отметьте все категории доступа — тогда он подойдёт для всех разделов NR Space.',
    CHECK_FAILED: 'Не получилось проверить токен. Попробуйте ещё раз через минуту.',
    ALREADY_CONNECTED: 'Этот кабинет уже подключён. Напишите нам — разберёмся.',
    OTHER_SHOP: 'Это токен другого магазина. Вставьте токен того магазина, который вы уже подключили.',
    UNAUTHORIZED: 'Сессия устарела. Обновите страницу и войдите снова.',
    SERVER_ERROR: 'Не получилось проверить токен. Попробуйте ещё раз через минуту.',
};

export function akylaiErrorMessage(code: string, missing?: string[]): string {
    const base = TOKEN_MESSAGES[code as AkylaiErrorCode] || TOKEN_MESSAGES.SERVER_ERROR;
    if (code === 'MISSING_CATEGORIES' && missing?.length) {
        return `В токене не хватает категорий: ${missing.join(', ')}. Создайте новый токен и отметьте все категории доступа — тогда он подойдёт для всех разделов NR Space.`;
    }
    return base;
}

export function isAkylaiErrorCode(code: string): code is AkylaiErrorCode {
    return Object.prototype.hasOwnProperty.call(TOKEN_MESSAGES, code);
}

// ── Шаг мастера считается из базы ─────────────────────────────

export type AkylaiState = {
    hasCabinet: boolean;
    tokenState: 'ok' | 'expired' | 'missing';
    telegram: 'none' | 'connected' | 'blocked';
    enabled: boolean;
};

export type AkylaiStep = 'hello' | 'token' | 'telegram' | 'done';

export function deriveAkylaiStep(s: AkylaiState): AkylaiStep {
    if (!s.hasCabinet) return 'hello';
    if (s.tokenState !== 'ok') return 'token';
    if (s.telegram !== 'connected') return 'telegram';
    return 'done';
}

// ── Одноразовая ссылка в Telegram ─────────────────────────────

export type LinkRow = { expires_at: string; used_at: string | null } | null;
export type LinkCheck = 'ok' | 'missing' | 'expired' | 'used';

export function checkLink(row: LinkRow, nowMs = Date.now()): LinkCheck {
    if (!row) return 'missing';
    if (row.used_at) return 'used';
    if (new Date(row.expires_at).getTime() <= nowMs) return 'expired';
    return 'ok';
}

/** Код из текста "/start <код>". Пусто, если кода нет или он чужого формата. */
export function parseStartCode(text: unknown): string {
    const m = String(text || '').trim().match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{16,64})$/);
    return m ? m[1] : '';
}

export const BOT_TEXT = {
    connected: 'Здравствуйте! Я Акылай 😊 Кабинет подключён. Первые 20 ответов я пришлю вам на проверку. Когда убедитесь, что я пишу как надо, предложу включить автопубликацию.',
    alreadyConnected: 'Мы уже на связи — ответы на отзывы будут приходить сюда.',
    linkBad: 'Эта ссылка уже не работает. Нажмите «Получить новую ссылку» на сайте NR Space и откройте её снова.',
    noCode: 'Здравствуйте! Я Акылай. Чтобы подключиться, откройте ссылку со страницы «Агенты» на сайте NR Space.',
    editPrompt: 'Напишите новый текст ответа ответом на это сообщение — я опубликую его на WB.',
    published: 'Опубликовано на WB ✅',
    publishFailed: 'Не получилось опубликовать. Я попробую ещё раз позже.',
    autoOffer: `Вы проверили ${AKYLAI_AUTO_OFFER_AFTER} ответов. Хотите, я буду публиковать ответы сразу, без проверки?`,
    autoOn: 'Автопубликация включена. Я буду публиковать ответы сразу и присылать их сюда для истории.',
};

// ── Стоп-правила ответа ───────────────────────────────────────

const STOP_RULES: Array<{ id: string; re: RegExp }> = [
    // \b в JS не видит кириллицу, поэтому границы слова — через lookaround:
    // «оценку» не должна считаться «ценой».
    { id: 'price', re: /\d[\d\s]*(?:₽|руб|р\.|рубл|сом|тенге|\$|usd|eur)|(?<![а-яё])(?:цен(?:а|у|е|ы|ой|ам)?|стоимост[а-яё]*)(?![а-яё])|скидк[аиу]\s+\d/iu },
    { id: 'contact', re: /(?:\+?\d[\d\s\-()]{8,}\d)|@[a-z0-9_]{3,}|https?:\/\/|www\.|t\.me|whatsapp|ватсап|вотсап|телеграм|instagram|инстаграм|e-?mail|(?<![а-яё])почт(?:а|у|е|ой)(?![а-яё])/iu },
    { id: 'refund', re: /верн[её]м|вернуть\s+деньги|возврат[а-я]*\s+(?:средств|денег)|компенсир|компенсац|возместим|обменяем|заменим\s+товар|гарантируем\s+возврат/i },
];

/** id нарушенных правил; пустой массив — ответ можно показывать. */
export function stopRuleViolations(text: string): string[] {
    const t = String(text || '');
    return STOP_RULES.filter((r) => r.re.test(t)).map((r) => r.id);
}

// ── Запрос к модели ───────────────────────────────────────────

export type FeedbackForReply = {
    id: string;
    rating: number;
    text: string;
    pros: string;
    cons: string;
    productName: string;
    userName: string;
};

export function normalizeFeedback(raw: Record<string, unknown>): FeedbackForReply | null {
    const id = String(raw?.id || '').trim();
    if (!id) return null;
    const details = (raw.productDetails || {}) as Record<string, unknown>;
    return {
        id,
        rating: Number(raw.productValuation) || 0,
        text: String(raw.text || '').trim(),
        pros: String(raw.pros || '').trim(),
        cons: String(raw.cons || '').trim(),
        productName: String(details.productName || '').trim(),
        userName: String(raw.userName || '').trim(),
    };
}

export function signatureFor(cabinetName: string): string {
    const name = String(cabinetName || '').trim();
    return name ? `С уважением, команда «${name}»` : 'С уважением, команда магазина';
}

export function buildReplyMessages(fb: FeedbackForReply, cabinetName: string, strict = false) {
    const rules = [
        'Ты — вежливый менеджер магазина на Wildberries и отвечаешь на отзыв покупателя.',
        'Пиши по-русски, 2–4 предложения, тепло и по делу, без шаблонных фраз и без эмодзи.',
        'Поблагодари за отзыв. На негатив — извинись и покажи, что замечание передано команде.',
        'Запрещено: называть цены, суммы и скидки; давать телефоны, ссылки, почту, мессенджеры;',
        'обещать возврат денег, обмен, замену или компенсацию.',
        `Не добавляй подпись — её добавят автоматически.`,
    ];
    if (strict) rules.push('Прошлый вариант нарушил запреты. Напиши заново строго без цен, контактов и обещаний возврата.');
    const parts = [
        `Оценка: ${fb.rating || 'нет'} из 5`,
        fb.productName ? `Товар: ${fb.productName}` : '',
        fb.text ? `Отзыв: ${fb.text}` : '',
        fb.pros ? `Достоинства: ${fb.pros}` : '',
        fb.cons ? `Недостатки: ${fb.cons}` : '',
        fb.userName ? `Имя покупателя: ${fb.userName}` : '',
        `Магазин: ${cabinetName || 'магазин'}`,
    ].filter(Boolean);
    return [
        { role: 'system', content: rules.join('\n') },
        { role: 'user', content: parts.join('\n') },
    ];
}

/** Итоговый текст ответа: без лишних пробелов, с подписью, в пределах лимита WB. */
export function finalizeReply(body: string, cabinetName: string, maxLen = 1000): string {
    const clean = String(body || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    const sig = signatureFor(cabinetName);
    const room = Math.max(0, maxLen - sig.length - 2);
    const trimmed = clean.length > room ? clean.slice(0, room).replace(/\s+\S*$/, '') + '…' : clean;
    return `${trimmed}\n\n${sig}`;
}

// ── Карточка в Telegram ───────────────────────────────────────

function stars(n: number): string {
    const k = Math.max(0, Math.min(5, Math.round(n)));
    return k ? '⭐'.repeat(k) : 'без оценки';
}

function esc(s: string): string {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatReplyCard(fb: FeedbackForReply, reply: string, mode: 'review' | 'auto'): string {
    const quote = [fb.text, fb.pros && `+ ${fb.pros}`, fb.cons && `− ${fb.cons}`].filter(Boolean).join('\n') || '(без текста)';
    const head = mode === 'auto' ? '✅ Опубликовала ответ' : '📝 Новый отзыв — ответ на проверку';
    return [
        `<b>${head}</b>`,
        `${stars(fb.rating)}${fb.productName ? ` · ${esc(fb.productName)}` : ''}`,
        '',
        `<i>${esc(quote.slice(0, 700))}</i>`,
        '',
        '<b>Ответ:</b>',
        esc(reply),
    ].join('\n');
}

export function replyKeyboard(replyId: string) {
    return {
        inline_keyboard: [[
            { text: 'Опубликовать', callback_data: `ak:pub:${replyId}` },
            { text: 'Изменить', callback_data: `ak:edit:${replyId}` },
        ]],
    };
}

export function autoOfferKeyboard(cabinetId: string) {
    return { inline_keyboard: [[{ text: 'Включить автопубликацию', callback_data: `ak:auto:${cabinetId}` }]] };
}

/** Разбор callback_data кнопок Акылай. */
export function parseCallback(data: unknown): { action: 'pub' | 'edit' | 'auto'; id: string } | null {
    const m = String(data || '').match(/^ak:(pub|edit|auto):([0-9a-f-]{36})$/i);
    return m ? { action: m[1] as 'pub' | 'edit' | 'auto', id: m[2].toLowerCase() } : null;
}
