/** Отложенный запуск РК: due-выборки и тик без немедленного WB-старта в dry_run. */

export type ScheduleStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type ScheduleRow = {
    id: string;
    cabinet_id: string;
    campaign_id: number;
    campaign_name?: string | null;
    start_at: string;
    status: ScheduleStatus;
};

export type StartHttpResult = {
    ok: boolean;
    retry?: boolean;
    already?: boolean;
    error?: string;
};

export type TickResultItem = {
    id: string;
    cabinet_id: string;
    campaign_id: number;
    action: 'would_start' | 'started' | 'failed' | 'skipped' | 'released';
    error?: string;
};

export type TickResult = {
    dryRun: boolean;
    due: number;
    wouldStart: number;
    started: number;
    failed: number;
    skipped: number;
    results: TickResultItem[];
};

export type TickDeps = {
    now: Date;
    dryRun: boolean;
    listDue: () => Promise<ScheduleRow[]>;
    claim: (id: string) => Promise<boolean>;
    finish: (id: string, status: 'done' | 'failed', errorText?: string) => Promise<void>;
    release: (id: string) => Promise<void>;
    loadToken: (cabinetId: string) => Promise<string | null>;
    startAdvert: (token: string, advertId: number, cabinetId: string) => Promise<StartHttpResult>;
    markCampaignLive?: (cabinetId: string, advertId: number) => Promise<void>;
};

export function isDue(row: ScheduleRow, now: Date): boolean {
    if (row.status !== 'pending') return false;
    const at = new Date(row.start_at).getTime();
    if (!Number.isFinite(at)) return false;
    return at <= now.getTime();
}

export function parseScheduleDryRun(env: string | null | undefined, body?: unknown): boolean {
    if (body && typeof body === 'object' && body !== null && 'dry_run' in body) {
        const v = (body as { dry_run?: unknown }).dry_run;
        if (v === true || v === 'true' || v === 1 || v === '1') return true;
        if (v === false || v === 'false' || v === 0 || v === '0') return false;
    }
    if (env == null || String(env).trim() === '') return false;
    return ['true', '1', 'yes', 'on'].includes(String(env).trim().toLowerCase());
}

function errorFromData(data: unknown): string {
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        const msg = o.error || o.errorText || o.message || o.code;
        if (msg) return String(msg).slice(0, 240);
        try {
            return JSON.stringify(o).slice(0, 240);
        } catch {
            /* ignore */
        }
    }
    if (typeof data === 'string' && data.trim()) return data.slice(0, 240);
    return '';
}

export function interpretStartHttp(status: number, data: unknown): StartHttpResult {
    if (status >= 200 && status < 300) return { ok: true };
    if (status === 429) return { ok: false, retry: true, error: 'WB 429' };
    const text = errorFromData(data);
    if (status === 400 && /already|уже|активн|status/i.test(text)) {
        return { ok: true, already: true };
    }
    return {
        ok: false,
        error: text || (`WB start error ${status}`),
    };
}

export async function runAdvStartTick(deps: TickDeps): Promise<TickResult> {
    const dueAll = await deps.listDue();
    const due = dueAll.filter((row) => isDue(row, deps.now));
    const results: TickResultItem[] = [];
    let wouldStart = 0;
    let started = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of due) {
        const advertId = Number(row.campaign_id);
        if (!advertId) {
            skipped += 1;
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'skipped',
                error: 'campaign_id required',
            });
            continue;
        }

        if (deps.dryRun) {
            wouldStart += 1;
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'would_start',
            });
            continue;
        }

        const claimed = await deps.claim(row.id);
        if (!claimed) {
            skipped += 1;
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'skipped',
                error: 'already claimed',
            });
            continue;
        }

        const token = await deps.loadToken(row.cabinet_id);
        if (!token) {
            failed += 1;
            await deps.finish(row.id, 'failed', 'нет рекламного токена');
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'failed',
                error: 'нет рекламного токена',
            });
            continue;
        }

        const http = await deps.startAdvert(token, advertId, row.cabinet_id);
        if (http.retry) {
            await deps.release(row.id);
            skipped += 1;
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'released',
                error: http.error,
            });
            continue;
        }
        if (!http.ok) {
            failed += 1;
            await deps.finish(row.id, 'failed', http.error);
            results.push({
                id: row.id,
                cabinet_id: row.cabinet_id,
                campaign_id: advertId,
                action: 'failed',
                error: http.error,
            });
            continue;
        }

        started += 1;
        await deps.finish(row.id, 'done');
        if (deps.markCampaignLive) {
            try {
                await deps.markCampaignLive(row.cabinet_id, advertId);
            } catch (e) {
                console.warn('[adv-start-schedule] mark live', String(e));
            }
        }
        results.push({
            id: row.id,
            cabinet_id: row.cabinet_id,
            campaign_id: advertId,
            action: 'started',
        });
    }

    return {
        dryRun: deps.dryRun,
        due: due.length,
        wouldStart,
        started,
        failed,
        skipped,
        results,
    };
}
