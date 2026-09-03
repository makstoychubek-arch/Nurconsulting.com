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

export type AccessPreset = 'standard' | 'manager' | 'readonly';

export function accessPresetItems(preset: AccessPreset): Array<{ code: string; disabled: boolean }> | undefined {
    if (preset === 'standard') return undefined;
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
    return String(rec.errorText || rec.message || rec.detail || rec.error || res.text || `WB ${res.status}`).slice(0, 400);
}
