// Автобиддер WB: поднимает/опускает ставку аукциона к целевой метрике.
// Бюджет не пополняет — только PATCH /adv/v1/bids.
// Auth: service_role (pg_cron по всем правилам) или user JWT + cabinet_id.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isTeamMember } from '../_shared/cabinet-access.ts';
import {
    collectNmIds,
    extractBidsFromAdvert,
    fetchAdvertById,
    fetchMinBids,
    setAdvertBids,
    type BidPlacement,
    type ExtractedBid,
} from '../_shared/wb-advert-bids.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
const STATS_DAYS = 3;
const DEADBAND = 0.10;
const SPEND_NO_ORDERS_RUB = 300;

type Rule = {
    id: string;
    cabinet_id: string;
    campaign_id: number;
    enabled: boolean;
    target_metric: 'drr' | 'ctr' | 'cpc';
    target_value: number;
    min_bid_kopecks: number;
    max_bid_kopecks: number;
    step_kopecks: number;
    interval_minutes: number;
    last_run_at: string | null;
};

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
    const isServiceRole = bearer === serviceKey;
    let userId: string | null = null;
    let isSuperAdmin = false;

    if (!isServiceRole) {
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${bearer}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);
        userId = user.id;
        isSuperAdmin =
            String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL ||
            user.id === SUPER_ADMIN_ID ||
            await isTeamMember(admin, user.email);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const targetCabinetId = body.cabinet_id ? String(body.cabinet_id) : null;
    const targetCampaignId = body.campaign_id != null ? Number(body.campaign_id) : null;
    const force = Boolean(body.force);

    if (!isServiceRole && !targetCabinetId) {
        return json({ error: 'cabinet_id required' }, 400);
    }

    if (!isServiceRole && targetCabinetId && !isSuperAdmin) {
        const { data: owned } = await admin
            .from('cabinets')
            .select('id')
            .eq('id', targetCabinetId)
            .eq('user_id', userId!)
            .maybeSingle();
        if (!owned) return json({ error: 'Cabinet not found or access denied' }, 403);
    }

    let rulesQuery = admin.from('autobidder_rules').select('*');
    if (!(force && targetCampaignId)) rulesQuery = rulesQuery.eq('enabled', true);
    if (targetCabinetId) rulesQuery = rulesQuery.eq('cabinet_id', targetCabinetId);
    if (targetCampaignId) rulesQuery = rulesQuery.eq('campaign_id', targetCampaignId);
    const { data: rules, error: rulesErr } = await rulesQuery;
    if (rulesErr) return json({ error: rulesErr.message }, 500);

    const due = ((rules || []) as Rule[]).filter((r) => force || isDue(r));
    const cabinetIds = [...new Set(due.map((r) => r.cabinet_id))];
    const cabMap = new Map<string, { id: string; name: string; wb_token: string }>();
    if (cabinetIds.length) {
        const { data: cabs } = await admin
            .from('cabinets')
            .select('id, name, wb_token')
            .in('id', cabinetIds);
        for (const c of cabs || []) {
            const token = sanitizeWbToken(c.wb_token);
            if (token) cabMap.set(c.id, { id: c.id, name: c.name, wb_token: token });
        }
    }

    const results: Array<Record<string, unknown>> = [];
    for (const rule of due) {
        const cab = cabMap.get(rule.cabinet_id);
        if (!cab) {
            results.push({ rule_id: rule.id, status: 'skipped', reason: 'no_token' });
            continue;
        }
        try {
            const result = await runRule(admin, cab.wb_token, rule);
            results.push({ rule_id: rule.id, campaign_id: rule.campaign_id, ...result });
        } catch (e) {
            const msg = (e as Error).message;
            await admin.from('autobidder_rules').update({
                last_run_at: new Date().toISOString(),
                last_error: msg.slice(0, 400),
                updated_at: new Date().toISOString(),
            }).eq('id', rule.id);
            results.push({ rule_id: rule.id, campaign_id: rule.campaign_id, status: 'error', error: msg });
        }
        await sleep(280);
    }

    return json({
        ok: true,
        processed: results.length,
        skipped_not_due: (rules || []).length - due.length,
        total_ms: Date.now() - started,
        results,
    });
});

function isDue(rule: Rule): boolean {
    if (!rule.last_run_at) return true;
    const elapsed = Date.now() - new Date(rule.last_run_at).getTime();
    return elapsed >= Math.max(15, Number(rule.interval_minutes) || 60) * 60_000;
}

async function runRule(
    admin: ReturnType<typeof createClient>,
    token: string,
    rule: Rule,
): Promise<Record<string, unknown>> {
    const { data: camp } = await admin
        .from('advertising_campaigns')
        .select('status, campaign_name, bid_type, current_bids')
        .eq('cabinet_id', rule.cabinet_id)
        .eq('campaign_id', rule.campaign_id)
        .maybeSingle();

    if (camp && Number(camp.status) === 11) {
        await finishRule(admin, rule, null, 'paused');
        return { status: 'skipped', reason: 'paused' };
    }

    const stats = await loadStats(admin, rule.cabinet_id, rule.campaign_id);
    if (!stats) {
        await finishRule(admin, rule, null, 'no_stats');
        return { status: 'skipped', reason: 'no_stats' };
    }

    const decision = decide(rule, stats);
    const advert = await fetchAdvertById(token, Number(rule.campaign_id));
    let bids = extractBidsFromAdvert(advert);
    const bidType = String(advert?.bid_type ?? advert?.bidType ?? camp?.bid_type ?? '').toLowerCase();
    const placement: BidPlacement = bidType === 'manual' ? 'search' : 'combined';

    if (!bids.length) {
        const nms = collectNmIds(advert, []);
        const mins = await fetchMinBids(token, Number(rule.campaign_id), nms, placement);
        bids = mins;
    }
    if (!bids.length) {
        await finishRule(admin, rule, 'no_bids', 'Не удалось прочитать текущие ставки WB');
        return { status: 'error', error: 'no_bids' };
    }

    if (decision.direction === 0) {
        await persistBids(admin, rule, bids);
        await finishRule(admin, rule, null, decision.reason);
        await logAction(admin, rule, 'hold', decision, bids[0]?.bid_kopecks ?? null, bids[0]?.bid_kopecks ?? null, {
            stats,
            bids_count: bids.length,
        });
        return { status: 'hold', reason: decision.reason, metric: decision.metricValue };
    }

    const oldBid = bids[0].bid_kopecks;
    const next = clamp(
        oldBid + decision.direction * Number(rule.step_kopecks),
        Number(rule.min_bid_kopecks),
        Number(rule.max_bid_kopecks),
    );
    if (next === oldBid) {
        await persistBids(admin, rule, bids);
        await finishRule(admin, rule, null, 'clamped');
        return { status: 'hold', reason: 'clamped', old_bid: oldBid };
    }

    const nextBids: ExtractedBid[] = bids.map((b) => ({ ...b, bid_kopecks: next }));
    const setRes = await setAdvertBids(token, Number(rule.campaign_id), nextBids);
    if (!setRes.ok) {
        await finishRule(admin, rule, setRes.body || `WB ${setRes.status}`, 'set_failed');
        return { status: 'error', error: setRes.body || `WB ${setRes.status}` };
    }

    await persistBids(admin, rule, nextBids);
    await finishRule(admin, rule, null, null);
    await logAction(admin, rule, decision.direction > 0 ? 'up' : 'down', decision, oldBid, next, {
        stats,
        wb_status: setRes.status,
    });
    return {
        status: 'ok',
        action: decision.direction > 0 ? 'up' : 'down',
        reason: decision.reason,
        metric: decision.metricValue,
        old_bid_kopecks: oldBid,
        new_bid_kopecks: next,
    };
}

async function loadStats(admin: ReturnType<typeof createClient>, cabinetId: string, campaignId: number) {
    const from = new Date();
    from.setDate(from.getDate() - (STATS_DAYS - 1));
    const dateFrom = from.toISOString().split('T')[0];
    const { data } = await admin
        .from('advertising_daily_stats')
        .select('spend, clicks, views, orders, sum_price')
        .eq('cabinet_id', cabinetId)
        .eq('campaign_id', campaignId)
        .gte('stat_date', dateFrom);
    const rows = data || [];
    if (!rows.length) return null;
    const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0);
    const clicks = rows.reduce((s, r) => s + Number(r.clicks || 0), 0);
    const views = rows.reduce((s, r) => s + Number(r.views || 0), 0);
    const orders = rows.reduce((s, r) => s + Number(r.orders || 0), 0);
    const revenue = rows.reduce((s, r) => s + Number(r.sum_price || 0), 0);
    return { spend, clicks, views, orders, revenue, days: rows.length };
}

function decide(rule: Rule, stats: { spend: number; clicks: number; views: number; orders: number; revenue: number }) {
    const target = Number(rule.target_value);
    const drr = stats.revenue > 0 ? (stats.spend / stats.revenue) * 100 : (stats.spend > 0 ? 999 : 0);
    const cpc = stats.clicks > 0 ? stats.spend / stats.clicks : 0;
    const ctr = stats.views > 0 ? (stats.clicks / stats.views) * 100 : 0;

    if (rule.target_metric === 'drr') {
        if (stats.spend >= SPEND_NO_ORDERS_RUB && stats.orders === 0) {
            return { direction: -1 as const, reason: 'spend_no_orders', metricValue: drr };
        }
        if (drr > target * (1 + DEADBAND)) return { direction: -1 as const, reason: 'drr_high', metricValue: drr };
        if (drr < target * (1 - DEADBAND) && stats.orders > 0) {
            return { direction: 1 as const, reason: 'drr_low', metricValue: drr };
        }
        return { direction: 0 as const, reason: 'drr_ok', metricValue: drr };
    }
    if (rule.target_metric === 'cpc') {
        if (cpc > target * (1 + DEADBAND)) return { direction: -1 as const, reason: 'cpc_high', metricValue: cpc };
        if (cpc > 0 && cpc < target * (1 - DEADBAND)) return { direction: 1 as const, reason: 'cpc_low', metricValue: cpc };
        return { direction: 0 as const, reason: 'cpc_ok', metricValue: cpc };
    }
    if (ctr > 0 && ctr < target * (1 - DEADBAND)) return { direction: 1 as const, reason: 'ctr_low', metricValue: ctr };
    if (ctr > target * (1 + DEADBAND)) return { direction: -1 as const, reason: 'ctr_high', metricValue: ctr };
    return { direction: 0 as const, reason: 'ctr_ok', metricValue: ctr };
}

async function persistBids(admin: ReturnType<typeof createClient>, rule: Rule, bids: ExtractedBid[]) {
    await admin.from('advertising_campaigns').update({
        current_bids: bids,
        updated_at: new Date().toISOString(),
    }).eq('cabinet_id', rule.cabinet_id).eq('campaign_id', rule.campaign_id);
}

async function finishRule(admin: ReturnType<typeof createClient>, rule: Rule, error: string | null, _reason: string | null) {
    await admin.from('autobidder_rules').update({
        last_run_at: new Date().toISOString(),
        last_error: error,
        updated_at: new Date().toISOString(),
    }).eq('id', rule.id);
}

async function logAction(
    admin: ReturnType<typeof createClient>,
    rule: Rule,
    action: string,
    decision: { reason: string; metricValue: number | null },
    oldBid: number | null,
    newBid: number | null,
    details: Record<string, unknown>,
) {
    await admin.from('autobidder_log').insert({
        cabinet_id: rule.cabinet_id,
        campaign_id: rule.campaign_id,
        rule_id: rule.id,
        action,
        metric: rule.target_metric,
        metric_value: decision.metricValue,
        target_value: rule.target_value,
        old_bid_kopecks: oldBid,
        new_bid_kopecks: newBid,
        details: { reason: decision.reason, ...details },
    });
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
