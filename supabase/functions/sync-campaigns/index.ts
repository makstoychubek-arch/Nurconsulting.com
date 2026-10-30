// sync_campaigns — каждые 30 мин.
// getAdverts → adv_campaigns; listClusters → adv_clusters (пропавшие is_active=false).
// Кабинеты параллельно (Promise.allSettled). Хелперы: wb-adv-proxy.ts.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { buildClusterListBody, nmIdsFromAdvert, parseClusterList } from '../_shared/wb-cluster-board.ts';
import {
    getAdverts,
    listClusters,
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

type Admin = SupabaseClient;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) return json({ error: 'missing_env' }, 500);
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'GET'
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await req.json().catch(() => ({} as Record<string, unknown>));
    const onlyCabinet = body.cabinet_id ? String(body.cabinet_id) : '';

    const admin = createClient(supabaseUrl, serviceKey);
    let q = admin
        .from('cabinets')
        .select('id, name, adv_token_secret_id, adv_token_valid')
        .eq('adv_token_valid', true)
        .not('adv_token_secret_id', 'is', null);
    if (onlyCabinet) q = q.eq('id', onlyCabinet);
    const { data: cabinets, error: cabErr } = await q;
    if (cabErr) return json({ error: cabErr.message }, 500);

    const settled = await Promise.allSettled(
        (cabinets || []).map((cab) => syncOneCabinet(admin, cab)),
    );

    const results = settled.map((row, i) => {
        const cab = cabinets![i];
        if (row.status === 'fulfilled') return { cabinet_id: cab.id, name: cab.name, ...row.value };
        const err = row.reason instanceof Error ? row.reason.message : String(row.reason);
        console.error('[sync-campaigns]', cab.name, err);
        return { cabinet_id: cab.id, name: cab.name, ok: false, error: err };
    });

    return json({
        ok: true,
        cabinets: results.length,
        failed: results.filter((r) => r.ok === false).length,
        results,
    });
});

async function syncOneCabinet(
    admin: Admin,
    cab: { id: string; name: string; adv_token_secret_id: string },
): Promise<Record<string, unknown>> {
    const token = await readAdvTokenFromVault(admin, cab.adv_token_secret_id);
    if (!token) {
        console.error('[sync-campaigns] нет Vault-токена', cab.name, cab.id);
        return { ok: false, error: 'ADV_TOKEN_MISSING' };
    }

    const ctx = makeCtx(admin, cab.id, token, cab.adv_token_secret_id);
    const advertsRes = await getAdverts(ctx, { statuses: '4,9,11' });
    if (advertsRes.status >= 400) {
        const err = errorText(advertsRes.data);
        console.error('[sync-campaigns] getAdverts', cab.name, err);
        return { ok: false, error: err, campaigns: 0, clusters: 0 };
    }

    const adverts = flattenAdverts(advertsRes.data);

    // Запись в базу пакетами на кабинет, а не по запросу на каждую кампанию: раньше это были сотни одиночных вставок и чтений за запуск (нагрузка на базу).
    const campRows = new Map<number, Record<string, unknown>>();
    const nmsByWb = new Map<number, number[]>();
    const syncedAt = new Date().toISOString();
    for (const advert of adverts) {
        const wbId = Number(advert.advertId ?? advert.id ?? advert.advert_id ?? 0);
        const nmId = firstNmId(advert);
        if (!wbId || !nmId) continue;
        nmsByWb.set(wbId, nmIdsFromAdvert(advert).length ? nmIdsFromAdvert(advert) : [nmId]);
        campRows.set(wbId, {
            cabinet_id: cab.id,
            wb_campaign_id: wbId,
            nm_id: nmId,
            campaign_type: campaignTypeFromWb(advert),
            name: advertName(advert),
            status: campaignStatus(advert),
            synced_at: syncedAt,
        });
    }

    const idByWb = new Map<number, string>();
    for (const part of chunk([...campRows.values()], 200)) {
        const { data: saved, error: upErr } = await admin
            .from('adv_campaigns')
            .upsert(part, { onConflict: 'cabinet_id,wb_campaign_id' })
            .select('id, wb_campaign_id');
        if (upErr) {
            console.error('[sync-campaigns] upsert campaigns', cab.name, upErr.message);
            return { ok: false, error: upErr.message, campaigns: idByWb.size, clusters: 0 };
        }
        for (const r of (saved || []) as { id: string; wb_campaign_id: number }[]) idByWb.set(Number(r.wb_campaign_id), r.id);
    }
    const campaigns = idByWb.size;

    const clusterRows = new Map<string, { campaign_id: string; cluster_key: string; is_active: boolean }>();
    const keysByCampaign = new Map<string, Set<string>>();
    for (const wbId of campRows.keys()) {
        const campaignId = idByWb.get(wbId);
        if (!campaignId) continue;
        // normquery/list принимает items [{advertId, nmId}] по товарам кампании; ключи делятся на active / excluded / archived
        const listRes = await listClusters(ctx, buildClusterListBody(wbId, nmsByWb.get(wbId) || []));
        if (listRes.status >= 400) {
            console.error('[sync-campaigns] listClusters', cab.name, wbId, errorText(listRes.data));
            continue;
        }
        const active = new Set<string>(), other = new Set<string>();
        for (const c of parseClusterList(listRes.data).values()) {
            for (const k of c.active) active.add(k);
            for (const k of [...c.excluded, ...c.archived]) other.add(k);
        }
        const keys = new Set<string>([...active, ...other]);
        keysByCampaign.set(campaignId, keys);
        for (const cluster_key of keys) clusterRows.set(campaignId + '\0' + cluster_key, { campaign_id: campaignId, cluster_key, is_active: active.has(cluster_key) });
    }

    let clusters = 0;
    for (const part of chunk([...clusterRows.values()], 500)) {
        const { error: clErr } = await admin.from('adv_clusters').upsert(part, { onConflict: 'campaign_id,cluster_key' });
        if (clErr) console.error('[sync-campaigns] upsert clusters', cab.name, clErr.message);
        else clusters += part.length;
    }

    // Пропавшие у WB ключи гасим одним проходом по кампаниям, у которых список ключей получили.
    const gone: string[] = [];
    for (const idsPart of chunk([...keysByCampaign.keys()], 100)) {
        for (let from = 0; ; from += 1000) {
            const { data: existing, error: exErr } = await admin
                .from('adv_clusters')
                .select('id, campaign_id, cluster_key')
                .in('campaign_id', idsPart)
                .order('id')
                .range(from, from + 999);
            if (exErr) { console.error('[sync-campaigns] read clusters', cab.name, exErr.message); break; }
            for (const c of (existing || []) as { id: string; campaign_id: string; cluster_key: string }[]) {
                if (!keysByCampaign.get(c.campaign_id)?.has(c.cluster_key)) gone.push(c.id);
            }
            if (!existing || existing.length < 1000) break;
        }
    }
    for (const part of chunk(gone, 200)) {
        const { error: deactErr } = await admin.from('adv_clusters').update({ is_active: false }).in('id', part);
        if (deactErr) console.error('[sync-campaigns] deactivate', cab.name, deactErr.message);
    }

    return { ok: true, campaigns, clusters };
}

function chunk<T>(list: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
}

function makeCtx(admin: Admin, cabinetId: string, token: string, tokenKey: string): AdvCallContext {
    return {
        cabinetId,
        token,
        tokenKey,
        dryRun: parseDryRun(Deno.env.get('DRY_RUN')),
        reqPerMin: parseReqPerMin(Deno.env.get('WB_ADV_REQ_PER_MIN')),
        fetchFn: fetch,
        onAuthFailure: async () => {
            await admin.from('cabinets').update({
                adv_token_valid: false,
                adv_token_checked_at: new Date().toISOString(),
            }).eq('id', cabinetId);
        },
    };
}

function flattenAdverts(data: unknown): Record<string, unknown>[] {
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

function firstNmId(a: Record<string, unknown>): number {
    const settings = a.settings && typeof a.settings === 'object'
        ? a.settings as Record<string, unknown>
        : {};
    const nms = a.nms ?? settings.nms ?? a.nmIds ?? settings.nmIds;
    if (Array.isArray(nms) && nms.length) return Number(nms[0]) || 0;
    // /api/advert/v2/adverts отдаёт артикулы в nm_settings[].nm_id
    for (const list of [a.nm_settings, a.nmSettings, settings.nm_settings]) {
        if (Array.isArray(list)) {
            for (const n of list as Record<string, unknown>[]) {
                const id = Number(n?.nm_id ?? n?.nmId ?? 0);
                if (id) return id;
            }
        }
    }
    return Number(a.nmId ?? a.nm_id ?? settings.nmId ?? settings.nm_id ?? 0);
}

function advertName(a: Record<string, unknown>): string {
    const settings = a.settings && typeof a.settings === 'object'
        ? a.settings as Record<string, unknown>
        : {};
    return String(a.name ?? a.campaignName ?? settings.name ?? '').trim();
}

function campaignTypeFromWb(a: Record<string, unknown>): 'manual_bid' | 'auto_bid' {
    const bid = String(a.bid_type ?? a.bidType ?? '').toLowerCase();
    if (/auto|unified|единая/.test(bid)) return 'auto_bid';
    if (/manual|ручн/.test(bid)) return 'manual_bid';
    const type = Number(a.type ?? a.advert_type ?? 0);
    if (type === 8) return 'auto_bid';
    return 'manual_bid';
}

function campaignStatus(a: Record<string, unknown>): string {
    const s = a.status;
    if (s === 9 || s === '9' || s === 'active') return 'active';
    if (s === 11 || s === '11' || s === 'paused') return 'paused';
    if (s != null && s !== '') return String(s);
    return 'active';
}

function collectClusterKeys(data: unknown): string[] {
    const keys = new Set<string>();
    const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }
        if (typeof node !== 'object') return;
        const o = node as Record<string, unknown>;
        const phrase = String(o.normquery ?? o.normQuery ?? o.phrase ?? o.text ?? o.query ?? o.keyword ?? '').trim();
        if (phrase) keys.add(phrase);
        for (const v of Object.values(o)) {
            if (v && typeof v === 'object') walk(v);
        }
    };
    walk(data);
    return [...keys];
}

function errorText(data: unknown): string {
    if (data && typeof data === 'object') {
        const o = data as Record<string, unknown>;
        return String(o.error || o.message || o.code || JSON.stringify(o).slice(0, 240));
    }
    return String(data || 'WB error').slice(0, 240);
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
