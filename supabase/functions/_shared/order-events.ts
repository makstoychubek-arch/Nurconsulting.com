// Новые заказы FBS (marketplace-api /api/v3/orders/new) -> строки order_events.
// Чистые функции без сети: поведение проверяется тестом (order-events_test.mts).

export type OrderEventRow = {
    cabinet_id: string;
    ext_id: string;
    nm_id: number | null;
    article: string | null;
    order_at: string | null;
    silent: boolean;
};

/** Ответ WB: { orders: [{ id, nmId, article, createdAt, ... }] }; допускаем и голый массив. */
export function parseNewOrders(payload: unknown): Record<string, unknown>[] {
    const list = Array.isArray(payload)
        ? payload
        : (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).orders)
            ? (payload as Record<string, unknown>).orders as unknown[]
            : []);
    return list.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object');
}

/** Заказ старше этого возраста при записи считается «уже висел» и приходит без звука (первая загрузка, сбой связи). */
export const FRESH_ORDER_MS = 3 * 60 * 1000;

export function toOrderEventRows(cabinetId: string, payload: unknown, nowMs: number = Date.now()): OrderEventRow[] {
    const seen = new Set<string>();
    const rows: OrderEventRow[] = [];
    for (const o of parseNewOrders(payload)) {
        const id = o.id ?? o.rid ?? o.orderId;
        if (id == null || id === '') continue;
        const extId = String(id);
        if (seen.has(extId)) continue;
        seen.add(extId);
        const nm = Number(o.nmId ?? o.nmID ?? o.nm_id);
        const created = typeof o.createdAt === 'string' && !Number.isNaN(Date.parse(o.createdAt)) ? new Date(o.createdAt).toISOString() : null;
        const silent = created != null && nowMs - Date.parse(created) > FRESH_ORDER_MS;
        rows.push({
            cabinet_id: cabinetId,
            ext_id: extId,
            nm_id: Number.isFinite(nm) && nm > 0 ? nm : null,
            article: o.article != null && String(o.article) !== '' ? String(o.article).slice(0, 200) : null,
            order_at: created,
            silent,
        });
    }
    return rows;
}
