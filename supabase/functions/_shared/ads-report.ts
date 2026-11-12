// Ежедневная рекламная карточка кабинета: расход, корзины, заказы, цены, ДРР. Чистая логика без Deno-API (тестируется node).
// Источник: adv_daily_stats по кампаниям кабинета (spend, carts, orders, clicks, impressions, revenue).
// ДРР здесь = расход / выручка от заказов с рекламы. Продажи после СПП за вчера у WB появляются позже, поэтому к ним не привязываемся.

export interface AdStat { spend: number; carts: number; orders: number; clicks: number; impressions: number; revenue: number }

export const emptyStat = (): AdStat => ({ spend: 0, carts: 0, orders: 0, clicks: 0, impressions: 0, revenue: 0 });

export function addStat(a: AdStat, b: Partial<Record<keyof AdStat, unknown>>): AdStat {
    const n = (v: unknown) => Number(v) || 0;
    return {
        spend: a.spend + n(b.spend), carts: a.carts + n(b.carts), orders: a.orders + n(b.orders),
        clicks: a.clicks + n(b.clicks), impressions: a.impressions + n(b.impressions), revenue: a.revenue + n(b.revenue),
    };
}

export interface AdCardModel {
    spend: number; carts: number; orders: number; clicks: number; impressions: number; revenue: number;
    cartCost: number | null;   // цена корзины
    orderCost: number | null;  // цена заказа
    clickCost: number | null;  // цена клика
    ctr: number | null;        // %
    drr: number | null;        // %
    spendDeltaPct: number | null; // к предыдущему дню, %
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const r1 = (v: number | null): number | null => (v == null ? null : Math.round(v * 10) / 10);

export function buildAdCard(day: AdStat, prev: AdStat | null): AdCardModel {
    return {
        spend: Math.round(day.spend), carts: day.carts, orders: day.orders, clicks: day.clicks, impressions: day.impressions, revenue: Math.round(day.revenue),
        cartCost: day.carts > 0 ? Math.round(day.spend / day.carts) : null,
        orderCost: day.orders > 0 ? Math.round(day.spend / day.orders) : null,
        clickCost: day.clicks > 0 ? Math.round(day.spend / day.clicks) : null,
        ctr: r1(div(day.clicks * 100, day.impressions)),
        drr: r1(div(day.spend * 100, day.revenue)),
        spendDeltaPct: prev && prev.spend > 0 ? r1((day.spend - prev.spend) * 100 / prev.spend) : null,
    };
}

/** Есть ли смысл слать карточку: был расход или показы. */
export const hasAds = (m: AdCardModel): boolean => m.spend > 0 || m.impressions > 0;
