// ozon-sync: тянет из Ozon Seller API товары, цены, остатки и отправления кабинета и кладёт в ozon_* таблицы.
// Только чтение из Ozon. Запуск: cron (service role) или вручную { cabinet_id, days }.
// При ошибке прошлые данные остаются, ошибка пишется в ozon_sync_state (ноль вместо данных не пишем).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    buildPostingRows, buildProductRows, buildStockRows, matchByBarcode, ozonCall, OzonError,
    type FetchFn, type OzonCreds,
} from '../_shared/ozon-api.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fetchFn: FetchFn = (url, init) => fetch(url, init);

type Admin = ReturnType<typeof createClient>;

async function upsert(admin: Admin, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<number> {
    let n = 0;
    for (const part of chunk(rows, 500)) {
        const { error } = await admin.from(table).upsert(part, { onConflict });
        if (error) throw new Error(`${table}: ${error.message}`);
        n += part.length;
    }
    return n;
}

async function mark(admin: Admin, cabinetId: string, part: string, ok: boolean, rows: number, err?: string) {
    const now = new Date().toISOString();
    await admin.from('ozon_sync_state').upsert({
        cabinet_id: cabinetId, part, last_try_at: now, ...(ok ? { last_ok_at: now, last_error: null, rows_written: rows } : { last_error: String(err || '').slice(0, 300) }),
    }, { onConflict: 'cabinet_id,part' });
}

async function syncProducts(admin: Admin, cabinetId: string, c: OzonCreds): Promise<number> {
    const list: Record<string, unknown>[] = [];
    let last = '';
    for (let i = 0; i < 50; i++) {
        const r = await ozonCall(c, '/v3/product/list', { filter: { visibility: 'ALL' }, last_id: last, limit: 1000 }, fetchFn);
        const res = (r.result || {}) as { items?: Record<string, unknown>[]; last_id?: string };
        list.push(...(res.items || []));
        last = res.last_id || '';
        if (!(res.items || []).length || !last) break;
        await sleep(200);
    }
    if (!list.length) return 0;
    const ids = list.map((x) => Number(x.product_id));
    const info: Record<string, unknown>[] = [];
    for (const part of chunk(ids, 100)) {
        const r = await ozonCall(c, '/v3/product/info/list', { product_id: part }, fetchFn);
        info.push(...(((r.items as Record<string, unknown>[]) || [])));
        await sleep(200);
    }
    const prices: Record<string, unknown>[] = [];
    let cur = '';
    for (let i = 0; i < 50; i++) {
        const r = await ozonCall(c, '/v5/product/info/prices', { filter: { visibility: 'ALL' }, limit: 1000, cursor: cur }, fetchFn);
        prices.push(...(((r.items as Record<string, unknown>[]) || [])));
        cur = String(r.cursor || '');
        if (!cur || !((r.items as unknown[]) || []).length) break;
        await sleep(200);
    }
    const attrs: Record<string, unknown>[] = [];
    for (const part of chunk(ids, 50)) {
        const r = await ozonCall(c, '/v4/product/info/attributes', { filter: { product_id: part.map(String), visibility: 'ALL' }, limit: 100 }, fetchFn);
        attrs.push(...(((r.result as Record<string, unknown>[]) || [])));
        await sleep(300);
    }
    const rows = buildProductRows(cabinetId, list, info, prices, attrs, new Date().toISOString());
    const n = await upsert(admin, 'ozon_products', rows as unknown as Record<string, unknown>[], 'cabinet_id,product_id');

    // связь с WB по штрихкоду
    const { data: wb } = await admin.from('wb_stocks').select('nm_id, barcode').eq('cabinet_id', cabinetId);
    const maps = matchByBarcode(cabinetId, rows, (wb || []) as { nm_id: number; barcode: string }[]);
    if (maps.length) await upsert(admin, 'mp_article_map', maps as unknown as Record<string, unknown>[], 'cabinet_id,nm_id,offer_id');
    return n;
}

async function syncStocks(admin: Admin, cabinetId: string, c: OzonCreds): Promise<number> {
    const items: Record<string, unknown>[] = [];
    let cur = '';
    for (let i = 0; i < 50; i++) {
        const r = await ozonCall(c, '/v4/product/info/stocks', { filter: { visibility: 'ALL' }, limit: 1000, cursor: cur }, fetchFn);
        items.push(...(((r.items as Record<string, unknown>[]) || [])));
        cur = String(r.cursor || '');
        if (!cur || !((r.items as unknown[]) || []).length) break;
        await sleep(200);
    }
    const rows = buildStockRows(cabinetId, items, new Date().toISOString());
    return await upsert(admin, 'ozon_stocks', rows as unknown as Record<string, unknown>[], 'cabinet_id,product_id,scheme');
}

async function syncPostings(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    let cur = '', total = 0;
    for (let i = 0; i < 200; i++) {
        const body: Record<string, unknown> = { dir: 'DESC', filter: { since, to }, limit: 100, with: { analytics_data: true } };
        if (cur) body.cursor = cur;
        const r = await ozonCall(c, '/v3/posting/fbo/list', body, fetchFn);
        const posts = ((r.postings as Record<string, unknown>[]) || []);
        total += await upsert(admin, 'ozon_postings', buildPostingRows(cabinetId, posts, new Date().toISOString(), 'fbo') as unknown as Record<string, unknown>[], 'cabinet_id,posting_number');
        cur = String(r.cursor || '');
        if (!r.has_next || !cur) break;
        await sleep(250);
    }
    return total;
}

/** Финотчёт Ozon по полумесяцам (cash-flow) с расшифровкой: комиссия, логистика, возвраты, услуги. Нужен для точной юнит-экономики. */
async function syncFinance(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    const from = new Date(Date.now() - Math.max(days, 60) * 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    let page = 1, total = 0;
    for (let i = 0; i < 20; i++) {
        const r = await ozonCall(c, '/v1/finance/cash-flow-statement/list', { date: { from, to }, with_details: true, page, page_size: 50 }, fetchFn);
        const res = (r.result || {}) as { cash_flows?: Record<string, any>[]; details?: Record<string, any>[]; page_count?: number };
        const flows = res.cash_flows || [], det = res.details || [];
        const rows = flows.map((f, k) => {
            const { period, ...summary } = f;
            const d = det.find((x) => String(x.period?.begin) === String(period?.begin)) || det[k] || {};
            return { cabinet_id: cabinetId, period_begin: String(period.begin).slice(0, 10), period_end: String(period.end).slice(0, 10), summary, detail: d, synced_at: new Date().toISOString() };
        });
        total += await upsert(admin, 'ozon_cashflow', rows as unknown as Record<string, unknown>[], 'cabinet_id,period_begin');
        if (page >= (res.page_count || 1)) break;
        page++;
        await sleep(250);
    }
    return total;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const body = await req.json().catch(() => ({}));
    const only = body?.cabinet_id ? String(body.cabinet_id) : '';
    const days = Math.min(120, Math.max(1, Number(body?.days) || 14));
    const parts: string[] = Array.isArray(body?.parts) && body.parts.length ? body.parts : ['products', 'stocks', 'postings', 'finance'];

    let q = admin.from('cabinets').select('id, name, ozon_client_id, ozon_api_key').not('ozon_api_key', 'is', null).neq('ozon_api_key', '');
    if (only) q = q.eq('id', only);
    const { data: cabs, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results: Record<string, unknown>[] = [];
    for (const cab of (cabs || []) as { id: string; name: string; ozon_client_id: string; ozon_api_key: string }[]) {
        const creds: OzonCreds = { clientId: String(cab.ozon_client_id || '').trim(), apiKey: String(cab.ozon_api_key || '').trim() };
        if (!creds.clientId || !creds.apiKey) continue;
        const res: Record<string, unknown> = { cabinet: cab.name };
        const jobs: Record<string, () => Promise<number>> = {
            products: () => syncProducts(admin, cab.id, creds),
            stocks: () => syncStocks(admin, cab.id, creds),
            postings: () => syncPostings(admin, cab.id, creds, days),
            finance: () => syncFinance(admin, cab.id, creds, days),
        };
        for (const p of parts) {
            if (!jobs[p]) continue;
            try {
                const n = await jobs[p]();
                await mark(admin, cab.id, p, true, n);
                res[p] = n;
            } catch (e) {
                const msg = e instanceof OzonError ? `Ozon ${e.status}: ${e.message}` : String((e as Error)?.message || e);
                await mark(admin, cab.id, p, false, 0, msg);
                res[p] = `error: ${msg}`;
            }
        }
        results.push(res);
    }
    return json({ ok: true, results });
});
