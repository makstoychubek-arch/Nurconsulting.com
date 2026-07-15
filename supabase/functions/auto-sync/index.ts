// Supabase Edge Function: auto-sync
// Syncs WB stocks/orders for all cabinets with tokens (or one cabinet).
// Auth: service_role key (pg_cron) or user JWT (dashboard manual sync).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
const WB_STATS = 'https://statistics-api.wildberries.ru';
const DATE_FROM = '2026-01-01';

// How many of the most recent days (including today) get precisely
// re-verified against WB on every single sync cycle via the flag=1
// "exact calendar day" query (see Pass B below). 4 = today + 3 full
// prior days, comfortably covering WB's own ~1-day report-publish lag
// plus a safety margin for late-arriving status changes.
const RECENT_DAYS_LOOKBACK = 4;

// Minimum time between full-history (flag=0) pulls per cabinet. That
// pull only matters for backfilling months-old history (which never
// changes), so it doesn't need to run every 4h — recent days are kept
// correct by the cheap per-day flag=1 pass on every cycle regardless.
const FULL_SYNC_INTERVAL_MS = 20 * 60 * 60 * 1000;

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
    let isServiceRole = bearer === serviceKey;
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
            user.id === SUPER_ADMIN_ID;
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

    let query = admin
        .from('cabinets')
        .select('id, name, wb_token, last_full_orders_sync_at')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');

    if (targetCabinetId) query = query.eq('id', targetCabinetId);

    const { data: cabinets, error: cabErr } = await query;

    if (cabErr || !cabinets || cabinets.length === 0) {
        return json({ error: 'Нет кабинетов с токенами', detail: cabErr }, 400);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const cabinet of cabinets) {
        const token = sanitizeWbToken(cabinet.wb_token);
        if (!token || token.length < 50) continue;

        const cabStart = Date.now();
        let stocksCount = 0;
        let ordersCount = 0;
        let financeRows = 0;
        let rnpDailyRows = 0;
        let status = 'success';
        let errorMsg = '';

        try {
            if (mode === 'full' || mode === 'stocks') {
                try {
                    const stocksRes = await fetch(
                        `${WB_STATS}/api/v1/supplier/stocks?dateFrom=${DATE_FROM}`,
                        { headers: { Authorization: token } },
                    );
                    if (stocksRes.ok) {
                        const stocks = await stocksRes.json();
                        if (Array.isArray(stocks) && stocks.length > 0) {
                            stocksCount = stocks.length;
                            await admin.from('wb_stocks').delete().eq('cabinet_id', cabinet.id);
                            const stockRows = stocks.map((s: Record<string, unknown>) => ({
                                cabinet_id: cabinet.id,
                                nm_id: s.nmId,
                                barcode: s.barcode,
                                tech_size: s.techSize || '',
                                quantity: s.quantity || 0,
                                in_way_to_client: s.inWayToClient || 0,
                                in_way_from_client: s.inWayFromClient || 0,
                                warehouse_name: s.warehouseName || '',
                            }));
                            for (let i = 0; i < stockRows.length; i += 100) {
                                await admin.from('wb_stocks').insert(stockRows.slice(i, i + 100));
                            }
                        }
                    }
                } catch (e) {
                    errorMsg += `stocks: ${(e as Error).message}; `;
                    status = 'partial';
                }
                await sleep(2000);
            }

            if (mode === 'full' || mode === 'rnp') {
                let historicalOrdersCount = 0;
                let recentOrdersCount = 0;

                // ── Pass A: full historical backfill (flag=0) ──────────────
                // ROOT CAUSE of the "yesterday's order count is short by a few
                // orders vs WB's own Воронка продаж" bug: WB's flag=0 (or
                // omitted) `dateFrom` does NOT mean "orders placed since
                // dateFrom" — it means "orders whose lastChangeDate (ANY
                // status change: delivered/returned/cancelled/etc, not just
                // placement) is >= dateFrom", sorted ascending by
                // lastChangeDate. Because DATE_FROM never moved, every 4h
                // cron tick re-downloaded WB's ENTIRE order history (~6.5
                // months and growing) in one unpaginated request, deleted
                // ALL of wb_orders for the cabinet, and reinserted everything
                // from scratch. Under load this large payload/loop is exactly
                // the kind of thing that can get truncated or hit the Edge
                // Function's time/CPU budget mid-upsert — and since orders
                // are processed in ascending lastChangeDate order, the most
                // recently-changed rows (= today/yesterday, the ones users
                // actually look at) are the ones most likely to be cut off
                // before they're written. That matches the reported symptom
                // exactly: historical months look fine, but the most recent
                // day is short by a couple of orders.
                //
                // Fix: this expensive full-history pull only backfills
                // months-old data that never changes, so it doesn't need to
                // run every cycle. It now runs at most once per
                // FULL_SYNC_INTERVAL_MS per cabinet (tracked via
                // cabinets.last_full_orders_sync_at), or immediately on a
                // cabinet's very first sync (column is null). Recent-day
                // correctness no longer depends on this pass at all — see
                // Pass B below, which runs on every single cycle.
                const lastFullSyncAt = cabinet.last_full_orders_sync_at
                    ? new Date(cabinet.last_full_orders_sync_at as string).getTime()
                    : 0;
                const shouldRunFullSync = (Date.now() - lastFullSyncAt) > FULL_SYNC_INTERVAL_MS;

                if (shouldRunFullSync) {
                    try {
                        const ordersRes = await fetch(
                            `${WB_STATS}/api/v1/supplier/orders?dateFrom=${DATE_FROM}&flag=0`,
                            { headers: { Authorization: token } },
                        );
                        if (ordersRes.ok) {
                            const orders = await ordersRes.json();
                            if (Array.isArray(orders) && orders.length > 0) {
                                historicalOrdersCount = orders.length;
                                await admin.from('wb_orders').delete().eq('cabinet_id', cabinet.id).gte('order_date', DATE_FROM);
                                // NOTE: WB legitimately returns multiple distinct orders for the
                                // same nm_id+barcode on the same day (different buyers/units).
                                // Dedup must use WB's own unique order-line id ("srid"), NOT
                                // (date, nm_id, barcode) — the old key silently dropped every
                                // extra same-day order for a product, undercounting order counts.
                                const orderRows = orders.map((o: Record<string, unknown>) => toOrderRow(cabinet.id, o));
                                const withSrid = orderRows.filter(r => r.srid);
                                const withoutSrid = orderRows.filter(r => !r.srid);
                                for (let i = 0; i < withSrid.length; i += 100) {
                                    await admin.from('wb_orders').upsert(
                                        withSrid.slice(i, i + 100),
                                        { onConflict: 'cabinet_id,srid' },
                                    );
                                }
                                for (let i = 0; i < withoutSrid.length; i += 100) {
                                    await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 100));
                                }
                            }
                            await admin.from('cabinets')
                                .update({ last_full_orders_sync_at: new Date().toISOString() })
                                .eq('id', cabinet.id);
                        }
                    } catch (e) {
                        errorMsg += `orders_full: ${(e as Error).message}; `;
                        status = 'partial';
                    }
                    await sleep(2000);
                }

                // ── Pass B: precise recent-days resync (flag=1) ────────────
                // Runs on EVERY sync cycle regardless of Pass A. flag=1
                // changes dateFrom's meaning to "return ONLY orders whose
                // orderDate falls on this exact single calendar date" — a
                // small, precise, single-day snapshot, immune to the
                // lastChangeDate noise from Pass A. For each of the last
                // RECENT_DAYS_LOOKBACK days we fetch that day's orders and
                // do a targeted delete-then-insert scoped to exactly
                // (cabinet_id, order_date = that day) — never touching other
                // days — so today/yesterday/etc. are always exactly correct
                // on every 4h tick, independent of whatever Pass A is doing.
                try {
                    for (let dayOffset = RECENT_DAYS_LOOKBACK - 1; dayOffset >= 0; dayOffset--) {
                        const d = new Date();
                        d.setUTCDate(d.getUTCDate() - dayOffset);
                        const dayStr = d.toISOString().split('T')[0];

                        const dayRes = await fetch(
                            `${WB_STATS}/api/v1/supplier/orders?dateFrom=${dayStr}&flag=1`,
                            { headers: { Authorization: token } },
                        );
                        if (dayRes.ok) {
                            const dayOrders = await dayRes.json();
                            if (Array.isArray(dayOrders)) {
                                recentOrdersCount += dayOrders.length;
                                // Scoped delete: only this cabinet + this exact day, never
                                // the blanket delete-everything used in Pass A.
                                await admin.from('wb_orders').delete()
                                    .eq('cabinet_id', cabinet.id)
                                    .eq('order_date', dayStr);
                                if (dayOrders.length > 0) {
                                    const rows = dayOrders.map((o: Record<string, unknown>) => toOrderRow(cabinet.id, o));
                                    const withSrid = rows.filter(r => r.srid);
                                    const withoutSrid = rows.filter(r => !r.srid);
                                    for (let i = 0; i < withSrid.length; i += 100) {
                                        await admin.from('wb_orders').upsert(
                                            withSrid.slice(i, i + 100),
                                            { onConflict: 'cabinet_id,srid' },
                                        );
                                    }
                                    for (let i = 0; i < withoutSrid.length; i += 100) {
                                        await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 100));
                                    }
                                }
                            }
                        } else {
                            errorMsg += `orders_recent(${dayStr}): HTTP ${dayRes.status}; `;
                            status = 'partial';
                        }
                        // WB Statistics API has strict rate limits — small pause between
                        // the per-day requests, matching the sleep() pattern already used
                        // elsewhere in this file.
                        await sleep(1200);
                    }
                } catch (e) {
                    errorMsg += `orders_recent: ${(e as Error).message}; `;
                    status = 'partial';
                }

                ordersCount = historicalOrdersCount + recentOrdersCount;

                try {
                    rnpDailyRows = await syncRnpDailyFromOrders(admin, cabinet.id);
                } catch (e) {
                    errorMsg += `rnp_daily: ${(e as Error).message}; `;
                    status = 'partial';
                }
                await sleep(2000);
            }

            if (mode === 'full') {
                try {
                    const today = new Date().toISOString().split('T')[0];
                    let rrdid = 0;
                    let pageRows = 0;
                    while (true) {
                        const finRes = await fetch(
                            `${WB_STATS}/api/v5/supplier/reportDetailByPeriod?dateFrom=${DATE_FROM}T00:00:00.000Z&dateTo=${today}T23:59:59.000Z&limit=100000&rrdid=${rrdid}`,
                            { headers: { Authorization: token } },
                        );
                        if (!finRes.ok) break;
                        const rows = await finRes.json();
                        if (!Array.isArray(rows) || rows.length === 0) break;
                        pageRows += rows.length;
                        const maxRrd = Math.max(...rows.map((r: { rrd_id?: number }) => r.rrd_id || 0));
                        if (maxRrd <= rrdid || rows.length < 100000) {
                            financeRows += pageRows;
                            break;
                        }
                        rrdid = maxRrd;
                        await sleep(1000);
                    }
                } catch (e) {
                    errorMsg += `finance: ${(e as Error).message}; `;
                    status = 'partial';
                }
            }
        } catch (e) {
            status = 'error';
            errorMsg = (e as Error).message;
        }

        const duration = Date.now() - cabStart;
        await admin.from('sync_log').insert({
            cabinet_id: cabinet.id,
            cabinet_name: cabinet.name,
            stocks_count: stocksCount,
            orders_count: ordersCount,
            finance_rows: financeRows,
            status,
            error_msg: errorMsg || null,
            duration_ms: duration,
        });

        results.push({
            cabinet: cabinet.name,
            status,
            stocks: stocksCount,
            orders: ordersCount,
            finance: financeRows,
            rnp_daily: rnpDailyRows,
            ms: duration,
        });

        await sleep(3000);
    }

    return json({
        ok: true,
        mode,
        cabinets_synced: results.length,
        total_ms: Date.now() - started,
        results,
    });
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

async function syncRnpDailyFromOrders(
    admin: ReturnType<typeof createClient>,
    cabinetId: string,
): Promise<number> {
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
