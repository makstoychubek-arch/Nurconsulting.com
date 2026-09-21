/**
 * День из WB Analytics sales-funnel/products/history.
 * В карточке продавца «Заказы» — это штуки воронки, не строки statistics-api.
 *
 * WB часто не кладёт orderCount отдельным полем, но всегда отдаёт
 * cartCount + cartToOrderConversion — те же «Корзина» и «Заказы%» в РНП.
 * 157 корзин × 18% = 28, как на графике WB.
 *
 * Последние 7 календарных дней карточки — Москва. Пересборка из wb_orders
 * не должна затирать эти штуки, иначе утром в РНП снова 66 вместо 47.
 */

export function moscowYmd(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}

export function addDaysYmd(day: string, n: number): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
}

export function wbFunnelWindow(today = moscowYmd()): { from: string; to: string } {
    return { from: addDaysYmd(today, -6), to: today };
}

export function isWbFunnelWindowDate(date: string, today = moscowYmd()): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const { from, to } = wbFunnelWindow(today);
    return date >= from && date <= to;
}

export function keepFunnelOrdersCount(
    existing: Record<string, unknown> | null | undefined,
    statsCount: number,
    date: string,
    today = moscowYmd(),
): number {
    const stats = Number(statsCount);
    const fallback = Number.isFinite(stats) && stats >= 0 ? stats : 0;
    if (!isWbFunnelWindowDate(date, today)) return fallback;
    const implied = funnelImpliedOrders(existing);
    if (implied != null) return implied;
    return fallback;
}

export function applyKeepFunnelOrders<T extends { nm_id: number; date: string; orders_count: number }>(
    existing: Array<Record<string, unknown> | null | undefined>,
    upserts: T[],
    today = moscowYmd(),
): T[] {
    const map = new Map<string, Record<string, unknown>>();
    for (const row of existing) {
        if (!row || typeof row !== 'object') continue;
        const date = String(row.date || '').split('T')[0];
        const nmId = Number(row.nm_id);
        if (!date || !nmId) continue;
        map.set(`${nmId}|${date}`, row);
    }
    for (const row of upserts) {
        row.orders_count = keepFunnelOrdersCount(
            map.get(`${row.nm_id}|${row.date}`),
            Number(row.orders_count),
            row.date,
            today,
        );
    }
    return upserts;
}

function numPick(obj: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
        const v = obj[key];
        if (v == null || v === '') continue;
        if (typeof v === 'object' && !Array.isArray(v)) {
            const nested = numPick(v as Record<string, unknown>, [
                'count', 'qty', 'quantity', 'value', 'orderCount', 'ordersCount',
            ]);
            if (nested != null) return nested;
            continue;
        }
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
}

export function funnelImpliedOrders(day: Record<string, unknown> | null | undefined): number | null {
    if (!day || typeof day !== 'object') return null;
    const cart = Number(day.cartCount ?? day.addToCartCount ?? day.basket_count ?? 0);
    const conv = Number(day.cartToOrderConversion ?? day.funnel_order_conv ?? 0);
    if (!(cart > 0 && conv > 0)) return null;
    return Math.round(cart * conv / 100);
}

export function funnelDayOrders(day: Record<string, unknown> | null | undefined): number | null {
    if (!day || typeof day !== 'object') return null;
    const fromField = numPick(day, [
        'orderCount', 'ordersCount', 'orders', 'order_count', 'ordered', 'orderCnt',
    ]);
    const implied = funnelImpliedOrders(day);
    // Карточка WB / Excel «План/факт»: Корзина × Заказы%. orderCount из
    // statistics-api часто больше (66 вместо 47) — его не берём, если есть %.
    if (implied != null) return implied;
    return fromField;
}

export function funnelDayMetricFields(day: Record<string, unknown>): Record<string, unknown> {
    const opens = Number(day.openCount || 0);
    const cart = Number(day.cartCount || 0);
    const fields: Record<string, unknown> = {
        impressions: opens,
        clicks: opens,
        ctr_pct: opens > 0 ? cart / opens * 100 : 0,
        basket_count: cart,
        basket_pct: Number(day.addToCartConversion || 0),
        funnel_order_conv: Number(day.cartToOrderConversion || 0),
        updated_at: new Date().toISOString(),
    };
    const orders = funnelDayOrders(day);
    if (orders != null) fields.orders_count = orders;
    return fields;
}
