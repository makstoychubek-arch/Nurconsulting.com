// Неймспейс /adv/* для рекламного API WB (docs/autobidder.md §2, §11.3).
// Хост только advert-api.wildberries.ru. Токен из Vault, на фронт не возвращается.
// deno-lint-ignore-file no-explicit-any

export const ADVERT_API_HOST = 'https://advert-api.wildberries.ru';

// OpenAPI Promotion (dev.wildberries.ru/openapi/promotion): Personal token
// на большинстве ручек — 5 запросов / 1 с ⇒ 300 req/min. Полный список лимитов
// per-endpoint (fullstats = 3/min, setBids = 2/s). Глобальный потолок на токен.
export const DEFAULT_ADV_REQ_PER_MIN = 300;

export const ADV_SPEC_URL = 'https://dev.wildberries.ru/openapi/promotion';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;
const SECRET_KEY_RE = /^(authorization|token|wb_token|adv_token|secret|api[_-]?key|decrypted_secret)$/i;

/** Пути из docs/autobidder.md §2. pause/start в спеке OpenAPI — GET, не POST. */
export const ADV_HELPERS = {
    getAdverts: { method: 'GET', path: '/api/advert/v2/adverts' },
    listClusters: { method: 'POST', path: '/adv/v0/normquery/list' },
    getBids: { method: 'POST', path: '/adv/v0/normquery/get-bids' },
    // v1 предпочтительнее для новых интеграций (docs/autobidder.md §2).
    setBids: { method: 'POST', path: '/api/advert/v1/normquery/bids' },
    getClusterStats: { method: 'POST', path: '/adv/v0/normquery/stats' },
    getClusterStatsDaily: { method: 'POST', path: '/adv/v1/normquery/stats' },
    getMinus: { method: 'POST', path: '/adv/v0/normquery/get-minus' },
    setMinus: { method: 'POST', path: '/adv/v0/normquery/set-minus' },
    fullstats: { method: 'GET', path: '/adv/v3/fullstats' },
    pause: { method: 'GET', path: '/adv/v0/pause' },
    start: { method: 'GET', path: '/adv/v0/start' },
} as const;

export type AdvHelperName = keyof typeof ADV_HELPERS;

export type AdvProxyResult = {
    status: number;
    data: unknown;
};

export type AdvCallContext = {
    cabinetId: string;
    token: string;
    tokenKey: string;
    dryRun: boolean;
    reqPerMin: number;
    fetchFn: typeof fetch;
    onAuthFailure: () => Promise<void>;
    sleepFn?: (ms: number) => Promise<void>;
    nowFn?: () => number;
    throttle?: TokenThrottle;
};

// Поля ответа getBids — из примера OpenAPI POST /adv/v0/normquery/get-bids.
export type WbGetBidsResponse = {
    bids: Array<{
        advert_id: number;
        bid: number;
        bid_kopecks: number;
        currency: string;
        nm_id: number;
        norm_query: string;
    }>;
};

// Поля setBids v1 — из примера OpenAPI POST /api/advert/v1/normquery/bids.
export type WbSetBidsV1Response = {
    success: Array<{
        advertId: number;
        nmId: number;
        normQuery: string;
        currency: string;
    }>;
    failed: Array<{
        advertId: number;
        nmId: number;
        normQuery: string;
        reason: string;
    }>;
};

// TODO: структура ответа неизвестна / не зафиксирована целиком — см. ADV_SPEC_URL
//   GET  /api/advert/v2/adverts
//   POST /adv/v0/normquery/list
//   POST /adv/v0/normquery/stats
//   POST /adv/v1/normquery/stats
//   POST /adv/v0/normquery/get-minus
//   POST /adv/v0/normquery/set-minus
//   GET  /adv/v3/fullstats
//   GET  /adv/v0/pause
//   GET  /adv/v0/start
export type WbAdvUnknownResponse = unknown;

export function parseDryRun(raw: string | undefined | null): boolean {
    if (raw == null || String(raw).trim() === '') return true;
    return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

export function parseReqPerMin(raw: string | undefined | null): number {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return DEFAULT_ADV_REQ_PER_MIN;
}

export function isAdvHelperName(action: unknown): action is AdvHelperName {
    return typeof action === 'string' && Object.prototype.hasOwnProperty.call(ADV_HELPERS, action);
}

export function normalizeAdvPath(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let p = raw.trim();
    if (!p) return null;
    if (!p.startsWith('/')) p = `/${p}`;
    if (p.includes('://') || p.includes('..')) return null;
    const q = p.indexOf('?');
    if (q >= 0) p = p.slice(0, q);
    if (p === '/adv' || p.startsWith('/adv/') || p.startsWith('/api/advert/')) return p;
    return null;
}

export function isAdvNamespaceRequest(input: {
    subpath?: unknown;
    action?: unknown;
    path?: unknown;
    namespace?: unknown;
}): boolean {
    if (input.namespace === 'adv' || input.action === 'adv') return true;
    if (isAdvHelperName(input.action)) return true;
    if (normalizeAdvPath(input.subpath)) return true;
    if (normalizeAdvPath(input.path)) return true;
    return false;
}

export function isSetBidsWrite(path: string, helper?: string | null): boolean {
    if (helper === 'setBids') return true;
    return path === '/adv/v0/normquery/bids' || path === '/api/advert/v1/normquery/bids';
}

let sharedThrottle: TokenThrottle | null = null;
let sharedThrottleLimit = 0;

function sharedOrNewThrottle(
    reqPerMin: number,
    now: () => number,
    sleep: (ms: number) => Promise<void>,
    override?: TokenThrottle,
): TokenThrottle {
    if (override) return override;
    if (!sharedThrottle || sharedThrottleLimit !== reqPerMin) {
        sharedThrottle = new TokenThrottle(reqPerMin, now, sleep);
        sharedThrottleLimit = reqPerMin;
    }
    return sharedThrottle;
}

export class TokenThrottle {
    private tails = new Map<string, Promise<void>>();
    private stamps = new Map<string, number[]>();

    constructor(
        private reqPerMin: number,
        private now: () => number,
        private sleep: (ms: number) => Promise<void>,
    ) {}

    async acquire(key: string): Promise<void> {
        const prev = this.tails.get(key) ?? Promise.resolve();
        let release!: () => void;
        const next = new Promise<void>((resolve) => {
            release = resolve;
        });
        this.tails.set(key, prev.then(() => next));
        await prev;
        try {
            const windowMs = 60_000;
            let stamps = (this.stamps.get(key) || []).filter((t) => this.now() - t < windowMs);
            while (stamps.length >= this.reqPerMin) {
                const wait = windowMs - (this.now() - stamps[0]) + 1;
                await this.sleep(Math.max(1, wait));
                stamps = stamps.filter((t) => this.now() - t < windowMs);
            }
            stamps.push(this.now());
            this.stamps.set(key, stamps);
        } finally {
            release();
        }
    }
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stripSecrets(value: unknown, token: string): unknown {
    if (token && value === token) return '[redacted]';
    if (Array.isArray(value)) return value.map((v) => stripSecrets(v, token));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (SECRET_KEY_RE.test(k)) continue;
            out[k] = stripSecrets(v, token);
        }
        return out;
    }
    if (typeof value === 'string' && token && value.includes(token)) {
        return value.split(token).join('[redacted]');
    }
    return value;
}

function parseJsonSafe(text: string): unknown {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text.slice(0, 400) };
    }
}

function buildWbUrl(path: string, query?: Record<string, unknown> | null): string {
    const url = new URL(path, `${ADVERT_API_HOST}/`);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v == null || v === '') continue;
            url.searchParams.set(k, String(v));
        }
    }
    return url.toString();
}

function pickQuery(query: Record<string, unknown> | null | undefined, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!query) return out;
    for (const k of keys) {
        if (query[k] != null && query[k] !== '') out[k] = query[k];
    }
    return out;
}

export function resolveAdvTarget(input: {
    action?: unknown;
    path?: unknown;
    method?: unknown;
    subpath?: unknown;
    query?: Record<string, unknown> | null;
    params?: Record<string, unknown> | null;
}): { helper: AdvHelperName | null; method: string; path: string; query: Record<string, unknown> } | { error: string } {
    const params = input.params || {};
    const query = { ...(input.query || {}) };
    const helper = isAdvHelperName(input.action) ? input.action : null;

    let path = helper
        ? ADV_HELPERS[helper].path
        : normalizeAdvPath(input.subpath) || normalizeAdvPath(input.path);
    if (!path) return { error: 'relative /adv/* or /api/advert/* path required' };

    let method = helper
        ? ADV_HELPERS[helper].method
        : String(input.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return { error: `unsupported method: ${method}` };
    }

    if (helper === 'pause' || helper === 'start') {
        const id = query.id ?? params.id ?? params.advertId;
        if (id != null) query.id = id;
    }
    if (helper === 'fullstats') {
        Object.assign(query, pickQuery({ ...params, ...query }, ['ids', 'beginDate', 'endDate']));
    }
    if (helper === 'getAdverts') {
        Object.assign(query, pickQuery({ ...params, ...query }, ['ids', 'statuses']));
    }

    return { helper, method, path, query };
}

export async function executeAdvRequest(
    ctx: AdvCallContext,
    input: {
        action?: unknown;
        path?: unknown;
        method?: unknown;
        subpath?: unknown;
        body?: unknown;
        query?: Record<string, unknown> | null;
        params?: Record<string, unknown> | null;
    },
): Promise<AdvProxyResult> {
    const target = resolveAdvTarget(input);
    if ('error' in target) {
        return { status: 400, data: { error: target.error, code: 'ADV_BAD_REQUEST' } };
    }

    const payload = input.body;
    if (isSetBidsWrite(target.path, target.helper) && ctx.dryRun) {
        return { status: 200, data: { dry_run: true, payload } };
    }

    const sleep = ctx.sleepFn || defaultSleep;
    const throttle = sharedOrNewThrottle(ctx.reqPerMin, ctx.nowFn || Date.now, sleep, ctx.throttle);
    const url = buildWbUrl(target.path, target.query);
    const hasBody = payload != null && target.method !== 'GET';

    let lastStatus = 0;
    let lastBody: unknown = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        await throttle.acquire(ctx.tokenKey);
        let res: Response;
        try {
            res = await ctx.fetchFn(url, {
                method: target.method,
                headers: {
                    Authorization: ctx.token,
                    Accept: 'application/json',
                    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                },
                body: hasBody ? JSON.stringify(payload) : undefined,
            });
        } catch (e) {
            lastStatus = 502;
            lastBody = { error: String(e), code: 'ADV_NETWORK' };
            if (attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_BASE_MS * (2 ** (attempt - 1)));
                continue;
            }
            break;
        }

        const text = await res.text().catch(() => '');
        const parsed = stripSecrets(parseJsonSafe(text), ctx.token);
        lastStatus = res.status;
        lastBody = parsed;

        if (res.status === 401 || res.status === 403) {
            try {
                await ctx.onAuthFailure();
            } catch (e) {
                console.warn('[wb-adv-proxy] mark token invalid failed:', String(e));
            }
            return {
                status: res.status,
                data: {
                    error: 'ADV_TOKEN_INVALID',
                    code: 'ADV_TOKEN_INVALID',
                    status: res.status,
                    cabinet_id: ctx.cabinetId,
                    message: 'Рекламный токен WB отклонён (401/403). Обновите токен с правами «Продвижение».',
                    wb: parsed,
                },
            };
        }

        if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
            await sleep(RETRY_BASE_MS * (2 ** (attempt - 1)));
            continue;
        }

        return {
            status: res.ok ? 200 : (res.status >= 400 && res.status < 500 ? res.status : 502),
            data: res.ok
                ? parsed
                : {
                    error: `WB advert API ${res.status}`,
                    code: 'ADV_WB_ERROR',
                    status: res.status,
                    wb: parsed,
                },
        };
    }

    return {
        status: lastStatus >= 400 && lastStatus < 500 ? lastStatus : 502,
        data: {
            error: `WB advert API ${lastStatus || 'failed'} after ${MAX_ATTEMPTS} attempts`,
            code: 'ADV_RETRY_EXHAUSTED',
            status: lastStatus || 502,
            wb: lastBody,
        },
    };
}

export function getAdverts(ctx: AdvCallContext, query?: Record<string, unknown>): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'getAdverts', query, params: query });
}

export function listClusters(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'listClusters', body });
}

export function getBids(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'getBids', body });
}

export function setBids(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'setBids', body });
}

export function getClusterStats(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'getClusterStats', body });
}

export function getClusterStatsDaily(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'getClusterStatsDaily', body });
}

export function getMinus(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'getMinus', body });
}

export function setMinus(ctx: AdvCallContext, body?: unknown): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'setMinus', body });
}

export function fullstats(ctx: AdvCallContext, query?: Record<string, unknown>): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'fullstats', query, params: query });
}

export function pause(ctx: AdvCallContext, query?: Record<string, unknown>): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'pause', query, params: query });
}

export function start(ctx: AdvCallContext, query?: Record<string, unknown>): Promise<AdvProxyResult> {
    return executeAdvRequest(ctx, { action: 'start', query, params: query });
}

export async function readAdvTokenFromVault(
    admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>; schema?: (s: string) => any },
    secretId: string | null | undefined,
): Promise<string | null> {
    if (!secretId) return null;
    const { data, error } = await admin.rpc('read_adv_vault_secret', { secret_id: secretId });
    if (!error && typeof data === 'string' && data.trim()) return data.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
    try {
        if (typeof admin.schema === 'function') {
            const { data: row } = await admin.schema('vault')
                .from('decrypted_secrets')
                .select('decrypted_secret')
                .eq('id', secretId)
                .maybeSingle();
            const secret = row?.decrypted_secret;
            if (typeof secret === 'string' && secret.trim()) {
                return secret.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
            }
        }
    } catch {
        /* vault schema may be unavailable */
    }
    return null;
}
