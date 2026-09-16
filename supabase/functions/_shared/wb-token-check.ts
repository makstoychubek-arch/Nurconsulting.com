// Проверка персонального API-токена Wildberries на онбординге.
//
// Клиент вставляет токен один раз, и до этого момента ни один экран не может
// показать данные. Поэтому важно не «молча не работать», а сразу сказать, что
// именно не так: токен от другого сервиса, просрочен, тестовый или выдан без
// нужных категорий доступа.
//
// Разбор токена — чистые функции без сети, чтобы их можно было тестировать.
// Живая проверка доступов идёт через официальные /ping на хостах WB.

export type WbTokenPayload = {
    /** id продавца */
    sid?: string;
    /** маска категорий доступа */
    s?: number;
    /** unix-время истечения */
    exp?: number;
    /** true — тестовый (песочница) токен */
    t?: boolean;
    oid?: number;
    uid?: number;
};

export type TokenDecode =
    | { ok: true; payload: WbTokenPayload }
    | { ok: false; code: TokenProblem; message: string };

export type TokenProblem = 'EMPTY' | 'MALFORMED' | 'EXPIRED' | 'SANDBOX';

/** Категории WB, без которых сайт не построит ни один отчёт. */
export const REQUIRED_CATEGORIES = [
    { key: 'statistics', host: 'statistics-api', label: 'Статистика' },
    { key: 'content', host: 'content-api', label: 'Контент' },
] as const;

/** Категории, которые нужны отдельным разделам, но не блокируют вход. */
export const OPTIONAL_CATEGORIES = [
    { key: 'adv', host: 'advert-api', label: 'Продвижение' },
    { key: 'analytics', host: 'seller-analytics-api', label: 'Аналитика' },
    { key: 'prices', host: 'discounts-prices-api', label: 'Цены и скидки' },
    { key: 'marketplace', host: 'marketplace-api', label: 'Маркетплейс' },
] as const;

function base64UrlDecode(part: string): string {
    const norm = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    return atob(pad);
}

/**
 * Разбирает токен WB без обращения к сети.
 * `nowSec` вынесен в аргумент, чтобы тесты не зависели от текущей даты.
 */
export function decodeWbToken(raw: string, nowSec = Math.floor(Date.now() / 1000)): TokenDecode {
    const token = String(raw || '').trim().replace(/\s+/g, '');
    if (!token) {
        return { ok: false, code: 'EMPTY', message: 'Вставьте токен из личного кабинета Wildberries.' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return {
            ok: false,
            code: 'MALFORMED',
            message: 'Это не похоже на токен Wildberries. Скопируйте его целиком, без пробелов и переносов строк.',
        };
    }

    let payload: WbTokenPayload;
    try {
        payload = JSON.parse(base64UrlDecode(parts[1]));
    } catch {
        return {
            ok: false,
            code: 'MALFORMED',
            message: 'Токен повреждён при копировании. Скопируйте его заново целиком.',
        };
    }

    if (typeof payload?.exp === 'number' && payload.exp <= nowSec) {
        return {
            ok: false,
            code: 'EXPIRED',
            message: 'Срок действия токена истёк. Выпустите новый в личном кабинете WB.',
        };
    }

    if (payload?.t === true) {
        return {
            ok: false,
            code: 'SANDBOX',
            message: 'Это тестовый токен (песочница). Нужен рабочий токен — снимите галочку «Тестовый контур».',
        };
    }

    return { ok: true, payload };
}

export type PingResult = { key: string; label: string; ok: boolean; status: number };

/** Итог живой проверки доступов токена. */
export function summarizePings(results: PingResult[], required: readonly string[]): {
    ok: boolean;
    missingRequired: string[];
    missingOptional: string[];
} {
    const requiredSet = new Set(required);
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    for (const r of results) {
        if (r.ok) continue;
        if (requiredSet.has(r.key)) missingRequired.push(r.label);
        else missingOptional.push(r.label);
    }
    return { ok: missingRequired.length === 0, missingRequired, missingOptional };
}

/** Текст для клиента, когда в токене не хватает обязательных категорий. */
export function missingScopesMessage(missing: string[]): string {
    if (!missing.length) return '';
    const list = missing.join(', ');
    return `В токене не отмечены категории: ${list}. Выпустите токен заново и поставьте эти галочки.`;
}

/**
 * 401/403 от WB на /ping означает «нет доступа к этой категории».
 * Прочие коды (5xx, таймаут) — это проблема на стороне WB, а не токена,
 * поэтому такую категорию не считаем недоступной.
 */
export function pingStatusMeansNoAccess(status: number): boolean {
    return status === 401 || status === 403;
}
