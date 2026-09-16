/**
 * Поисковые кластеры кампании: тела запросов, разбор ответов и склейка в одну
 * таблицу для экрана «Кластеры» (ставка CPM по каждому кластеру).
 *
 * Спека: docs/wb-openapi-promotion.md
 *   POST /adv/v0/normquery/list      → items[{ advertId, nmId }]          (camelCase!)
 *   POST /adv/v0/normquery/stats     → items[{ advert_id, nm_id }] + from/to
 *   POST /adv/v0/normquery/get-bids  → items[{ advert_id, nm_id }]
 *   POST /adv/v0/normquery/get-minus → items[{ advert_id, nm_id }]
 *   POST /adv/v0/normquery/set-minus → { advert_id, nm_id, norm_queries }
 *   POST /api/advert/v1/normquery/bids → bids[{ advertId, nmId, normQuery, bidMinorUnits }]
 *   GET  /api/advert/v0/bids/recommendations?advertId=&nmId= → коридор ставок
 *
 * Ставку ставим только через v1: bidMinorUnits — 0,01 валюты кабинета (у нас KGS),
 * шаг берём из GET /api/advert/v1/config.
 */

export const CLUSTER_ITEMS_LIMIT = 100;
export const MINUS_QUERIES_LIMIT = 1000;
export const SET_BIDS_LIMIT = 100;

export type ClusterState = 'active' | 'excluded' | 'archived';

export type ClusterFilter = 'all' | 'managed' | 'active' | 'excluded' | 'archived';

export type ClusterBoardRow = {
    nmId: number;
    normQuery: string;
    state: ClusterState;
    minus: boolean;
    bid: number | null;
    bidMinorUnits: number | null;
    currency: string;
    views: number;
    clicks: number;
    atbs: number;
    orders: number;
    shks: number;
    spend: number;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    avgPos: number | null;
    /** Из отчёта поисковых запросов WB, приходит отдельным вызовом. */
    frequency?: number | null;
    searchPosition?: number | null;
    searchOrders?: number | null;
    /** Коридор ставок WB: три уровня охвата по этому кластеру. */
    bidMin?: number | null;
    bidMedium?: number | null;
    bidMax?: number | null;
    reach?: ClusterReach | null;
};

export type ClusterStatRow = {
    advertId: number;
    nmId: number;
    normQuery: string;
    views: number;
    clicks: number;
    atbs: number;
    orders: number;
    shks: number;
    spend: number;
    ctr: number | null;
    cpc: number | null;
    cpm: number | null;
    avgPos: number | null;
    currency: string;
};

export type ClusterBidRow = {
    advertId: number;
    nmId: number;
    normQuery: string;
    bid: number;
    bidMinorUnits: number;
    currency: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

function arrayFrom(v: unknown, ...keys: string[]): unknown[] {
    if (Array.isArray(v)) return v;
    const rec = asRecord(v);
    if (!rec) return [];
    for (const key of keys) {
        if (Array.isArray(rec[key])) return rec[key] as unknown[];
    }
    return [];
}

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** WB отдаёт null у cpm/ctr/views для кампаний с оплатой за клик. */
function numOrNull(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function strings(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/**
 * GET /api/advert/v2/adverts отдаёт артикулы в `nm_settings[].nm_id`
 * (старые формы — `nms` / `nm_ids` на верхнем уровне или в settings).
 */
export function nmIdsFromAdvert(advert: unknown): number[] {
    const rec = asRecord(advert);
    if (!rec) return [];
    const out: number[] = [];
    const settings = asRecord(rec.settings) || {};
    const push = (v: unknown) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) out.push(Math.trunc(n));
    };
    for (const list of [rec.nm_settings, rec.nmSettings, settings.nm_settings]) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            const r = asRecord(item);
            if (r) push(r.nm_id ?? r.nmId ?? r.nm);
        }
    }
    for (const list of [rec.nms, rec.nm_ids, rec.nmIds, settings.nms, settings.nm_ids]) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            const r = asRecord(item);
            if (r) push(r.nm ?? r.nmId ?? r.nm_id ?? r.id);
            else push(item);
        }
    }
    return uniqueNmIds(out);
}

export function uniqueNmIds(raw: unknown): number[] {
    const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    const out = new Set<number>();
    for (const item of list) {
        const n = Number(item);
        if (Number.isFinite(n) && n > 0) out.add(Math.trunc(n));
    }
    return [...out].slice(0, CLUSTER_ITEMS_LIMIT);
}

// ── Тела запросов ───────────────────────────────────────────────────────────

/** normquery/list — единственная ручка кластеров с camelCase в теле. */
export function buildClusterListBody(advertId: number, nmIds: number[]) {
    return { items: nmIds.slice(0, CLUSTER_ITEMS_LIMIT).map((nmId) => ({ advertId, nmId })) };
}

export function buildClusterStatsBody(advertId: number, nmIds: number[], from: string, to: string) {
    return {
        from,
        to,
        items: nmIds.slice(0, CLUSTER_ITEMS_LIMIT).map((nmId) => ({ advert_id: advertId, nm_id: nmId })),
    };
}

export function buildClusterItemsBody(advertId: number, nmIds: number[]) {
    return { items: nmIds.slice(0, CLUSTER_ITEMS_LIMIT).map((nmId) => ({ advert_id: advertId, nm_id: nmId })) };
}

export function buildMinusBody(advertId: number, nmId: number, normQueries: string[]) {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const q of normQueries) {
        const key = q.trim();
        if (!key) continue;
        const low = key.toLowerCase();
        if (seen.has(low)) continue;
        seen.add(low);
        list.push(key);
    }
    return { advert_id: advertId, nm_id: nmId, norm_queries: list.slice(0, MINUS_QUERIES_LIMIT) };
}

/**
 * Ставка приходит из UI в базовых единицах валюты кабинета (сом), WB v1 ждёт
 * разменные (bidMinorUnits) и кратность cpmStep из /api/advert/v1/config.
 */
export function bidToMinorUnits(bid: number, cpmStep = 0): number {
    const minor = Math.round(num(bid) * 100);
    if (minor <= 0) return 0;
    const step = Math.round(num(cpmStep));
    if (step <= 1) return minor;
    const snapped = Math.round(minor / step) * step;
    return snapped > 0 ? snapped : step;
}

export function buildSetBidsBody(
    rows: Array<{ advertId: number; nmId: number; normQuery: string; bid: number }>,
    cpmStep = 0,
) {
    const bids = rows
        .map((r) => ({
            advertId: Math.trunc(num(r.advertId)),
            nmId: Math.trunc(num(r.nmId)),
            normQuery: String(r.normQuery ?? '').trim(),
            bidMinorUnits: bidToMinorUnits(r.bid, cpmStep),
        }))
        .filter((r) => r.advertId > 0 && r.nmId > 0 && r.normQuery && r.bidMinorUnits > 0)
        .slice(0, SET_BIDS_LIMIT);
    return { bids };
}

// ── Разбор ответов ──────────────────────────────────────────────────────────

export type ClusterListByNm = Map<number, { active: string[]; excluded: string[]; archived: string[] }>;

export function parseClusterList(data: unknown): ClusterListByNm {
    const out: ClusterListByNm = new Map();
    for (const item of arrayFrom(data, 'items')) {
        const rec = asRecord(item);
        if (!rec) continue;
        const nmId = Math.trunc(num(rec.nmId ?? rec.nm_id));
        if (!nmId) continue;
        const q = asRecord(rec.normQueries ?? rec.norm_queries) || {};
        const prev = out.get(nmId) || { active: [], excluded: [], archived: [] };
        out.set(nmId, {
            active: [...prev.active, ...strings(q.active)],
            excluded: [...prev.excluded, ...strings(q.excluded)],
            archived: [...prev.archived, ...strings(q.archived)],
        });
    }
    return out;
}

export function parseClusterStats(data: unknown): ClusterStatRow[] {
    const out: ClusterStatRow[] = [];
    for (const group of arrayFrom(data, 'stats')) {
        const rec = asRecord(group);
        if (!rec) continue;
        const advertId = Math.trunc(num(rec.advert_id ?? rec.advertId));
        const nmId = Math.trunc(num(rec.nm_id ?? rec.nmId));
        for (const inner of arrayFrom(rec.stats, 'stats')) {
            const s = asRecord(inner);
            if (!s) continue;
            const normQuery = String(s.norm_query ?? s.normQuery ?? '').trim();
            if (!normQuery) continue;
            const views = num(s.views);
            const clicks = num(s.clicks);
            const ctrRaw = numOrNull(s.ctr);
            out.push({
                advertId,
                nmId,
                normQuery,
                views,
                clicks,
                atbs: num(s.atbs),
                orders: num(s.orders),
                shks: num(s.shks),
                spend: num(s.spend),
                ctr: ctrRaw != null ? ctrRaw : views > 0 ? (clicks / views) * 100 : null,
                cpc: numOrNull(s.cpc),
                cpm: numOrNull(s.cpm),
                avgPos: numOrNull(s.avg_pos ?? s.avgPos),
                currency: String(s.currency ?? '').trim(),
            });
        }
    }
    return out;
}

export function parseClusterBids(data: unknown): ClusterBidRow[] {
    const out: ClusterBidRow[] = [];
    for (const item of arrayFrom(data, 'bids')) {
        const rec = asRecord(item);
        if (!rec) continue;
        const normQuery = String(rec.norm_query ?? rec.normQuery ?? '').trim();
        if (!normQuery) continue;
        const bid = num(rec.bid);
        const minor = num(rec.bid_kopecks ?? rec.bidMinorUnits);
        out.push({
            advertId: Math.trunc(num(rec.advert_id ?? rec.advertId)),
            nmId: Math.trunc(num(rec.nm_id ?? rec.nmId)),
            normQuery,
            bid: bid || (minor ? minor / 100 : 0),
            bidMinorUnits: minor || Math.round(bid * 100),
            currency: String(rec.currency ?? '').trim(),
        });
    }
    return out;
}

export function parseMinusList(data: unknown): Map<number, string[]> {
    const out = new Map<number, string[]>();
    for (const item of arrayFrom(data, 'items')) {
        const rec = asRecord(item);
        if (!rec) continue;
        const nmId = Math.trunc(num(rec.nm_id ?? rec.nmId));
        if (!nmId) continue;
        const prev = out.get(nmId) || [];
        out.set(nmId, [...prev, ...strings(rec.norm_queries ?? rec.normQueries)]);
    }
    return out;
}

// ── Склейка в таблицу ───────────────────────────────────────────────────────

function rowKey(nmId: number, normQuery: string): string {
    return `${nmId}\u0000${normQuery.toLowerCase()}`;
}

/**
 * Кластер попадает в таблицу, если он есть хотя бы в одном источнике: список
 * WB, статистика или ставки. Статус берём из normquery/list (там же архив),
 * минус-фразы — отдельный флаг, потому что WB держит их своим списком.
 */
export function buildClusterBoard(input: {
    nmIds: number[];
    list?: ClusterListByNm;
    stats?: ClusterStatRow[];
    bids?: ClusterBidRow[];
    minus?: Map<number, string[]>;
}): ClusterBoardRow[] {
    const rows = new Map<string, ClusterBoardRow>();

    const blank = (nmId: number, normQuery: string): ClusterBoardRow => ({
        nmId,
        normQuery,
        state: 'active',
        minus: false,
        bid: null,
        bidMinorUnits: null,
        currency: '',
        views: 0,
        clicks: 0,
        atbs: 0,
        orders: 0,
        shks: 0,
        spend: 0,
        ctr: null,
        cpc: null,
        cpm: null,
        avgPos: null,
    });

    const ensure = (nmId: number, normQuery: string): ClusterBoardRow => {
        const key = rowKey(nmId, normQuery);
        let row = rows.get(key);
        if (!row) {
            row = blank(nmId, normQuery);
            rows.set(key, row);
        }
        return row;
    };

    for (const [nmId, groups] of input.list || new Map()) {
        for (const q of groups.active) ensure(nmId, q).state = 'active';
        for (const q of groups.excluded) ensure(nmId, q).state = 'excluded';
        for (const q of groups.archived) ensure(nmId, q).state = 'archived';
    }

    for (const s of input.stats || []) {
        const row = ensure(s.nmId, s.normQuery);
        row.views = s.views;
        row.clicks = s.clicks;
        row.atbs = s.atbs;
        row.orders = s.orders;
        row.shks = s.shks;
        row.spend = s.spend;
        row.ctr = s.ctr;
        row.cpc = s.cpc;
        row.cpm = s.cpm;
        row.avgPos = s.avgPos;
        if (s.currency) row.currency = s.currency;
    }

    for (const b of input.bids || []) {
        const row = ensure(b.nmId, b.normQuery);
        row.bid = b.bid || null;
        row.bidMinorUnits = b.bidMinorUnits || null;
        if (b.currency) row.currency = b.currency;
    }

    for (const [nmId, queries] of input.minus || new Map()) {
        const set = new Set(queries.map((q) => q.toLowerCase()));
        for (const row of rows.values()) {
            if (row.nmId === nmId && set.has(row.normQuery.toLowerCase())) row.minus = true;
        }
        for (const q of queries) {
            const row = ensure(nmId, q);
            row.minus = true;
        }
    }

    const allowed = new Set(input.nmIds || []);
    const out = [...rows.values()].filter((r) => !allowed.size || allowed.has(r.nmId));
    out.sort((a, b) => (b.spend - a.spend) || (b.views - a.views) || a.normQuery.localeCompare(b.normQuery, 'ru'));
    return out;
}

export function countClusterFilters(rows: ClusterBoardRow[]): Record<ClusterFilter, number> {
    return {
        all: rows.length,
        managed: rows.filter((r) => r.bid != null && r.bid > 0).length,
        active: rows.filter((r) => r.state === 'active' && !r.minus).length,
        excluded: rows.filter((r) => r.state === 'excluded' || r.minus).length,
        archived: rows.filter((r) => r.state === 'archived').length,
    };
}

export function filterClusters(rows: ClusterBoardRow[], filter: ClusterFilter): ClusterBoardRow[] {
    if (filter === 'managed') return rows.filter((r) => r.bid != null && r.bid > 0);
    if (filter === 'active') return rows.filter((r) => r.state === 'active' && !r.minus);
    if (filter === 'excluded') return rows.filter((r) => r.state === 'excluded' || r.minus);
    if (filter === 'archived') return rows.filter((r) => r.state === 'archived');
    return rows;
}

export function clusterBoardTotals(rows: ClusterBoardRow[]) {
    const views = rows.reduce((s, r) => s + r.views, 0);
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const orders = rows.reduce((s, r) => s + r.orders, 0);
    return {
        clusters: rows.length,
        views,
        clicks,
        spend,
        orders,
        ctr: views > 0 ? (clicks / views) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
    };
}

/** «Ставка есть, а заказов нет» — кандидаты в минус-фразы. */
export function minusCandidates(rows: ClusterBoardRow[], minViews = 500): ClusterBoardRow[] {
    return rows
        .filter((r) => r.state === 'active' && !r.minus && r.orders === 0 && r.views >= minViews)
        .sort((a, b) => b.spend - a.spend || b.views - a.views);
}

// ── Позиции в поиске по каждому кластеру ────────────────────────────────────
// POST /api/v2/search-report/product/orders (seller-analytics-api): по nmId и
// списку фраз отдаёт частоту запроса, среднюю позицию по дням и заказы.
// Лимиты жёсткие: 30 фраз за запрос (100 на Jam Advanced/Premium), 3 запроса
// в минуту на кабинет и период не больше 7 дней — поэтому просим порциями и
// только то, чего нет в кэше.

export const POSITION_QUERIES_LIMIT = 30;

export type ClusterPosition = {
    query: string;
    frequency: number;
    avgPosition: number | null;
    orders: number;
    days: Array<{ date: string; avgPosition: number | null; orders: number }>;
};

export function buildPositionsBody(nmId: number, queries: string[], from: string, to: string) {
    return {
        period: { start: from, end: to },
        nmId: Math.trunc(num(nmId)),
        searchTexts: queries.slice(0, POSITION_QUERIES_LIMIT),
    };
}

export function chunkQueries(queries: string[], size = POSITION_QUERIES_LIMIT): string[][] {
    const seen = new Set<string>();
    const flat: string[] = [];
    for (const q of queries) {
        const key = String(q ?? '').trim();
        if (!key) continue;
        const low = key.toLowerCase();
        if (seen.has(low)) continue;
        seen.add(low);
        flat.push(key);
    }
    const out: string[][] = [];
    for (let i = 0; i < flat.length; i += size) out.push(flat.slice(i, i + size));
    return out;
}

export function parsePositionsReport(data: unknown): ClusterPosition[] {
    const root = asRecord(data);
    const payload = asRecord(root?.data) || root;
    const items = arrayFrom(payload, 'items');
    const out: ClusterPosition[] = [];
    for (const item of items) {
        const rec = asRecord(item);
        if (!rec) continue;
        const query = String(rec.text ?? rec.searchText ?? '').trim();
        if (!query) continue;
        const days: ClusterPosition['days'] = [];
        for (const d of arrayFrom(rec.dateItems, 'dateItems')) {
            const dr = asRecord(d);
            if (!dr) continue;
            days.push({
                date: String(dr.dt ?? dr.date ?? '').split('T')[0],
                avgPosition: numOrNull(dr.avgPosition),
                orders: num(dr.orders),
            });
        }
        const withPos = days.map((d) => d.avgPosition).filter((p): p is number => p != null && p > 0);
        out.push({
            query,
            frequency: num(rec.frequency),
            avgPosition: withPos.length ? withPos.reduce((a, b) => a + b, 0) / withPos.length : null,
            orders: days.reduce((s, d) => s + d.orders, 0),
            days,
        });
    }
    return out;
}

/** Позиции приходят отдельно и позже ставок — дописываем в готовые строки. */
export function mergeClusterPositions(
    rows: ClusterBoardRow[],
    positions: ClusterPosition[],
): ClusterBoardRow[] {
    const byQuery = new Map<string, ClusterPosition>();
    for (const p of positions) byQuery.set(p.query.toLowerCase(), p);
    return rows.map((row) => {
        const hit = byQuery.get(row.normQuery.toLowerCase());
        if (!hit) return row;
        return {
            ...row,
            frequency: hit.frequency,
            searchPosition: hit.avgPosition,
            searchOrders: hit.orders,
        };
    });
}

// ---------------------------------------------------------------------------
// Коридор ставок WB
// GET /api/advert/v0/bids/recommendations?advertId=&nmId= — по каждому кластеру
// три уровня охвата (reachMin / reachMedium / reachMax) плюс базовые ставки
// кампании. Один запрос на артикул, поэтому тянем вместе с бордом.

export type ClusterReach = 'below_min' | 'min' | 'medium' | 'max' | 'above_max';

export type ClusterCorridor = {
    normQuery: string;
    /** Ставки в валюте кабинета, не в минорных единицах. */
    min: number | null;
    medium: number | null;
    max: number | null;
};

export type BidRecommendations = {
    advertId: number;
    nmId: number;
    /** Базовые ставки кампании: конкурентная, лидеров, топ-2. */
    competitive: number | null;
    leaders: number | null;
    top2: number | null;
    corridors: ClusterCorridor[];
};

/** bidKopecks — минорные единицы валюты кабинета, приводим к целым единицам. */
function minorToMajor(value: unknown): number | null {
    const n = numOrNull(value);
    if (n == null || n <= 0) return null;
    return n / 100;
}

function reachLevel(node: unknown): number | null {
    const rec = asRecord(node);
    if (!rec) return null;
    return minorToMajor(rec.bidKopecks);
}

export function parseBidRecommendations(data: unknown): BidRecommendations | null {
    const root = asRecord(data);
    if (!root) return null;
    const base = asRecord(root.base);
    const corridors: ClusterCorridor[] = [];
    for (const item of arrayFrom(root, 'normQueries')) {
        const rec = asRecord(item);
        if (!rec) continue;
        const normQuery = String(rec.normQuery ?? '').trim();
        if (!normQuery) continue;
        corridors.push({
            normQuery,
            min: reachLevel(rec.reachMin),
            medium: reachLevel(rec.reachMedium),
            max: reachLevel(rec.reachMax),
        });
    }
    return {
        advertId: Math.trunc(num(root.advertId)),
        nmId: Math.trunc(num(root.nmId)),
        competitive: reachLevel(base?.competitiveBid),
        leaders: reachLevel(base?.leadersBid),
        top2: reachLevel(base?.top2),
        corridors,
    };
}

/**
 * Где наша ставка относительно коридора WB. Ниже min — охвата почти нет,
 * выше max — платим за то, что уже не даёт роста охвата.
 */
export function reachForBid(bid: number | null, c: ClusterCorridor | null): ClusterReach | null {
    if (bid == null || bid <= 0 || !c) return null;
    const { min, medium, max } = c;
    if (min != null && bid < min) return 'below_min';
    if (max != null && bid > max) return 'above_max';
    if (medium != null && bid >= medium) return max != null && bid >= max ? 'max' : 'medium';
    if (min != null && bid >= min) return 'min';
    return null;
}

/** Ставка для выбранного уровня охвата с откатом на соседний, если WB его не дал. */
export function bidForReach(
    c: ClusterCorridor | null,
    level: 'min' | 'medium' | 'max',
): number | null {
    if (!c) return null;
    if (level === 'min') return c.min ?? c.medium ?? c.max ?? null;
    if (level === 'max') return c.max ?? c.medium ?? c.min ?? null;
    return c.medium ?? c.min ?? c.max ?? null;
}

/** Коридор приходит вместе с бордом — дописываем в строки как позиции. */
export function mergeClusterCorridors(
    rows: ClusterBoardRow[],
    recs: BidRecommendations[],
): ClusterBoardRow[] {
    const byKey = new Map<string, ClusterCorridor>();
    for (const rec of recs) {
        for (const c of rec.corridors) {
            byKey.set(rec.nmId + '|' + c.normQuery.toLowerCase(), c);
        }
    }
    if (!byKey.size) return rows;
    return rows.map((row) => {
        const hit = byKey.get(row.nmId + '|' + row.normQuery.toLowerCase());
        if (!hit) return row;
        return {
            ...row,
            bidMin: hit.min,
            bidMedium: hit.medium,
            bidMax: hit.max,
            reach: reachForBid(row.bid, hit),
        };
    });
}

/** setBids v1 работает только у ручной ставки с оплатой за показы. */
export function canSetClusterBids(bidType: unknown, paymentType: unknown): boolean {
    const bid = String(bidType ?? '').toLowerCase();
    const pay = String(paymentType ?? '').toLowerCase();
    if (bid && bid !== 'manual') return false;
    if (pay && pay !== 'cpm') return false;
    return true;
}
