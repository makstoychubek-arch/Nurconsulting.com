// Адаптер WB Marketplace FBS → нормализованные строки заказов.
// Ozon можно добавить рядом с тем же FbsOrderRow.

import { sanitizeWbToken } from './wb-cabinet-tokens.ts';

const MARKETPLACE_API = 'https://marketplace-api.wildberries.ru';
const CONTENT_API = 'https://content-api.wildberries.ru';

export type MarketplaceSource = 'wb' | 'ozon';

export type FbsOrderRow = {
    marketplace: MarketplaceSource;
    cabinet: string;
    orderId: string;
    nmId: number | null;
    barcode: string;
    article: string;
    productName: string;
    size: string;
    qty: number;
    orderCreatedAt: Date;
};

type WbFbsOrder = {
    id?: number;
    nmId?: number;
    chrtId?: number;
    article?: string;
    skus?: string[];
    createdAt?: string;
    deliveryType?: string;
};

type ContentSize = {
    techSize?: string;
    wbSize?: string;
    chrtID?: number;
    chrtId?: number;
    skus?: string[];
};

type ContentCard = {
    nmID?: number;
    nmId?: number;
    title?: string;
    vendorCode?: string;
    sizes?: ContentSize[];
};

/** Календарные сутки reportDate в Бишкеке (UTC+6) → unix dateFrom/dateTo. */
export function bishkekDayUnixRange(reportDate: string): { dateFrom: number; dateTo: number } {
    const [y, m, d] = reportDate.split('-').map(Number);
    // 00:00 Бишкек = предыдущий день 18:00 UTC
    const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 6 * 3600 * 1000;
    const endUtcMs = startUtcMs + 24 * 3600 * 1000 - 1000;
    return {
        dateFrom: Math.floor(startUtcMs / 1000),
        dateTo: Math.floor(endUtcMs / 1000),
    };
}

export function yesterdayBishkek(): string {
    const nowBishkek = new Date(Date.now() + 6 * 3600 * 1000);
    nowBishkek.setUTCDate(nowBishkek.getUTCDate() - 1);
    return nowBishkek.toISOString().slice(0, 10);
}

export function prettyRuDate(isoDate: string): string {
    const [y, m, d] = isoDate.split('-');
    return `${d}.${m}.${y}`;
}

export async function fetchWbFbsOrdersForDay(
    tokenRaw: string,
    cabinet: string,
    reportDate: string,
): Promise<FbsOrderRow[]> {
    const token = sanitizeWbToken(tokenRaw);
    if (!token) throw new Error('empty wb token');

    const { dateFrom, dateTo } = bishkekDayUnixRange(reportDate);
    const raw = await fetchAllWbOrders(token, dateFrom, dateTo);
    const catalog = await buildCatalogMap(token, raw);

    const rows: FbsOrderRow[] = [];
    for (const o of raw) {
        if (o.deliveryType && o.deliveryType !== 'fbs') continue;
        const barcode = String(o.skus?.[0] || '').trim();
        if (!barcode) continue;
        const created = o.createdAt ? new Date(o.createdAt) : null;
        if (!created || Number.isNaN(created.getTime())) continue;

        const nmId = Number(o.nmId || 0) || null;
        const chrtId = Number(o.chrtId || 0) || 0;
        const article = String(o.article || '').trim();
        const meta = (nmId && catalog.get(nmId)) || null;
        const size = (chrtId && meta?.sizeByChrt.get(chrtId)) ||
            meta?.sizeBySku.get(barcode) ||
            '';
        const productName = meta?.title || humanizeArticle(article) || article || barcode;

        rows.push({
            marketplace: 'wb',
            cabinet,
            orderId: String(o.id ?? ''),
            nmId,
            barcode,
            article,
            productName,
            size,
            qty: 1,
            orderCreatedAt: created,
        });
    }
    return rows;
}

async function fetchAllWbOrders(token: string, dateFrom: number, dateTo: number): Promise<WbFbsOrder[]> {
    const out: WbFbsOrder[] = [];
    // next — курсор WB, иногда > Number.MAX_SAFE_INTEGER → держим строкой
    let next = '0';
    for (let page = 0; page < 50; page++) {
        const url =
            `${MARKETPLACE_API}/api/v3/orders?limit=1000&next=${encodeURIComponent(next)}` +
            `&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const res = await fetch(url, {
            headers: { Authorization: token },
            signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`WB FBS orders HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = await res.json() as { orders?: WbFbsOrder[]; next?: number | string };
        const chunk = data.orders || [];
        out.push(...chunk);
        const n = data.next == null ? '' : String(data.next).trim();
        if (!chunk.length || !n || n === '0') break;
        // Если страница неполная — дальше обычно пусто
        if (chunk.length < 1000) break;
        next = n;
        await sleep(250);
    }
    return out;
}

type CatalogEntry = {
    title: string;
    sizeByChrt: Map<number, string>;
    sizeBySku: Map<string, string>;
};

async function buildCatalogMap(token: string, orders: WbFbsOrder[]): Promise<Map<number, CatalogEntry>> {
    const nmIds = [...new Set(orders.map((o) => Number(o.nmId || 0)).filter(Boolean))];
    const map = new Map<number, CatalogEntry>();
    for (const nmId of nmIds) {
        try {
            const card = await fetchContentCard(token, nmId);
            if (!card) continue;
            const entry: CatalogEntry = {
                title: String(card.title || '').trim(),
                sizeByChrt: new Map(),
                sizeBySku: new Map(),
            };
            for (const s of card.sizes || []) {
                const size = String(s.techSize || s.wbSize || '').trim();
                const chrt = Number(s.chrtID ?? s.chrtId ?? 0);
                if (chrt && size) entry.sizeByChrt.set(chrt, size);
                for (const sku of s.skus || []) {
                    if (sku && size) entry.sizeBySku.set(String(sku), size);
                }
            }
            map.set(nmId, entry);
            await sleep(120);
        } catch (e) {
            console.warn('[wb-fbs-orders] content card', nmId, String(e));
        }
    }
    return map;
}

async function fetchContentCard(token: string, nmId: number): Promise<ContentCard | null> {
    const body = {
        settings: {
            filter: { textSearch: String(nmId), withPhoto: -1 },
            cursor: { limit: 100 },
        },
    };
    const res = await fetch(`${CONTENT_API}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { cards?: ContentCard[] };
    const cards = data.cards || [];
    return cards.find((c) => Number(c.nmID ?? c.nmId ?? 0) === nmId) || cards[0] || null;
}

/** пиджак_NEW_красный → Пиджак NEW красный */
export function humanizeArticle(article: string): string {
    const raw = article.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}
