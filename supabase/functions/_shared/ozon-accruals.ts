// Начисления Ozon по отправлениям: /v1/finance/accrual/postings. Чистые функции, без сети.
export type AccrualRow = {
    cabinet_id: string; posting_number: string; ord: number; type_id: number; accrual_date: string | null;
    sku: number | null; quantity: number; amount: number; seller_price: number | null; currency: string; synced_at: string;
};

type Money = { amount?: string | number; currency?: string } | null | undefined;
type RawAccrual = { type_id?: number; accrued?: Money; accrual_date?: string; seller_price?: Money; sku?: number; quantity?: number };
type RawPosting = { posting_number?: string; accruals?: RawAccrual[] };

const num = (m: Money): number | null => {
    if (!m || m.amount == null || m.amount === '') return null;
    const v = Number(m.amount);
    return Number.isFinite(v) ? v : null;
};

export function buildAccrualRows(cabinetId: string, postings: RawPosting[], nowIso: string): AccrualRow[] {
    const out: AccrualRow[] = [];
    for (const p of postings || []) {
        const pn = String(p.posting_number || '').trim();
        if (!pn) continue;
        (p.accruals || []).forEach((a, i) => {
            const t = Number(a.type_id);
            if (!Number.isFinite(t) || t <= 0) return;
            const d = String(a.accrual_date || '').slice(0, 10);
            out.push({
                cabinet_id: cabinetId, posting_number: pn, ord: i, type_id: t,
                accrual_date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
                sku: Number.isFinite(Number(a.sku)) && Number(a.sku) > 0 ? Number(a.sku) : null,
                quantity: Number(a.quantity) || 1, amount: num(a.accrued) ?? 0, seller_price: num(a.seller_price),
                currency: String(a.accrued?.currency || 'RUB'), synced_at: nowIso,
            });
        });
    }
    return out;
}

/** Номера отправлений пачками по 200 (лимит метода). */
export function postingBatches(numbers: string[], size = 200): string[][] {
    const uniq = [...new Set(numbers.map((x) => String(x || '').trim()).filter(Boolean))];
    const out: string[][] = [];
    for (let i = 0; i < uniq.length; i += size) out.push(uniq.slice(i, i + size));
    return out;
}
