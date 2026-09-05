// Разбор и запись ставок WB Promotion API (аукцион type 9).
// Ставки в /adv/v1/bids — в копейках (1500 = 15 ₽).
// deno-lint-ignore-file no-explicit-any

export const ADV_API = 'https://advert-api.wildberries.ru';

export type BidPlacement = 'search' | 'recommendations' | 'combined';

export type ExtractedBid = {
    nm_id: number;
    placement: BidPlacement;
    bid_kopecks: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function nmIdsFrom(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const out: number[] = [];
    for (const n of value) {
        if (typeof n === 'number' && n > 0) out.push(n);
        else if (typeof n === 'string' && Number(n) > 0) out.push(Number(n));
        else if (n && typeof n === 'object') {
            const rec = n as Record<string, unknown>;
            const id = Number(rec.nm ?? rec.nmId ?? rec.nm_id ?? rec.id ?? 0);
            if (id) out.push(id);
        }
    }
    return [...new Set(out)];
}

function rawBid(obj: unknown): number {
    if (typeof obj === 'number') return obj;
    const rec = asRecord(obj);
    if (!rec) return 0;
    return Number(rec.bid ?? rec.bid_kopecks ?? rec.cpm ?? rec.price ?? rec.searchCPM ?? 0);
}

/** Значения < 1000 почти всегда рубли из v2/adverts; /adv/v1/bids ждёт копейки. */
export function normalizeBidKopecks(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (raw < 1000) return Math.round(raw * 100);
    return Math.round(raw);
}

export function extractBidsFromAdvert(advert: Record<string, unknown> | null | undefined): ExtractedBid[] {
    if (!advert) return [];
    const out: ExtractedBid[] = [];
    const bidType = String(advert.bid_type ?? advert.bidType ?? '').toLowerCase();
    const defaultPlacement: BidPlacement = bidType === 'manual' ? 'search' : 'combined';
    const settings = asRecord(advert.settings) || {};

    const lists: unknown[] = [
        advert.unitedParams,
        advert.united_params,
        settings.unitedParams,
        settings.united_params,
        advert.params,
        advert.autoParams,
        advert.auto_params,
        settings.autoParams,
    ];

    for (const list of lists) {
        const arr = Array.isArray(list) ? list : list ? [list] : [];
        for (const item of arr) {
            const rec = asRecord(item);
            if (!rec) continue;
            const nms = nmIdsFrom(rec.nms ?? rec.nmIds ?? rec.nm_ids);
            const searchBid = rawBid(rec.search ?? rec.search_bid);
            const recsBid = rawBid(rec.recommendations ?? rec.recom ?? rec.recom_bid);
            const combined = rawBid(rec.bid ?? rec.cpm ?? rec.price);

            if (Array.isArray(rec.nms)) {
                for (const n of rec.nms) {
                    if (!n || typeof n !== 'object') continue;
                    const nr = n as Record<string, unknown>;
                    const id = Number(nr.nm ?? nr.nmId ?? nr.nm_id ?? 0);
                    const b = rawBid(nr);
                    if (id && b) {
                        out.push({
                            nm_id: id,
                            placement: defaultPlacement,
                            bid_kopecks: normalizeBidKopecks(b),
                        });
                    }
                }
            }

            for (const nm of nms) {
                if (searchBid) {
                    out.push({ nm_id: nm, placement: 'search', bid_kopecks: normalizeBidKopecks(searchBid) });
                }
                if (recsBid) {
                    out.push({ nm_id: nm, placement: 'recommendations', bid_kopecks: normalizeBidKopecks(recsBid) });
                }
                if (!searchBid && !recsBid && combined) {
                    out.push({ nm_id: nm, placement: defaultPlacement, bid_kopecks: normalizeBidKopecks(combined) });
                }
            }
        }
    }

    const map = new Map<string, ExtractedBid>();
    for (const b of out) {
        if (!b.nm_id || !b.bid_kopecks) continue;
        map.set(`${b.nm_id}:${b.placement}`, b);
    }
    return [...map.values()];
}

export async function fetchAdvertById(
    token: string,
    advertId: number,
): Promise<Record<string, unknown> | null> {
    const urls = [
        `${ADV_API}/api/advert/v2/adverts?ids=${advertId}`,
        `${ADV_API}/api/advert/v2/adverts?statuses=4%2C9%2C11&ids=${advertId}`,
    ];
    for (const url of urls) {
        try {
            const res = await fetch(url, { headers: { Authorization: token } });
            const text = await res.text();
            if (!res.ok) {
                console.warn('[wb-advert-bids] fetchAdvert', res.status, text.slice(0, 200));
                continue;
            }
            const data = text ? JSON.parse(text) : null;
            const adverts: Record<string, unknown>[] = data?.adverts || (Array.isArray(data) ? data : []);
            const found = adverts.find((a) => Number(a.advertId ?? a.id ?? a.advert_id ?? 0) === advertId);
            if (found) return found;
        } catch (e) {
            console.warn('[wb-advert-bids] fetchAdvert error:', String(e));
        }
    }
    return null;
}

function parseMinBidsPayload(data: unknown, fallbackPlacement: BidPlacement): ExtractedBid[] {
    const out: ExtractedBid[] = [];
    const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }
        const rec = asRecord(node);
        if (!rec) return;
        const nm = Number(rec.nm_id ?? rec.nmId ?? rec.nm ?? 0);
        const bid = Number(rec.bid_kopecks ?? rec.bid ?? rec.min_bid ?? rec.minBid ?? 0);
        const placement = String(rec.placement || fallbackPlacement) as BidPlacement;
        if (nm && bid) {
            out.push({
                nm_id: nm,
                placement: (['search', 'recommendations', 'combined'].includes(placement)
                    ? placement
                    : fallbackPlacement),
                bid_kopecks: normalizeBidKopecks(bid),
            });
        }
        for (const key of ['items', 'nms', 'nm_bids', 'bids', 'result']) {
            if (rec[key]) walk(rec[key]);
        }
    };
    walk(data);
    const map = new Map<string, ExtractedBid>();
    for (const b of out) map.set(`${b.nm_id}:${b.placement}`, b);
    return [...map.values()];
}

export async function fetchMinBids(
    token: string,
    advertId: number,
    nmIds: number[] = [],
    placement: BidPlacement = 'search',
): Promise<ExtractedBid[]> {
    const bodies: unknown[] = [
        { items: [{ advert_id: advertId, nm_ids: nmIds }] },
        { advert_id: advertId, nm_ids: nmIds },
        { ids: [advertId] },
    ];
    for (const body of bodies) {
        try {
            const res = await fetch(`${ADV_API}/adv/v1/bids/min`, {
                method: 'POST',
                headers: { Authorization: token, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) {
                console.warn('[wb-advert-bids] bids/min', res.status, text.slice(0, 200));
                continue;
            }
            const data = text ? JSON.parse(text) : null;
            const parsed = parseMinBidsPayload(data, placement);
            if (parsed.length) return parsed;
        } catch (e) {
            console.warn('[wb-advert-bids] bids/min error:', String(e));
        }
    }
    return [];
}

export async function setAdvertBids(
    token: string,
    advertId: number,
    nmBids: ExtractedBid[],
): Promise<{ ok: boolean; status: number; body: string }> {
    const payload = {
        bids: [{
            advert_id: advertId,
            nm_bids: nmBids.map((b) => ({
                nm_id: b.nm_id,
                bid_kopecks: Math.round(b.bid_kopecks),
                placement: b.placement,
            })),
        }],
    };
    const urls = [`${ADV_API}/adv/v1/bids`, `${ADV_API}/api/advert/v1/bids`];
    let last = { ok: false, status: 0, body: '' };
    for (const url of urls) {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await res.text();
        last = { ok: res.ok, status: res.status, body: body.slice(0, 400) };
        if (res.ok || (res.status !== 404 && res.status !== 405)) return last;
    }
    return last;
}

export function collectNmIds(advert: Record<string, unknown> | null | undefined, bids: ExtractedBid[]): number[] {
    const ids = new Set<number>(bids.map((b) => b.nm_id));
    if (!advert) return [...ids];
    const settings = asRecord(advert.settings) || {};
    for (const list of [advert.nms, settings.nms, advert.nm_ids, settings.nm_ids]) {
        for (const id of nmIdsFrom(list)) ids.add(id);
    }
    return [...ids];
}
