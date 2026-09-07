// Топ WB-ручек для вкладки «Агенты»: приглашения, цены, отзывы, FBS, пропуска.
// Форматы — как в официальном OpenAPI dev.wildberries.ru.

export const USERS_API = 'https://user-management-api.wildberries.ru';
export const PRICES_API = 'https://discounts-prices-api.wildberries.ru';
export const FEEDBACKS_API = 'https://feedbacks-api.wildberries.ru';
export const MARKET_API = 'https://marketplace-api.wildberries.ru';
export const CHAT_API = 'https://buyer-chat-api.wildberries.ru';
export const FINANCE_API = 'https://finance-api.wildberries.ru';
export const ADVERT_API = 'https://advert-api.wildberries.ru';

export const WB_ACCESS_CODES = [
    'balance', 'finance', 'supply', 'discountPrice', 'feedbacks', 'questions',
    'pinFeedbacks', 'pointsForReviews', 'suppliersDocuments', 'brands',
    'wbPoint', 'showcase', 'changeJam',
] as const;

export type AccessItem = { code: string; disabled: boolean };
export type AccessPreset = 'standard' | 'manager' | 'readonly' | 'finance';

const ACCESS_PRESETS: AccessPreset[] = ['standard', 'manager', 'readonly', 'finance'];

export function isAccessPreset(value: string): value is AccessPreset {
    return ACCESS_PRESETS.includes(value as AccessPreset);
}

export function accessPresetItems(preset: AccessPreset): AccessItem[] | undefined {
    if (preset === 'standard') return undefined;
    if (preset === 'finance') {
        return [
            { code: 'finance', disabled: false },
            { code: 'balance', disabled: false },
        ];
    }
    if (preset === 'manager') {
        return [
            { code: 'finance', disabled: true },
            { code: 'balance', disabled: true },
        ];
    }
    return [
        { code: 'supply', disabled: true },
        { code: 'discountPrice', disabled: true },
        { code: 'finance', disabled: true },
        { code: 'balance', disabled: true },
        { code: 'showcase', disabled: true },
        { code: 'changeJam', disabled: true },
        { code: 'brands', disabled: true },
        { code: 'pointsForReviews', disabled: true },
    ];
}

/** Для уже добавленного пользователя WB обновляет только переданные code. */
export function accessItemsForExistingUser(preset: AccessPreset): AccessItem[] {
    if (preset === 'standard' || preset === 'finance') {
        return [
            { code: 'finance', disabled: false },
            { code: 'balance', disabled: false },
        ];
    }
    return accessPresetItems(preset) || [];
}

export function accessPresetLabel(preset: AccessPreset): string {
    switch (preset) {
        case 'finance':
            return 'финансы и баланс';
        case 'manager':
            return 'менеджер (без финансов и баланса)';
        case 'readonly':
            return 'только просмотр';
        default:
            return 'стандарт WB';
    }
}

export function parseAccessPreset(text: string): AccessPreset | null {
    const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (!t.trim()) return null;
    if (/без\s+финанс|no[_\s-]?finance|не\s+финанс/i.test(t)) return 'manager';
    if (/финанс|finance/i.test(t)) return 'finance';
    if (/только\s+смотр|read.?only|чтение|readonly/i.test(t)) return 'readonly';
    if (/менеджер|manager/i.test(t)) return 'manager';
    if (/стандарт|по\s+умолчанию|дефолт|default/i.test(t)) return 'standard';
    const n = Number(t.trim());
    if (n >= 1 && n <= ACCESS_PRESETS.length) return ACCESS_PRESETS[n - 1];
    return null;
}

export function isAlreadyAddedInviteError(err: string): boolean {
    return /already added|already exists|already exist|уже добавлен|уже есть|user already/i.test(err);
}

export function digitsPhone(raw: string): string {
    return String(raw || '').replace(/\D/g, '');
}

export function userPhoneDigits(user: Record<string, unknown>): string {
    const invitee = user.inviteeInfo && typeof user.inviteeInfo === 'object'
        ? user.inviteeInfo as Record<string, unknown>
        : {};
    return digitsPhone(String(user.phone || user.phoneNumber || invitee.phoneNumber || ''));
}

export function userIdOf(user: Record<string, unknown>): number {
    return Number(user.id || user.userId || 0);
}

export function findUserByPhone(users: unknown[], phone: string): Record<string, unknown> | null {
    const want = digitsPhone(phone);
    if (!want) return null;
    for (const row of users) {
        if (!row || typeof row !== 'object') continue;
        const user = row as Record<string, unknown>;
        const have = userPhoneDigits(user);
        if (have && (have === want || have.endsWith(want) || want.endsWith(have))) return user;
    }
    return null;
}

export function collectUsers(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) return data.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
    if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        if (Array.isArray(rec.users)) return rec.users.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
    }
    return [];
}

export function normalizeWbInvitePhone(raw: string): { phone: string; countryName: string } | null {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
    if (d.length === 10 && /^9\d{9}$/.test(d)) d = '7' + d;
    if (d.length === 11 && d.startsWith('7')) {
        const isKz = /^7(7\d|6\d)/.test(d);
        return { phone: d, countryName: isKz ? 'Казахстан' : 'Россия' };
    }
    if (d.length === 9 && /^[57]\d{8}$/.test(d)) return { phone: '996' + d, countryName: 'Кыргызстан' };
    if (d.length === 12 && d.startsWith('996')) return { phone: d, countryName: 'Кыргызстан' };
    if (d.length === 12 && d.startsWith('998')) return { phone: d, countryName: 'Узбекистан' };
    if (d.length === 12 && d.startsWith('375')) return { phone: d, countryName: 'Беларусь' };
    if (d.length === 9 && /^[234]\d{8}$/.test(d)) return { phone: '375' + d, countryName: 'Беларусь' };
    if (d.length >= 10 && d.length <= 15) return { phone: d, countryName: 'другое' };
    return null;
}

export async function wbSend(
    url: string,
    token: string,
    method = 'GET',
    body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: token,
            Accept: 'application/json',
            ...(body != null ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let data: unknown = null;
    if (text) {
        try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    }
    return { ok: res.ok, status: res.status, data, text: text.slice(0, 400) };
}

export function wbError(res: { status: number; data: unknown; text: string }): string {
    const rec = res.data && typeof res.data === 'object' ? res.data as Record<string, unknown> : {};
    return String(rec.errorText || rec.message || rec.detail || rec.error || rec.title || res.text || `WB ${res.status}`).slice(0, 400);
}

export async function updateWbUserAccess(
    token: string,
    userId: number,
    access: AccessItem[],
): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
    return wbSend(`${USERS_API}/api/v1/users/access`, token, 'PUT', {
        usersAccesses: [{ userId, access }],
    });
}

export async function listWbUsers(
    token: string,
    inviteOnly = false,
): Promise<{ ok: boolean; status: number; users: Record<string, unknown>[]; error?: string }> {
    const q = `limit=100&offset=0${inviteOnly ? '&isInviteOnly=true' : ''}`;
    const res = await wbSend(`${USERS_API}/api/v1/users?${q}`, token);
    if (!res.ok) return { ok: false, status: res.status, users: [], error: wbError(res) };
    return { ok: true, status: res.status, users: collectUsers(res.data) };
}

export async function findWbUserByPhone(
    token: string,
    phone: string,
): Promise<{ user: Record<string, unknown> | null; pending: boolean; error?: string }> {
    const active = await listWbUsers(token, false);
    if (!active.ok) return { user: null, pending: false, error: active.error };
    const foundActive = findUserByPhone(active.users, phone);
    if (foundActive) return { user: foundActive, pending: false };
    const invited = await listWbUsers(token, true);
    const foundInvited = findUserByPhone(invited.users, phone);
    return { user: foundInvited, pending: Boolean(foundInvited) };
}
