// Возвраты Ozon: /v1/returns/list. Чистая функция, без сети.
export type ReturnRow = { cabinet_id: string; id: number; type: string; schema: string; d: string | null; offer_id: string; sku: number | null; qty: number; price: number; reason: string; posting_number: string; synced_at: string };

type Raw = {
    id?: number; type?: string; schema?: string; return_reason_name?: string; posting_number?: string;
    product?: { sku?: number; offer_id?: string; quantity?: number; price?: { price?: number } };
    logistic?: { return_date?: string | null; final_moment?: string | null; technical_return_moment?: string | null };
};

export function buildReturnRows(cabinetId: string, raw: Raw[], nowIso: string): ReturnRow[] {
    const out: ReturnRow[] = [];
    for (const r of raw || []) {
        const id = Number(r.id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const day = String(r.logistic?.return_date || r.logistic?.technical_return_moment || r.logistic?.final_moment || '').slice(0, 10);
        out.push({
            cabinet_id: cabinetId, id, type: String(r.type || ''), schema: String(r.schema || '').toLowerCase(),
            d: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null, offer_id: String(r.product?.offer_id || ''),
            sku: Number.isFinite(Number(r.product?.sku)) ? Number(r.product?.sku) : null,
            qty: Number(r.product?.quantity) || 1, price: Number(r.product?.price?.price) || 0,
            reason: String(r.return_reason_name || ''), posting_number: String(r.posting_number || ''), synced_at: nowIso,
        });
    }
    return out;
}
