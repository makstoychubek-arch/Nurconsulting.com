// Заказы FBS из marketplace-api WB → строки таблицы fbs_orders (какой склад продавца / ФФ собирал заказ).
// Чистые функции, без сетевых вызовов — чтобы проверять тестом.

export type WbFbsOrder = {
    id?: number | string;
    rid?: string;
    createdAt?: string;
    warehouseId?: number;
    nmId?: number;
};

export type FbsOrderRow = {
    cabinet_id: string;
    order_id: number;
    rid: string | null;
    nm_id: number | null;
    warehouse_id: number | null;
    ff_name: string | null;
    created_at: string | null;
    order_date: string | null;
};

/** Дата заказа по Москве (как день заказа в отчётах WB): UTC + 3 часа. */
export function moscowDate(iso?: string): string | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    return new Date(t + 3 * 3600_000).toISOString().slice(0, 10);
}

export function toFbsOrderRows(
    cabinetId: string,
    orders: WbFbsOrder[] | null | undefined,
    warehouseNames: Map<number, string>,
): FbsOrderRow[] {
    const out: FbsOrderRow[] = [];
    for (const o of orders || []) {
        const id = Number(o?.id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const wh = Number(o.warehouseId);
        out.push({
            cabinet_id: cabinetId,
            order_id: id,
            rid: o.rid ? String(o.rid) : null,
            nm_id: Number(o.nmId) > 0 ? Number(o.nmId) : null,
            warehouse_id: Number.isFinite(wh) && wh > 0 ? wh : null,
            ff_name: Number.isFinite(wh) ? (warehouseNames.get(wh) ?? null) : null,
            created_at: o.createdAt ?? null,
            order_date: moscowDate(o.createdAt),
        });
    }
    return out;
}
