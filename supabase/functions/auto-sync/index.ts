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
const WB_ANALYTICS = 'https://seller-analytics-api.wildberries.ru';
const DATE_FROM = '2026-01-01';

// How many of the most recent days (including today) get precisely
// re-verified against WB on every single sync cycle via the flag=1
// "exact calendar day" query (see Pass B below). 4 = today + 3 full
// prior days, comfortably covering WB's own ~1-day report-publish lag
// plus a safety margin for late-arriving status changes.
const RECENT_DAYS_LOOKBACK = 4;

// Сколько исторических дней докачивать за один прогон (Pass A, порционный
// бэкфил). 25 дней × ~1.5с на день ≈ 40с на кабинет — укладывается в лимиты
// Edge Function даже с несколькими кабинетами в очереди.
const BACKFILL_DAYS_PER_RUN = 25;

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
        .select('id, name, wb_token, orders_backfilled_to')
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
                    // Старый GET /api/v1/supplier/stocks отключён WB
                    // (PLUG-404, июнь-июль 2026). Новый метод — POST
                    // /api/analytics/v1/stocks-report/wb-warehouses (токен
                    // категории Analytics). Пустой nmIds = все товары.
                    const stocksRes = await fetch(
                        `${WB_ANALYTICS}/api/analytics/v1/stocks-report/wb-warehouses`,
                        {
                            method: 'POST',
                            headers: { Authorization: token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nmIds: [], limit: 250000, offset: 0 }),
                        },
                    );
                    if (stocksRes.ok) {
                        const payload = await stocksRes.json();
                        const stocks = payload?.data?.items;
                        if (Array.isArray(stocks) && stocks.length > 0) {
                            stocksCount = stocks.length;
                            await admin.from('wb_stocks').delete().eq('cabinet_id', cabinet.id);
                            const stockRows = stocks.map((s: Record<string, unknown>) => ({
                                cabinet_id: cabinet.id,
                                nm_id: s.nmId,
                                barcode: String(s.chrtId ?? ''),
                                tech_size: '',
                                quantity: s.quantity || 0,
                                in_way_to_client: s.inWayToClient || 0,
                                in_way_from_client: s.inWayFromClient || 0,
                                warehouse_name: s.warehouseName || '',
                            }));
                            for (let i = 0; i < stockRows.length; i += 500) {
                                await admin.from('wb_stocks').insert(stockRows.slice(i, i + 500));
                            }
                        }
                    } else {
                        errorMsg += `stocks: HTTP ${stocksRes.status}; `;
                        status = 'partial';
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
                                        // ВАЖНО: ошибка upsert раньше игнорировалась молча —
                                        // именно так wb_orders месяцами оставалась пустой.
                                        const { error: upErr } = await admin.from('wb_orders').upsert(
                                            withSrid.slice(i, i + 100),
                                            { onConflict: 'cabinet_id,srid' },
                                        );
                                        if (upErr) throw new Error(`upsert(${dayStr}): ${upErr.message}`);
                                    }
                                    for (let i = 0; i < withoutSrid.length; i += 100) {
                                        const { error: insErr } = await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 100));
                                        if (insErr) throw new Error(`insert(${dayStr}): ${insErr.message}`);
                                    }
                                }
                            }
                        } else {
                            errorMsg += `orders_recent(${dayStr}): HTTP ${dayRes.status}; `;
                            status = 'partial';
                            // 429 — выдерживаем паузу, иначе следующие дни тоже упадут
                            if (dayRes.status === 429) await sleep(20000);
                        }
                        // WB Statistics API has strict rate limits — small pause between
                        // the per-day requests, matching the sleep() pattern already used
                        // elsewhere in this file.
                        await sleep(2000);
                    }
                } catch (e) {
                    errorMsg += `orders_recent: ${(e as Error).message}; `;
                    status = 'partial';
                }

                // ── Pass A: порционный исторический бэкфил (flag=1 по дням) ─
                // Старая версия тянула ВСЮ историю одним flag=0 запросом
                // (десятки тысяч заказов одним JSON), предварительно удалив
                // все wb_orders кабинета — функция падала по лимитам Edge
                // Function (HTTP 546) до завершения вставки, и кабинет
                // оставался с пустой таблицей («Нет данных за выбранный
                // период»). Теперь история докачивается порциями по
                // BACKFILL_DAYS_PER_RUN дней за прогон, с курсором
                // cabinets.orders_backfilled_to (дата, до которой история
                // уже есть). Каждый день — точный flag=1 снапшот + upsert,
                // без blanket-delete. За несколько прогонов крона история
                // догружается до DATE_FROM и дальше не трогается.
                try {
                    const recentEdge = new Date();
                    recentEdge.setUTCDate(recentEdge.getUTCDate() - RECENT_DAYS_LOOKBACK);
                    const backfilledTo = cabinet.orders_backfilled_to
                        ? String(cabinet.orders_backfilled_to)
                        : recentEdge.toISOString().split('T')[0];

                    if (backfilledTo > DATE_FROM) {
                        const cursor = new Date(backfilledTo + 'T00:00:00Z');
                        let daysDone = 0;
                        while (daysDone < BACKFILL_DAYS_PER_RUN) {
                            cursor.setUTCDate(cursor.getUTCDate() - 1);
                            const dayStr = cursor.toISOString().split('T')[0];
                            if (dayStr < DATE_FROM) break;

                            const dayRes = await fetch(
                                `${WB_STATS}/api/v1/supplier/orders?dateFrom=${dayStr}&flag=1`,
                                { headers: { Authorization: token } },
                            );
                            if (!dayRes.ok) {
                                errorMsg += `orders_backfill(${dayStr}): HTTP ${dayRes.status}; `;
                                status = 'partial';
                                // При 429 ждём и пробуем тот же день ещё раз, иначе
                                // курсор не двигается и кабинет остаётся пустым.
                                if (dayRes.status === 429) {
                                    await sleep(25000);
                                    const retry = await fetch(
                                        `${WB_STATS}/api/v1/supplier/orders?dateFrom=${dayStr}&flag=1`,
                                        { headers: { Authorization: token } },
                                    );
                                    if (!retry.ok) break;
                                    // подменяем dayRes-подобный поток через повторную обработку ниже
                                    const retryOrders = await retry.json();
                                    if (Array.isArray(retryOrders) && retryOrders.length > 0) {
                                        historicalOrdersCount += retryOrders.length;
                                        const rows = retryOrders.map((o: Record<string, unknown>) => toOrderRow(cabinet.id, o));
                                        const withSrid = rows.filter(r => r.srid);
                                        const withoutSrid = rows.filter(r => !r.srid);
                                        for (let i = 0; i < withSrid.length; i += 500) {
                                            const { error: upErr } = await admin.from('wb_orders').upsert(
                                                withSrid.slice(i, i + 500),
                                                { onConflict: 'cabinet_id,srid' },
                                            );
                                            if (upErr) throw new Error(`backfill upsert(${dayStr}): ${upErr.message}`);
                                        }
                                        if (withoutSrid.length) {
                                            await admin.from('wb_orders').delete()
                                                .eq('cabinet_id', cabinet.id)
                                                .eq('order_date', dayStr)
                                                .is('srid', null);
                                            for (let i = 0; i < withoutSrid.length; i += 500) {
                                                const { error: insErr } = await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 500));
                                                if (insErr) throw new Error(`backfill insert(${dayStr}): ${insErr.message}`);
                                            }
                                        }
                                    }
                                    await admin.from('cabinets')
                                        .update({ orders_backfilled_to: dayStr })
                                        .eq('id', cabinet.id);
                                    daysDone++;
                                    await sleep(2000);
                                    continue;
                                }
                                break;
                            }
                            const dayOrders = await dayRes.json();
                            if (Array.isArray(dayOrders) && dayOrders.length > 0) {
                                historicalOrdersCount += dayOrders.length;
                                const rows = dayOrders.map((o: Record<string, unknown>) => toOrderRow(cabinet.id, o));
                                const withSrid = rows.filter(r => r.srid);
                                const withoutSrid = rows.filter(r => !r.srid);
                                for (let i = 0; i < withSrid.length; i += 500) {
                                    const { error: upErr } = await admin.from('wb_orders').upsert(
                                        withSrid.slice(i, i + 500),
                                        { onConflict: 'cabinet_id,srid' },
                                    );
                                    if (upErr) throw new Error(`backfill upsert(${dayStr}): ${upErr.message}`);
                                }
                                if (withoutSrid.length) {
                                    await admin.from('wb_orders').delete()
                                        .eq('cabinet_id', cabinet.id)
                                        .eq('order_date', dayStr)
                                        .is('srid', null);
                                    for (let i = 0; i < withoutSrid.length; i += 500) {
                                        const { error: insErr } = await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 500));
                                        if (insErr) throw new Error(`backfill insert(${dayStr}): ${insErr.message}`);
                                    }
                                }
                            }
                            // Курсор двигаем после каждого успешно загруженного дня —
                            // обрыв функции ничего не теряет, продолжим с этого места.
                            await admin.from('cabinets')
                                .update({ orders_backfilled_to: dayStr })
                                .eq('id', cabinet.id);
                            daysDone++;
                            await sleep(2000);
                        }
                    }
                } catch (e) {
                    errorMsg += `orders_backfill: ${(e as Error).message}; `;
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

            // Блок финансовой детализации удалён: использовавшийся метод
            // GET /api/v5/supplier/reportDetailByPeriod отключён WB 15.07.2026
            // (замена — POST /api/finance/v1/sales-reports/detailed, токен
            // категории «Финансы»). Результат нигде не сохранялся (только
            // счётчик в sync_log), а каждый прогон тратил на него время.
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

        // Между кабинетами — длинная пауза: WB Statistics API общий лимит
        // на продавца/IP, иначе следующий кабинет сразу ловит 429 и остаётся
        // с пустым wb_orders («Нет данных за выбранный период»).
        await sleep(8000);
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
