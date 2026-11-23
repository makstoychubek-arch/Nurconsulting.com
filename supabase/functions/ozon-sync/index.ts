// ozon-sync: тянет из Ozon Seller API товары, цены, остатки и отправления кабинета и кладёт в ozon_* таблицы.
// Только чтение из Ozon. Запуск: cron (service role) или вручную { cabinet_id, days }.
// При ошибке прошлые данные остаются, ошибка пишется в ozon_sync_state (ноль вместо данных не пишем).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { buildAdsRows, chunk as adsChunk } from '../_shared/ozon-ads.ts';
import { buildReturnRows } from '../_shared/ozon-returns.ts';
import { buildAccrualRows, postingBatches } from '../_shared/ozon-accruals.ts';
import { buildFunnelRows, FUNNEL_METRICS, funnelWindows } from '../_shared/ozon-funnel.ts';
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
    // Окно в 60 дней с расшифровкой Ozon не успевает отдать (504 с 19 ноября 2026), поэтому тянем по одному полумесяцу:
    // текущий и два предыдущих. Сбой одного окна не останавливает остальные; ошибка (если все окна упали) поднимается наружу.
    const now = new Date();
    const halves: { from: string; to: string }[] = [];
    let y = now.getUTCFullYear(), m = now.getUTCMonth(), second = now.getUTCDate() > 15;
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let k = 0; k < 3; k++) {
        const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        halves.push(second ? { from: `${y}-${pad(m + 1)}-16T00:00:00.000Z`, to: `${y}-${pad(m + 1)}-${pad(lastDay)}T23:59:59.000Z` } : { from: `${y}-${pad(m + 1)}-01T00:00:00.000Z`, to: `${y}-${pad(m + 1)}-15T23:59:59.000Z` });
        if (second) second = false; else { second = true; m--; if (m < 0) { m = 11; y--; } }
    }
    let total = 0, lastErr: unknown = null, ok = 0;
    for (const w of halves) {
        try {
            let page = 1;
            for (let i = 0; i < 20; i++) {
                const r = await ozonCall(c, '/v1/finance/cash-flow-statement/list', { date: { from: w.from, to: w.to }, with_details: true, page, page_size: 50 }, fetchFn);
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
            ok++;
        } catch (e) { lastErr = e; }
        await sleep(250);
    }
    if (!ok && lastErr) throw lastErr;
    return total;
}

/** Начисления Ozon по дням и видам (/v1/finance/accrual/by-day, замена отключённого /v3/finance/transaction/list): все начисления дня, в том числе без отправления
 *  (кросс-докинг, размещение на складе, услуги). Сводка (дата, категория, вид) в ozon_operations_daily; суммы в валюте кабинета Ozon (рубли). */
async function syncOperations(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    const n = Math.min(90, Math.max(2, days));
    const { data: tp } = await admin.from('ozon_accrual_types').select('id, name');
    const names = new Map<number, string>(((tp || []) as { id: number; name: string }[]).map((x) => [Number(x.id), String(x.name)]));
    // обходим вложенный объект: любая запись с type_id и accrued.amount считается начислением этого вида
    const walk = (o: unknown, cb: (t: number, amount: number) => void) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const x of o) walk(x, cb); return; }
        const r = o as Record<string, any>;
        if (r.type_id != null && r.accrued && r.accrued.amount != null) { cb(Number(r.type_id), Number(r.accrued.amount) || 0); return; }
        for (const k of Object.keys(r)) if (k !== 'total_amount') walk(r[k], cb);
    };
    let total = 0;
    for (let i = 1; i <= n; i++) {
        const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        const agg = new Map<string, { t: string; name: string; amount: number; cnt: number }>();
        let last = '';
        for (let page = 0; page < 40; page++) {
            const r = await ozonCall(c, '/v1/finance/accrual/by-day', last ? { date: d, last_id: last } : { date: d }, fetchFn) as { accruals?: Record<string, any>[]; last_id?: string };
            for (const a of r.accruals || []) {
                const cat = String(a.accrued_category || '');
                const src = a.posting || a.item_fees || a.non_item_fee || a.container_fees;
                walk(src, (t, amount) => { const key = cat + ':' + t; const e = agg.get(key) || { t: key, name: names.get(t) || '', amount: 0, cnt: 0 }; e.amount += amount; e.cnt++; agg.set(key, e); });
            }
            last = String(r.last_id || '');
            if (!last || !(r.accruals || []).length) break;
            await sleep(150);
        }
        const rows = [...agg.values()].map((a) => ({ cabinet_id: cabinetId, d, op_type: a.t, op_name: a.name, amount: Math.round(a.amount * 100) / 100, cnt: a.cnt, synced_at: new Date().toISOString() }));
        if (rows.length) total += await upsert(admin, 'ozon_operations_daily', rows as unknown as Record<string, unknown>[], 'cabinet_id,d,op_type');
        await sleep(150);
    }
    return total;
}

/** Начисления Ozon по отправлениям (новый метод /v1/finance/accrual/postings, 200 отправлений за запрос): точные комиссия, логистика, эквайринг, подписка по каждому заказу. */
async function syncAccruals(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    // Начисления появляются по мере доставки и возвратов (иногда через несколько недель после создания отправления),
    // поэтому окно шире обычного: перечитываем отправления за последние 75 дней.
    const since = new Date(Date.now() - Math.max(days, 75) * 86400_000).toISOString();
    // справочник типов начислений (редко меняется)
    try {
        const t = await ozonCall(c, '/v1/finance/accrual/types', {}, fetchFn);
        const types = ((t.accrual_types as { id: number; name: string; description?: string }[]) || []).map((x) => ({ id: x.id, name: x.name, description: x.description || '', synced_at: new Date().toISOString() }));
        if (types.length) await upsert(admin, 'ozon_accrual_types', types as unknown as Record<string, unknown>[], 'id');
    } catch (_e) { /* справочник не критичен: названия берутся из прошлой загрузки */ }
    const numbers: string[] = [];
    for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await admin.from('ozon_postings').select('posting_number').eq('cabinet_id', cabinetId).gte('created_at', since).order('created_at', { ascending: false }).range(from, from + 999);
        if (error) throw new Error(error.message);
        for (const r of (data || []) as { posting_number: string }[]) numbers.push(r.posting_number);
        if (!data || data.length < 1000) break;
    }
    let total = 0;
    for (const part of postingBatches(numbers, 200)) {
        const r = await ozonCall(c, '/v1/finance/accrual/postings', { posting_numbers: part }, fetchFn);
        const rows = buildAccrualRows(cabinetId, (r.posting_accruals as never[]) || [], new Date().toISOString());
        // у отправления набор начислений мог измениться: старые строки заменяем целиком
        const nums = [...new Set(rows.map((x) => x.posting_number))];
        if (nums.length) await admin.from('ozon_accruals').delete().eq('cabinet_id', cabinetId).in('posting_number', nums);
        total += await upsert(admin, 'ozon_accruals', rows as unknown as Record<string, unknown>[], 'cabinet_id,posting_number,ord');
        await sleep(300);
    }
    return total;
}

/** Возвраты Ozon (отказы при вручении и возвраты клиентов) за последние дни: нужны РНП для строки «Возвраты». */
async function syncReturns(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    const from = new Date(Date.now() - Math.max(days, 30) * 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    let last = 0, total = 0;
    for (let i = 0; i < 40; i++) {
        const r = await ozonCall(c, '/v1/returns/list', { filter: { logistic_return_date: { time_from: from, time_to: to } }, limit: 500, last_id: last }, fetchFn);
        const list = ((r.returns as Record<string, unknown>[]) || []) as { id?: number }[];
        total += await upsert(admin, 'ozon_returns', buildReturnRows(cabinetId, list as never[], new Date().toISOString()) as unknown as Record<string, unknown>[], 'cabinet_id,id');
        if (!r.has_next || !list.length) break;
        last = Number(list[list.length - 1].id) || 0;
        await sleep(250);
    }
    return total;
}

/** Баланс Ozon на сегодня (закрывающий остаток за месяц). Показывается на дашборде вместо баланса WB. */
async function syncBalance(admin: Admin, cabinetId: string, c: OzonCreds): Promise<number> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const first = today.slice(0, 8) + '01';
    const r = await ozonCall(c, '/v1/finance/balance', { date_from: first, date_to: today }, fetchFn);
    const t = (r.total || {}) as { closing_balance?: { value?: number; currency_code?: string }; opening_balance?: { value?: number } };
    if (t.closing_balance?.value == null) return 0;
    return await upsert(admin, 'ozon_balance_daily', [{ cabinet_id: cabinetId, d: today, closing: Number(t.closing_balance.value) || 0, opening: Number(t.opening_balance?.value) || 0, currency: t.closing_balance.currency_code || 'RUB', synced_at: now.toISOString() }] as unknown as Record<string, unknown>[], 'cabinet_id,d');
}

/** Реклама Ozon по кампаниям и дням (Performance API, отдельный ключ рекламного кабинета). Без ключа часть пропускается. */
async function syncAds(admin: Admin, cabinetId: string, perf: { id: string; secret: string }, days: number): Promise<number> {
    if (!perf.id || !perf.secret) return 0;
    const tr = await fetch('https://api-performance.ozon.ru/api/client/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: perf.id, client_secret: perf.secret, grant_type: 'client_credentials' }), signal: AbortSignal.timeout(20000) });
    if (!tr.ok) throw new Error(`Ozon Performance token ${tr.status}`);
    const token = String((await tr.json()).access_token || '');
    const H = { Authorization: `Bearer ${token}` };
    const cr = await fetch('https://api-performance.ozon.ru/api/client/campaign', { headers: H, signal: AbortSignal.timeout(30000) });
    if (!cr.ok) throw new Error(`Ozon Performance campaigns ${cr.status}`);
    // архивные кампании статистику уже не меняют, их пропускаем (меньше запросов, быстрее)
    const ids = (((await cr.json()).list || []) as { id?: string; state?: string }[]).filter((c) => c.state !== 'CAMPAIGN_STATE_ARCHIVED').map((c) => String(c.id || '')).filter(Boolean);
    const to = new Date().toISOString().slice(0, 10);
    // Ozon отдаёт статистику рекламы не больше чем за 62 дня
    const from = new Date(Date.now() - Math.min(60, Math.max(days, 7)) * 86400_000).toISOString().slice(0, 10);
    let total = 0;
    // По 3 кампании за запрос: пачка из 10 у Ozon зависала до таймаута («Signal timed out»), из-за чего реклама не обновлялась с 14 ноября.
    // Сбой одной пачки не бросает остальные: пишем, что получилось, и сообщаем об ошибке в конце.
    let failed = '';
    for (const part of adsChunk(ids, 3)) {
        try {
            const q = part.map((i) => 'campaignIds=' + encodeURIComponent(i)).join('&');
            const r = await fetch(`https://api-performance.ozon.ru/api/client/statistics/daily/json?${q}&dateFrom=${from}&dateTo=${to}`, { headers: H, signal: AbortSignal.timeout(25000) });
            if (!r.ok) throw new Error(`Ozon Performance stats ${r.status}`);
            const rows = ((await r.json()).rows || []) as Record<string, unknown>[];
            total += await upsert(admin, 'ozon_ads_daily', buildAdsRows(cabinetId, rows, new Date().toISOString()) as unknown as Record<string, unknown>[], 'cabinet_id,d,campaign_id');
        } catch (e) { failed = String((e as Error)?.message || e); }
        await sleep(300);
    }
    if (failed && !total) throw new Error(failed);
    return total;
}

/** Воронка Ozon (показы, просмотры карточки, корзина, заказы) по SKU и дням за последние дни. Нужна подписка Premium; без неё Ozon вернёт ошибку. */
async function syncFunnel(admin: Admin, cabinetId: string, c: OzonCreds, days: number): Promise<number> {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - Math.max(days, 7) * 86400_000).toISOString().slice(0, 10);
    let total = 0;
    for (const w of funnelWindows(from, to)) {
        let offset = 0;
        for (let i = 0; i < 20; i++) {
            const r = await ozonCall(c, '/v1/analytics/data', { date_from: w.from, date_to: w.to, metrics: [...FUNNEL_METRICS], dimension: ['sku', 'day'], limit: 1000, offset }, fetchFn);
            const data = ((r.result as { data?: Record<string, unknown>[] } | undefined)?.data || []) as { dimensions?: { id?: string }[]; metrics?: number[] }[];
            total += await upsert(admin, 'ozon_funnel_daily', buildFunnelRows(cabinetId, data, new Date().toISOString()) as unknown as Record<string, unknown>[], 'cabinet_id,d,sku');
            if (data.length < 1000) break;
            offset += 1000;
            await sleep(250);
        }
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
    const parts: string[] = Array.isArray(body?.parts) && body.parts.length ? body.parts : ['products', 'stocks', 'postings', 'finance', 'funnel', 'returns', 'balance', 'ads', 'accruals'];

    let q = admin.from('cabinets').select('id, name, ozon_client_id, ozon_api_key, ozon_perf_client_id, ozon_perf_secret').not('ozon_api_key', 'is', null).neq('ozon_api_key', '');
    if (only) q = q.eq('id', only);
    const { data: cabs, error } = await q;
    if (error) return json({ error: error.message }, 500);

    const results: Record<string, unknown>[] = [];
    for (const cab of (cabs || []) as { id: string; name: string; ozon_client_id: string; ozon_api_key: string; ozon_perf_client_id?: string; ozon_perf_secret?: string }[]) {
        const creds: OzonCreds = { clientId: String(cab.ozon_client_id || '').trim(), apiKey: String(cab.ozon_api_key || '').trim() };
        if (!creds.clientId || !creds.apiKey) continue;
        const res: Record<string, unknown> = { cabinet: cab.name };
        const jobs: Record<string, () => Promise<number>> = {
            products: () => syncProducts(admin, cab.id, creds),
            stocks: () => syncStocks(admin, cab.id, creds),
            postings: () => syncPostings(admin, cab.id, creds, days),
            finance: () => syncFinance(admin, cab.id, creds, days),
            funnel: () => syncFunnel(admin, cab.id, creds, days),
            returns: () => syncReturns(admin, cab.id, creds, days),
            accruals: () => syncAccruals(admin, cab.id, creds, days),
            operations: () => syncOperations(admin, cab.id, creds, days),
            balance: () => syncBalance(admin, cab.id, creds),
            ads: () => syncAds(admin, cab.id, { id: String(cab.ozon_perf_client_id || '').trim(), secret: String(cab.ozon_perf_secret || '').trim() }, days),
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
