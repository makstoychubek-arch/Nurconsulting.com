// sync_daily_stats — 06:00 Бишкек (00:00 UTC).
// fullstats за вчера → adv_daily_stats (cluster_key=NULL);
// getClusterStatsDaily → строки по кластерам. Upsert по PK.
// Кабинеты параллельно (Promise.allSettled). Хелперы: wb-adv-proxy.ts.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    fullstats,
    getClusterStatsDaily,
    parseDryRun,
    parseReqPerMin,
    readAdvTokenFromVault,
    type AdvCallContext,
} from '../_shared/wb-adv-proxy.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const FULLSTATS_CHUNK = 50;
const FULLSTATS_GAP_MS = 21_000;

type Admin = SupabaseClient;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'GET'
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await req.json().catch(() => ({} as Record<string, unknown>));

    const dryRun = parseDryRun(
        body.dry_run != null ? String(body.dry_run) : Deno.env.get('DRY_RUN'),
    );
    const reqPerMin = parseReqPerMin(
        body.req_per_min != null ? String(body.req_per_min) : Deno.env.get('WB_ADV_REQ_PER_MIN'),
    );
    const date = ymd(body.date) || yesterdayYmd();
    const onlyCabinet = body.cabinet_id ? String(body.cabinet_id).trim() : '';

    const admin = createClient(supabaseUrl, serviceKey);
    let q = admin
        .from('cabinets')
        .select('id, name, adv_token_secret_id')
        .eq('adv_token_valid', true)
        .not('adv_token_secret_id', 'is', null);
    if (onlyCabinet) q = q.eq('id', onlyCabinet);
    const { data: cabinets, error: cabErr } = await q;
    if (cabErr) return json({ error: cabErr.message }, 500);

    const list = cabinets || [];
    const settled = await Promise.allSettled(
        list.map((cab) => syncOneCabinet(admin, cab, date, dryRun, reqPerMin)),
    );

    const results = settled.map((row, i) => {
        const cab = list[i];
        if (row.status === 'fulfilled') return { cabinet_id: cab.id, name: cab.name, ...row.value };
        const err = row.reason instanceof Error ? row.reason.message : String(row.reason);
        console.error('[sync-daily-stats]', cab.name, err);
        return { cabinet_id: cab.id, name: cab.name, ok: false, error: err };
    });

    return json({
        ok: true,
        date,
        dry_run: dryRun,
        cabinets: results.length,
        failed: results.filter((r) => r.ok === false).length,
        results,
    });
});

async function syncOneCabinet(
    admin: Admin,
    cab: { id: string; name: string; adv_token_secret_id: string },
    date: string,
    dryRun: boolean,
    reqPerMin: number,
): Promise<Record<string, unknown>> {
    const token = await readAdvTokenFromVault(admin, cab.adv_token_secret_id);
    if (!token) {
        console.error('[sync-daily-stats] нет Vault-токена', cab.name, cab.id);
        return { ok: false, error: 'ADV_TOKEN_MISSING' };
    }

    const ctx = makeCtx(admin, cab.id, token, cab.adv_token_secret_id, dryRun, reqPerMin);

    const { data: campaigns, error: campErr } = await admin
        .from('adv_campaigns')
        .select('id, wb_campaign_id')
        .eq('cabinet_id', cab.id);
    if (campErr) throw new Error(`adv_campaigns: ${campErr.message}`);

    const list = (campaigns || []) as { id: string; wb_campaign_id: number }[];
    const byWb = new Map<number, string>();
    for (const c of list) byWb.set(Number(c.wb_campaign_id), c.id);

    if (!list.length) {
        console.warn('[sync-daily-stats] нет локальных кампаний', cab.name, cab.id);
        return { ok: true, campaigns: 0, fullstats_rows: 0, cluster_rows: 0 };
    }

    const ids = list.map((c) => Number(c.wb_campaign_id)).filter((n) => Number.isFinite(n) && n > 0);
    let fullstatsRows = 0;
    const errors: string[] = [];

    for (let i = 0; i < ids.length; i += FULLSTATS_CHUNK) {
        if (i > 0) await sleep(FULLSTATS_GAP_MS);
        const chunk = ids.slice(i, i + FULLSTATS_CHUNK);
        const res = await fullstats(ctx, {
            ids: chunk.join(','),
            beginDate: date,
            endDate: date,
        });
        if (res.status >= 400) {
            const err = errorText(res.data);
            console.error('[sync-daily-stats] fullstats', cab.name, err);
            errors.push(`fullstats: ${err}`);
            continue;
        }
        const parsed = collectFullstats(res.data, date);
        const upserts = [];
        for (const row of parsed) {
            const campaignId = byWb.get(row.advertId);
            if (!campaignId) {
                console.warn('[sync-daily-stats] fullstats неизвестная кампания', cab.name, row.advertId);
                continue;
            }
            upserts.push({
                campaign_id: campaignId,
                cluster_key: null,
                date: row.date,
                impressions: row.impressions,
                clicks: row.clicks,
                spend: row.spend,
                carts: row.carts,
                orders: row.orders,
                revenue: row.revenue,
            });
        }
        fullstatsRows += await upsertStats(admin, upserts);
    }

    let clusterRows = 0;
    for (const camp of list) {
        const res = await getClusterStatsDaily(ctx, {
            from: date,
            to: date,
            items: [{ id: Number(camp.wb_campaign_id) }],
        });
        if (res.status >= 400) {
            const err = errorText(res.data);
            console.error('[sync-daily-stats] getClusterStatsDaily', cab.name, camp.wb_campaign_id, err);
            errors.push(`cluster ${camp.wb_campaign_id}: ${err}`);
            continue;
        }
        const parsed = collectClusterStats(res.data, date);
        const upserts = [];
        for (const row of parsed) {
            const campaignId = byWb.get(row.advertId) ?? camp.id;
            upserts.push({
                campaign_id: campaignId,
                cluster_key: row.clusterKey,
                date: row.date,
                impressions: row.impressions,
                clicks: row.clicks,
                spend: row.spend,
                carts: row.carts,
                orders: row.orders,
                revenue: row.revenue,
            });
        }
        clusterRows += await upsertStats(admin, upserts);
    }

    return {
        ok: errors.length === 0,
        campaigns: list.length,
        fullstats_rows: fullstatsRows,
        cluster_rows: clusterRows,
        ...(errors.length ? { error: errors.join('; ') } : {}),
    };
}

async function upsertStats(
    admin: Admin,
    rows: Array<{
        campaign_id: string;
        cluster_key: string | null;
        date: string;
        impressions: number;
        clicks: number;
        spend: number;
        carts: number;
        orders: number;
        revenue: number;
    }>,
): Promise<number> {
    if (!rows.length) return 0;
    const { error } = await admin.from('adv_daily_stats').upsert(rows, {
        onConflict: 'campaign_id,cluster_key,date',
    });
    if (error) throw new Error(`adv_daily_stats upsert: ${error.message}`);
    return rows.length;
}

function makeCtx(
    admin: Admin,
    cabinetId: string,
    token: string,
    tokenKey: string,
    dryRun: boolean,
    reqPerMin: number,
): AdvCallContext {
    return {
        cabinetId,
        token,
        tokenKey,
        dryRun,
        reqPerMin,
        fetchFn: fetch,
        onAuthFailure: async () => {
            await admin.from('cabinets').update({
                adv_token_valid: false,
                adv_token_checked_at: new Date().toISOString(),
            }).eq('id', cabinetId);
        },
    };
}

type DailyMetrics = {
    impressions: number;
    clicks: number;
    spend: number;
    carts: number;
    orders: number;
    revenue: number;
};

type FullstatRow = { advertId: number; date: string } & DailyMetrics;
type ClusterStatRow = { advertId: number; clusterKey: string; date: string } & DailyMetrics;

function collectFullstats(payload: unknown, wantDate: string): FullstatRow[] {
    const out: FullstatRow[] = [];
    const items = Array.isArray(payload)
        ? payload
        : asArray(asRecord(payload)?.adverts ?? asRecord(payload)?.content);

    for (const item of items) {
        const rec = asRecord(item);
        if (!rec) continue;
        const advertId = advertIdOf(rec);
        if (!advertId) continue;
        const daysRaw = rec.days;
        const days = Array.isArray(daysRaw)
            ? daysRaw
            : daysRaw && typeof daysRaw === 'object'
                ? Object.values(daysRaw as Record<string, unknown>)
                : [];
        for (const day of days) {
            const d = asRecord(day);
            if (!d) continue;
            const date = dateOnly(pick(d, ['date', 'day', 'dt']));
            if (date !== wantDate) continue;
            out.push({ advertId, date, ...metricsFrom(d) });
        }
    }
    return out;
}

function collectClusterStats(payload: unknown, wantDate: string): ClusterStatRow[] {
    const out: ClusterStatRow[] = [];
    walkClusterStats(payload, { advertId: null, clusterKey: null }, wantDate, out);
    const uniq = new Map<string, ClusterStatRow>();
    for (const row of out) uniq.set(`${row.advertId}\t${row.clusterKey}\t${row.date}`, row);
    return [...uniq.values()];
}

function walkClusterStats(
    node: unknown,
    inherited: { advertId: number | null; clusterKey: string | null },
    wantDate: string,
    out: ClusterStatRow[],
): void {
    if (Array.isArray(node)) {
        for (const item of node) walkClusterStats(item, inherited, wantDate, out);
        return;
    }
    const rec = asRecord(node);
    if (!rec) return;

    const advertId = advertIdOf(rec) ?? inherited.advertId;
    const clusterKey = clusterKeyOf(rec) ?? inherited.clusterKey;
    const date = dateOnly(pick(rec, ['date', 'day', 'dt']));
    const hasMetrics =
        pick(rec, ['views', 'impressions', 'shows', 'clicks', 'sum', 'spend', 'orders', 'atbs']) !== undefined;

    if (advertId && clusterKey && date === wantDate && hasMetrics) {
        out.push({ advertId, clusterKey, date, ...metricsFrom(rec) });
    }

    const next = { advertId, clusterKey };
    for (const [key, value] of Object.entries(rec)) {
        if ([
            'advertId', 'advert_id', 'id', 'normquery', 'normQuery', 'norm_query',
            'cluster', 'phrase', 'query', 'keyword', 'date', 'day', 'dt',
        ].includes(key)) continue;
        if (value && typeof value === 'object') walkClusterStats(value, next, wantDate, out);
    }
}

function metricsFrom(row: Record<string, unknown>): DailyMetrics {
    return {
        impressions: toInt(pick(row, ['views', 'impressions', 'shows', 'view'])),
        clicks: toInt(pick(row, ['clicks', 'click'])),
        spend: toNum(pick(row, ['sum', 'spend', 'spent', 'cost'])),
        carts: toInt(pick(row, ['atbs', 'carts', 'addedToCart'])),
        orders: toInt(pick(row, ['orders', 'order', 'ordersCount', 'orders_count'])),
        revenue: toNum(pick(row, ['sum_price', 'sumPrice', 'revenue'])),
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function toInt(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNum(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
}

function advertIdOf(row: Record<string, unknown>): number | null {
    const n = Number(pick(row, ['advertId', 'advert_id', 'id']));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function clusterKeyOf(row: Record<string, unknown>): string | null {
    const raw = pick(row, ['normquery', 'normQuery', 'norm_query', 'cluster', 'phrase', 'query', 'keyword']);
    if (raw == null) return null;
    const s = String(raw).trim();
    return s || null;
}

function dateOnly(value: unknown): string | null {
    if (value == null) return null;
    const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

/** Вчера по Бишкеку (UTC+6), YYYY-MM-DD. Cron 06:00 = 00:00 UTC. */
function yesterdayYmd(): string {
    const now = new Date();
    const bishkek = new Date(now.getTime() + 6 * 3600_000);
    bishkek.setUTCDate(bishkek.getUTCDate() - 1);
    return bishkek.toISOString().slice(0, 10);
}

function ymd(value: unknown): string | null {
    if (value == null) return null;
    const s = String(value).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function errorText(data: unknown): string {
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        return String(o.error || o.message || o.code || JSON.stringify(o).slice(0, 240));
    }
    return String(data || 'WB error').slice(0, 240);
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
