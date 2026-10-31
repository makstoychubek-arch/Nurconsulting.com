// Текущее состояние кампании из ответа GET /api/advert/v2/adverts: зоны показов и дата создания.
// Дневного лимита и автопополнения в публичном API WB нет, поэтому полей limit/autoRefill здесь нет и быть не может
// (подробно: docs/adv-controls-api.md). Чистая функция, без сети.
export interface AdvState {
    zones: { search: boolean; recommendations: boolean } | null;
    createdAt: string | null;
    startedAt: string | null;
    updatedAt: string | null;
}

const iso = (v: unknown): string | null => {
    if (typeof v !== 'string' || !v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

export function parseAdvState(advert: Record<string, unknown> | null | undefined): AdvState {
    const a = advert ?? {};
    const settings = a.settings && typeof a.settings === 'object' ? a.settings as Record<string, unknown> : {};
    const pl = settings.placements && typeof settings.placements === 'object' ? settings.placements as Record<string, unknown> : null;
    const ts = a.timestamps && typeof a.timestamps === 'object' ? a.timestamps as Record<string, unknown> : {};
    return {
        zones: pl && typeof pl.search === 'boolean' && typeof pl.recommendations === 'boolean'
            ? { search: pl.search, recommendations: pl.recommendations } : null,
        createdAt: iso(ts.created),
        startedAt: iso(ts.started),
        updatedAt: iso(ts.updated),
    };
}
