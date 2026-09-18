/** Выплата блогеру: ставка + бонус, если просмотры строго больше порога. */

export type BloggerRate = {
    rate_per_video?: number | string | null;
    bonus_views_threshold?: number | string | null;
    bonus_amount?: number | string | null;
};

export function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function computePayout(
    rate: unknown,
    views: unknown,
    threshold: unknown,
    bonus: unknown,
): number {
    const r = num(rate);
    const v = num(views);
    const t = num(threshold);
    const b = num(bonus);
    return r + (v > t ? b : 0);
}

export function computePayoutFromBlogger(blogger: BloggerRate | null | undefined, views: unknown): number {
    if (!blogger) return 0;
    return computePayout(
        blogger.rate_per_video,
        views,
        blogger.bonus_views_threshold,
        blogger.bonus_amount,
    );
}

export function monthStart(isoOrDate: string | Date): string {
    const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
    if (!Number.isFinite(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

export function sumAccrued(rows: Array<{ accrued?: unknown }>): number {
    return (rows || []).reduce((s, r) => s + num(r.accrued), 0);
}
