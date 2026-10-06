// Автопилот рекламы: решение «поднять, опустить или оставить ставку» по каждому артикулу.
// Чистая логика без сети и базы. Деньги считаем так:
//   предельная цена заказа = прибыль на выкуп (до рекламы) × доля выкупа;
//   целевая цена заказа    = min(предельная × target_share, max_drr% × средняя цена заказа).
// deno-lint-ignore-file no-explicit-any

export type Params = {
    targetShare: number; maxDrrPct: number; minBidKop: number; maxBidKop: number; stepPct: number; minClicks: number;
};
export const DEFAULTS: Params = { targetShare: 0.7, maxDrrPct: 15, minBidKop: 300, maxBidKop: 1600, stepPct: 10, minClicks: 60 };

export type Econ = { profitPerSale: number; buyout: number; pricePerOrder: number };
export type Stats = { spend: number; orders: number; clicks: number; views: number };
export type Decision = { action: 'raise' | 'lower' | 'hold'; newBid: number; reason: string; cpo: number | null; target: number };

const BUYOUT_MIN = 0.15, BUYOUT_MAX = 0.6;

export function breakEvenCpo(e: Econ): number {
    return Math.max(0, e.profitPerSale * e.buyout);
}

export function targetCpo(e: Econ, p: Params): number {
    return Math.max(0, Math.min(breakEvenCpo(e) * p.targetShare, (p.maxDrrPct / 100) * e.pricePerOrder));
}

/** Ставка в копейках, кратная 10 (0,1 сом). */
export const roundBid = (n: number) => Math.round(n / 10) * 10;

export function decideBid(stats: Stats, e: Econ, bid: number, p: Params): Decision {
    const target = targetCpo(e, p);
    const hold = (reason: string, cpo: number | null = null): Decision => ({ action: 'hold', newBid: bid, reason, cpo, target });
    if (!(target > 0)) return hold('нет прибыли на выкуп: реклама не окупается');

    const cpo = stats.orders > 0 ? stats.spend / stats.orders : null;
    const step = Math.max(10, roundBid(bid * p.stepPct / 100));
    const lower = (mult: number, reason: string): Decision => {
        const nb = Math.max(p.minBidKop, roundBid(bid - step * mult));
        return nb < bid ? { action: 'lower', newBid: nb, reason, cpo, target } : hold('ставка уже на минимуме', cpo);
    };

    if (stats.orders === 0) {
        if (stats.spend >= target * 1.5) return lower(2, 'потратили больше 1,5 целевых цен заказа и ни одного заказа');
        return hold('мало данных', null);
    }
    if (stats.clicks < p.minClicks) return hold('мало кликов для решения', cpo);

    const ratio = (cpo as number) / target;
    if (ratio <= 0.6) {
        const nb = Math.min(p.maxBidKop, roundBid(bid + step));
        return nb > bid ? { action: 'raise', newBid: nb, reason: 'заказ заметно дешевле цели: растим', cpo, target } : hold('ставка на потолке', cpo);
    }
    if (ratio <= 1.0) return hold('цена заказа в норме', cpo);
    if (ratio <= 1.4) return lower(1, 'цена заказа выше цели');
    return lower(2, 'цена заказа сильно выше цели');
}

/** Прибыль на выкуп и доля выкупа по строкам РНП (за период без свежих дней: выкупы приходят с задержкой). */
export function economicsFromRows(rows: any[], costPrice: number): Econ | null {
    let sales = 0, orders = 0, transfer = 0, storage = 0, ordersSum = 0;
    for (const r of rows) {
        sales += Number(r.sales_count) || 0; orders += Number(r.orders_count) || 0;
        transfer += Number(r.to_transfer) || 0; storage += Number(r.storage_sum) || 0; ordersSum += Number(r.orders_sum) || 0;
    }
    if (sales < 8 || orders < 8 || !(costPrice > 0)) return null;
    const buyout = Math.min(BUYOUT_MAX, Math.max(BUYOUT_MIN, sales / orders));
    return { profitPerSale: (transfer - sales * costPrice - storage) / sales, buyout, pricePerOrder: ordersSum / orders };
}

/** Статистика по артикулам из строк advertising_daily_stats (apps[].nms[]). */
export function nmStatsFromRows(rows: any[]): Map<string, Stats> {
    const out = new Map<string, Stats>();
    for (const row of rows) {
        const apps = Array.isArray(row?.data?.apps) ? row.data.apps : [];
        for (const app of apps) {
            for (const n of Array.isArray(app?.nms) ? app.nms : []) {
                const key = `${row.campaign_id}:${n.nmId}`;
                const s = out.get(key) || { spend: 0, orders: 0, clicks: 0, views: 0 };
                s.spend += Number(n.sum) || 0; s.orders += Number(n.orders) || 0; s.clicks += Number(n.clicks) || 0; s.views += Number(n.views) || 0;
                out.set(key, s);
            }
        }
    }
    return out;
}
