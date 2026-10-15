// Очередь изменений РК: проверка, склейка, повторы и запросы в WB. Чистая логика, fetch подставляется (для тестов).
export type OpKind = 'set_bid' | 'add_nm' | 'remove_nm' | 'create';
export type Placement = 'search' | 'recommendations' | 'combined';

export interface AdvOp {
    id: string;
    seq: number;
    cabinet_id: string;
    advert_id: number | null;
    kind: OpKind;
    payload: Record<string, unknown>;
    attempts: number;
}

export const ADV_API = 'https://advert-api.wildberries.ru';
export const MAX_ATTEMPTS = 5;
const BACKOFF_SEC = [30, 120, 300, 900, 1800];

export function backoffSeconds(attempts: number): number {
    return BACKOFF_SEC[Math.min(Math.max(attempts, 1), BACKOFF_SEC.length) - 1];
}

const PLACEMENTS = ['search', 'recommendations', 'combined'];

/** Возвращает текст ошибки или null. Ставка в копейках: 1 сом = 100. */
export function validateOp(op: Pick<AdvOp, 'kind' | 'advert_id' | 'payload'>): string | null {
    const p = op.payload || {};
    if (op.kind === 'create') {
        const name = String(p.name ?? '').trim();
        const nms = Array.isArray(p.nms) ? p.nms.map(Number).filter((n) => n > 0) : [];
        if (!name) return 'Нет названия кампании';
        if (name.length > 100) return 'Название длиннее 100 символов';
        if (!nms.length || nms.length > 50) return 'Нужно от 1 до 50 товаров';
        if (!['cpm', 'cpc'].includes(String(p.payment_type ?? 'cpm'))) return 'Неверный тип оплаты';
        if (!['manual', 'unified'].includes(String(p.bid_type ?? 'manual'))) return 'Неверный тип ставки';
        return null;
    }
    if (!op.advert_id || Number(op.advert_id) <= 0) return 'Нет номера кампании';
    if (op.kind === 'set_bid') {
        const nm = Number(p.nm_id), bid = Number(p.bid_kopecks);
        if (!nm || nm <= 0) return 'Нет артикула';
        if (!Number.isFinite(bid) || bid < 100 || bid > 5_000_000) return 'Ставка вне допустимых пределов';
        if (!PLACEMENTS.includes(String(p.placement ?? 'search'))) return 'Неверное место размещения';
        return null;
    }
    const nms = Array.isArray(p.nms) ? p.nms.map(Number).filter((n) => n > 0) : [];
    if (!nms.length || nms.length > 50) return 'Нужно от 1 до 50 товаров';
    return null;
}

/** Из пачки оставляет по последней ставке на (кампания, товар, место); старые помечает «заменены». */
export function coalesceOps(ops: AdvOp[]): { run: AdvOp[]; superseded: AdvOp[] } {
    const sorted = [...ops].sort((a, b) => a.seq - b.seq);
    const lastBid = new Map<string, AdvOp>();
    for (const o of sorted) {
        if (o.kind === 'set_bid') lastBid.set(`${o.advert_id}:${o.payload.nm_id}:${o.payload.placement ?? 'search'}`, o);
    }
    const run: AdvOp[] = [];
    const superseded: AdvOp[] = [];
    for (const o of sorted) {
        if (o.kind === 'set_bid') {
            const k = `${o.advert_id}:${o.payload.nm_id}:${o.payload.placement ?? 'search'}`;
            (lastBid.get(k) === o ? run : superseded).push(o);
        } else run.push(o);
    }
    return { run, superseded };
}

export interface WbCallResult { ok: boolean; status: number; body: string; data?: unknown }
type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

async function call(fetchFn: FetchFn, token: string, method: string, path: string, body?: unknown): Promise<WbCallResult> {
    const res = await fetchFn(`${ADV_API}${path}`, {
        method,
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = undefined;
    try { data = JSON.parse(text); } catch { /* не json */ }
    return { ok: res.ok, status: res.status, body: text.slice(0, 400), data };
}

export async function sendBid(fetchFn: FetchFn, token: string, o: AdvOp): Promise<WbCallResult> {
    const body = {
        bids: [{ advert_id: Number(o.advert_id), nm_bids: [{
            nm_id: Number(o.payload.nm_id), bid_kopecks: Math.round(Number(o.payload.bid_kopecks)), placement: String(o.payload.placement ?? 'search'),
        }] }],
    };
    // Актуальный путь по документации WB; старый оставлен на случай 404/405 (так делает и wb-proxy).
    let last = await call(fetchFn, token, 'PATCH', '/api/advert/v1/bids', body);
    if (last.status === 404 || last.status === 405) last = await call(fetchFn, token, 'PATCH', '/adv/v1/bids', body);
    return last;
}

export function sendNms(fetchFn: FetchFn, token: string, advertId: number, add: number[], del: number[]) {
    const nms: Record<string, number[]> = {};
    if (add.length) nms.add = add;
    if (del.length) nms.delete = del;
    return call(fetchFn, token, 'PATCH', '/adv/v0/auction/nms', { nms: [{ advert_id: advertId, nms }] });
}

export function sendCreate(fetchFn: FetchFn, token: string, p: Record<string, unknown>) {
    const body: Record<string, unknown> = {
        name: String(p.name).trim(),
        nms: (p.nms as unknown[]).map(Number),
        bid_type: String(p.bid_type ?? 'manual'),
        payment_type: String(p.payment_type ?? 'cpm'),
    };
    if (body.bid_type === 'manual') body.placement_types = Array.isArray(p.placement_types) && p.placement_types.length ? p.placement_types : ['search'];
    return call(fetchFn, token, 'POST', '/adv/v2/seacat/save-ad', body);
}

/** Понятное сообщение по ответу WB. */
export function friendlyWbError(r: WbCallResult): string {
    if (r.status === 401 || r.status === 403) return 'Токен WB не имеет прав на управление рекламой';
    if (r.status === 429) return 'WB просит подождать (лимит запросов), повторим сами';
    if (r.status >= 500) return 'WB временно не отвечает, повторим сами';
    return `WB отклонил изменение (${r.status}): ${r.body || 'пустой ответ'}`;
}

/** Повтор имеет смысл при лимите, сбое WB или сети; отказ по существу (400/401/403/404) повторять нельзя. */
export function isRetryable(r: WbCallResult): boolean {
    return r.status === 0 || r.status === 429 || r.status >= 500;
}
