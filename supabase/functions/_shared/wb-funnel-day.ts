/**
 * День из WB Analytics sales-funnel/products/history.
 * В карточке продавца «Заказы» — это штуки воронки, не строки statistics-api.
 *
 * Берём настоящий orderCount воронки: 05.10.2026 сверено с кабинетом WB по артикулу
 * 1544472467 за 7 дней (12, 11, 17, 22, 26, 31, 5 = 124, как в «Динамике продаж»).
 * «Корзина × Заказы %» только запасной вариант, когда orderCount не пришёл: процент
 * целый и округлённый, поэтому даёт расхождения (27 вместо 26).
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
    // Настоящий orderCount воронки, сохранённый для любого дня (в том числе старше 7 дней — его доливает
    // orders-rescan через sales-funnel/products), главнее заказов statistics-api, которых WB отдаёт ~9% меньше.
    const stored = existing?.funnel_orders;
    if (stored != null && stored !== '' && Number.isFinite(Number(stored)) && Number(stored) >= 0) return Number(stored);
    if (!isWbFunnelWindowDate(date, today)) return fallback;
    // Настоящий orderCount воронки, сохранённый при синхронизации.
    const raw = existing?.funnel_orders;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0) return Number(raw);
    const implied = funnelImpliedOrders(existing);
    if (implied != null) return implied;
    return fallback;
}

/** Сумма заказов воронки (orderSum) — как «Заказано, сумма» в аналитике WB. */
export function keepFunnelOrdersSum(existing: Record<string, unknown> | null | undefined, statsSum: number): number {
    const stored = existing?.funnel_orders_sum;
    if (stored != null && stored !== '' && Number.isFinite(Number(stored)) && Number(stored) >= 0) return Number(stored);
    return Number(statsSum) || 0;
}

export function applyKeepFunnelOrders<T extends { nm_id: number; date: string; orders_count: number; orders_sum?: number; avg_check?: number }>(
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
        const ex = map.get(`${row.nm_id}|${row.date}`);
        row.orders_count = keepFunnelOrdersCount(ex, Number(row.orders_count), row.date, today);
        if (row.orders_sum != null) {
            row.orders_sum = keepFunnelOrdersSum(ex, Number(row.orders_sum));
            if ('avg_check' in row) row.avg_check = row.orders_count > 0 ? row.orders_sum / row.orders_count : 0;
        }
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
    if (fromField != null) return fromField;
    return funnelImpliedOrders(day);
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
    // Настоящий orderCount воронки — отдельно, для сверки и для защиты от перезаписи из statistics-api.
    const rawOrders = numPick(day, ['orderCount', 'ordersCount', 'orders', 'order_count']);
    if (rawOrders != null) fields.funnel_orders = Math.round(rawOrders);
    const rawSum = numPick(day, ['orderSum', 'ordersSumRub', 'ordersSum']);
    if (rawSum != null && rawOrders != null) {
        fields.funnel_orders_sum = Math.round(rawSum);
        fields.orders_sum = Math.round(rawSum);
    }
    return fields;
}
