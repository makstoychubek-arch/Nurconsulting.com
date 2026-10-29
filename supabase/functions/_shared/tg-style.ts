// Единый вид сообщений бота в Телеграме (HTML-режим): без эмодзи, заголовок жирным заглавными,
// цифры столбцом в <pre>, ошибки по-человечески. Согласован с «Минимализмом» сайта.

export function tgEscape(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Заголовок: «ZEVINA 1 · ОТЧЁТ ЗА 28.10» (жирным). */
export function tgHead(...parts: string[]): string {
    return `<b>${tgEscape(parts.filter(Boolean).join(' · ').toLocaleUpperCase('ru-RU'))}</b>`;
}

/** Строки «название ... значение» в моноширинном блоке: подписи слева, значения выровнены справа. */
export function tgRows(rows: Array<[string, string]>): string {
    const w = Math.max(0, ...rows.map(([k]) => k.length));
    const v = Math.max(0, ...rows.map(([, val]) => val.length));
    return `<pre>${tgEscape(rows.map(([k, val]) => `${k.padEnd(w)}  ${val.padStart(v)}`).join('\n'))}</pre>`;
}

/** Короткое человеческое сообщение об ошибке, без технических деталей. */
export function tgFail(reason = 'Попробуйте ещё раз чуть позже.'): string {
    return `<b>НЕ ПОЛУЧИЛОСЬ</b>\n${tgEscape(reason)}`;
}
