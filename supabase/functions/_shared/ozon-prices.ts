// Смена цен Ozon по артикулам: проверка новой цены и тело запроса v1/product/import/prices.
// Зачёркнутую цену оставляем, только если она выше новой не меньше чем на 5% (иначе Ozon отклонит), «ограничение для акций» (min_price)
// не выше новой цены. Авто-стратегия Ozon не меняется (UNKNOWN). Правила сверены с прежними ручными изменениями цен 12–13 ноября 2026.

export interface PriceRow { offer_id: string; price: number | null; old_price: number | null; min_price: number | null; currency: string | null }
export interface PriceItem { offer_id: string; price: string; old_price?: string; min_price?: string; currency_code: string; auto_action_enabled: string }

export const MIN_PRICE = 100;

/** Защита от опечатки: новая цена не меньше половины и не больше двукратной текущей. */
export function checkNewPrice(cur: number | null, next: number): string | null {
    if (!Number.isFinite(next) || next < MIN_PRICE) return `цена должна быть от ${MIN_PRICE}`;
    if (cur && cur > 0 && (next < cur * 0.5 || next > cur * 2)) return 'цена отличается от текущей больше чем вдвое';
    return null;
}

export function buildPriceItem(row: PriceRow, next: number): PriceItem {
    const price = Math.round(next);
    const item: PriceItem = {
        offer_id: row.offer_id, price: String(price), currency_code: row.currency || 'KGS', auto_action_enabled: 'UNKNOWN',
    };
    const old = Number(row.old_price) || 0;
    // old_price выше новой цены на 5% и больше: оставляем, иначе убираем (0)
    item.old_price = old > price * 1.05 ? String(Math.round(old)) : '0';
    const min = Number(row.min_price) || 0;
    if (min > 0) item.min_price = String(Math.min(Math.round(min), price));
    return item;
}
