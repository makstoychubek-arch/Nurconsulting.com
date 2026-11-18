// Фото карточек Ozon для А/Б-тестов: прочитать картинки товара и поставить новое главное фото.
// Ozon хранит главное фото отдельно (primary_image), остальные в images; при записи главное задаётся полем primary_image. Форма ответа v3/product/info/list сверена живым запросом 14 ноября 2026.

import { ozonCall, type FetchFn, type OzonCreds } from './ozon-api.ts';

export interface OzonCardImages { product_id: number; offer_id: string; primary: string | null; rest: string[] }

const urls = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(String).filter((u) => /^https?:\/\//.test(u));

/** Картинки товаров: главная и остальные (главная в «остальных» не повторяется). */
export function parseCardImages(items: Record<string, unknown>[]): OzonCardImages[] {
    return items.map((it) => {
        const primary = urls(it.primary_image)[0] ?? null;
        const all = urls(it.images);
        return { product_id: Number(it.id), offer_id: String(it.offer_id ?? ''), primary: primary ?? all[0] ?? null, rest: all.filter((u) => u !== primary && u !== (primary ?? all[0])) };
    });
}

/** Что отправить в Ozon: главное фото и остальные (все исходные фото карточки без главного, не больше 14: предел Ozon при заданном primary_image). */
export function buildImageList(photo: string, all: string[]): { primary_image: string; images: string[] } {
    const images: string[] = [];
    for (const u of all) if (u && u !== photo && !images.includes(u)) images.push(u);
    return { primary_image: photo, images: images.slice(0, 14) };
}

export async function getOzonCards(creds: OzonCreds, productIds: number[], fetchFn: FetchFn): Promise<OzonCardImages[]> {
    const out: OzonCardImages[] = [];
    for (let i = 0; i < productIds.length; i += 100) {
        const r = await ozonCall(creds, '/v3/product/info/list', { product_id: productIds.slice(i, i + 100) }, fetchFn);
        out.push(...parseCardImages((r.items as Record<string, unknown>[]) || []));
    }
    return out;
}

/** Ставит photo главным у одного товара Ozon, остальные фото (all: исходные фото карточки) сохраняет.
 *  Метод v2/product/pictures/import (v1 Ozon отключил, проверено живым запросом 14 ноября 2026): изменение видно в карточке за секунды. */
export async function setOzonMainPhoto(
    creds: OzonCreds, offerId: string, photo: string, all: string[], fetchFn: FetchFn,
): Promise<{ ok: boolean; error?: string }> {
    if (!offerId || !/^https?:\/\//.test(photo)) return { ok: false, error: 'нужны offer_id и ссылка на фото' };
    try {
        await ozonCall(creds, '/v2/product/pictures/import', { items: [{ offer_id: offerId, ...buildImageList(photo, all) }] }, fetchFn);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: String((e as Error)?.message || e).slice(0, 200) };
    }
}
