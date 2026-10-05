// Пересбор заказов: WB дописывает заказы задним числом, а история грузится один раз.
// Раз в несколько минут перезабираем по одному дню из окна последних RESCAN_WINDOW_DAYS дней
// и добавляем недостающие заказы (ничего не удаляем). Курсор идёт назад от «позавчера» и возвращается.

export const RESCAN_WINDOW_DAYS = 30;
export const RESCAN_START_BACK = 2; // «вчера» и «сегодня» уже обновляет auto-sync

function addDays(ymd: string, n: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** День, который надо пересобрать сейчас, и куда сдвинуть курсор после успеха. */
export function nextRescanDay(
    today: string,
    cursor: string | null | undefined,
    startBack = RESCAN_START_BACK,
    windowDays = RESCAN_WINDOW_DAYS,
): { day: string; next: string } {
    const oldest = addDays(today, -(startBack + windowDays - 1));
    const start = addDays(today, -startBack);
    let day = cursor && /^\d{4}-\d{2}-\d{2}$/.test(cursor) ? cursor : start;
    if (day > start || day < oldest) day = start;
    const next = day <= oldest ? start : addDays(day, -1);
    return { day, next };
}

/** Строки для upsert: только заказы с srid (без него нельзя отличить дубль). */
export function rescanRows(
    cabinetId: string,
    day: string,
    orders: Record<string, unknown>[],
    price: (o: Record<string, unknown>) => number,
) {
    return orders
        .filter((o) => o && o.srid)
        .map((o) => ({
            cabinet_id: cabinetId,
            order_date: day,
            nm_id: o.nmId,
            barcode: o.barcode,
            srid: o.srid,
            price: price(o),
            is_return: (o.isReturn as boolean) || false,
            data: o,
        }));
}

// Воронка продаж WB (analytics sales-funnel/products) — источник заказов, как в Аналитике WB и у Raskpro.
// history отдаёт максимум 7 дней, а products принимает любой прошедший период, поэтому берём по одному дню.
export const FUNNEL_WINDOW_DAYS = 62;
export const FUNNEL_START_BACK = 1; // сегодня и вчера (воронка за 7 дней) обновляет auto-sync

export function funnelRowsFromProducts(
    cabinetId: string,
    day: string,
    products: Record<string, any>[],
    allowedNm: Set<number> | null,
    nowIso = new Date().toISOString(),
) {
    const out: Record<string, unknown>[] = [];
    for (const p of products || []) {
        const nm = Number(p?.product?.nmId ?? p?.nmId ?? 0);
        if (!nm || (allowedNm && !allowedNm.has(nm))) continue;
        const st = p?.statistic?.selected || p?.statistic || {};
        const orders = Number(st.orderCount);
        const sum = Number(st.orderSum);
        if (!Number.isFinite(orders) || !Number.isFinite(sum)) continue;
        const conv = Number(st.conversions?.cartToOrderPercent ?? st.cartToOrderConversion ?? 0);
        out.push({
            cabinet_id: cabinetId,
            nm_id: nm,
            date: day,
            orders_count: Math.round(orders),
            funnel_orders: Math.round(orders),
            funnel_orders_sum: Math.round(sum),
            orders_sum: Math.round(sum),
            avg_check: orders > 0 ? sum / orders : 0,
            basket_count: Number(st.cartCount || 0),
            funnel_order_conv: conv,
            updated_at: nowIso,
        });
    }
    return out;
}
