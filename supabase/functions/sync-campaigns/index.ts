// sync_campaigns — каждые 30 мин.
// getAdverts v2: nm_id из nm_settings[]. Кабинеты с adv_enabled=true.
// listClusters — только status 9/11, тело { items: [{ id }] }.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    advertName,
    campaignStatus,
    campaignTypeFromWb,
    firstNmId,
    flattenAdverts,
    shouldSyncClusters,
} from '../_shared/adv-advert-parse.ts';
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
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'GET'
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await req.json().catch(() => ({} as Record<string, unknown>));
    const onlyCabinet = body.cabinet_id ? String(body.cabinet_id) : '';
    const force = body.force === true || body.force === 'true';

    const admin = createClient(supabaseUrl, serviceKey);
    let q = admin
        .from('cabinets')
        .select('id, name, adv_token_secret_id, adv_token_valid, adv_enabled')
        .eq('adv_token_valid', true)
        .not('adv_token_secret_id', 'is', null);
    if (!force) q = q.eq('adv_enabled', true);
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
    const advertsRes = await getAdverts(ctx, { statuses: '-1,4,7,8,9,11' });
    if (advertsRes.status >= 400) {
        const err = errorText(advertsRes.data);
        console.error('[sync-campaigns] getAdverts', cab.name, err);
        return { ok: false, error: err, campaigns: 0, clusters: 0 };
    }

    const adverts = flattenAdverts(advertsRes.data);
    const rows: Record<string, unknown>[] = [];
    const liveWbIds: number[] = [];
    let skippedNoId = 0;
    const syncedAt = new Date().toISOString();

    for (const advert of adverts) {
        const wbId = Number(advert.advertId ?? advert.id ?? advert.advert_id ?? 0);
        if (!wbId) {
            skippedNoId += 1;
            continue;
        }
        const nmId = firstNmId(advert);
        rows.push({
            cabinet_id: cab.id,
            wb_campaign_id: wbId,
            nm_id: nmId,
            campaign_type: campaignTypeFromWb(advert),
            name: advertName(advert),
            status: campaignStatus(advert),
            synced_at: syncedAt,
        });
        if (shouldSyncClusters(advert)) liveWbIds.push(wbId);
    }

    let campaigns = 0;
    for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { data: saved, error: upErr } = await admin
            .from('adv_campaigns')
            .upsert(chunk, { onConflict: 'cabinet_id,wb_campaign_id' })
            .select('id, wb_campaign_id');
        if (upErr) {
            console.error('[sync-campaigns] upsert chunk', cab.name, upErr.message);
            continue;
        }
        campaigns += (saved || []).length;
    }

    const withNm = rows.filter((r) => r.nm_id != null).length;
    const { data: idRows } = await admin
        .from('adv_campaigns')
        .select('id, wb_campaign_id')
        .eq('cabinet_id', cab.id)
        .in('wb_campaign_id', liveWbIds.length ? liveWbIds : [0]);
    const idByWb = new Map<number, string>();
    for (const r of idRows || []) {
        idByWb.set(Number((r as { wb_campaign_id: number }).wb_campaign_id), String((r as { id: string }).id));
    }

    let clusters = 0;
    for (const wbId of liveWbIds) {
        const savedId = idByWb.get(wbId);
        if (!savedId) continue;
        const listRes = await listClusters(ctx, { items: [{ id: wbId }] });
        if (listRes.status >= 400) {
            console.error('[sync-campaigns] listClusters', cab.name, wbId, errorText(listRes.data));
            continue;
        }
        const keys = collectClusterKeys(listRes.data);
        if (keys.length) {
            const clusterRows = keys.map((cluster_key) => ({
                campaign_id: savedId,
                cluster_key,
                is_active: true,
            }));
            const { error: clErr } = await admin
                .from('adv_clusters')
                .upsert(clusterRows, { onConflict: 'campaign_id,cluster_key' });
            if (clErr) console.error('[sync-campaigns] upsert clusters', cab.name, wbId, clErr.message);
            else clusters += keys.length;
        }
        const { data: existing } = await admin
            .from('adv_clusters')
            .select('id, cluster_key')
            .eq('campaign_id', savedId);
        const seen = new Set(keys);
        const gone = (existing || []).filter((c) => !seen.has(c.cluster_key)).map((c) => c.id);
        if (gone.length) {
            await admin.from('adv_clusters').update({ is_active: false }).in('id', gone);
        }
    }

    return {
        ok: true,
        seen: adverts.length,
        campaigns,
        with_nm: withNm,
        without_nm: rows.length - withNm,
        clusters,
        skipped_no_id: skippedNoId,
        live: liveWbIds.length,
    };
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
