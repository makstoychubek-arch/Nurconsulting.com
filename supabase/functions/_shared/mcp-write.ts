// Изменение цен через свой ИИ (MCP): разбор запроса, проверка границ, текст подтверждения. Чистые функции, всё проверяется тестом.
// deno-lint-ignore-file no-explicit-any

export interface PriceCard { nmID: number; vendorCode: string; price: number; discount: number }
export interface PriceAsk { article?: string; nm_id?: number; price?: number; discount?: number }
export interface PriceItem { nmID: number; vendorCode: string; was: { price: number; discount: number; final: number }; will: { price: number; discount: number; final: number } }

export const WRITE_LIMITS = { maxItems: 30, maxMove: 0.25, maxDiscount: 70, maxPerHour: 20, ttlMin: 15 };

const final = (price: number, discount: number) => Math.round(price * (1 - discount / 100));
const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ');

// Сопоставляет просьбы с карточками и проверяет границы. Ошибки возвращает списком, ничего не применяя.
export function planPriceChanges(cards: PriceCard[], asks: PriceAsk[]): { items: PriceItem[]; errors: string[] } {
    const items: PriceItem[] = [], errors: string[] = [];
    if (!Array.isArray(asks) || !asks.length) return { items, errors: ['Не указано, что менять.'] };
    if (asks.length > WRITE_LIMITS.maxItems) return { items, errors: [`За один раз не больше ${WRITE_LIMITS.maxItems} товаров.`] };
    const seen = new Set<number>();
    for (const a of asks) {
        const label = String(a?.article ?? a?.nm_id ?? '?');
        const q = String(a?.article ?? '').trim().toLowerCase();
        const hit = a?.nm_id ? cards.filter((c) => c.nmID === Number(a.nm_id)) : q ? cards.filter((c) => c.vendorCode.toLowerCase() === q) : [];
        const found = hit.length ? hit : q ? cards.filter((c) => c.vendorCode.toLowerCase().includes(q)) : [];
        if (found.length !== 1) { errors.push(found.length ? `«${label}»: подходит несколько артикулов (${found.slice(0, 4).map((c) => c.vendorCode).join(', ')}), уточните.` : `«${label}»: такого артикула нет.`); continue; }
        const c = found[0];
        if (seen.has(c.nmID)) { errors.push(`«${c.vendorCode}» указан дважды.`); continue; }
        seen.add(c.nmID);
        const price = a.price != null ? Math.round(Number(a.price)) : c.price;
        const discount = a.discount != null ? Math.round(Number(a.discount)) : c.discount;
        if (a.price == null && a.discount == null) { errors.push(`«${c.vendorCode}»: не указана ни цена, ни скидка.`); continue; }
        if (!Number.isFinite(price) || price <= 0 || price >= 10_000_000) { errors.push(`«${c.vendorCode}»: цена должна быть больше 0.`); continue; }
        if (!Number.isFinite(discount) || discount < 0 || discount > WRITE_LIMITS.maxDiscount) { errors.push(`«${c.vendorCode}»: скидка от 0 до ${WRITE_LIMITS.maxDiscount}%.`); continue; }
        const was = { price: c.price, discount: c.discount, final: final(c.price, c.discount) };
        const will = { price, discount, final: final(price, discount) };
        if (was.final > 0 && Math.abs(will.final - was.final) / was.final > WRITE_LIMITS.maxMove) {
            errors.push(`«${c.vendorCode}»: цена со скидкой изменится ${fmt(was.final)} → ${fmt(will.final)} (больше ${Math.round(WRITE_LIMITS.maxMove * 100)}%). Для таких изменений используйте сайт.`);
            continue;
        }
        if (will.price === was.price && will.discount === was.discount) { errors.push(`«${c.vendorCode}»: уже такая цена и скидка.`); continue; }
        items.push({ nmID: c.nmID, vendorCode: c.vendorCode, was, will });
    }
    return { items, errors };
}

export function summarize(items: PriceItem[]): string {
    return items.map((i) => `${i.vendorCode}: цена ${fmt(i.was.price)} → ${fmt(i.will.price)}, скидка ${i.was.discount}% → ${i.will.discount}%, покупатель платит ${fmt(i.was.final)} → ${fmt(i.will.final)}`).join('\n');
}
