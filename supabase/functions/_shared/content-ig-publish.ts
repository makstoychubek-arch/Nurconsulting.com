/** Instagram Graph API: контейнер на слайд → карусель → publish. dry_run не ходит в Graph. */

export const GRAPH_VERSION = 'v21.0';
export const GRAPH_HOST = 'https://graph.facebook.com';

export type IgStep =
    | { type: 'container'; imageUrl: string; isCarouselItem: boolean }
    | { type: 'single'; imageUrl: string; caption?: string }
    | { type: 'carousel'; children: string[]; caption?: string }
    | { type: 'publish'; creationId: string };

export type IgHttpResult = {
    ok: boolean;
    id?: string;
    permalink?: string;
    error?: string;
    status: number;
    retry?: boolean;
};

export type IgPublishDeps = {
    dryRun: boolean;
    igUserId: string;
    token: string;
    slideUrls: string[];
    caption?: string;
    postGraph: (path: string, body: Record<string, string>) => Promise<IgHttpResult>;
    waitContainer?: (id: string) => Promise<boolean>;
};

export type IgPublishResult = {
    dryRun: boolean;
    published: boolean;
    wouldPublish: boolean;
    mediaId?: string;
    permalink?: string;
    error?: string;
    steps: IgStep[];
};

export function graphUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${GRAPH_HOST}/${GRAPH_VERSION}${p}`;
}

export function buildIgPublishSteps(slideUrls: string[], caption?: string): IgStep[] {
    const urls = (slideUrls || []).map((u) => String(u || '').trim()).filter(Boolean);
    if (!urls.length) return [];
    if (urls.length === 1) {
        return [
            { type: 'single', imageUrl: urls[0], caption },
            { type: 'publish', creationId: '' },
        ];
    }
    return [
        ...urls.map((imageUrl) => ({ type: 'container' as const, imageUrl, isCarouselItem: true })),
        { type: 'carousel', children: [], caption },
        { type: 'publish', creationId: '' },
    ];
}

export function parseGraphBody(status: number, data: unknown): IgHttpResult {
    const retry = status === 429 || status >= 500;
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        const errObj = o.error && typeof o.error === 'object' ? o.error as Record<string, unknown> : null;
        const err = errObj
            ? String(errObj.message || errObj.error_user_msg || errObj.type || 'graph error')
            : (typeof o.error === 'string' ? o.error : '');
        const id = o.id != null ? String(o.id) : '';
        if (err && !id) return { ok: false, error: err.slice(0, 280), status, retry };
        if (status >= 400 && !id) return { ok: false, error: (err || `HTTP ${status}`).slice(0, 280), status, retry };
        return {
            ok: status < 400 && !!id,
            id: id || undefined,
            permalink: o.permalink ? String(o.permalink) : undefined,
            error: err ? err.slice(0, 280) : undefined,
            status,
            retry,
        };
    }
    if (status >= 400) return { ok: false, error: `HTTP ${status}`, status, retry };
    return { ok: false, error: 'empty graph response', status, retry };
}

export function parseIgDryRun(env: string | null | undefined, body?: unknown): boolean {
    if (body && typeof body === 'object' && body !== null && 'dry_run' in body) {
        const v = (body as { dry_run?: unknown }).dry_run;
        if (v === true || v === 'true' || v === 1 || v === '1') return true;
        if (v === false || v === 'false' || v === 0 || v === '0') return false;
    }
    if (env == null || String(env).trim() === '') return false;
    return ['true', '1', 'yes', 'on'].includes(String(env).trim().toLowerCase());
}

export async function runIgPublish(deps: IgPublishDeps): Promise<IgPublishResult> {
    const steps = buildIgPublishSteps(deps.slideUrls, deps.caption);
    if (!steps.length) {
        return { dryRun: deps.dryRun, published: false, wouldPublish: false, error: 'Нет слайдов для публикации', steps };
    }
    if (!deps.igUserId || !deps.token) {
        return { dryRun: deps.dryRun, published: false, wouldPublish: false, error: 'Instagram не подключён', steps };
    }
    if (deps.dryRun) {
        return { dryRun: true, published: false, wouldPublish: true, steps };
    }

    const containerIds: string[] = [];
    let creationId = '';

    for (const step of steps) {
        if (step.type === 'container') {
            const res = await deps.postGraph(`${deps.igUserId}/media`, {
                image_url: step.imageUrl,
                is_carousel_item: 'true',
                access_token: deps.token,
            });
            if (!res.ok || !res.id) {
                return { dryRun: false, published: false, wouldPublish: false, error: res.error || 'container failed', steps };
            }
            if (deps.waitContainer) {
                const ready = await deps.waitContainer(res.id);
                if (!ready) {
                    return { dryRun: false, published: false, wouldPublish: false, error: 'Контейнер слайда не готов', steps };
                }
            }
            containerIds.push(res.id);
        } else if (step.type === 'single') {
            const body: Record<string, string> = {
                image_url: step.imageUrl,
                access_token: deps.token,
            };
            if (step.caption) body.caption = step.caption;
            const res = await deps.postGraph(`${deps.igUserId}/media`, body);
            if (!res.ok || !res.id) {
                return { dryRun: false, published: false, wouldPublish: false, error: res.error || 'media failed', steps };
            }
            creationId = res.id;
        } else if (step.type === 'carousel') {
            const body: Record<string, string> = {
                media_type: 'CAROUSEL',
                children: containerIds.join(','),
                access_token: deps.token,
            };
            if (step.caption) body.caption = step.caption;
            const res = await deps.postGraph(`${deps.igUserId}/media`, body);
            if (!res.ok || !res.id) {
                return { dryRun: false, published: false, wouldPublish: false, error: res.error || 'carousel failed', steps };
            }
            creationId = res.id;
        } else if (step.type === 'publish') {
            const res = await deps.postGraph(`${deps.igUserId}/media_publish`, {
                creation_id: creationId,
                access_token: deps.token,
            });
            if (!res.ok || !res.id) {
                return { dryRun: false, published: false, wouldPublish: false, error: res.error || 'publish failed', steps };
            }
            let permalink = res.permalink;
            if (!permalink) {
                const info = await deps.postGraph(`${res.id}`, {
                    fields: 'permalink',
                    access_token: deps.token,
                });
                permalink = info.permalink;
            }
            return {
                dryRun: false,
                published: true,
                wouldPublish: false,
                mediaId: res.id,
                permalink,
                steps,
            };
        }
    }
    return { dryRun: false, published: false, wouldPublish: false, error: 'Неполный сценарий публикации', steps };
}

export async function postGraphForm(
    fetchFn: typeof fetch,
    path: string,
    body: Record<string, string>,
): Promise<IgHttpResult> {
    const isGet = 'fields' in body && !path.includes('media');
    const url = new URL(graphUrl(path));
    let res: Response;
    try {
        if (isGet) {
            Object.entries(body).forEach(([k, v]) => url.searchParams.set(k, v));
            res = await fetchFn(url.toString(), { method: 'GET' });
        } else {
            const form = new URLSearchParams(body);
            res = await fetchFn(graphUrl(path), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form,
            });
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg.slice(0, 280), status: 0, retry: true };
    }
    const data = await res.json().catch(() => null);
    return parseGraphBody(res.status, data);
}
