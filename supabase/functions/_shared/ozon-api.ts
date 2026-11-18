// Ozon Seller API: вызов с повтором на 429 и 5xx, листание, превращение ответов в строки наших таблиц.
// Без Deno-API, чтобы тестировалось обычным node. Формы ответов сверены живыми запросами 12 ноября 2026
// (v3/product/list, v3/product/info/list, v4/product/info/stocks, v5/product/info/prices,
//  v4/product/info/attributes, v3/posting/fbo/list). Старые finance/transaction методы отключены.

export interface OzonCreds { clientId: string; apiKey: string }
export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
    ok: boolean; status: number; text: () => Promise<string>;
}>;

export const OZON_HOST = 'https://api-seller.ozon.ru';

export class OzonError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function ozonCall(
    creds: OzonCreds, path: string, body: unknown, fetchFn: FetchFn,
    opts: { retries?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<Record<string, unknown>> {
    const retries = opts.retries ?? 4;
    const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let last = '';
    for (let i = 0; i <= retries; i++) {
        const res = await fetchFn(OZON_HOST + path, {
            method: 'POST',
            headers: { 'Client-Id': creds.clientId, 'Api-Key': creds.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
        });
        const txt = await res.text();
        if (res.ok) {
            try { return JSON.parse(txt) as Record<string, unknown>; } catch { throw new OzonError(502, 'Ozon вернул не JSON'); }
        }
        last = txt.slice(0, 200);
        // 429 и 5xx: подождать и повторить. Остальное (401, 403, 400) повтором не лечится.
        const retriable = res.status === 429 || res.status >= 500;
        if (!retriable || i === retries) throw new OzonError(res.status, last);
        await sleep(Math.min(8000, 600 * 2 ** i));
    }
    throw new OzonError(502, last);
}

// Ozon на «upstream request failed» иногда отдаёт 200 с текстом, а не JSON: ozonCall это уже обрабатывает как ошибку.

function num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
    return v === null || v === undefined || v === '' ? null : String(v);
}

export interface OzonProductRow {
    cabinet_id: string; product_id: number; offer_id: string; sku: number | null; name: string | null; barcode: string | null;
    price: number | null; old_price: number | null; min_price: number | null; currency: string;
    commission_fbo_pct: number | null; commission_fbs_pct: number | null; acquiring: number | null; deliv_to_customer: number | null;
    volume_weight: number | null; width_mm: number | null; height_mm: number | null; depth_mm: number | null; weight_g: number | null;
    image_url: string | null; archived: boolean; updated_at: string;
}

/** Сводит список товаров, карточки, цены и габариты в строки ozon_products. Лишние штрихкоды OZN… (внутренние Ozon) отбрасываем. */
export function buildProductRows(
    cabinetId: string,
    list: Record<string, unknown>[], info: Record<string, unknown>[], prices: Record<string, unknown>[], attrs: Record<string, unknown>[],
    nowIso: string,
): OzonProductRow[] {
    const infoBy = new Map(info.map((x) => [Number(x.id), x]));
    const priceBy = new Map(prices.map((x) => [Number(x.product_id), x]));
    const attrBy = new Map(attrs.map((x) => [Number(x.id), x]));
    return list.map((p) => {
        const id = Number(p.product_id);
        const i = infoBy.get(id) || {};
        const pr = (priceBy.get(id) || {}) as Record<string, any>;
        const a = (attrBy.get(id) || {}) as Record<string, any>;
        const codes = (Array.isArray((i as any).barcodes) ? (i as any).barcodes : []).map(String).filter((b: string) => !b.startsWith('OZN'));
        const com = pr.commissions || {};
        const pp = pr.price || {};
        return {
            cabinet_id: cabinetId, product_id: id, offer_id: String(p.offer_id), sku: num(p.sku),
            name: str((i as any).name), barcode: codes[0] ?? null,
            price: num(pp.price), old_price: num(pp.old_price), min_price: num(pp.min_price), currency: str(pp.currency_code) || 'KGS',
            commission_fbo_pct: num(com.sales_percent_fbo), commission_fbs_pct: num(com.sales_percent_fbs),
            acquiring: num(pr.acquiring), deliv_to_customer: num(com.fbo_deliv_to_customer_amount), volume_weight: num(pr.volume_weight),
            width_mm: num(a.width), height_mm: num(a.height), depth_mm: num(a.depth), weight_g: num(a.weight),
            image_url: str(((i as any).primary_image || [])[0]) ?? str(((i as any).images || [])[0]),
            archived: Boolean(p.archived), updated_at: nowIso,
        };
    });
}

export interface OzonStockRow {
    cabinet_id: string; product_id: number; offer_id: string; scheme: 'fbo' | 'fbs'; present: number; reserved: number; synced_at: string;
}

/** Остатки по товару: Ozon отдаёт по записи на схему. Если схема встретилась дважды (склады), суммируем. */
export function buildStockRows(cabinetId: string, items: Record<string, unknown>[], nowIso: string): OzonStockRow[] {
    const out = new Map<string, OzonStockRow>();
    for (const it of items) {
        for (const s of (Array.isArray(it.stocks) ? it.stocks : []) as Record<string, unknown>[]) {
            const scheme = String(s.type) === 'fbs' ? 'fbs' : String(s.type) === 'fbo' ? 'fbo' : null;
            if (!scheme) continue;
            const key = `${it.product_id}|${scheme}`;
            const prev = out.get(key);
            const present = Number(s.present) || 0, reserved = Number(s.reserved) || 0;
            if (prev) { prev.present += present; prev.reserved += reserved; continue; }
            out.set(key, { cabinet_id: cabinetId, product_id: Number(it.product_id), offer_id: String(it.offer_id), scheme, present, reserved, synced_at: nowIso });
        }
    }
    return [...out.values()];
}

export interface OzonPostingRow {
    cabinet_id: string; posting_number: string; scheme: string; order_id: number | null; status: string; substatus: string | null;
    created_at: string; in_process_at: string | null; cancelled: boolean; cancel_reason: string | null; city: string | null;
    warehouse_name: string | null; currency: string; total_amount: number; items: { offer_id: string; sku: number | null; quantity: number; price: number }[];
    synced_at: string;
}

export function buildPostingRows(cabinetId: string, postings: Record<string, unknown>[], nowIso: string, scheme = 'fbo'): OzonPostingRow[] {
    return postings.map((p: Record<string, any>) => {
        const items = (Array.isArray(p.products) ? p.products : []).map((x: Record<string, any>) => ({
            offer_id: String(x.offer_id), sku: num(x.sku), quantity: Number(x.quantity) || 0, price: Number(x.price?.amount ?? x.price) || 0,
        }));
        const cur = (Array.isArray(p.products) && p.products[0]?.price?.currency) || 'KGS';
        const status = String(p.status);
        return {
            cabinet_id: cabinetId, posting_number: String(p.posting_number), scheme, order_id: num(p.order_id), status, substatus: str(p.substatus),
            created_at: String(p.created_at), in_process_at: str(p.in_process_at), cancelled: status === 'cancelled',
            cancel_reason: str(p.cancellation?.cancel_reason), city: str(p.analytics_data?.city), warehouse_name: str(p.analytics_data?.warehouse_name),
            currency: String(cur), total_amount: items.reduce((s, x) => s + x.price * x.quantity, 0), items, synced_at: nowIso,
        };
    });
}

/** Автосвязь артикулов по штрихкоду: у вас штрихкод товара один и тот же на WB и Ozon. */
export function matchByBarcode(
    cabinetId: string, products: { product_id: number; offer_id: string; barcode: string | null }[],
    wbBarcodes: { nm_id: number; barcode: string }[],
): { cabinet_id: string; nm_id: number; offer_id: string; ozon_product_id: number; method: 'barcode' }[] {
    const nmBy = new Map<string, number>();
    for (const b of wbBarcodes) if (b.barcode) nmBy.set(String(b.barcode), Number(b.nm_id));
    const seen = new Set<string>();
    const out: { cabinet_id: string; nm_id: number; offer_id: string; ozon_product_id: number; method: 'barcode' }[] = [];
    for (const p of products) {
        const nm = p.barcode ? nmBy.get(String(p.barcode)) : undefined;
        if (!nm) continue;
        const key = `${nm}|${p.offer_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ cabinet_id: cabinetId, nm_id: nm, offer_id: p.offer_id, ozon_product_id: p.product_id, method: 'barcode' });
    }
    return out;
}
