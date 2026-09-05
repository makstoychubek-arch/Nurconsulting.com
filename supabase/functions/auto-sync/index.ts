// Supabase Edge Function: auto-sync
// Syncs WB stocks/orders for all cabinets with tokens (or one cabinet).
// Auth: service_role key (pg_cron) or user JWT (dashboard manual sync).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isTeamMember } from '../_shared/cabinet-access.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
const WB_STATS = 'https://statistics-api.wildberries.ru';
const WB_ANALYTICS = 'https://seller-analytics-api.wildberries.ru';
const WB_MARKET = 'https://marketplace-api.wildberries.ru';
const DATE_FROM = '2026-01-01';

// WB Statistics `/api/v1/supplier/orders`: 1 request / minute / seller.
// Кабинеты — разные продавцы (разные sid в JWT), поэтому пауза нужна
// между днями одного токена, а не между кабинетами.
const ORDERS_MIN_INTERVAL_MS = 61000;
const lastOrderFetchAt = new Map<string, number>();

// Сегодня + вчера. Более длинный lookback на 1 req/мин съедает бюджет
// функции и оставляет дыру между «последним бэкфилом» и «сегодня».
const RECENT_DAYS_LOOKBACK = 2;

// За прогон: 1 исторический день на кабинет (сначала дыра вперёд, потом старше).
const BACKFILL_DAYS_PER_RUN = 1;

const TIME_BUDGET_MS = 120000;

type Admin = any;

type CabWork = {
    id: string;
    name: string;
    token: string;
    orders_backfilled_to: string | null;
    orders_filled_until: string | null;
    stocksCount: number;
    stocksFbo: number;
    stocksFbs: number;
    ordersCount: number;
    financeRows: number;
    rnpDailyRows: number;
    funnelDays: number;
    status: string;
    errorMsg: string;
    cabStart: number;
};

function retryAfterMs(res: Response): number {
    const raw =
        res.headers.get('x-ratelimit-retry') ||
        res.headers.get('retry-after') ||
        res.headers.get('Retry-After') ||
        '';
    const sec = Number(raw);
    if (Number.isFinite(sec) && sec > 0) return (sec + 2) * 1000;
    return ORDERS_MIN_INTERVAL_MS;
}

async function fetchSupplierOrdersExactDay(
    token: string,
    dayStr: string,
    maxAttempts = 6,
): Promise<Record<string, unknown>[]> {
    const lastAt = lastOrderFetchAt.get(token) || 0;
    const waitMs = lastAt ? Math.max(0, ORDERS_MIN_INTERVAL_MS - (Date.now() - lastAt)) : 0;
    if (waitMs > 0) await sleep(waitMs);

    const url = `${WB_STATS}/api/v1/supplier/orders?dateFrom=${dayStr}&flag=1`;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(url, { headers: { Authorization: token } });
        lastOrderFetchAt.set(token, Date.now());

        if (res.status === 429) {
            const extra = Math.min(retryAfterMs(res) + attempt * 5000, 180000);
            await sleep(extra);
            continue;
        }
        if (!res.ok) {
            const text = (await res.text().catch(() => '')).slice(0, 200);
            throw new Error(`orders HTTP ${res.status} ${text}`.trim());
        }
        const js = await res.json().catch(() => []);
        return Array.isArray(js) ? js as Record<string, unknown>[] : [];
    }
    throw new Error(`WB orders 429 persisted after ${maxAttempts} attempts`);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
        return json({ error: 'Unauthorized' }, 401);
    }
    const bearer = authHeader.replace('Bearer ', '');

    const admin = createClient(supabaseUrl, serviceKey);
    let isServiceRole = isServiceAuthorized(req, serviceKey);
    let userId: string | null = null;
    let isSuperAdmin = false;

    if (!isServiceRole) {
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);
        userId = user.id;
        isSuperAdmin =
            String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ||
            user.id === SUPER_ADMIN_ID ||
            await isTeamMember(admin, user.email);
    }

    let mode = 'full';
    let targetCabinetId: string | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        mode = body.mode || 'full';
        targetCabinetId = body.cabinet_id || null;
    } catch { /* empty body ok for cron */ }

    if (!isServiceRole && !targetCabinetId) {
        return json({ error: 'cabinet_id required for manual sync' }, 400);
    }

    if (!isServiceRole && targetCabinetId && !isSuperAdmin) {
        const { data: owned } = await admin
            .from('cabinets')
            .select('id')
            .eq('id', targetCabinetId)
            .eq('user_id', userId!)
            .maybeSingle();
        if (!owned) return json({ error: 'Cabinet not found or access denied' }, 403);
    }

    const cabinets = await loadCabinets(admin, targetCabinetId);
    if (!cabinets) {
        return json({ error: 'Нет кабинетов с токенами' }, 400);
    }

    const work: CabWork[] = [];
    for (const cabinet of cabinets) {
        const token = sanitizeWbToken(cabinet.wb_token);
        if (!token || token.length < 50) continue;
        work.push({
            id: cabinet.id,
            name: cabinet.name,
            token,
            orders_backfilled_to: cabinet.orders_backfilled_to ? String(cabinet.orders_backfilled_to) : null,
            orders_filled_until: cabinet.orders_filled_until ? String(cabinet.orders_filled_until) : null,
            stocksCount: 0,
            stocksFbo: 0,
            stocksFbs: 0,
            ordersCount: 0,
            financeRows: 0,
            rnpDailyRows: 0,
            funnelDays: 0,
            status: 'success',
            errorMsg: '',
            cabStart: Date.now(),
        });
    }

    for (const cab of work) {
        if (mode !== 'full' && mode !== 'stocks') continue;
        try {
            cab.stocksCount = await syncStocks(admin, cab);
        } catch (e) {
            cab.errorMsg += `stocks: ${(e as Error).message}; `;
            cab.status = 'partial';
        }
    }

    if (mode === 'full' || mode === 'rnp') {
        const today = isoDate(new Date());
        const horizon = addDaysStr(today, -RECENT_DAYS_LOOKBACK);

        // Pass B: вчера + сегодня. Иначе утром в РНП пустая колонка за вчера
        // (4.09), а курсор backfill сидит в июле и туда не успевает.
        const yesterday = addDaysStr(today, -1);
        for (const dayStr of [yesterday, today]) {
            for (const cab of work) {
                try {
                    cab.ordersCount += await syncRecentDay(admin, cab, dayStr);
                } catch (e) {
                    cab.errorMsg += `orders_${dayStr}: ${(e as Error).message}; `;
                    cab.status = 'partial';
                }
            }
        }

        // Pass A: по одному историческому дню. Сначала дыра вперёд
        // (у Базы курсор ушёл в июль и август/сентябрь так и не докачались),
        // потом старше DATE_FROM.
        for (let i = 0; i < BACKFILL_DAYS_PER_RUN; i++) {
            for (const cab of work) {
                if (Date.now() - started > TIME_BUDGET_MS) {
                    if (!cab.errorMsg.includes('orders_backfill: deferred')) {
                        cab.errorMsg += 'orders_backfill: deferred; ';
                        cab.status = 'partial';
                    }
                    continue;
                }
                try {
                    cab.ordersCount += await syncOneHistoryDay(admin, cab, horizon);
                } catch (e) {
                    cab.errorMsg += `orders_backfill: ${(e as Error).message}; `;
                    cab.status = 'partial';
                }
            }
        }

        for (const cab of work) {
            try {
                cab.rnpDailyRows = await syncRnpDailyFromOrders(admin, cab.id);
            } catch (e) {
                cab.errorMsg += `rnp_daily: ${(e as Error).message}; `;
                cab.status = 'partial';
            }
            try {
                cab.funnelDays = await syncFunnelLast7Days(admin, cab.id, cab.token);
            } catch (e) {
                cab.errorMsg += `funnel: ${(e as Error).message}; `;
                cab.status = cab.status === 'error' ? 'error' : 'partial';
            }
        }
    }

    const results: Array<Record<string, unknown>> = [];
    for (const cab of work) {
        try {
            const added = await syncArticlesFromContentCards(admin, cab.id, cab.token);
            if (added) console.log('[auto-sync] new rnp_articles from WB cards:', cab.name, added);
        } catch (e) {
            cab.errorMsg += `articles: ${(e as Error).message}; `;
            cab.status = cab.status === 'error' ? 'error' : 'partial';
        }

        await admin.from('sync_log').insert({
            cabinet_id: cab.id,
            cabinet_name: cab.name,
            stocks_count: cab.stocksCount,
            orders_count: cab.ordersCount,
            finance_rows: cab.financeRows,
            status: cab.status,
            error_msg: cab.errorMsg || null,
            duration_ms: Date.now() - cab.cabStart,
        });

        results.push({
            cabinet: cab.name,
            status: cab.status,
            stocks: cab.stocksCount,
            stocks_fbo: cab.stocksFbo,
            stocks_fbs: cab.stocksFbs,
            orders: cab.ordersCount,
            finance: cab.financeRows,
            rnp_daily: cab.rnpDailyRows,
            funnel_days: cab.funnelDays,
            ms: Date.now() - cab.cabStart,
        });
    }

    return json({
        ok: true,
        mode,
        cabinets_synced: results.length,
        total_ms: Date.now() - started,
        results,
    });
});

async function loadCabinets(admin: Admin, targetCabinetId: string | null) {
    let query = admin
        .from('cabinets')
        .select('id, name, wb_token, orders_backfilled_to, orders_filled_until')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');
    if (targetCabinetId) query = query.eq('id', targetCabinetId);
    let { data, error } = await query;
    if (error && /orders_filled_until/.test(error.message || '')) {
        let q2 = admin
            .from('cabinets')
            .select('id, name, wb_token, orders_backfilled_to')
            .not('wb_token', 'is', null)
            .gt('wb_token', '');
        if (targetCabinetId) q2 = q2.eq('id', targetCabinetId);
        const retry = await q2;
        data = (retry.data || []).map((r: Record<string, unknown>) => ({ ...r, orders_filled_until: null }));
        error = retry.error;
    }
    if (error || !data?.length) return null;
    return data as Array<{
        id: string;
        name: string;
        wb_token: string;
        orders_backfilled_to: string | null;
        orders_filled_until: string | null;
    }>;
}

async function syncStocks(admin: Admin, cab: CabWork): Promise<number> {
    const synced = await syncCabinetStocks(admin, cab.id, cab.token);
    cab.stocksFbo = synced.fbo;
    cab.stocksFbs = synced.fbs;
    if (synced.errors.length) {
        cab.errorMsg += synced.errors.join(' ');
        cab.status = 'partial';
    }
    return synced.fbo + synced.fbs;
}

async function syncRecentDay(admin: Admin, cab: CabWork, dayStr: string): Promise<number> {
    const dayOrders = await fetchSupplierOrdersExactDay(cab.token, dayStr);
    await admin.from('wb_orders').delete()
        .eq('cabinet_id', cab.id)
        .eq('order_date', dayStr);
    await writeOrderRows(admin, cab.id, dayStr, dayOrders);
    return dayOrders.length;
}

async function syncOneHistoryDay(admin: Admin, cab: CabWork, horizon: string): Promise<number> {
    const backfilledTo = cab.orders_backfilled_to || horizon;
    const filledUntil = cab.orders_filled_until || backfilledTo;

    // Дыра вперёд: курсор когда-то ушёл в прошлое и больше не трогал июль→сегодня.
    if (filledUntil < horizon) {
        const dayStr = addDaysStr(filledUntil, 1);
        const dayOrders = await fetchSupplierOrdersExactDay(cab.token, dayStr);
        await writeOrderRows(admin, cab.id, dayStr, dayOrders);
        cab.orders_filled_until = dayStr;
        await admin.from('cabinets').update({ orders_filled_until: dayStr }).eq('id', cab.id);
        return dayOrders.length;
    }

    if (backfilledTo > DATE_FROM) {
        const dayStr = addDaysStr(backfilledTo, -1);
        if (dayStr < DATE_FROM) return 0;
        const dayOrders = await fetchSupplierOrdersExactDay(cab.token, dayStr);
        await writeOrderRows(admin, cab.id, dayStr, dayOrders);
        cab.orders_backfilled_to = dayStr;
        await admin.from('cabinets').update({ orders_backfilled_to: dayStr }).eq('id', cab.id);
        return dayOrders.length;
    }
    return 0;
}

async function writeOrderRows(
    admin: Admin,
    cabinetId: string,
    dayStr: string,
    dayOrders: Record<string, unknown>[],
) {
    if (!dayOrders.length) return;
    const rows = dayOrders.map((o) => toOrderRow(cabinetId, o));
    const withSrid = rows.filter((r) => r.srid);
    const withoutSrid = rows.filter((r) => !r.srid);
    for (let i = 0; i < withSrid.length; i += 500) {
        const { error: upErr } = await admin.from('wb_orders').upsert(
            withSrid.slice(i, i + 500),
            { onConflict: 'cabinet_id,srid' },
        );
        if (upErr) throw new Error(`upsert(${dayStr}): ${upErr.message}`);
    }
    if (withoutSrid.length) {
        await admin.from('wb_orders').delete()
            .eq('cabinet_id', cabinetId)
            .eq('order_date', dayStr)
            .is('srid', null);
        for (let i = 0; i < withoutSrid.length; i += 500) {
            const { error: insErr } = await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 500));
            if (insErr) throw new Error(`insert(${dayStr}): ${insErr.message}`);
        }
    }
}

async function syncFunnelLast7Days(admin: Admin, cabinetId: string, token: string): Promise<number> {
    const { data: arts } = await admin.from('rnp_articles')
        .select('nm_id')
        .eq('cabinet_id', cabinetId)
        .eq('is_active', true);
    const nmIds = [...new Set((arts || []).map((a: { nm_id: number }) => Number(a.nm_id)).filter((n: number) => n > 0))];
    if (!nmIds.length) return 0;

    const today = isoDate(new Date());
    const dateFrom = addDaysStr(today, -6);
    const upserts: Record<string, unknown>[] = [];
    // history принимает максимум 20 nmId (иначе 400 на Зевине).
    for (let i = 0; i < nmIds.length; i += 20) {
        if (i > 0) await sleep(21000);
        const chunk = nmIds.slice(i, i + 20);
        const res = await fetch(`${WB_ANALYTICS}/api/analytics/v3/sales-funnel/products/history`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedPeriod: { start: dateFrom, end: today },
                nmIds: chunk,
                skipDeletedNm: true,
                aggregationLevel: 'day',
            }),
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) break;
            throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json().catch(() => []);
        const items = Array.isArray(payload) ? payload : (payload?.data || []);
        for (const item of items) {
            const nmId = Number(item?.product?.nmId || item?.nmId || 0);
            if (!nmId) continue;
            for (const day of (item.history || [])) {
                const date = String(day.date || '').split('T')[0];
                if (!date) continue;
                const opens = Number(day.openCount || 0);
                const cart = Number(day.cartCount || 0);
                upserts.push({
                    cabinet_id: cabinetId,
                    nm_id: nmId,
                    date,
                    impressions: opens,
                    clicks: opens,
                    ctr_pct: opens > 0 ? cart / opens * 100 : 0,
                    basket_count: cart,
                    basket_pct: Number(day.addToCartConversion || 0),
                    funnel_order_conv: Number(day.cartToOrderConversion || 0),
                    updated_at: new Date().toISOString(),
                });
            }
        }
    }
    for (let i = 0; i < upserts.length; i += 100) {
        const { error } = await admin.from('rnp_daily_data').upsert(
            upserts.slice(i, i + 100),
            { onConflict: 'cabinet_id,nm_id,date' },
        );
        if (error) throw error;
    }
    return upserts.length;
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoDate(d: Date) {
    return d.toISOString().split('T')[0];
}

function addDaysStr(day: string, n: number) {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
}

type StockRow = {
    cabinet_id: string;
    nm_id: number;
    barcode: string;
    tech_size: string;
    quantity: number;
    in_way_to_client: number;
    in_way_from_client: number;
    warehouse_name: string;
    stock_scheme: 'fbo' | 'fbs';
};

type ChrtMeta = { nmId: number; barcode: string; techSize: string };

type FbsMarketResult = {
    warehousesFound: boolean;
    rows: StockRow[];
};

async function syncCabinetStocks(
    admin: ReturnType<typeof createClient>,
    cabinetId: string,
    token: string,
): Promise<{ fbo: number; fbs: number; errors: string[] }> {
    const errors: string[] = [];
    let fboRows: StockRow[] = [];
    let fbsRows: StockRow[] = [];
    let fboOk = false;
    let fbsOk = false;

    let sizeMaps = { byChrt: new Map<number, ChrtMeta>(), bySku: new Map<string, ChrtMeta>() };
    try {
        sizeMaps = skuMapsFromCards(await fetchContentCards(token));
    } catch (e) {
        errors.push(`cards: ${(e as Error).message};`);
    }

    try {
        fboRows = await fetchFboStockRows(token, cabinetId, sizeMaps);
        fboOk = true;
    } catch (e) {
        errors.push(`fbo: ${(e as Error).message};`);
    }

    try {
        fbsRows = await fetchFbsStockRows(admin, token, cabinetId);
        fbsOk = true;
    } catch (e) {
        errors.push(`fbs: ${(e as Error).message};`);
    }

    if (!fboOk && !fbsOk) return { fbo: 0, fbs: 0, errors };

    if (fboOk && fbsOk) {
        await admin.from('wb_stocks').delete().eq('cabinet_id', cabinetId);
        await insertStockRows(admin, [...fboRows, ...fbsRows]);
    } else if (fboOk) {
        await admin.from('wb_stocks').delete().eq('cabinet_id', cabinetId).neq('stock_scheme', 'fbs');
        await insertStockRows(admin, fboRows);
    } else {
        await admin.from('wb_stocks').delete().eq('cabinet_id', cabinetId).eq('stock_scheme', 'fbs');
        await insertStockRows(admin, fbsRows);
    }

    return { fbo: fboRows.length, fbs: fbsRows.length, errors };
}

async function insertStockRows(admin: ReturnType<typeof createClient>, rows: StockRow[]) {
    for (let i = 0; i < rows.length; i += 500) {
        await admin.from('wb_stocks').insert(rows.slice(i, i + 500));
    }
}

async function fetchFboStockRows(
    token: string,
    cabinetId: string,
    maps?: { byChrt: Map<number, ChrtMeta>; bySku: Map<string, ChrtMeta> },
): Promise<StockRow[]> {
    const stocksRes = await fetch(`${WB_ANALYTICS}/api/analytics/v1/stocks-report/wb-warehouses`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nmIds: [], limit: 250000, offset: 0 }),
    });
    if (!stocksRes.ok) throw new Error(`HTTP ${stocksRes.status}`);
    const payload = await stocksRes.json();
    const stocks = payload?.data?.items;
    if (!Array.isArray(stocks)) return [];
    return stocks.map((s: Record<string, unknown>) => {
        const sku = String(s.barcode || s.sku || '').trim();
        const chrtId = Number(s.chrtId || s.chrtID || 0) || (/^\d{6,}$/.test(sku) ? Number(sku) : 0);
        const meta = (chrtId && maps?.byChrt.get(chrtId)) || (sku && maps?.bySku.get(sku)) || undefined;
        return {
            cabinet_id: cabinetId,
            nm_id: Number(s.nmId || meta?.nmId || 0),
            barcode: meta?.barcode || sku || String(chrtId || ''),
            tech_size: String(s.techSize || s.wbSize || s.sizeName || meta?.techSize || ''),
            quantity: Number(s.quantity || 0),
            in_way_to_client: Number(s.inWayToClient || 0),
            in_way_from_client: Number(s.inWayFromClient || 0),
            warehouse_name: String(s.warehouseName || ''),
            stock_scheme: 'fbo' as const,
        };
    });
}

async function fetchFbsStockRows(
    admin: Admin,
    token: string,
    cabinetId: string,
): Promise<StockRow[]> {
    try {
        const result = await fetchFbsFromMarketplace(admin, token, cabinetId);
        // Если у кабинета есть склады продавца — пишем их имена.
        // Пустой ответ склада ≠ «нет FBS»: иначе products-report затирает
        // WIN WIN / АМАН ФФ общим «FBS (склады продавца)».
        if (result.warehousesFound) return result.rows;
    } catch (e) {
        console.warn('[auto-sync] FBS marketplace:', (e as Error).message);
    }
    return fetchFbsFromProductsReport(token, cabinetId);
}

async function fetchContentCards(token: string): Promise<Record<string, unknown>[]> {
    const cards: Record<string, unknown>[] = [];
    let cursorNmId = 0;
    let cursorUpdatedAt = '';
    for (let page = 0; page < 40; page++) {
        const body: Record<string, unknown> = {
            settings: {
                sort: { ascending: false },
                filter: { textSearch: '', withPhoto: -1 },
                cursor: {
                    limit: 100,
                    ...(cursorNmId ? { nmID: cursorNmId } : {}),
                    ...(cursorUpdatedAt ? { updatedAt: cursorUpdatedAt } : {}),
                },
            },
        };
        const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) return cards;
            throw new Error(`content cards HTTP ${res.status}`);
        }
        const payload = await res.json();
        const pageCards = payload?.cards || payload?.data?.cards || [];
        if (Array.isArray(pageCards)) cards.push(...pageCards);
        const cur = payload?.cursor || {};
        const nextNm = Number(cur.nmID || cur.nmId || 0);
        const nextAt = String(cur.updatedAt || '');
        if (!pageCards.length || pageCards.length < 100 || !nextNm) break;
        cursorNmId = nextNm;
        cursorUpdatedAt = nextAt;
        await sleep(400);
    }
    return cards;
}

function skuMapsFromCards(cards: Record<string, unknown>[]): {
    byChrt: Map<number, ChrtMeta>;
    bySku: Map<string, ChrtMeta>;
} {
    const byChrt = new Map<number, ChrtMeta>();
    const bySku = new Map<string, ChrtMeta>();
    for (const card of cards) {
        const nmId = Number(card.nmID || card.nmId || 0);
        if (!nmId) continue;
        const sizes = (card.sizes || []) as Record<string, unknown>[];
        for (const sz of sizes) {
            const chrtId = Number(sz.chrtID || sz.chrtId || 0);
            const rawSkus = (sz.skus as string[] | undefined) || [];
            const techSize = String(sz.techSize || sz.wbSize || '');
            const fallbackSku = String(rawSkus[0] || sz.sku || (chrtId || ''));
            const meta: ChrtMeta = { nmId, barcode: fallbackSku, techSize };
            if (chrtId) byChrt.set(chrtId, meta);
            for (const sku of rawSkus) {
                const key = String(sku || '').trim();
                if (key) bySku.set(key, { nmId, barcode: key, techSize });
            }
            if (!rawSkus.length && sz.sku) bySku.set(String(sz.sku), meta);
        }
    }
    return { byChrt, bySku };
}

async function fetchWarehouseStocks(
    token: string,
    warehouseId: number,
    skus: string[],
    chrtIds: number[],
): Promise<Record<string, unknown>[]> {
    const query = async (body: Record<string, unknown>) => {
        const res = await fetch(`${WB_MARKET}/api/v3/stocks/${warehouseId}`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res;
    };

    const pull = async (kind: 'skus' | 'chrtIds', values: Array<string | number>) => {
        const acc: Record<string, unknown>[] = [];
        for (let i = 0; i < values.length; i += 1000) {
            const chunk = values.slice(i, i + 1000);
            const res = await query(kind === 'skus' ? { skus: chunk } : { chrtIds: chunk });
            if (!res.ok) return { ok: false as const, status: res.status, stocks: acc };
            const payload = await res.json();
            const stocks = payload?.stocks || [];
            if (Array.isArray(stocks)) acc.push(...stocks);
            await sleep(220);
        }
        return { ok: true as const, status: 200, stocks: acc };
    };

    if (skus.length) {
        const first = await pull('skus', skus);
        if (first.ok) return first.stocks;
        if ((first.status === 400 || first.status === 422) && chrtIds.length) {
            const retry = await pull('chrtIds', chrtIds);
            if (retry.ok) return retry.stocks;
            console.warn('[auto-sync] FBS stocks', warehouseId, retry.status);
            return retry.stocks;
        }
        console.warn('[auto-sync] FBS stocks', warehouseId, first.status);
        return first.stocks;
    }
    if (chrtIds.length) {
        const onlyChrt = await pull('chrtIds', chrtIds);
        if (!onlyChrt.ok) console.warn('[auto-sync] FBS stocks', warehouseId, onlyChrt.status);
        return onlyChrt.stocks;
    }
    return [];
}

async function fetchFbsFromMarketplace(
    admin: Admin,
    token: string,
    cabinetId: string,
): Promise<FbsMarketResult> {
    const whRes = await fetch(`${WB_MARKET}/api/v3/warehouses`, {
        headers: { Authorization: token },
    });
    if (!whRes.ok) throw new Error(`warehouses HTTP ${whRes.status}`);
    const warehouses = await whRes.json();
    if (!Array.isArray(warehouses) || !warehouses.length) {
        return { warehousesFound: false, rows: [] };
    }

    const cards = await fetchContentCards(token);
    const { byChrt, bySku } = skuMapsFromCards(cards);
    try {
        const { data: existing } = await admin
            .from('wb_stocks')
            .select('barcode, nm_id, tech_size')
            .eq('cabinet_id', cabinetId)
            .limit(20000);
        for (const row of existing || []) {
            const barcode = String(row.barcode || '').trim();
            if (!barcode) continue;
            const meta: ChrtMeta = {
                nmId: Number(row.nm_id || 0),
                barcode,
                techSize: String(row.tech_size || ''),
            };
            if (barcode.length >= 8 && !bySku.has(barcode)) bySku.set(barcode, meta);
            const chrtId = Number(barcode);
            if (Number.isFinite(chrtId) && chrtId > 0 && !byChrt.has(chrtId)) {
                byChrt.set(chrtId, meta);
            }
        }
    } catch (e) {
        console.warn('[auto-sync] FBS sku from stocks:', (e as Error).message);
    }

    const skus = [...bySku.keys()];
    const chrtIds = [...byChrt.keys()];
    if (!skus.length && !chrtIds.length) {
        return { warehousesFound: true, rows: [] };
    }

    const rows: StockRow[] = [];
    for (const wh of warehouses) {
        const warehouseId = Number(wh?.id || 0);
        const warehouseName = String(wh?.name || 'FBS').trim() || 'FBS';
        if (!warehouseId) continue;
        try {
            const stocks = await fetchWarehouseStocks(token, warehouseId, skus, chrtIds);
            for (const s of stocks) {
                const amount = Number(s.amount || 0);
                if (amount <= 0) continue;
                const sku = String(s.sku || '').trim();
                const chrtId = Number(s.chrtId || s.chrtID || 0);
                const meta = (sku && bySku.get(sku)) || byChrt.get(chrtId);
                rows.push({
                    cabinet_id: cabinetId,
                    nm_id: meta?.nmId || 0,
                    barcode: sku || meta?.barcode || String(chrtId || ''),
                    tech_size: meta?.techSize || '',
                    quantity: amount,
                    in_way_to_client: 0,
                    in_way_from_client: 0,
                    warehouse_name: warehouseName,
                    stock_scheme: 'fbs',
                });
            }
        } catch (e) {
            console.warn('[auto-sync] FBS warehouse', warehouseName, (e as Error).message);
        }
    }
    return { warehousesFound: true, rows };
}

async function fetchFbsFromProductsReport(token: string, cabinetId: string): Promise<StockRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    const rows: StockRow[] = [];
    for (let offset = 0; offset < 20000; offset += 1000) {
        const res = await fetch(`${WB_ANALYTICS}/api/v2/stocks-report/products/products`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPeriod: { start: today, end: today },
                stockType: 'mp',
                skipDeletedNm: true,
                availabilityFilters: ['deficient', 'actual', 'balanced', 'nonActual', 'nonLiquid', 'invalidData'],
                orderBy: { field: 'stockCount', mode: 'desc' },
                limit: 1000,
                offset,
            }),
        });
        if (!res.ok) {
            if (offset === 0) throw new Error(`products mp HTTP ${res.status}`);
            break;
        }
        const payload = await res.json();
        const items = payload?.data?.items || payload?.data?.products || [];
        if (!Array.isArray(items) || !items.length) break;
        for (const item of items) {
            const nmId = Number(item.nmID || item.nmId || 0);
            const qty = Number(item.metrics?.stockCount ?? item.stockCount ?? 0);
            if (!nmId || qty <= 0) continue;
            rows.push({
                cabinet_id: cabinetId,
                nm_id: nmId,
                barcode: '',
                tech_size: '',
                quantity: qty,
                in_way_to_client: 0,
                in_way_from_client: 0,
                warehouse_name: 'FBS (склады продавца)',
                stock_scheme: 'fbs',
            });
        }
        if (items.length < 1000) break;
        await sleep(700);
    }
    return rows;
}

async function syncArticlesFromContentCards(admin: Admin, cabinetId: string, token: string): Promise<number> {
    const cards: Record<string, unknown>[] = [];
    let cursorNmId = 0;
    let cursorUpdatedAt = '';
    for (let page = 0; page < 20; page++) {
        const body: Record<string, unknown> = {
            settings: {
                sort: { ascending: false },
                filter: { textSearch: '', withPhoto: -1 },
                cursor: {
                    limit: 100,
                    ...(cursorNmId ? { nmID: cursorNmId } : {}),
                    ...(cursorUpdatedAt ? { updatedAt: cursorUpdatedAt } : {}),
                },
            },
        };
        const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) return 0;
            throw new Error(`content cards HTTP ${res.status}`);
        }
        const payload = await res.json();
        const pageCards = payload?.cards || payload?.data?.cards || [];
        if (Array.isArray(pageCards)) cards.push(...pageCards);
        const cur = payload?.cursor || {};
        const nextNm = Number(cur.nmID || cur.nmId || 0);
        const nextAt = String(cur.updatedAt || '');
        if (!pageCards.length || pageCards.length < 100 || !nextNm) break;
        cursorNmId = nextNm;
        cursorUpdatedAt = nextAt;
        await sleep(400);
    }
    if (!cards.length) return 0;

    const { data: existing } = await admin.from('rnp_articles').select('nm_id,is_active').eq('cabinet_id', cabinetId);
    const known = new Set((existing || []).map((r: { nm_id: number }) => Number(r.nm_id)));
    const toInsert = [];
    for (const card of cards) {
        const nmId = Number(card.nmID || card.nmId);
        if (!nmId) continue;
        if (known.has(nmId)) continue;
        const sa = String(card.vendorCode || card.vendor_code || card.supplierVendorCode || '').trim();
        const name = sa || String(card.title || card.object || `Артикул ${nmId}`).trim();
        toInsert.push({
            cabinet_id: cabinetId,
            nm_id: nmId,
            name,
            photo_url: '',
            is_active: true,
            cost_price: 0,
            manual_data: sa ? { seller_article: sa } : {},
        });
    }
    for (let i = 0; i < toInsert.length; i += 200) {
        await admin.from('rnp_articles').upsert(toInsert.slice(i, i + 200), {
            onConflict: 'cabinet_id,nm_id',
            ignoreDuplicates: true,
        });
    }
    return toInsert.length;
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function toOrderRow(cabinetId: string, o: Record<string, unknown>) {
    return {
        cabinet_id: cabinetId,
        order_date: String(o.date || '').split('T')[0] ||
            new Date().toISOString().split('T')[0],
        nm_id: o.nmId,
        barcode: o.barcode,
        srid: o.srid || null,
        price: o.priceWithDiscount || o.totalPrice || 0,
        is_return: o.isReturn || false,
        data: o,
    };
}

async function syncRnpDailyFromOrders(admin: Admin, cabinetId: string): Promise<number> {
    const now = new Date();
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const { data: orders, error } = await admin
        .from('wb_orders')
        .select('nm_id, order_date, price, is_return, data')
        .eq('cabinet_id', cabinetId)
        .gte('order_date', dateFrom);
    if (error || !orders?.length) return 0;

    const byKey = new Map<string, { count: number; sum: number; sppSum: number; sppCnt: number }>();
    for (const o of orders) {
        if (o.is_return) continue;
        const date = String(o.order_date || '').split('T')[0];
        if (!date || o.nm_id == null) continue;
        const key = `${o.nm_id}|${date}`;
        let d = byKey.get(key);
        if (!d) {
            d = { count: 0, sum: 0, sppSum: 0, sppCnt: 0 };
            byKey.set(key, d);
        }
        d.count++;
        d.sum += Number(o.price || 0);
        const raw = o.data as Record<string, unknown> | null;
        const spp = raw?.spp ?? raw?.Spp;
        if (spp != null && Number(spp) > 0) {
            d.sppSum += Number(spp);
            d.sppCnt++;
        }
    }

    const upserts = [...byKey.entries()].map(([key, d]) => {
        const sep = key.indexOf('|');
        const nmId = Number(key.slice(0, sep));
        const date = key.slice(sep + 1);
        return {
            cabinet_id: cabinetId,
            nm_id: nmId,
            date,
            orders_count: d.count,
            orders_sum: d.sum,
            avg_check: d.count > 0 ? d.sum / d.count : 0,
            spp_pct: d.sppCnt > 0 ? d.sppSum / d.sppCnt : 0,
            updated_at: new Date().toISOString(),
        };
    });

    let written = 0;
    for (let i = 0; i < upserts.length; i += 100) {
        const chunk = upserts.slice(i, i + 100);
        const { error: upErr } = await admin.from('rnp_daily_data').upsert(
            chunk,
            { onConflict: 'cabinet_id,nm_id,date' },
        );
        if (upErr) throw upErr;
        written += chunk.length;
    }
    return written;
}
