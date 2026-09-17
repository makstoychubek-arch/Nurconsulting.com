/**
 * Цена заказа WB для колонки wb_orders.price.
 *
 * В /api/v1/supplier/orders три цены:
 *   totalPrice     — до скидки продавца;
 *   priceWithDisc  — со скидкой продавца, ровно та база, по которой в финотчёте
 *                    считаются «Продажи» (retail_price_withdisc_rub);
 *   finishedPrice  — с СПП, столько платит покупатель.
 *
 * Поля priceWithDiscount у WB нет никогда. Синхронизации читали именно его и
 * молча падали на totalPrice, поэтому «Заказы, сом» на дашборде были завышены
 * в 1.5–3 раза относительно продаж: у Baza средний заказ выходил 5155 сом при
 * средней продаже 1551 сом.
 */
export function orderPriceWithDisc(o: Record<string, unknown> | null | undefined): number {
    const num = (v: unknown): number => {
        if (v == null || v === '') return NaN;
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
    };
    const withDisc = num(o?.priceWithDisc);
    if (withDisc > 0) return withDisc;
    const total = num(o?.totalPrice);
    return total > 0 ? total : 0;
}
