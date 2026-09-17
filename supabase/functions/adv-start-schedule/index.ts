// adv-start-schedule — каждую минуту.
// Берёт pending из adv_start_schedule, у которых start_at уже наступило,
// и включает РК через GET /adv/v0/start. Сам по себе ничего не стартует,
// пока ряд не due. dry_run в теле — только отчёт, без WB.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    interpretStartHttp,
    parseScheduleDryRun,
    runAdvStartTick,
    type ScheduleRow,
    type TickDeps,
} from '../_shared/adv-start-schedule.ts';
import {
    parseReqPerMin,
    readAdvTokenFromVault,
    start,
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
    const dryRun = parseScheduleDryRun(Deno.env.get('ADV_START_SCHEDULE_DRY_RUN'), body);
    const now = new Date();
    const admin = createClient(supabaseUrl, serviceKey);
    const deps = makeDeps(admin, now, dryRun);

    try {
        const result = await runAdvStartTick(deps);
        return json({ ok: true, ...result });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[adv-start-schedule]', msg);
        return json({ error: msg }, 500);
    }
});

function makeDeps(admin: Admin, now: Date, dryRun: boolean): TickDeps {
    const iso = now.toISOString();
    return {
        now,
        dryRun,
        async listDue() {
            const { data, error } = await admin
                .from('adv_start_schedule')
                .select('id, cabinet_id, campaign_id, campaign_name, start_at, status')
                .eq('status', 'pending')
                .lte('start_at', iso)
                .order('start_at', { ascending: true })
                .limit(40);
            if (error) throw new Error(error.message);
            return (data || []) as ScheduleRow[];
        },
        async claim(id) {
            const { data, error } = await admin
                .from('adv_start_schedule')
                .update({ status: 'running', started_at: iso })
                .eq('id', id)
                .eq('status', 'pending')
                .select('id')
                .maybeSingle();
            if (error) throw new Error(error.message);
            return !!data;
        },
        async finish(id, status, errorText) {
            const { error } = await admin.from('adv_start_schedule').update({
                status,
                error_text: errorText || null,
                finished_at: iso,
            }).eq('id', id);
            if (error) throw new Error(error.message);
        },
        async release(id) {
            const { error } = await admin.from('adv_start_schedule').update({
                status: 'pending',
                started_at: null,
                error_text: 'WB 429 — вернём в очередь',
            }).eq('id', id);
            if (error) throw new Error(error.message);
        },
        async loadToken(cabinetId) {
            const { data, error } = await admin
                .from('cabinets')
                .select('id, adv_token_secret_id')
                .eq('id', cabinetId)
                .maybeSingle();
            if (error) throw new Error(error.message);
            if (!data?.adv_token_secret_id) return null;
            return readAdvTokenFromVault(admin, data.adv_token_secret_id);
        },
        async startAdvert(token, advertId, cabinetId) {
            const ctx = makeStartCtx(admin, cabinetId, token);
            const res = await start(ctx, { id: advertId });
            return interpretStartHttp(res.status, res.data);
        },
        async markCampaignLive(cabinetId, advertId) {
            await admin.from('advertising_campaigns').update({
                status: 9,
                updated_at: iso,
            }).eq('cabinet_id', cabinetId).eq('campaign_id', advertId);
        },
    };
}

function makeStartCtx(admin: Admin, cabinetId: string, token: string): AdvCallContext {
    return {
        cabinetId,
        token,
        tokenKey: cabinetId,
        dryRun: false,
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

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
