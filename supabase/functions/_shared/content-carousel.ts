/** План слайдов карусели 1080×1350 (4:5). Рендер PNG — в content-carousel-render.ts (Deno). */

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const PHOTO_PAGES = 3;
export const SLIDE_KINDS = ['cover', 'collage', 'photo', 'info', 'brand'] as const;
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
    description?: string;
};

export type SlideOverlay = {
    headline: string;
    line: string;
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
    description: string;
    headline: string;
    line: string;
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
    const slots = input.slots == null ? 8 : input.slots;
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
    const used = new Set([cover, ...photos.slice(1, 5)].filter(Boolean));
    const rest = photos.filter((u) => u && !used.has(u));
    const pool = rest.length ? rest : (photos.slice(1).length ? photos.slice(1) : (cover ? [cover] : []));
    const plains: string[] = [];
    for (let i = 0; i < PHOTO_PAGES; i++) {
        const u = pool[i] || pool[i % Math.max(pool.length, 1)];
        if (u) plains.push(u);
    }
    const title = shortSeo(String(input.title || '').trim(), 60);
    const composition = String(input.composition || '').trim();
    const brand = String(input.brand || '').trim() || 'NR';
    const price = nPrice(input.price);
    const vendorCode = String(input.vendorCode || '').trim();
    const description = String(input.description || '').trim();
    const base = {
        width: SLIDE_W, height: SLIDE_H, title, nmId, composition, brand, price, vendorCode, description,
        headline: '', line: '',
    };
    const raw: SlidePlan[] = [
        { ...base, kind: 'cover', photos: cover ? [cover] : [] },
        { ...base, kind: 'collage', photos: details.slice(0, 4) },
        ...plains.map((u) => ({ ...base, kind: 'photo' as const, photos: [u] })),
        { ...base, kind: 'info', photos: [] },
        { ...base, kind: 'brand', photos: [] },
    ];
    const overlays = layoutSeoOverlays(raw.map((p) => p.kind), input);
    return raw.map((p, i) => ({ ...p, headline: overlays[i].headline, line: overlays[i].line }));
}

export const SEO_HEADLINE_MAX = 32;
export const SEO_LINE_MAX = 52;

const SEO_STOP = new Set([
    'и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'по', 'для', 'из', 'от', 'до',
    'или', 'а', 'но', 'как', 'при', 'без', 'над', 'под', 'о', 'об', 'про',
    'же', 'ли', 'бы', 'это', 'этот', 'эта', 'эти', 'тот', 'та', 'те', 'не',
    'ни', 'да', 'у', 'за', 'через',
]);

export function seoToken(word: unknown): string {
    const w = String(word || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');
    if (!w || SEO_STOP.has(w)) return '';
    const stem = w.replace(/(иями|ями|ами|ого|ему|ому|ыми|ими|ов|ев|ей|ой|ий|ый|ая|ое|ее|ые|ие|ую|юю|ах|ях|ам|ям|ом|ем|а|я|о|е|у|ю|ы|и|ь)$/i, '');
    return stem.length >= 4 ? stem : w;
}

export function dedupeSeoText(text: unknown): string {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of words) {
        const t = seoToken(w);
        if (t && seen.has(t)) continue;
        if (t) seen.add(t);
        out.push(w);
    }
    return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function withoutUsedSeo(text: unknown, used: Set<string>): string {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const out: string[] = [];
    for (const w of words) {
        const t = seoToken(w);
        if (t && used.has(t)) continue;
        out.push(w);
        if (t) used.add(t);
    }
    return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function shortSeo(text: unknown, max = SEO_HEADLINE_MAX): string {
    return clipText(dedupeSeoText(text), max);
}

export function clipText(s: unknown, max: number): string {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= max) return t;
    const cut = t.slice(0, Math.max(1, max - 1));
    const sp = cut.lastIndexOf(' ');
    return ((sp > max * 0.45 ? cut.slice(0, sp) : cut).trim() || cut.trim()) + '…';
}

export function splitSeoSentences(text: unknown): string[] {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?…;])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 8);
}

function splitHeadlineLine(sentence: string, used?: Set<string>): SlideOverlay {
    const bag = used || new Set<string>();
    const t = withoutUsedSeo(dedupeSeoText(sentence), bag);
    if (!t) return { headline: '', line: '' };
    const words = t.split(' ').filter(Boolean);
    if (words.length <= 4 && t.length <= SEO_HEADLINE_MAX) return { headline: clipText(t, SEO_HEADLINE_MAX), line: '' };
    const n = Math.min(4, Math.max(2, Math.ceil(words.length / 3)));
    return {
        headline: clipText(words.slice(0, n).join(' '), SEO_HEADLINE_MAX),
        line: clipText(words.slice(n).join(' '), SEO_LINE_MAX),
    };
}

/** SEO-описание WB по слайдам: короткие слова, без повторов корня. */
export function layoutSeoOverlays(
    kinds: SlideKind[],
    input: { description?: string; title?: string; composition?: string; brand?: string },
): SlideOverlay[] {
    const sentences = splitSeoSentences(input.description || '');
    const title = shortSeo(input.title, SEO_HEADLINE_MAX);
    const composition = shortSeo(input.composition, SEO_LINE_MAX);
    const used = new Set<string>();
    let i = 0;
    const take = () => sentences[i++] || '';
    let photos = 0;
    return kinds.map((kind) => {
        if (kind === 'cover') {
            const hook = take();
            const headline = title || shortSeo(hook, SEO_HEADLINE_MAX);
            collectSeoInto(headline, used);
            const line = clipText(withoutUsedSeo(hook, used), SEO_LINE_MAX);
            return { headline, line };
        }
        if (kind === 'collage') return { headline: '', line: '' };
        if (kind === 'photo') {
            photos += 1;
            if (photos === 2 && composition) {
                const already = sentences.some((s) => composition.length >= 4 && s.toLowerCase().includes(composition.slice(0, 8).toLowerCase()));
                if (!already) {
                    collectSeoInto(composition, used);
                    return { headline: 'Состав', line: composition };
                }
            }
            return splitHeadlineLine(take() || (photos === 1 ? composition : ''), used);
        }
        return { headline: '', line: '' };
    });
}

function collectSeoInto(text: string, used: Set<string>) {
    withoutUsedSeo(text, used);
}

export function parseGptOverlayJson(
    raw: unknown,
    kinds: SlideKind[],
    fallback: SlideOverlay[],
): SlideOverlay[] {
    let data: unknown = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
        try { data = JSON.parse(trimmed); } catch { return fallback; }
    }
    const obj = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : null;
    const list = Array.isArray(data) ? data : (obj && (obj.overlays || obj.slides));
    if (!Array.isArray(list)) return fallback;
    const used = new Set<number>();
    const stems = new Set<string>();
    return kinds.map((kind, i) => {
        let row: Record<string, unknown> | null = null;
        const at = list[i];
        if (at && typeof at === 'object' && !Array.isArray(at)) {
            const k = String((at as Record<string, unknown>).kind || kind);
            if (k === kind) {
                used.add(i);
                row = at as Record<string, unknown>;
            }
        }
        if (!row) {
            const idx = list.findIndex((item, j) => {
                if (used.has(j) || !item || typeof item !== 'object' || Array.isArray(item)) return false;
                return String((item as Record<string, unknown>).kind || '') === kind;
            });
            if (idx >= 0) {
                used.add(idx);
                row = list[idx] as Record<string, unknown>;
            }
        }
        if (!row) return fallback[i] || { headline: '', line: '' };
        const headline = shortSeo(String(row.headline ?? row.title ?? ''), SEO_HEADLINE_MAX);
        const lineRaw = dedupeSeoText(String(row.line ?? row.text ?? row.body ?? ''));
        const head = withoutUsedSeo(headline, stems);
        const line = clipText(withoutUsedSeo(lineRaw, stems), SEO_LINE_MAX);
        if (!head && !line) return fallback[i] || { headline: '', line: '' };
        return { headline: head, line };
    });
}

export function applyOverlays(plans: SlidePlan[], overlays: SlideOverlay[]): SlidePlan[] {
    return plans.map((p, i) => {
        const o = overlays[i] || { headline: p.headline, line: p.line };
        return { ...p, headline: o.headline || '', line: o.line || '' };
    });
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

export function pickCardDescription(card: Record<string, unknown> | null | undefined): string {
    if (!card) return '';
    return String(card.description || card.imtDescription || card.desc || '').replace(/\s+/g, ' ').trim();
}

export function parseWbCard(card: Record<string, unknown> | null | undefined): {
    nmId: number;
    title: string;
    photos: string[];
    price: number | null;
    composition: string;
    vendorCode: string;
    brand: string;
    description: string;
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
        description: pickCardDescription(c),
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
