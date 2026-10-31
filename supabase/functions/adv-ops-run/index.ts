// Отправляет в WB изменения из очереди adv_ops (ставки, товары, новые кампании, завершение, зоны показов).
// Вызывается с сайта сразу после записи (JWT пользователя) и по cron каждую минуту (service_role) — повторы и догон.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { isSuperAdminUser, isTeamMember } from '../_shared/cabinet-access.ts';
import { sanitizeWbToken } from '../_shared/wb-cabinet-tokens.ts';
import {
    type AdvOp, backoffSeconds, coalesceOps, friendlyWbError, isRetryable, MAX_ATTEMPTS, sendBid, sendCreate, sendFinish, sendNms, sendZones, validateOp,
    type WbCallResult,
} from '../_shared/adv-ops.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BUDGET_MS = 100_000;          // дольше не держим: остаток вернётся в очередь и уйдёт со следующим вызовом
const DRY_RUN = (Deno.env.get('ADV_OPS_DRY_RUN') ?? '') === '1';

// WB: ставки 5/сек, список товаров 1/сек, создание кампании 5/мин.
const PAUSE_MS: Record<string, number> = { set_bid: 250, add_nm: 1100, remove_nm: 1100, create: 12500, finish: 250, set_zones: 1100 };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String).filter(Boolean).slice(0, 200) : null;
    let cabinetId: string | null = body.cabinet_id ? String(body.cabinet_id) : null;

    const service = await isServiceAuthorized(req, serviceKey);
    if (!service) {
        const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
        if (!bearer) return json({ error: 'Unauthorized' }, 401);
        const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
        const { data: { user }, error } = await userClient.auth.getUser();
        if (error || !user) return json({ error: 'Invalid session' }, 401);
        if (!cabinetId) return json({ error: 'cabinet_id required' }, 400);
        const all = isSuperAdminUser(user) || await isTeamMember(admin, user.email);
        if (!all) {
            const { data: own } = await admin.from('cabinets').select('id').eq('id', cabinetId).eq('user_id', user.id).maybeSingle();
            if (!own) return json({ error: 'Кабинет не найден или нет доступа' }, 403);
        }
    }

    const started = Date.now();
    const { data: claimed, error: claimErr } = await admin.rpc('adv_ops_claim', { p_cabinet: cabinetId, p_ids: ids, p_limit: 40 });
    if (claimErr) return json({ error: claimErr.message }, 500);
    const ops = (claimed ?? []) as AdvOp[];
    if (!ops.length) return json({ ok: true, claimed: 0 });

    const summary = { done: 0, retry: 0, failed: 0, superseded: 0, deferred: 0 };
    const done = async (o: AdvOp, result: unknown) => {
        await admin.from('adv_ops').update({ status: 'done', done_at: new Date().toISOString(), last_error: null, result }).eq('id', o.id);
        summary.done++;
    };
    const fail = async (o: AdvOp, msg: string, retryable: boolean) => {
        const again = retryable && o.attempts < MAX_ATTEMPTS;
        await admin.from('adv_ops').update(again
            ? { status: 'pending', last_error: msg, next_at: new Date(Date.now() + backoffSeconds(o.attempts) * 1000).toISOString() }
            : { status: 'error', last_error: msg, done_at: new Date().toISOString() }).eq('id', o.id);
        if (again) summary.retry++; else summary.failed++;
    };

    const byCab = new Map<string, AdvOp[]>();
    for (const o of ops) byCab.set(o.cabinet_id, [...(byCab.get(o.cabinet_id) ?? []), o]);

    for (const [cab, list] of byCab) {
        const { run, superseded } = coalesceOps(list);
        for (const o of superseded) { await done(o, { superseded: true }); summary.done--; summary.superseded++; }

        const { data: cabRow } = await admin.from('cabinets').select('wb_token').eq('id', cab).maybeSingle();
        const token = sanitizeWbToken(cabRow?.wb_token);
        for (const o of run) {
            if (Date.now() - started > BUDGET_MS) {
                await admin.from('adv_ops').update({ status: 'pending', attempts: Math.max(0, o.attempts - 1), next_at: new Date().toISOString() }).eq('id', o.id);
                summary.deferred++;
                continue;
            }
            const bad = validateOp(o);
            if (bad) { await fail(o, bad, false); continue; }
            if (!token) { await fail(o, 'Токен WB не задан для кабинета', false); continue; }
            try {
                let r: WbCallResult;
                if (DRY_RUN) r = { ok: true, status: 200, body: 'dry-run', data: { dry: true } };
                else if (o.kind === 'set_bid') r = await sendBid(fetch, token, o);
                else if (o.kind === 'create') r = await sendCreate(fetch, token, o.payload);
                else if (o.kind === 'finish') r = await sendFinish(fetch, token, Number(o.advert_id));
                else if (o.kind === 'set_zones') r = await sendZones(fetch, token, Number(o.advert_id), !!o.payload.search, !!o.payload.recommendations);
                else {
                    const nms = (o.payload.nms as unknown[]).map(Number).filter((n) => n > 0);
                    r = await sendNms(fetch, token, Number(o.advert_id), o.kind === 'add_nm' ? nms : [], o.kind === 'remove_nm' ? nms : []);
                }
                if (!r.ok) { await fail(o, friendlyWbError(r), isRetryable(r)); await sleep(r.status === 429 ? 2000 : PAUSE_MS[o.kind]); continue; }

                if (o.kind === 'create') {
                    const newId = Number(typeof r.data === 'number' ? r.data : (r.data as Record<string, unknown>)?.id ?? 0);
                    await admin.from('adv_ops').update({ advert_id: newId || null }).eq('id', o.id);
                    // стартовая ставка из мастера: ставим отдельными записями, чтобы они ушли тем же путём с повторами
                    const bid = Number(o.payload.bid_kopecks);
                    if (newId && bid >= 100 && String(o.payload.payment_type ?? 'cpm') === 'cpm') {
                        const placement = String(o.payload.bid_type) === 'unified' ? 'combined' : 'search';
                        await admin.from('adv_ops').insert((o.payload.nms as unknown[]).map((nm) => ({
                            cabinet_id: cab, advert_id: newId, kind: 'set_bid', payload: { nm_id: Number(nm), bid_kopecks: bid, placement },
                        })));
                    }
                    await done(o, { advert_id: newId });
                } else {
                    if (o.kind === 'finish' || o.kind === 'set_zones') {
                        // кэш наших кампаний: после «Завершить» кампания больше не попадёт в синхронизацию (она берёт статусы 4, 9, 11)
                        try {
                            const patch = o.kind === 'finish'
                                ? { status: '7', synced_at: new Date().toISOString() }
                                : { placements: { search: !!o.payload.search, recommendations: !!o.payload.recommendations }, synced_at: new Date().toISOString() };
                            const { error: cacheErr } = await admin.from('adv_campaigns').update(patch).eq('cabinet_id', cab).eq('wb_campaign_id', Number(o.advert_id));
                            if (cacheErr) console.warn('[adv-ops-run] adv_campaigns:', cacheErr.message);
                        } catch (e) { console.warn('[adv-ops-run] adv_campaigns:', String(e)); }
                    }
                    if (o.kind === 'set_bid') {
                        try {
                            await admin.from('advertising_campaigns').update({
                                current_bids: [{ nm_id: Number(o.payload.nm_id), bid_kopecks: Number(o.payload.bid_kopecks), placement: String(o.payload.placement ?? 'search') }],
                                updated_at: new Date().toISOString(),
                            }).eq('cabinet_id', cab).eq('campaign_id', Number(o.advert_id));
                        } catch (e) { console.warn('[adv-ops-run] current_bids:', String(e)); }
                    }
                    await done(o, { status: r.status, dry: DRY_RUN || undefined });
                }
            } catch (e) {
                console.error('[adv-ops-run] op failed', JSON.stringify({ id: o.id, kind: o.kind }), e);
                await fail(o, 'Нет связи с WB, повторим сами', true);
            }
            await sleep(PAUSE_MS[o.kind] ?? 300);
        }
    }
    return json({ ok: true, claimed: ops.length, ...summary });
});
