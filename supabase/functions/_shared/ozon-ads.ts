// Статистика рекламы Ozon (Performance API): /api/client/statistics/daily/json. Чистые функции, без сети.
export type AdsRow = { cabinet_id: string; d: string; campaign_id: string; title: string; impressions: number; clicks: number; spend: number; orders: number; orders_sum: number; synced_at: string };

/** Ozon отдаёт числа строками с запятой: «1917,51». */
export function num(v: unknown): number {
    const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

export function buildAdsRows(cabinetId: string, rows: Record<string, unknown>[], nowIso: string): AdsRow[] {
    const out: AdsRow[] = [];
    for (const r of rows || []) {
        const d = String(r.date || '').slice(0, 10);
        const id = String(r.id || '');
        if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
        out.push({ cabinet_id: cabinetId, d, campaign_id: id, title: String(r.title || '').slice(0, 120), impressions: num(r.views), clicks: num(r.clicks), spend: num(r.moneySpent), orders: num(r.orders), orders_sum: num(r.ordersMoney), synced_at: nowIso });
    }
    return out;
}

export function chunk<T>(a: T[], n: number): T[][] { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }
