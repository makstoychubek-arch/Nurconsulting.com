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
export function nextRescanDay(today: string, cursor: string | null | undefined): { day: string; next: string } {
    const oldest = addDays(today, -(RESCAN_START_BACK + RESCAN_WINDOW_DAYS - 1));
    const start = addDays(today, -RESCAN_START_BACK);
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
