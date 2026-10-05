// Вход через Telegram без сторонних сервисов: сайт получает одноразовый токен, человек открывает бота
// по ссылке, бот присылает 6-значный код, человек вводит код на сайте. Код привязан к токену и живёт 5 минут.

export const TG_LOGIN_TTL_MS = 5 * 60 * 1000;
export const TG_LOGIN_MAX_ATTEMPTS = 5;

/** `/start lg_<32 hex>` из ссылки t.me/<бот>?start=lg_<токен>. */
export function parseLoginStart(text: unknown): string {
    const m = String(text || '').trim().match(/^\/start(?:@\w+)?\s+lg_([a-f0-9]{32})$/);
    return m ? m[1] : '';
}

export function randomHex(bytes: number): string {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Шестизначный код без смещения распределения. */
export function randomCode(): string {
    const a = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
    do { crypto.getRandomValues(a); } while (a[0] >= limit);
    return String(a[0] % 1_000_000).padStart(6, '0');
}

export async function sha256(text: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Код хранится только хэшем и привязан к токену, чтобы чужой код к другому токену не подошёл. */
export function codeHash(token: string, code: string): Promise<string> {
    return sha256(`${token}:${String(code).trim()}`);
}

export function isExpired(createdAtIso: string, now = Date.now()): boolean {
    const t = Date.parse(createdAtIso);
    return !Number.isFinite(t) || now - t > TG_LOGIN_TTL_MS;
}

export function telegramEmail(tgId: number | string): string {
    return `tg${tgId}@telegram.nurcon.kg`;
}

export function displayName(from: { first_name?: string; last_name?: string; username?: string } | null | undefined): string {
    const n = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
    return n || (from?.username ? `@${from.username}` : 'Пользователь Telegram');
}
