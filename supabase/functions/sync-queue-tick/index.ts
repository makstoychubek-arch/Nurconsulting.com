// Supabase Edge Function: sync-queue-tick
// Воркер очереди загрузки истории (таблица sync_jobs). Запускается pg_cron раз в минуту,
// только service role. Берёт по одной задаче на кабинет (claim_sync_jobs), вызывает
// rnp-finance-sync на окно задачи и записывает результат.
//
// Лимит WB «1 запрос в минуту на токен» держит сам rnp-finance-sync; здесь важно,
// чтобы у одного кабинета в каждый момент работала только одна задача (это гарантирует
// claim_sync_jobs) и чтобы сбой одного окна не останавливал остальные.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { decideOutcome, type SyncPhase, type SyncResult } from '../_shared/sync-queue.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const CALL_TIMEOUT_MS = 140000;
const JOBS_PER_TICK = 2;

type Job = {
    id: string;
    cabinet_id: string;
    period_from: string;
    period_to: string;
    attempts: number;
    phase: SyncPhase;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: claimed, error } = await admin.rpc('claim_sync_jobs', { p_limit: JOBS_PER_TICK });
    if (error) return json({ error: 'claim_failed' }, 500);

    const jobs = (claimed || []) as Job[];
    const results = await Promise.all(jobs.map((job) => runJob(admin, supabaseUrl, serviceKey, job)));
    return json({ ok: true, claimed: jobs.length, results });
});

async function runJob(admin: any, supabaseUrl: string, serviceKey: string, job: Job) {
    let res: SyncResult;
    let callError: string | undefined;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
        const r = await fetch(`${supabaseUrl}/functions/v1/rnp-finance-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
                mode: job.phase === 'storage_status' ? 'status' : 'sync',
                cabinet_id: job.cabinet_id,
                from: job.period_from,
                to: job.period_to,
            }),
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) callError = `http_${r.status}`;
        else res = body?.results?.[0] as SyncResult;
    } catch (e) {
        callError = (e as Error).name === 'AbortError' ? 'timeout' : 'network';
    }

    const out = decideOutcome({ attempts: job.attempts, phase: job.phase }, res, callError);
    const now = new Date();
    if (out.status === 'done') {
        await admin.from('sync_jobs').update({
            status: 'done', phase: out.phase, rows: out.rows, error: null, finished_at: now.toISOString(), claimed_at: null,
        }).eq('id', job.id);
    } else if (out.status === 'queued') {
        await admin.from('sync_jobs').update({
            status: 'queued', phase: out.phase, error: out.error, claimed_at: null,
            next_run_at: new Date(now.getTime() + out.delaySec * 1000).toISOString(),
        }).eq('id', job.id);
    } else {
        await admin.from('sync_jobs').update({
            status: 'error', phase: out.phase, error: out.error, finished_at: now.toISOString(), claimed_at: null,
        }).eq('id', job.id);
    }
    return { id: job.id, window: `${job.period_from}..${job.period_to}`, outcome: out.status };
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
