/**
 * Главное фото карточки WB — слот 1 на CDN basket-XX (/images/big/1.webp).
 * Слот 2 — второе фото; если после media_save хеш слота 1 меняется,
 * а слот 2 нет, ротация реально меняет обложку, а не галерею.
 */

import { WB_MAIN_PHOTO_SLOT } from './ab-test-report-card.ts';

// Хосты WB давно ушли за 26: артикулы 2026 года лежат на basket-48 и дальше,
// и с прежним потолком проба не находила фото у всех новых карточек.
const MAX_BASKET = 60;
const BASKET_PROBE_BATCH = 12;

export { WB_MAIN_PHOTO_SLOT };

export function wbBasketPhotoUrl(basket: number, nmId: number, slot: number): string {
    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    const bStr = String(basket).padStart(2, '0');
    return `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/${slot}.webp`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function probeWbBasketHost(nmId: number): Promise<number | null> {
    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    for (let start = 1; start <= MAX_BASKET; start += BASKET_PROBE_BATCH) {
        const batch = Array.from(
            { length: Math.min(BASKET_PROBE_BATCH, MAX_BASKET - start + 1) },
            (_, i) => start + i,
        );
        const results = await Promise.all(batch.map(async (b) => {
            const bStr = String(b).padStart(2, '0');
            const url = `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
            try {
                const res = await fetch(url, { method: 'GET' });
                return res.ok ? b : null;
            } catch {
                return null;
            }
        }));
        const found = results.find((r) => r != null);
        if (found != null) return found;
    }
    return null;
}

export async function hashWbPhotoSlot(
    basket: number,
    nmId: number,
    slot: number,
): Promise<{ url: string; sha: string; size: number } | null> {
    const url = `${wbBasketPhotoUrl(basket, nmId, slot)}?t=${Date.now()}`;
    try {
        const res = await fetch(url, {
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length < 200) return null;
        return { url: wbBasketPhotoUrl(basket, nmId, slot), sha: await sha256Hex(bytes), size: bytes.length };
    } catch {
        return null;
    }
}

export function mainPhotoChanged(
    before: { sha: string } | null,
    after: { sha: string } | null,
    slot2Before?: { sha: string } | null,
    slot2After?: { sha: string } | null,
): { ok: boolean; slot1Changed: boolean; slot2Stable: boolean | null } {
    const slot1Changed = Boolean(before && after && before.sha !== after.sha);
    const slot2Stable = (slot2Before && slot2After) ? slot2Before.sha === slot2After.sha : null;
    return { ok: slot1Changed && slot2Stable !== false, slot1Changed, slot2Stable };
}

export function extractMainPhotoUrl(card: Record<string, unknown> | null | undefined): string {
    const photos = (card?.photos as Array<Record<string, string>> | undefined) || [];
    const first = photos[0] || {};
    let u = first.big || first.c516x688 || first.c246x328 || first.square || first.tm || '';
    if (u.startsWith('//')) u = 'https:' + u;
    return u;
}

/** Готовый URL обложки из РНП / карточки — без пробы CDN. */
export function pickCachedPhotoUrl(raw: unknown): string | null {
    let url = String(raw || '').trim();
    if (!url) return null;
    if (url.startsWith('//')) url = `https:${url}`;
    return /^https?:\/\//i.test(url) ? url : null;
}

/** Обложка карточки: сначала кэш, иначе проба basket-XX как у отзывов. */
export async function resolveWbCardPhotoUrl(
    nmId: number,
    cachedUrl?: string | null,
): Promise<string | null> {
    const cached = pickCachedPhotoUrl(cachedUrl);
    if (cached) return cached;
    const id = Number(nmId) || 0;
    if (!id) return null;
    const basket = await probeWbBasketHost(id);
    if (!basket) return null;
    return wbBasketPhotoUrl(basket, id, WB_MAIN_PHOTO_SLOT);
}
