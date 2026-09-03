// Supabase Edge Function: rnp-finance-sync
// Серверный конвейер РНП: финансовый отчёт WB + платное хранение → raw_* →
// rnp_recompute_finance() → rnp_daily_data. Фронт РНП читает только БД;
// WB API дёргается здесь — по кнопке «Обновить» (JWT пользователя) или по
// cron (service role).
//
// Body:
//   { mode: 'sync',  cabinet_id?, from?, to?, force? }  — финотчёт + хранение + пересчёт
//   { mode: 'status', cabinet_id, from, to }            — дотянуть незавершённую задачу хранения
//   { mode: 'rate' }                                     — курс RUB→KGS от НБКР в exchange_rates
//
// Кэш: период (cabinet, source, from, to) со статусом done и fetched_at < TTL
// повторно не запрашивается (force=true снимает ограничение).
//
// Платное хранение у WB — асинхронный отчёт: создать задачу → опросить статус →
// скачать. Задача может считаться дольше лимита edge-функции, поэтому taskId
// сохраняется в rnp_sync_state (status=pending), а ответ содержит
// storage_pending=true — клиент повторяет вызов через ~10 с.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasAllCabinetsAccess } from '../_shared/cabinet-access.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WB_STATS = 'https://statistics-api.wildberries.ru';
const WB_ANALYTICS = 'https://seller-analytics-api.wildberries.ru';
const DEFAULT_WINDOW_DAYS = 8;      // paid_storage: не больше 8 дней на задачу
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FINANCE_PAGE = 100000;
const FINANCE_MAX_PAGES = 4;
const STORAGE_POLL_MS = 4000;
const STORAGE_POLL_MAX = 5;         // ~20 с ожидания внутри одного вызова

// WB Statistics API для одного seller'а режет запросы (часто это проявляется
// как 429). У вас несколько кабинетов используют общий WB-токен, поэтому
// между кабинетами нужно «растягивать» запросы.
const WB_STATS_MIN_INTERVAL_MS = 61000; // ~1 запрос/мин на seller'а
const wbStatsLastReqAtByToken = new Map<string, number>();

type Json = Record<string, unknown>;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const started = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const bearer = authHeader.replace('Bearer ', '');
    const admin = createClient(supabaseUrl, serviceKey);
    // Подпись JWT проверяет gateway (verify_jwt), поэтому роли из payload можно верить.
    const isServiceRole = bearer === serviceKey || jwtRole(bearer) === 'service_role';

    let user: { id: string; email?: string | null } | null = null;
    if (!isServiceRole) {
        const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
        const { data, error } = await userClient.auth.getUser();
        if (error || !data?.user) return json({ error: 'Invalid session' }, 401);
        user = data.user;
    }

    let body: Json = {};
    try { body = await req.json(); } catch { /* empty body ok for cron */ }
    const mode = String(body.mode || 'sync');

    if (mode === 'rate') {
        try {
            const r = await syncNbkrRate(admin);
            return json({ ok: true, ...r, ms: Date.now() - started });
        } catch (e) {
            return json({ error: (e as Error).message }, 502);
        }
    }

    const targetCabinetId = body.cabinet_id ? String(body.cabinet_id) : null;
    if (!isServiceRole && !targetCabinetId) return json({ error: 'cabinet_id required' }, 400);

    // Доступ к кабинету: владелец / супер-админ / сотрудник
    if (!isServiceRole && targetCabinetId) {
        const all = await hasAllCabinetsAccess(admin, user);
        if (!all) {
            const { data: owned } = await admin.from('cabinets').select('id').eq('id', targetCabinetId).eq('user_id', user!.id).maybeSingle();
            if (!owned) return json({ error: 'Кабинет не найден или нет доступа' }, 403);
        }
    }

    // Период: по умолчанию последние 8 дней (включая сегодня)
    const today = isoDate(new Date());
    const to = normDate(body.to) || today;
    const from = normDate(body.from) || isoDate(addDays(new Date(to), -(DEFAULT_WINDOW_DAYS - 1)));
    if (daysBetween(from, to) > 31) return json({ error: 'Период не больше 31 дня за один вызов' }, 400);
    const force = body.force === true;

    let query = admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '');
    if (targetCabinetId) query = query.eq('id', targetCabinetId);
    const { data: cabinetsRaw, error: cabErr } = await query;
    if (cabErr || !cabinetsRaw?.length) return json({ error: 'Нет кабинетов с токенами', detail: cabErr?.message }, 400);

    const isCron = !targetCabinetId;
    // Cron без cabinet_id: сначала финотчёт ВСЕХ кабинетов (хранение на десятки
    // тысяч строк раньше съедало бюджет и оставляло done только у первого).
    // Кабинеты без finance/done идут первыми. Хранение — только если финансы
    // уже в кэше, либо это ручной вызов с cabinet_id.
    const TIME_BUDGET_MS = 130000;
    const { data: states } = await admin.from('rnp_sync_state')
        .select('cabinet_id, source, status, fetched_at')
        .eq('period_from', from)
        .eq('period_to', to);
    const freshDone = (row: Json | undefined) => {
        if (!row || row.status !== 'done' || !row.fetched_at) return false;
        return Date.now() - new Date(String(row.fetched_at)).getTime() < CACHE_TTL_MS;
    };
    const finDone = new Set(
        (states || []).filter((s: Json) => s.source === 'finance' && freshDone(s)).map((s: Json) => String(s.cabinet_id)),
    );
    const stoDone = new Set(
        (states || []).filter((s: Json) => s.source === 'storage' && freshDone(s)).map((s: Json) => String(s.cabinet_id)),
    );
    const cabinets = [...cabinetsRaw].sort((a, b) => {
        const af = finDone.has(a.id) ? 1 : 0;
        const bf = finDone.has(b.id) ? 1 : 0;
        if (af !== bf) return af - bf;
        const as = stoDone.has(a.id) ? 1 : 0;
        const bs = stoDone.has(b.id) ? 1 : 0;
        return as - bs;
    });

    const results: Json[] = [];
    for (const cab of cabinets) {
        if (isCron && Date.now() - started > TIME_BUDGET_MS) {
            results.push({ cabinet_id: cab.id, cabinet: cab.name, status: 'deferred' });
            continue;
        }
        const token = sanitizeWbToken(cab.wb_token);
        if (!token || token.length < 50) continue;
        const res: Json = { cabinet_id: cab.id, cabinet: cab.name, from, to };
        try {
            const financeCached = finDone.has(cab.id);
            if (mode !== 'status') {
                res.finance = await syncFinance(admin, cab.id, token, from, to, force);
                if ((res.finance as Json)?.rows != null && (res.finance as Json).skipped !== true) {
                    finDone.add(cab.id);
                }
            }
            const wantStorage = !isCron || mode === 'status' || financeCached;
            if (wantStorage) {
                res.storage = await syncStorage(admin, cab.id, token, from, to, force);
            } else {
                res.storage = { skipped: true, reason: 'cron_finance_first' };
            }
            const storagePending = (res.storage as Json).pending === true;
            res.storage_pending = storagePending;
            const { data: rc, error: rcErr } = await admin.rpc('rnp_recompute_finance', { p_cabinet: cab.id, p_from: from, p_to: to });
            if (rcErr) res.recompute_error = rcErr.message; else res.recompute = rc;
            res.status = storagePending ? 'storage_pending' : 'done';
        } catch (e) {
            res.status = 'error';
            res.error = (e as Error).message;
        }
        results.push(res);
    }

    return json({ ok: true, mode, results, ms: Date.now() - started });
});

async function wbStatsFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
    const lastAt = wbStatsLastReqAtByToken.get(token) || 0;
    const now = Date.now();
    const waitMs = lastAt ? Math.max(0, WB_STATS_MIN_INTERVAL_MS - (now - lastAt)) : 0;
    if (waitMs > 0) await sleep(waitMs);

    const res = await fetch(url, {
        ...init,
        headers: {
            ...(init?.headers as Record<string, string> | undefined),
            Authorization: token,
        },
    });

    wbStatsLastReqAtByToken.set(token, Date.now());
    return res;
}

// ─── Финансовый отчёт ────────────────────────────────────────────────────────
async function syncFinance(admin: any, cabinetId: string, token: string, from: string, to: string, force: boolean): Promise<Json> {
    const state = await getState(admin, cabinetId, 'finance', from, to);
    if (!force && state?.status === 'done' && state.fetched_at && Date.now() - new Date(String(state.fetched_at)).getTime() < CACHE_TTL_MS) {
        return { cached: true, rows: state.rows || 0, fetched_at: state.fetched_at };
    }
    await setState(admin, cabinetId, 'finance', from, to, { status: 'pending', error: null });

    let rrdid = 0;
    let total = 0;
    for (let page = 0; page < FINANCE_MAX_PAGES; page++) {
        const url = `${WB_STATS}/api/v5/supplier/reportDetailByPeriod?dateFrom=${from}&dateTo=${to}&rrdid=${rrdid}&limit=${FINANCE_PAGE}`;
        // Лимит WB — 1 запрос/мин на токен, и его делят дашборд и кроны.
        // Ждём столько, сколько просит X-RateLimit-Retry (до ~75 с), и повторяем.
        let res = await wbStatsFetch(url, token);
        for (let attempt = 0; res.status === 429 && attempt < 2; attempt++) {
            const retry = Number(res.headers.get('x-ratelimit-retry') || res.headers.get('retry-after') || 60);
            if (!(retry > 0 && retry <= 75)) break;
            await sleep((retry + 2) * 1000);
            res = await wbStatsFetch(url, token);
        }
        if (res.status === 429) {
            const retry = Number(res.headers.get('x-ratelimit-retry') || 60);
            await setState(admin, cabinetId, 'finance', from, to, { status: 'error', error: `WB 429: лимит 1 запрос/мин, повтор через ${retry} с`, rows: total });
            return { skipped: true, reason: 'rate_limit', retry };
        }
        if (!res.ok) {
            const text = (await res.text().catch(() => '')).slice(0, 200);
            await setState(admin, cabinetId, 'finance', from, to, { status: 'error', error: `HTTP ${res.status} ${text}`, rows: total });
            throw new Error(`Финотчёт WB: HTTP ${res.status} ${text}`);
        }
        const text = await res.text();
        const rows = text ? JSON.parse(text) : [];
        if (!Array.isArray(rows) || !rows.length) break;

        const mapped = rows.map((r: Json) => toFinanceRow(cabinetId, r)).filter(r => r.rrd_id > 0);
        for (let i = 0; i < mapped.length; i += 1000) {
            const { error } = await admin.from('raw_finance_report').upsert(mapped.slice(i, i + 1000), { onConflict: 'cabinet_id,rrd_id' });
            if (error) throw new Error('raw_finance_report: ' + error.message);
        }
        total += mapped.length;
        if (rows.length < FINANCE_PAGE) break;
        rrdid = Number((rows[rows.length - 1] as Json).rrd_id || 0);
        if (!rrdid) break;
    }
    await setState(admin, cabinetId, 'finance', from, to, { status: 'done', rows: total, error: null, fetched_at: new Date().toISOString() });
    return { rows: total };
}

function toFinanceRow(cabinetId: string, r: Json) {
    const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const d = (v: unknown) => { const s = String(v || '').split('T')[0]; return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
    const saleDt = d(r.sale_dt) || d(r.rr_dt) || d(r.order_dt);
    return {
        cabinet_id: cabinetId,
        rrd_id: n(r.rrd_id),
        realizationreport_id: n(r.realizationreport_id) || null,
        rr_dt: d(r.rr_dt),
        sale_dt: saleDt,
        nm_id: n(r.nm_id) || null,
        sa_name: r.sa_name ? String(r.sa_name).slice(0, 200) : null,
        doc_type_name: r.doc_type_name ? String(r.doc_type_name) : null,
        supplier_oper_name: r.supplier_oper_name ? String(r.supplier_oper_name).slice(0, 200) : null,
        quantity: n(r.quantity),
        retail_amount: n(r.retail_amount),
        retail_price_withdisc_rub: n(r.retail_price_withdisc_rub),
        ppvz_for_pay: n(r.ppvz_for_pay),
        delivery_rub: n(r.delivery_rub),
        penalty: n(r.penalty),
        storage_fee: n(r.storage_fee),
        deduction: n(r.deduction),
        acceptance: n(r.acceptance),
        currency_name: r.currency_name ? String(r.currency_name) : null,
        fetched_at: new Date().toISOString(),
    };
}

// ─── Платное хранение (async-отчёт) ──────────────────────────────────────────
async function syncStorage(admin: any, cabinetId: string, token: string, from: string, to: string, force: boolean): Promise<Json> {
    const state = await getState(admin, cabinetId, 'storage', from, to);
    if (!force && state?.status === 'done' && state.fetched_at && Date.now() - new Date(String(state.fetched_at)).getTime() < CACHE_TTL_MS) {
        return { cached: true, rows: state.rows || 0, fetched_at: state.fetched_at };
    }

    let taskId: string | null = state?.status === 'pending' && state.task_id ? String(state.task_id) : null;

    if (!taskId) {
        const res = await fetch(`${WB_ANALYTICS}/api/v1/paid_storage?dateFrom=${from}&dateTo=${to}`, { headers: { Authorization: token } });
        if (res.status === 429) {
            // Лимит на создание задач — 1/мин. Не ошибка: хранение просто доедет позже.
            await setState(admin, cabinetId, 'storage', from, to, { status: 'error', error: 'WB 429 при создании задачи хранения' });
            return { pending: false, skipped: true, reason: 'rate_limit' };
        }
        if (!res.ok) {
            const text = (await res.text().catch(() => '')).slice(0, 200);
            await setState(admin, cabinetId, 'storage', from, to, { status: 'error', error: `HTTP ${res.status} ${text}` });
            return { pending: false, skipped: true, reason: `HTTP ${res.status}` };
        }
        const payload = await res.json().catch(() => ({}));
        taskId = String(payload?.data?.taskId || payload?.taskId || '');
        if (!taskId) {
            await setState(admin, cabinetId, 'storage', from, to, { status: 'error', error: 'WB не вернул taskId' });
            return { pending: false, skipped: true, reason: 'no_task_id' };
        }
        await setState(admin, cabinetId, 'storage', from, to, { status: 'pending', task_id: taskId, error: null });
    }

    // Опрашиваем статус — недолго, чтобы уложиться в лимит edge-функции
    for (let i = 0; i < STORAGE_POLL_MAX; i++) {
        const st = await fetch(`${WB_ANALYTICS}/api/v1/paid_storage/tasks/${taskId}/status`, { headers: { Authorization: token } });
        if (st.ok) {
            const js = await st.json().catch(() => ({}));
            const status = String(js?.data?.status || js?.status || '').toLowerCase();
            if (status === 'done') {
                const rows = await downloadStorage(token, taskId);
                const mapped = rows.map(r => toStorageRow(cabinetId, r)).filter(r => r.date);
                await admin.from('raw_storage').delete().eq('cabinet_id', cabinetId).gte('date', from).lte('date', to);
                for (let k = 0; k < mapped.length; k += 1000) {
                    const { error } = await admin.from('raw_storage').insert(mapped.slice(k, k + 1000));
                    if (error) throw new Error('raw_storage: ' + error.message);
                }
                await setState(admin, cabinetId, 'storage', from, to, { status: 'done', rows: mapped.length, task_id: taskId, error: null, fetched_at: new Date().toISOString() });
                return { rows: mapped.length, pending: false };
            }
            if (status === 'canceled' || status === 'purged' || status === 'error') {
                await setState(admin, cabinetId, 'storage', from, to, { status: 'error', error: `задача WB: ${status}`, task_id: null });
                return { pending: false, skipped: true, reason: status };
            }
        }
        await sleep(STORAGE_POLL_MS);
    }
    return { pending: true, task_id: taskId };
}

async function downloadStorage(token: string, taskId: string): Promise<Json[]> {
    const res = await fetch(`${WB_ANALYTICS}/api/v1/paid_storage/tasks/${taskId}/download`, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`Скачивание отчёта хранения: HTTP ${res.status}`);
    const text = await res.text();
    const js = text ? JSON.parse(text) : [];
    return Array.isArray(js) ? js : (Array.isArray(js?.data) ? js.data : []);
}

function toStorageRow(cabinetId: string, r: Json) {
    const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
    const date = String(r.date || '').split('T')[0];
    return {
        cabinet_id: cabinetId,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        nm_id: n(r.nmId) || null,
        vendor_code: r.vendorCode ? String(r.vendorCode).slice(0, 200) : null,
        barcode: r.barcode ? String(r.barcode) : null,
        chrt_id: n(r.chrtId) || null,
        warehouse: r.warehouse ? String(r.warehouse) : null,
        warehouse_coef: n(r.warehouseCoef) || null,
        volume: n(r.volume) || null,
        calc_type: r.calcType ? String(r.calcType) : null,
        warehouse_price: n(r.warehousePrice),
        fetched_at: new Date().toISOString(),
    };
}

// ─── Курс RUB→KGS от НБКР ────────────────────────────────────────────────────
// Только nbkr.kg — WB не вызываем. daily.xml иногда отвечает 5xx без UA,
// поэтому пробуем weekly.xml. Ручной курс на ту же дату не перетираем.
async function syncNbkrRate(admin: any): Promise<Json> {
    const xml = await fetchNbkrXml();
    const m = xml.match(/<Currency[^>]*ISOCode="RUB"[^>]*>[\s\S]*?<Nominal>([\d.,]+)<\/Nominal>[\s\S]*?<Value>([\d.,]+)<\/Value>/i);
    if (!m) throw new Error('НБКР: не нашли курс RUB в XML');
    const nominal = Number(m[1].replace(',', '.')) || 1;
    const value = Number(m[2].replace(',', '.'));
    const rate = value / nominal;
    if (!(rate > 0.3 && rate < 5)) throw new Error(`НБКР: подозрительный курс ${rate}`);
    const xmlDate = xml.match(/\bDate="(\d{2})\.(\d{2})\.(\d{4})"/);
    const date = xmlDate ? `${xmlDate[3]}-${xmlDate[2]}-${xmlDate[1]}` : isoDate(new Date());
    const { data: existing } = await admin.from('exchange_rates').select('source').eq('pair', 'RUB_KGS').eq('date', date).maybeSingle();
    if (existing?.source === 'manual') return { date, rate: null, kept: 'manual' };
    const { error } = await admin.from('exchange_rates').upsert({ pair: 'RUB_KGS', date, rate, source: 'nbkr' }, { onConflict: 'pair,date' });
    if (error) throw new Error('exchange_rates: ' + error.message);
    return { date, rate, source: 'nbkr' };
}

async function fetchNbkrXml(): Promise<string> {
    const urls = [
        'https://www.nbkr.kg/XML/daily.xml',
        'https://www.nbkr.kg/XML/weekly.xml',
    ];
    const headers = { 'User-Agent': 'NRSpace/1.0 (+https://nurcon.kg)' };
    let last = '';
    for (const url of urls) {
        try {
            const res = await fetch(url, { headers });
            if (!res.ok) { last = `HTTP ${res.status}`; continue; }
            const text = await res.text();
            if (/ISOCode="RUB"/i.test(text)) return text;
            last = 'нет RUB в XML';
        } catch (e) {
            last = (e as Error).message;
        }
    }
    throw new Error(`НБКР: ${last || 'нет ответа'}`);
}

// ─── helpers ────────────────────────────────────────────────────────────────
async function getState(admin: any, cabinetId: string, source: string, from: string, to: string) {
    const { data } = await admin.from('rnp_sync_state').select('*')
        .eq('cabinet_id', cabinetId).eq('source', source).eq('period_from', from).eq('period_to', to).maybeSingle();
    return data as Json | null;
}

async function setState(admin: any, cabinetId: string, source: string, from: string, to: string, patch: Json) {
    await admin.from('rnp_sync_state').upsert({
        cabinet_id: cabinetId, source, period_from: from, period_to: to,
        updated_at: new Date().toISOString(), ...patch,
    }, { onConflict: 'cabinet_id,source,period_from,period_to' });
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
function jwtRole(token: string): string {
    try {
        const part = token.split('.')[1];
        if (!part) return '';
        const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        return String(payload?.role || '');
    } catch { return ''; }
}
function isoDate(d: Date) { return d.toISOString().split('T')[0]; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function normDate(v: unknown): string | null {
    const s = String(v || '').split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function daysBetween(a: string, b: string) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }
