// autobidder_tick — */5 мин. Способ B, стратегия min_sufficient.
// Кабинеты параллельно, правила внутри кабинета последовательно.
// DRY_RUN=true по умолчанию: setBids не уходит в WB.
// get_ad_position — заглушка (шаг 7). Telegram-алерты — шаг 11.7.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    decideBid,
    getAdPosition,
    isCapExhausted,
    spendEstimateBetweenSyncs,
    tokenInvalidResult,
} from '../_shared/autobidder-tick-decide.ts';
import {
    getBids,
    parseDryRun,
    parseReqPerMin,
    readAdvTokenFromVault,
    setBids,
    type AdvCallContext,
} from '../_shared/wb-adv-proxy.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Admin = SupabaseClient;

type CabinetRow = {
    id: string;
    name: string;
    adv_token_secret_id: string;
    adv_daily_budget_cap: number | null;
    adv_group_id: string | null;
};

type RuleRow = {
    id: string;
    cluster_id: string | null;
    target_pos_from: number;
    target_pos_to: number;
    max_bid: number | null;
    min_bid_floor: number;
    step_pct: number;
    hysteresis: number;
    campaign: {
        id: string;
        cabinet_id: string;
        wb_campaign_id: number;
        nm_id: number;
        campaign_type: string;
        status: string;
    };
};

type ClusterRow = { id: string; campaign_id: string; cluster_key: string; is_active: boolean };

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
    const reqPerMin = parseReqPerMin(Deno.env.get('WB_ADV_REQ_PER_MIN'));
    const onlyCabinet = body.cabinet_id ? String(body.cabinet_id).trim() : '';
    const onlyRule = body.rule_id ? String(body.rule_id).trim() : '';
    const positions = asPosMap(body.positions);

    const admin = createClient(supabaseUrl, serviceKey);

    let q = admin
        .from('cabinets')
        .select('id, name, adv_token_secret_id, adv_daily_budget_cap, adv_group_id')
        .eq('adv_token_valid', true)
        .eq('adv_enabled', true)
        .not('adv_token_secret_id', 'is', null);
    if (onlyCabinet) q = q.eq('id', onlyCabinet);
    const { data: cabinets, error: cabErr } = await q;
    if (cabErr) return json({ error: cabErr.message }, 500);
    const list = (cabinets || []) as CabinetRow[];

    const { data: ruleRows, error: ruleErr } = await admin
        .from('autobidder_rules')
        .select(`
            id, cluster_id, target_pos_from, target_pos_to,
            max_bid, min_bid_floor, step_pct, hysteresis, is_active, strategy,
            adv_campaigns!inner (
                id, cabinet_id, wb_campaign_id, nm_id, campaign_type, status
            )
        `)
        .eq('is_active', true)
        .eq('strategy', 'min_sufficient');
    if (ruleErr) return json({ error: ruleErr.message }, 500);

    const rules: RuleRow[] = [];
    for (const raw of ruleRows || []) {
        const r = raw as Record<string, unknown>;
        const camp = unwrapCamp(r.adv_campaigns);
        if (!camp) continue;
        if (camp.campaign_type !== 'manual_bid') continue;
        if (onlyRule && r.id !== onlyRule) continue;
        rules.push({
            id: String(r.id),
            cluster_id: r.cluster_id ? String(r.cluster_id) : null,
            target_pos_from: Number(r.target_pos_from),
            target_pos_to: Number(r.target_pos_to),
            max_bid: r.max_bid == null ? null : Number(r.max_bid),
            min_bid_floor: Number(r.min_bid_floor),
            step_pct: Number(r.step_pct),
            hysteresis: Number(r.hysteresis),
            campaign: camp,
        });
    }

    const campIds = [...new Set(rules.map((r) => r.campaign.id))];
    let clusters: ClusterRow[] = [];
    if (campIds.length) {
        const { data: cl, error: clErr } = await admin
            .from('adv_clusters')
            .select('id, campaign_id, cluster_key, is_active')
            .in('campaign_id', campIds)
            .eq('is_active', true);
        if (clErr) return json({ error: clErr.message }, 500);
        clusters = (cl || []) as ClusterRow[];
    }

    const today = bishkekYmd();
    const groupIds = [...new Set(list.map((c) => c.adv_group_id).filter(Boolean))] as string[];
    const cabGroup = new Map<string, string | null>(list.map((c) => [c.id, c.adv_group_id]));
    const spendCabinetIds = new Set(list.map((c) => c.id));
    if (groupIds.length) {
        const { data: mates } = await admin
            .from('cabinets')
            .select('id, adv_group_id')
            .in('adv_group_id', groupIds);
        for (const m of mates || []) {
            const row = m as { id: string; adv_group_id: string | null };
            spendCabinetIds.add(row.id);
            cabGroup.set(row.id, row.adv_group_id);
        }
    }

    const spendByCabinet = await loadSpendByCabinet(admin, today, [...spendCabinetIds]);
    const groupCaps = new Map<string, number | null>();
    if (groupIds.length) {
        const { data: groups } = await admin
            .from('cabinet_groups')
            .select('id, adv_daily_budget_cap')
            .in('id', groupIds);
        for (const g of groups || []) {
            const row = g as { id: string; adv_daily_budget_cap: number | null };
            groupCaps.set(row.id, row.adv_daily_budget_cap);
        }
    }
    const spendByGroup = new Map<string, number>();
    for (const [cabId, gid] of cabGroup) {
        if (!gid) continue;
        spendByGroup.set(gid, (spendByGroup.get(gid) || 0) + (spendByCabinet.get(cabId) || 0));
    }

    // оценка между синками — 0 (TODO после Способа A)
    void spendEstimateBetweenSyncs();

    const settled = await Promise.allSettled(list.map((cab) =>
        tickCabinet(admin, cab, {
            dryRun,
            reqPerMin,
            rules: rules.filter((r) => r.campaign.cabinet_id === cab.id),
            clusters,
            positions,
            cabinetExhausted: isCapExhausted(
                spendByCabinet.get(cab.id) || 0,
                cab.adv_daily_budget_cap,
            ),
            groupExhausted: cab.adv_group_id
                ? isCapExhausted(spendByGroup.get(cab.adv_group_id) || 0, groupCaps.get(cab.adv_group_id) ?? null)
                : false,
        })
    ));

    const results = settled.map((row, i) => {
        const cab = list[i];
        if (row.status === 'fulfilled') return { cabinet_id: cab.id, name: cab.name, ...row.value };
        const err = row.reason instanceof Error ? row.reason.message : String(row.reason);
        console.error('[autobidder-tick]', cab.name, err);
        return { cabinet_id: cab.id, name: cab.name, ok: false, error: err };
    });

    return json({
        ok: true,
        dry_run: dryRun,
        date: today,
        cabinets: results.length,
        failed: results.filter((r) => r.ok === false).length,
        results,
    });
});

async function tickCabinet(
    admin: Admin,
    cab: CabinetRow,
    ctxIn: {
        dryRun: boolean;
        reqPerMin: number;
        rules: RuleRow[];
        clusters: ClusterRow[];
        positions: Map<string, number | null>;
        cabinetExhausted: boolean;
        groupExhausted: boolean;
    },
): Promise<Record<string, unknown>> {
    const token = await readAdvTokenFromVault(admin, cab.adv_token_secret_id);
    if (!token) {
        console.error('[autobidder-tick] нет Vault-токена', cab.name);
        return { ok: false, error: 'ADV_TOKEN_MISSING', decisions: [] };
    }

    const adv = makeCtx(admin, cab.id, token, cab.adv_token_secret_id, ctxIn.dryRun, ctxIn.reqPerMin);
    const decisions: Record<string, unknown>[] = [];
    const byCamp = new Map<string, RuleRow[]>();
    for (const rule of ctxIn.rules) {
        const list = byCamp.get(rule.campaign.id) || [];
        list.push(rule);
        byCamp.set(rule.campaign.id, list);
    }

    for (const [campaignId, campRules] of byCamp) {
        const camp = campRules[0].campaign;
        if (!Number(camp.nm_id)) {
            console.warn('[autobidder-tick] skip campaign without nm_id', camp.wb_campaign_id);
            continue;
        }
        const bidsRes = await getBids(adv, {
            items: [{ advert_id: Number(camp.wb_campaign_id), nm_id: Number(camp.nm_id) }],
        });
        if (bidsRes.status === 401 || bidsRes.status === 403) {
            console.error('[autobidder-tick] token invalid', cab.name);
            return {
                ok: false,
                error: 'token_invalid',
                reason: 'token_invalid',
                decisions: [tokenInvalidResult(0)],
            };
        }
        if (bidsRes.status >= 400) {
            console.error('[autobidder-tick] getBids', cab.name, camp.wb_campaign_id, bidsRes.status);
            continue;
        }
        const bidMap = collectBids(bidsRes.data);

        for (const rule of campRules) {
            const targets = resolveClusters(rule, ctxIn.clusters, campaignId);
            for (const cl of targets) {
                const myBid = bidMap.get(normKey(cl.cluster_key)) ?? 0;
                const myPos = getAdPosition(
                    Number(camp.nm_id),
                    cl.cluster_key,
                    ctxIn.positions.has(cl.cluster_key) ? ctxIn.positions.get(cl.cluster_key) : undefined,
                );
                const decided = decideBid({
                    myPos,
                    myBid,
                    targetPosFrom: rule.target_pos_from,
                    targetPosTo: rule.target_pos_to,
                    stepPct: rule.step_pct,
                    hysteresis: rule.hysteresis,
                    minBidFloor: rule.min_bid_floor,
                    maxBid: rule.max_bid,
                    budgetCabinetExhausted: ctxIn.cabinetExhausted,
                    budgetGroupExhausted: ctxIn.groupExhausted,
                });

                const { error: snapErr } = await admin.from('serp_position_snapshots').insert({
                    campaign_id: campaignId,
                    cluster_key: cl.cluster_key,
                    ad_position: myPos,
                    organic_position: null,
                });
                if (snapErr) console.error('[autobidder-tick] snapshot', snapErr.message);

                let applied = false;
                if (decided.apply && !ctxIn.dryRun) {
                    const setRes = await setBids(adv, {
                        bids: [{
                            advertId: Number(camp.wb_campaign_id),
                            nmId: Number(camp.nm_id),
                            normQuery: cl.cluster_key,
                            bid: decided.newBid,
                            bidMinorUnits: decided.newBid * 100,
                        }],
                    });
                    applied = setRes.status < 400;
                    if (!applied) {
                        console.error('[autobidder-tick] setBids', cab.name, cl.cluster_key, setRes.status);
                    }
                    if (setRes.status === 401 || setRes.status === 403) {
                        return { ok: false, error: 'token_invalid', reason: 'token_invalid', decisions };
                    }
                }

                const { error: histErr } = await admin.from('bid_history').insert({
                    rule_id: rule.id,
                    old_bid: myBid,
                    new_bid: decided.newBid,
                    observed_pos: myPos,
                    organic_pos: null,
                    source: 'feedback',
                    reason: decided.reason,
                    applied,
                });
                if (histErr) console.error('[autobidder-tick] bid_history', histErr.message);

                decisions.push({
                    rule_id: rule.id,
                    cluster_key: cl.cluster_key,
                    my_bid: myBid,
                    my_pos: myPos,
                    new_bid: decided.newBid,
                    reason: decided.reason,
                    apply: decided.apply,
                    applied,
                });
            }
        }
    }

    return { ok: true, decisions: decisions.length, items: decisions };
}

function resolveClusters(rule: RuleRow, clusters: ClusterRow[], campaignId: string): ClusterRow[] {
    const mine = clusters.filter((c) => c.campaign_id === campaignId);
    if (rule.cluster_id) {
        const one = mine.find((c) => c.id === rule.cluster_id);
        return one ? [one] : [];
    }
    return mine;
}

function collectBids(data: unknown): Map<string, number> {
    const out = new Map<string, number>();
    const rec = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const list = Array.isArray(data)
        ? data
        : Array.isArray(rec.bids)
            ? rec.bids
            : [];
    for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const key = String(o.norm_query ?? o.normQuery ?? o.normquery ?? o.phrase ?? '').trim();
        if (!key) continue;
        let bid = Number(o.bid);
        if (!Number.isFinite(bid) || bid <= 0) {
            const kop = Number(o.bid_kopecks ?? o.bidMinorUnits);
            if (Number.isFinite(kop) && kop > 0) bid = kop / 100;
        }
        if (Number.isFinite(bid)) out.set(normKey(key), bid);
    }
    return out;
}

function loadSpendByCabinet(admin: Admin, date: string, cabinetIds: string[]): Promise<Map<string, number>> {
    return (async () => {
        const map = new Map<string, number>();
        if (!cabinetIds.length) return map;
        const { data: camps } = await admin
            .from('adv_campaigns')
            .select('id, cabinet_id')
            .in('cabinet_id', cabinetIds);
        const campToCab = new Map<string, string>();
        for (const c of camps || []) {
            campToCab.set(String((c as { id: string }).id), String((c as { cabinet_id: string }).cabinet_id));
        }
        const ids = [...campToCab.keys()];
        if (!ids.length) return map;
        const { data: stats } = await admin
            .from('adv_daily_stats')
            .select('campaign_id, spend')
            .eq('date', date)
            .is('cluster_key', null)
            .in('campaign_id', ids);
        for (const s of stats || []) {
            const row = s as { campaign_id: string; spend: number };
            const cab = campToCab.get(row.campaign_id);
            if (!cab) continue;
            map.set(cab, (map.get(cab) || 0) + Number(row.spend || 0));
        }
        return map;
    })();
}

function unwrapCamp(raw: unknown): RuleRow['campaign'] | null {
    const obj = Array.isArray(raw) ? raw[0] : raw;
    if (!obj || typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    return {
        id: String(o.id),
        cabinet_id: String(o.cabinet_id),
        wb_campaign_id: Number(o.wb_campaign_id),
        nm_id: Number(o.nm_id),
        campaign_type: String(o.campaign_type || ''),
        status: String(o.status || ''),
    };
}

function asPosMap(raw: unknown): Map<string, number | null> {
    const map = new Map<string, number | null>();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v == null || v === '') map.set(k, null);
        else {
            const n = Number(v);
            if (Number.isFinite(n)) map.set(k, n);
        }
    }
    return map;
}

function normKey(s: string): string {
    return s.trim().toLowerCase();
}

function bishkekYmd(): string {
    return new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
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

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
