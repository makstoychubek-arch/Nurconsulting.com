// Воронка Ozon по дням и SKU: /v1/analytics/data (нужна подписка Premium). Чистые функции, без сети.
export const FUNNEL_METRICS = ['hits_view', 'hits_view_search', 'hits_view_pdp', 'hits_tocart', 'ordered_units'] as const;

export type FunnelRow = { cabinet_id: string; d: string; sku: number; views: number; views_search: number; views_pdp: number; tocart: number; ordered: number; synced_at: string };

/** Ответ analytics/data с dimension [sku, day] -> строки таблицы ozon_funnel_daily. Строки без SKU или даты пропускаются. */
export function buildFunnelRows(cabinetId: string, data: { dimensions?: { id?: string }[]; metrics?: number[] }[], nowIso: string): FunnelRow[] {
    const out: FunnelRow[] = [];
    for (const r of data || []) {
        const sku = Number(r.dimensions?.[0]?.id);
        const d = String(r.dimensions?.[1]?.id || '').slice(0, 10);
        if (!Number.isFinite(sku) || sku <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        const m = (r.metrics || []).map((v) => Number(v) || 0);
        out.push({ cabinet_id: cabinetId, d, sku, views: m[0] || 0, views_search: m[1] || 0, views_pdp: m[2] || 0, tocart: m[3] || 0, ordered: m[4] || 0, synced_at: nowIso });
    }
    return out;
}

/** Окна по дням: у Ozon на SKU×день до ~1000 строк за запрос, берём по 7 дней. */
export function funnelWindows(fromIso: string, toIso: string, step = 7): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    const end = Date.parse(toIso + 'T00:00:00Z');
    for (let t = Date.parse(fromIso + 'T00:00:00Z'); t <= end; t += step * 86400_000) {
        out.push({ from: new Date(t).toISOString().slice(0, 10), to: new Date(Math.min(t + (step - 1) * 86400_000, end)).toISOString().slice(0, 10) });
    }
    return out;
}
