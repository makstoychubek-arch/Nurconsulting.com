/**
 * День из WB Analytics sales-funnel/products/history.
 * В карточке продавца «Заказы» — это штуки воронки, не строки statistics-api.
 *
 * WB часто не кладёт orderCount отдельным полем, но всегда отдаёт
 * cartCount + cartToOrderConversion — те же «Корзина» и «Заказы%» в РНП.
 * 157 корзин × 18% = 28, как на графике WB.
 */

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
    if (fromField != null && implied != null) return Math.max(fromField, implied);
    return fromField ?? implied;
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
