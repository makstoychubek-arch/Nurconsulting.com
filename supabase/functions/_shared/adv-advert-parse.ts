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

/** listClusters — пачками по 100 пар {advertId, nmId}; статус не режет (нужны и завершённые). */
export function shouldSyncClusters(a: Record<string, unknown>): boolean {
    return allNmIds(a).length > 0;
}

export function allNmIds(a: Record<string, unknown>): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    const add = (n: number) => {
        if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
            seen.add(n);
            out.push(n);
        }
    };
    const settings = a.settings && typeof a.settings === 'object'
        ? a.settings as Record<string, unknown>
        : {};
    collectNmIds(a.nm_settings, add);
    collectNmIds(settings.nm_settings, add);
    const nms = a.nms ?? settings.nms ?? a.nmIds ?? settings.nmIds;
    if (Array.isArray(nms)) {
        for (const item of nms) {
            if (typeof item === 'number') add(item);
            else if (item && typeof item === 'object') {
                add(Number((item as Record<string, unknown>).nm_id
                    ?? (item as Record<string, unknown>).nmId
                    ?? (item as Record<string, unknown>).nm));
            }
        }
    }
    add(Number(a.nmId ?? a.nm_id ?? settings.nmId ?? settings.nm_id ?? 0));
    const named = parseNmFromName(advertName(a));
    if (named) add(named);
    return out;
}

function collectNmIds(raw: unknown, add: (n: number) => void): void {
    if (!Array.isArray(raw)) return;
    for (const item of raw) {
        if (typeof item === 'number') add(item);
        else if (item && typeof item === 'object') {
            add(Number((item as Record<string, unknown>).nm_id
                ?? (item as Record<string, unknown>).nmId
                ?? (item as Record<string, unknown>).nm));
        }
    }
}

/** Официальное тело POST /adv/v0/normquery/list */
export function listClustersBody(
    pairs: Array<{ advertId: number; nmId: number }>,
): { items: Array<{ advertId: number; nmId: number }> } {
    return { items: pairs.map((p) => ({ advertId: p.advertId, nmId: p.nmId })) };
}

/** Официальное тело POST /adv/v0/normquery/get-bids (в спеке snake_case). */
export function getBidsBody(
    pairs: Array<{ advertId: number; nmId: number }>,
): { items: Array<{ advert_id: number; nm_id: number }> } {
    return { items: pairs.map((p) => ({ advert_id: p.advertId, nm_id: p.nmId })) };
}

export type ParsedClusterListItem = {
    advertId: number;
    nmId: number;
    active: string[];
    excluded: string[];
};

/** Ответ list: items[].normQueries.active | excluded | archived. */
export function parseListClustersResponse(data: unknown): ParsedClusterListItem[] {
    const items = extractItems(data);
    const out: ParsedClusterListItem[] = [];
    for (const item of items) {
        const advertId = Number(item.advertId ?? item.advert_id ?? item.id ?? 0);
        const nmId = Number(item.nmId ?? item.nm_id ?? 0);
        const nqRaw = item.normQueries ?? item.normqueries ?? item.norm_queries;
        const nq = nqRaw && typeof nqRaw === 'object' ? nqRaw as Record<string, unknown> : {};
        const active = stringList(nq.active);
        const excluded = [...stringList(nq.excluded), ...stringList(nq.archived)];
        if (!advertId && !active.length && !excluded.length) {
            const fallback = phraseFromObject(item);
            if (fallback) active.push(fallback);
        }
        if (!advertId && !active.length && !excluded.length) continue;
        out.push({ advertId, nmId, active: uniqPhrases(active), excluded: uniqPhrases(excluded) });
    }
    return out;
}

function extractItems(data: unknown): Record<string, unknown>[] {
    if (!data) return [];
    if (Array.isArray(data)) return data.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
    if (typeof data !== 'object') return [];
    const o = data as Record<string, unknown>;
    for (const key of ['items', 'list', 'data']) {
        if (Array.isArray(o[key])) {
            return o[key].filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
        }
    }
    return [o];
}

function stringList(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const item of raw) {
        if (typeof item === 'string' && item.trim()) out.push(item.trim());
        else if (item && typeof item === 'object') {
            const p = phraseFromObject(item as Record<string, unknown>);
            if (p) out.push(p);
        }
    }
    return out;
}

function phraseFromObject(o: Record<string, unknown>): string {
    return String(o.normquery ?? o.normQuery ?? o.norm_query ?? o.phrase ?? o.text ?? o.query ?? o.keyword ?? '').trim();
}

function uniqPhrases(list: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of list) {
        if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    }
    return out;
}
