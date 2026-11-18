// Отправки FBS для фулфилмента (АМАН ФФ) за день: сколько заказов ушло по каждому кабинету и сколько это стоит в рублях.
// Чистая логика без Deno-API, чтобы тестировалась обычным node.
// Тариф берётся из ff_terms (kind = 'ship', ₽ за 1 заказ) на дату заказа, отдельно по каждому складу ФФ.

export interface FfOrder { cabinet_id: string; ff_name: string | null; nm_id: number; order_date: string }
export interface FfTerm { cabinet_id: string; ff_name: string; kind: string; value: number | string; date_from: string; date_to: string | null }

export interface FfShipRow {
    cabinetId: string;
    cabinet: string;
    sub: string;
    count: number;
    rate: number | null;   // средняя цена за отправку, если тарифы склада совпадают, то она же
    sum: number;           // ₽
    mixedRates: boolean;
}

/** Тариф отправки склада ФФ на дату: последний подходящий период; null, если не задан. */
export function shipRate(terms: FfTerm[], cabinetId: string, ff: string, date: string): number | null {
    let best: FfTerm | null = null;
    for (const t of terms) {
        if (t.cabinet_id !== cabinetId || t.ff_name !== ff || t.kind !== 'ship') continue;
        if (t.date_from > date || (t.date_to && t.date_to < date)) continue;
        if (!best || t.date_from > best.date_from) best = t;
    }
    return best ? Number(best.value) : null;
}

/** Строки по кабинетам. Склады ФФ отбираются по префиксу имени («АМАН» берёт «АМАН ФФ», «АМАН ФФ 2» и т. д.). */
export function buildShipRows(
    orders: FfOrder[], terms: FfTerm[], date: string,
    opts: { ffPrefix: string; cabinetNames: Record<string, string>; articleNames: Record<string, string>; onlyCabinets?: string[] },
): FfShipRow[] {
    const by = new Map<string, { count: number; sum: number; rates: Set<number>; nms: Map<number, number> }>();
    for (const o of orders) {
        if (o.order_date !== date) continue;
        if (!o.ff_name || !o.ff_name.startsWith(opts.ffPrefix)) continue;
        if (opts.onlyCabinets && !opts.onlyCabinets.includes(o.cabinet_id)) continue;
        const rate = shipRate(terms, o.cabinet_id, o.ff_name, date);
        let b = by.get(o.cabinet_id);
        if (!b) { b = { count: 0, sum: 0, rates: new Set(), nms: new Map() }; by.set(o.cabinet_id, b); }
        b.count += 1;
        if (rate != null) { b.sum += rate; b.rates.add(rate); }
        b.nms.set(o.nm_id, (b.nms.get(o.nm_id) || 0) + 1);
    }
    const rows: FfShipRow[] = [];
    for (const [cabinetId, b] of by) {
        const top = [...b.nms.entries()].sort((a, c) => c[1] - a[1]);
        const sub = top.length === 1
            ? (opts.articleNames[String(top[0][0])] || '')
            : `${top.length} ${plural(top.length, 'артикул', 'артикула', 'артикулов')}`;
        rows.push({
            cabinetId, cabinet: opts.cabinetNames[cabinetId] || 'Кабинет', sub, count: b.count, sum: Math.round(b.sum * 100) / 100,
            rate: b.rates.size === 1 ? [...b.rates][0] : (b.count ? Math.round(b.sum / b.count * 100) / 100 : null),
            mixedRates: b.rates.size > 1,
        });
    }
    return rows.sort((a, c) => c.sum - a.sum);
}

export function plural(n: number, one: string, few: string, many: string): string {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

export function totals(rows: FfShipRow[]): { count: number; sum: number } {
    return { count: rows.reduce((s, r) => s + r.count, 0), sum: Math.round(rows.reduce((s, r) => s + r.sum, 0) * 100) / 100 };
}
