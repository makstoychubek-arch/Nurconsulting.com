// Разбор ответа GET /api/advert/v2/adverts.
// nm_id в v2 лежит в nm_settings[].nm_id, не в nms.

export function flattenAdverts(data: unknown): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const walk = (items: unknown[]) => {
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const id = Number(o.advertId ?? o.id ?? o.advert_id ?? 0);
            if (id) out.push(o);
            for (const key of ['advert_list', 'adverts', 'list', 'items']) {
                if (Array.isArray(o[key])) walk(o[key] as unknown[]);
            }
        }
    };
    if (Array.isArray(data)) walk(data);
    else if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        for (const key of ['adverts', 'advert_list', 'items', 'list']) {
            if (Array.isArray(o[key])) walk(o[key] as unknown[]);
        }
    }
    return out;
}

export function parseNmFromName(name: string): number {
    const m = String(name || '').trim().match(/^(\d{6,})/);
    return m ? Number(m[1]) : 0;
}

export function firstNmId(a: Record<string, unknown>): number | null {
    const settings = a.settings && typeof a.settings === 'object'
        ? a.settings as Record<string, unknown>
        : {};
    const fromSettings = nmFromList(a.nm_settings) || nmFromList(settings.nm_settings);
    if (fromSettings) return fromSettings;

    const nms = a.nms ?? settings.nms ?? a.nmIds ?? settings.nmIds;
    if (Array.isArray(nms) && nms.length) {
        const n = Number(typeof nms[0] === 'object' && nms[0]
            ? (nms[0] as Record<string, unknown>).nm_id
                ?? (nms[0] as Record<string, unknown>).nmId
                ?? nms[0]
            : nms[0]);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const flat = Number(a.nmId ?? a.nm_id ?? settings.nmId ?? settings.nm_id ?? 0);
    if (Number.isFinite(flat) && flat > 0) return flat;

    const named = parseNmFromName(advertName(a));
    return named || null;
}

function nmFromList(raw: unknown): number {
    if (!Array.isArray(raw) || !raw.length) return 0;
    for (const item of raw) {
        if (typeof item === 'number' && item > 0) return item;
        if (item && typeof item === 'object') {
            const n = Number((item as Record<string, unknown>).nm_id
                ?? (item as Record<string, unknown>).nmId
                ?? (item as Record<string, unknown>).nm);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }
    return 0;
}

export function advertName(a: Record<string, unknown>): string {
    const settings = a.settings && typeof a.settings === 'object'
        ? a.settings as Record<string, unknown>
        : {};
    return String(a.name ?? a.campaignName ?? settings.name ?? '').trim();
}

export function campaignTypeFromWb(a: Record<string, unknown>): 'manual_bid' | 'auto_bid' {
    const bid = String(a.bid_type ?? a.bidType ?? '').toLowerCase();
    if (/auto|unified|единая/.test(bid)) return 'auto_bid';
    if (/manual|ручн/.test(bid)) return 'manual_bid';
    const type = Number(a.type ?? a.advert_type ?? 0);
    if (type === 8) return 'auto_bid';
    return 'manual_bid';
}

export function campaignStatus(a: Record<string, unknown>): string {
    const s = a.status;
    if (s === 9 || s === '9' || s === 'active') return 'active';
    if (s === 11 || s === '11' || s === 'paused') return 'paused';
    if (s != null && s !== '') return String(s);
    return 'active';
}

/** Кластеры имеет смысл тянуть у живых/на паузе, не у сотен завершённых. */
export function shouldSyncClusters(a: Record<string, unknown>): boolean {
    const s = Number(a.status ?? campaignStatus(a));
    return s === 9 || s === 11;
}
