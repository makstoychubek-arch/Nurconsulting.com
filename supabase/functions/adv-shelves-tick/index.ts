// adv-shelves-tick: каждые 5 минут. Для включённых кампаний «Полки» исключает поисковые фразы (минус-фразы),
// чтобы показы шли только на рекомендательных полках. Пробный режим (dry_run_until) только пишет «исключил бы».
// set-minus в WB перезаписывает весь список: читаем текущие минус-фразы и дописываем к ним.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    getAdverts, getMinus, listClusters, readAdvTokenFromVault, setMinus, type AdvCallContext,
} from '../_shared/wb-adv-proxy.ts';
import {
    buildClusterItemsBody, buildClusterListBody, buildMinusBody, nmIdsFromAdvert, parseClusterList, parseMinusList,
} from '../_shared/wb-cluster-board.ts';
import { isDryRun, isDue, phrasesToExclude } from '../_shared/adv-shelves.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const body = await req.json().catch(() => ({}));
    const onlyAdvert = Number(body?.advert_id || 0);
    const force = body?.force === true;
    const now = Date.now();

    let q = admin.from('adv_shelves').select('*').eq('enabled', true);
    if (onlyAdvert) q = q.eq('advert_id', onlyAdvert);
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);
    const due = (rows || []).filter((r: Record<string, unknown>) => force || isDue(r.last_run_at as string, Number(r.interval_min) || 10, now));
    if (!due.length) return json({ ok: true, due: 0 });

    const byCab = new Map<string, Record<string, unknown>[]>();
    for (const r of due) {
        const list = byCab.get(String(r.cabinet_id)) || [];
        list.push(r);
        byCab.set(String(r.cabinet_id), list);
    }

    const results: Record<string, unknown>[] = [];
    for (const [cabId, list] of byCab) {
        const { data: cab } = await admin.from('cabinets').select('id, name, adv_token_secret_id').eq('id', cabId).maybeSingle();
        const token = await readAdvTokenFromVault(admin, cab?.adv_token_secret_id);
        if (!token) {
            for (const r of list) await mark(admin, r.id as string, 'no_token', 'Нет рекламного токена кабинета');
            results.push({ cabinet: cab?.name, error: 'ADV_TOKEN_MISSING' });
            continue;
        }
        const ctx: AdvCallContext = {
            cabinetId: cabId, token, tokenKey: String(cab?.adv_token_secret_id), dryRun: false, reqPerMin: 120, fetchFn: fetch,
            onAuthFailure: async () => {
                await admin.from('cabinets').update({ adv_token_valid: false, adv_token_checked_at: new Date().toISOString() }).eq('id', cabId);
            },
        };
        for (const r of list) {
            try {
                results.push(await runOne(admin, ctx, r, now));
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                await mark(admin, r.id as string, 'error', msg.slice(0, 300));
                results.push({ advert_id: r.advert_id, error: msg });
            }
        }
    }
    return json({ ok: true, due: due.length, results });
});

async function runOne(admin: ReturnType<typeof createClient>, ctx: AdvCallContext, r: Record<string, unknown>, now: number) {
    const advertId = Number(r.advert_id);
    const adv = await getAdverts(ctx, { ids: String(advertId) });
    if (adv.status >= 400) throw new Error(`adverts ${adv.status}`);
    const raw = adv.data as { adverts?: unknown[] } | unknown[];
    const list = Array.isArray(raw) ? raw : (raw?.adverts || []);
    const nmIds = nmIdsFromAdvert(list.find((a) => Number((a as Record<string, unknown>)?.id ?? (a as Record<string, unknown>)?.advertId) === advertId) || list[0]);
    if (!nmIds.length) throw new Error('В кампании нет товаров');

    const cl = await listClusters(ctx, buildClusterListBody(advertId, nmIds));
    if (cl.status >= 400) throw new Error(`normquery/list ${cl.status}`);
    const clusters = parseClusterList(cl.data);
    const mn = await getMinus(ctx, buildClusterItemsBody(advertId, nmIds));
    if (mn.status >= 400) throw new Error(`get-minus ${mn.status}`);
    const minus = parseMinusList(mn.data);

    const dry = isDryRun(r.dry_run_until as string, now);
    const keep = (r.keep_phrases as string[]) || [];
    let total = 0;
    const logRows: Record<string, unknown>[] = [];
    for (const nmId of nmIds) {
        const c = clusters.get(nmId) || { active: [], excluded: [], archived: [] };
        const have = minus.get(nmId) || [];
        const add = phrasesToExclude(c.active, c.excluded, keep, have);
        if (!add.length) continue;
        if (!dry) {
            const res = await setMinus(ctx, buildMinusBody(advertId, nmId, [...have, ...add]));
            if (res.status >= 400) throw new Error(`set-minus ${res.status}`);
        }
        total += add.length;
        for (const phrase of add) {
            logRows.push({ cabinet_id: r.cabinet_id, advert_id: advertId, nm_id: nmId, phrase, action: dry ? 'would_exclude' : 'exclude' });
        }
    }
    if (logRows.length) await admin.from('adv_shelves_log').insert(logRows);
    await admin.from('adv_shelves').update({
        last_run_at: new Date().toISOString(),
        last_status: dry ? 'dry' : 'ok',
        last_error: null,
        excluded_total: Number(r.excluded_total || 0) + (dry ? 0 : total),
        updated_at: new Date().toISOString(),
    }).eq('id', r.id as string);
    return { advert_id: advertId, nm: nmIds.length, found: total, dry };
}

async function mark(admin: ReturnType<typeof createClient>, id: string, status: string, err: string) {
    await admin.from('adv_shelves').update({ last_run_at: new Date().toISOString(), last_status: status, last_error: err }).eq('id', id);
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
