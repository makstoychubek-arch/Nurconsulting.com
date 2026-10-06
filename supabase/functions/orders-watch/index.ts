// Supabase Edge Function: orders-watch
// Следит за новыми заказами FBS у кабинетов команды и пишет их в order_events (по ним сайт играет звук).
// Запускается pg_cron раз в минуту, только service role. Отвечает сразу (pg_net ждёт 5 с), а внутри
// в фоне опрашивает WB несколько раз за минуту (каждые POLL_EVERY_MS), поэтому от заказа на WB до события
// проходит в среднем 7–10 секунд. Метод WB /api/v3/orders/new отдаёт заказы, которые ещё не собраны.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { toOrderEventRows } from '../_shared/order-events.ts';
import { filterFeatureActive, recordFeatureRun } from '../_shared/cabinet-features.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MARKET_API = 'https://marketplace-api.wildberries.ru';
const POLLS_PER_RUN = 5;
const POLL_EVERY_MS = 12000;
const KEEP_DAYS = 7;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

type Cab = { id: string; name: string; wb_token: string };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const work = run(admin).catch(() => undefined);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;
    return json({ ok: true });
});

async function run(admin: any) {
    const { data: cabs } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .not('wb_token', 'is', null)
        .gt('wb_token', '')
        .eq('nr_managed', true); // только кабинеты команды
    const withToken = ((cabs || []) as Cab[]).filter((c) => sanitize(c.wb_token).length > 50);
    // Тумблер «Уведомления о заказах».
    const list = await filterFeatureActive(admin, withToken, 'order_alerts');
    if (!list.length) return;

    // Чистим старое раз за запуск.
    await admin.from('order_events').delete().lt('created_at', new Date(Date.now() - KEEP_DAYS * 86400000).toISOString());

    for (let i = 0; i < POLLS_PER_RUN; i++) {
        await Promise.all(list.map((c) => pollCabinet(admin, c).catch(() => undefined)));
        if (i < POLLS_PER_RUN - 1) await sleep(POLL_EVERY_MS);
    }
}

async function pollCabinet(admin: any, cab: Cab) {
    const res = await fetch(`${MARKET_API}/api/v3/orders/new`, { headers: { Authorization: sanitize(cab.wb_token) } });
    if (!res.ok) {
        // нет права «Маркетплейс» или лимит: пропускаем, повторим через интервал; причину видно в настройках кабинета
        await recordFeatureRun(admin, cab.id, 'order_alerts', 'error', res.status === 401 || res.status === 403 ? 'Токен WB без права «Маркетплейс» или недействителен' : `WB ответил ${res.status}`);
        return;
    }
    const payload = await res.json().catch(() => null);

    // Заказы, что уже висели в «новых» (первый опрос кабинета, сбой связи), пишутся без звука: см. FRESH_ORDER_MS.
    const rows = toOrderEventRows(cab.id, payload);
    if (!rows.length) return;
    await admin.from('order_events').upsert(rows, { onConflict: 'cabinet_id,ext_id', ignoreDuplicates: true });
}

function sanitize(raw: unknown): string {
    return typeof raw === 'string' ? raw.replace(/^﻿/, '').replace(/\s+/g, '').trim() : '';
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
