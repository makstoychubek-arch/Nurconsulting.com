/**
 * День из WB Analytics sales-funnel/products/history.
 * В карточке продавца «Заказы» — это orderCount, не строки statistics-api.
 */

export function funnelDayOrders(day: Record<string, unknown> | null | undefined): number | null {
    if (!day || typeof day !== 'object') return null;
    const raw = day.orderCount ?? day.ordersCount ?? day.orders ?? day.order_count;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
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
