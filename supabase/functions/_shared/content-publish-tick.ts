/** Тик отложенной публикации Контент-завода. dry_run не публикует в Instagram. */

import {
    runIgPublish,
    type IgHttpResult,
    type IgPublishResult,
} from './content-ig-publish.ts';

export type ContentPostRow = {
    id: string;
    cabinet_id: string;
    platform: string;
    status: string;
    publish_at: string | null;
    approved_at?: string | null;
    slide_urls?: unknown;
    file_url?: string | null;
    caption?: string | null;
};

export type TickResultItem = {
    id: string;
    cabinet_id: string;
    action: 'would_publish' | 'published' | 'failed' | 'skipped' | 'manual';
    error?: string;
    permalink?: string;
};

export type TickResult = {
    dryRun: boolean;
    due: number;
    wouldPublish: number;
    published: number;
    failed: number;
    skipped: number;
    results: TickResultItem[];
};

export type TickDeps = {
    now: Date;
    dryRun: boolean;
    listDue: () => Promise<ContentPostRow[]>;
    claim: (id: string) => Promise<boolean>;
    finish: (id: string, patch: {
        status: 'published' | 'error' | 'scheduled';
        error_text?: string | null;
        post_url?: string | null;
        ig_media_id?: string | null;
    }) => Promise<void>;
    loadIg: (cabinetId: string) => Promise<{ token: string; igUserId: string } | null>;
    postGraph: (path: string, body: Record<string, string>) => Promise<IgHttpResult>;
    waitContainer?: (id: string) => Promise<boolean>;
};

export function slideUrlsOf(row: ContentPostRow): string[] {
    const raw = row.slide_urls;
    const list = Array.isArray(raw) ? raw : [];
    const urls = list.map((u) => String(u || '').trim()).filter(Boolean);
    if (urls.length) return urls;
    const file = String(row.file_url || '').trim();
    return file ? [file] : [];
}

export function isDuePost(row: ContentPostRow, now: Date): boolean {
    if (row.status !== 'scheduled') return false;
    if (!row.publish_at) return false;
    const at = new Date(row.publish_at).getTime();
    if (!Number.isFinite(at)) return false;
    return at <= now.getTime();
}

export function canCronPublish(row: ContentPostRow): boolean {
    return row.platform === 'instagram' && !!row.approved_at;
}

export async function runContentPublishTick(deps: TickDeps): Promise<TickResult> {
    const dueRows = (await deps.listDue()).filter((r) => isDuePost(r, deps.now));
    const result: TickResult = {
        dryRun: deps.dryRun,
        due: dueRows.length,
        wouldPublish: 0,
        published: 0,
        failed: 0,
        skipped: 0,
        results: [],
    };

    for (const row of dueRows) {
        if (row.platform !== 'instagram') {
            result.skipped += 1;
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'manual' });
            continue;
        }
        if (!row.approved_at) {
            result.skipped += 1;
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'skipped', error: 'нет подтверждения' });
            continue;
        }
        if (deps.dryRun) {
            result.wouldPublish += 1;
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'would_publish' });
            continue;
        }
        const claimed = await deps.claim(row.id);
        if (!claimed) {
            result.skipped += 1;
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'skipped' });
            continue;
        }
        const ig = await deps.loadIg(row.cabinet_id);
        if (!ig) {
            result.failed += 1;
            const error = 'Instagram не подключён';
            await deps.finish(row.id, { status: 'error', error_text: error });
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'failed', error });
            continue;
        }
        const pub: IgPublishResult = await runIgPublish({
            dryRun: false,
            igUserId: ig.igUserId,
            token: ig.token,
            slideUrls: slideUrlsOf(row),
            caption: row.caption || undefined,
            postGraph: deps.postGraph,
            waitContainer: deps.waitContainer,
        });
        if (!pub.published) {
            result.failed += 1;
            const error = pub.error || 'Ошибка публикации Instagram';
            await deps.finish(row.id, { status: 'error', error_text: error });
            result.results.push({ id: row.id, cabinet_id: row.cabinet_id, action: 'failed', error });
            continue;
        }
        result.published += 1;
        await deps.finish(row.id, {
            status: 'published',
            error_text: null,
            post_url: pub.permalink || null,
            ig_media_id: pub.mediaId || null,
        });
        result.results.push({
            id: row.id,
            cabinet_id: row.cabinet_id,
            action: 'published',
            permalink: pub.permalink,
        });
    }
    return result;
}
