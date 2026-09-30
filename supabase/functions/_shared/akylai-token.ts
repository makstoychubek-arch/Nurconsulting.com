// Разбор персонального токена WB для мастера Акылай.
//
// Токен WB — JWT (RFC 7519). По документации WB («Декодирование токена»):
//   s    — битовая маска свойств токена, биты считаются с 0 от младшего;
//          бит 7  — доступ к категории «Вопросы и отзывы»,
//          бит 30 — токен «только на чтение»;
//   acc  — тип токена: 1 базовый, 2 тестовый, 3 персональный, 4 сервисный;
//   for  — у персонального "self", у сервисного "asid:<id сервиса>";
//   t    — true у тестового токена;
//   sid  — id продавца (по нему ищем, не подключён ли магазин у другого клиента);
//   exp  — unix-время окончания действия.
// Если WB поменяет формат, правится только этот файл и его тест.
//
// Чистые функции без сети — чтобы тесты не зависели от WB.

export const WB_BIT_FEEDBACKS = 7;
export const WB_BIT_READ_ONLY = 30;
export const WB_ACC_PERSONAL = 3;

export type AkylaiTokenProblem =
    | 'EMPTY'
    | 'MALFORMED'
    | 'EXPIRED'
    | 'NOT_PERSONAL'
    | 'NO_FEEDBACKS'
    | 'READ_ONLY';

export type AkylaiTokenInfo = {
    sid: string;
    exp: number | null;
    acc: number | null;
    mask: number;
};

export type AkylaiTokenParse =
    | { ok: true; token: string; info: AkylaiTokenInfo }
    | { ok: false; problem: AkylaiTokenProblem };

/** Бит маски s. Маска может быть больше 2^31, поэтому без побитовых операторов JS. */
export function hasBit(mask: number, bit: number): boolean {
    if (!Number.isFinite(mask) || mask < 0) return false;
    return Math.floor(mask / 2 ** bit) % 2 === 1;
}

export function cleanToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^﻿/, '').replace(/^Bearer\s+/i, '').replace(/\s+/g, '').trim();
}

function base64UrlDecode(part: string): string {
    const norm = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm + '='.repeat((4 - (norm.length % 4)) % 4);
    return atob(pad);
}

/**
 * Проверяет токен по полям из самого токена. Порядок проверок важен: клиенту
 * называем одну, самую полезную причину — сначала тип токена, потом
 * категория, потом «только чтение».
 */
export function parseAkylaiToken(raw: unknown, nowSec = Math.floor(Date.now() / 1000)): AkylaiTokenParse {
    const token = cleanToken(raw);
    if (!token) return { ok: false, problem: 'EMPTY' };

    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return { ok: false, problem: 'MALFORMED' };

    let payload: Record<string, unknown>;
    try {
        const parsed = JSON.parse(base64UrlDecode(parts[1]));
        if (!parsed || typeof parsed !== 'object') return { ok: false, problem: 'MALFORMED' };
        payload = parsed as Record<string, unknown>;
    } catch {
        return { ok: false, problem: 'MALFORMED' };
    }

    const exp = typeof payload.exp === 'number' ? payload.exp : null;
    if (exp !== null && exp <= nowSec) return { ok: false, problem: 'EXPIRED' };

    const acc = typeof payload.acc === 'number' ? payload.acc : null;
    const isPersonal = acc === WB_ACC_PERSONAL && payload.for === 'self' && payload.t !== true;
    if (!isPersonal) return { ok: false, problem: 'NOT_PERSONAL' };

    const mask = typeof payload.s === 'number' ? payload.s : 0;
    if (!hasBit(mask, WB_BIT_FEEDBACKS)) return { ok: false, problem: 'NO_FEEDBACKS' };
    if (hasBit(mask, WB_BIT_READ_ONLY)) return { ok: false, problem: 'READ_ONLY' };

    const sid = typeof payload.sid === 'string' ? payload.sid.trim() : '';
    if (!sid) return { ok: false, problem: 'MALFORMED' };

    return { ok: true, token, info: { sid, exp, acc, mask } };
}

/** sid продавца из любого токена WB (для поиска дублей среди старых кабинетов). */
export function tokenSellerId(raw: unknown): string {
    const token = cleanToken(raw);
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    try {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        return typeof payload?.sid === 'string' ? payload.sid.trim() : '';
    } catch {
        return '';
    }
}
