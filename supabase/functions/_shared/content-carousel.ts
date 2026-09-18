/** План слайдов карусели 1080×1350 (4:5). Рендер PNG — в content-carousel-render.ts (Deno). */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const SLIDE_KINDS = ['cover', 'collage', 'info', 'brand'] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

export type CarouselInput = {
    photos?: string[];
    extraPhotos?: string[];
    title?: string;
    nmId?: number | string;
    composition?: string;
    brand?: string;
    price?: number | string | null;
    vendorCode?: string;
};

export type SlidePlan = {
    kind: SlideKind;
    width: number;
    height: number;
    photos: string[];
    title: string;
    nmId: number;
    composition: string;
    brand: string;
    price: number | null;
    vendorCode: string;
};

export type CollageCell = { x: number; y: number; w: number; h: number };

export function uniqUrls(urls: unknown): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(urls) ? urls : []) {
        let u = String(raw || '').trim();
        if (u.startsWith('//')) u = 'https:' + u;
        if (!u || seen.has(u)) continue;
        seen.add(u);
        out.push(u);
    }
    return out;
}

/** nmId из CDN-пути WB (`…/247347214/images/big/1.webp`). Иначе 0. */
export function nmIdFromPhotoUrl(url: unknown): number {
    const m = String(url || '').match(/\/(\d{6,})\/images\//);
    return m ? Number(m[1]) : 0;
}

export function photoUrlFitsNmId(url: unknown, nmId: unknown): boolean {
    const id = Number(nmId);
    if (!id) return false;
    const inUrl = nmIdFromPhotoUrl(url);
    if (inUrl) return inUrl === id;
    return true;
}

/** Только URL этого nmId. Чужие WB-карточки («похожие») отбрасываем. */
export function photosForNmId(urls: unknown, nmId: unknown): string[] {
    const id = Number(nmId);
    if (!id) return [];
    return uniqUrls(urls).filter((u) => photoUrlFitsNmId(u, id));
}

export function wbBasketHostFromUrl(url: unknown): number {
    const m = String(url || '').match(/basket-(\d+)\.wbbasket\.ru/i);
    return m ? Number(m[1]) : 0;
}

export function wbBasketSlotUrl(host: number, nmId: number, slot: number): string {
    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    const bStr = String(host).padStart(2, '0');
    return `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nmId}/images/big/${slot}.webp`;
}

export function galleryUrlsFromManual(manual: unknown, nmId: unknown): string[] {
    const id = Number(nmId);
    if (!id || !manual || typeof manual !== 'object') return [];
    const gal = (manual as Record<string, unknown>).cached_gallery_urls;
    if (!gal || typeof gal !== 'object' || Array.isArray(gal)) return [];
    const rec = gal as Record<string, unknown>;
    const urls = Object.keys(rec)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => String(rec[k] || ''));
    return photosForNmId(urls, id);
}

/** Фото только этого nmId: карточка WB + photo_url + галерея РНП + слоты того же basket. */
export function bindExactArticlePhotos(input: {
    nmId: unknown;
    cardPhotos?: unknown;
    articlePhoto?: unknown;
    gallery?: unknown;
    slots?: number;
}): string[] {
    const id = Number(input.nmId);
    if (!id) return [];
    const raw = [
        ...(Array.isArray(input.cardPhotos) ? input.cardPhotos : []),
        input.articlePhoto,
        ...(Array.isArray(input.gallery) ? input.gallery : []),
    ];
    const bound = photosForNmId(raw, id);
    const slots = input.slots == null ? 5 : input.slots;
    if (bound.length >= slots) return bound;
    const host = bound.map(wbBasketHostFromUrl).find((h) => h > 0) || 0;
    if (!host) return bound;
    const extra: string[] = [];
    for (let s = 1; s <= slots; s++) extra.push(wbBasketSlotUrl(host, id, s));
    return uniqUrls([...bound, ...extra]);
}

export function collageCells(gap = 28): CollageCell[] {
    const cellW = (SLIDE_W - gap * 3) / 2;
    const cellH = (SLIDE_H - gap * 3) / 2;
    return [
        { x: gap, y: gap, w: cellW, h: cellH },
        { x: gap * 2 + cellW, y: gap, w: cellW, h: cellH },
        { x: gap, y: gap * 2 + cellH, w: cellW, h: cellH },
        { x: gap * 2 + cellW, y: gap * 2 + cellH, w: cellW, h: cellH },
    ];
}

function nPrice(v: unknown): number | null {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 10000000 ? n / 100 : n;
}

export function planCarouselSlides(input: CarouselInput): SlidePlan[] {
    const nmId = Number(input.nmId) || 0;
    const photos = uniqUrls([
        ...photosForNmId(input.photos || [], nmId),
        ...photosForNmId(input.extraPhotos || [], nmId),
    ]);
    const cover = photos[0] || '';
    const details = photos.slice(1, 5);
    while (details.length < 4 && cover) details.push(cover);
    const title = String(input.title || '').trim();
    const composition = String(input.composition || '').trim();
    const brand = String(input.brand || '').trim() || 'NR';
    const price = nPrice(input.price);
    const vendorCode = String(input.vendorCode || '').trim();
    const base = { width: SLIDE_W, height: SLIDE_H, title, nmId, composition, brand, price, vendorCode };
    return [
        { ...base, kind: 'cover', photos: cover ? [cover] : [] },
        { ...base, kind: 'collage', photos: details.slice(0, 4) },
        { ...base, kind: 'info', photos: [] },
        { ...base, kind: 'brand', photos: [] },
    ];
}

export function pickComposition(card: Record<string, unknown> | null | undefined): string {
    if (!card) return '';
    const bags = [card.options, card.addin, card.characteristics, card.needKiz];
    for (const bag of bags) {
        if (!Array.isArray(bag)) continue;
        for (const row of bag) {
            if (!row || typeof row !== 'object') continue;
            const o = row as Record<string, unknown>;
            const name = String(o.name || o.title || o.key || '');
            if (!/состав|composition/i.test(name)) continue;
            const val = o.value ?? o.val ?? o.text;
            if (Array.isArray(val)) return val.map(String).filter(Boolean).join(', ');
            const s = String(val || '').trim();
            if (s) return s;
        }
    }
    return '';
}

export function pickCardPrice(card: Record<string, unknown> | null | undefined): number | null {
    if (!card) return null;
    const sizes = card.sizes;
    if (Array.isArray(sizes)) {
        for (const s of sizes) {
            if (!s || typeof s !== 'object') continue;
            const o = s as Record<string, unknown>;
            const p = nPrice(o.discountedPrice ?? o.price ?? o.salePrice);
            if (p != null) return p;
        }
    }
    return nPrice(card.price ?? card.salePrice);
}

export function parseWbCard(card: Record<string, unknown> | null | undefined): {
    nmId: number;
    title: string;
    photos: string[];
    price: number | null;
    composition: string;
    vendorCode: string;
    brand: string;
} {
    const c = card || {};
    const nmId = Number(c.nmID ?? c.nmId ?? c.nm_id ?? 0) || 0;
    const title = String(c.title ?? c.imtName ?? c.vendorCode ?? (nmId ? `Артикул ${nmId}` : '')).trim();
    const rawPhotos = Array.isArray(c.photos) ? c.photos : [];
    const photosRaw = uniqUrls(rawPhotos.map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
            const o = p as Record<string, unknown>;
            return o.big || o.c516x688 || o.c246x328 || o.tm || '';
        }
        return '';
    }));
    const photos = nmId ? photosForNmId(photosRaw, nmId) : photosRaw;
    return {
        nmId,
        title,
        photos,
        price: pickCardPrice(c),
        composition: pickComposition(c),
        vendorCode: String(c.vendorCode || c.vendor_code || '').trim(),
        brand: String(c.brand || c.brandName || '').trim(),
    };
}

/** Только карточка с этим nmId. Похожие из textSearch отбрасываем. */
export function pickCardByNmId(cards: unknown, nmId: unknown): ReturnType<typeof parseWbCard> | null {
    const id = Number(nmId);
    if (!id) return null;
    const list = Array.isArray(cards) ? cards : [];
    for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const parsed = parseWbCard(raw as Record<string, unknown>);
        if (parsed.nmId === id) return parsed;
    }
    return null;
}
