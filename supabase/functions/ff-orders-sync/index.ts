import '../_shared/wb-user-agent.ts';
// Supabase Edge Function: ff-orders-sync
// Раз в час забирает у WB заказы FBS (marketplace-api /api/v3/orders, не старше 30 дней) с номером склада продавца
// и сохраняет в fbs_orders: какой склад (ФФ, например «АМАН ФФ 3») собирал каждый заказ. По ним дашборд точно
// относит отправки и штрафы (подмена, отмена) на конкретный ФФ. Только service role (pg_cron / ручной запуск).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { toFbsOrderRows } from '../_shared/fbs-orders.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MARKET_API = 'https://marketplace-api.wildberries.ru';
const WINDOW_DAYS = 30;       // WB отдаёт заказы не дальше чем за 30 дней
const PAGE = 1000;
const MAX_PAGES = 60;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
type Cab = { id: string; name: string; wb_token: string };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    let only: string | null = null;
    try { only = (await req.json())?.cabinet_id ?? null; } catch { /* пустое тело */ }
    const work = run(admin, only).catch((e) => console.warn('[ff-orders-sync]', (e as Error).message));
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;
    return json({ ok: true });
});

async function run(admin: any, only: string | null) {
    // Только кабинеты, где есть остатки на складах продавца (FBS).
    const { data: stocks } = await admin.from('wb_stocks').select('cabinet_id').eq('stock_scheme', 'fbs').gt('quantity', 0).limit(5000);
    const ids = [...new Set(((stocks || []) as { cabinet_id: string }[]).map((s) => s.cabinet_id))].filter((id) => !only || id === only);
    if (!ids.length) return;
    const { data: cabs } = await admin.from('cabinets').select('id, name, wb_token').in('id', ids).not('wb_token', 'is', null);
    for (const cab of ((cabs || []) as Cab[]).filter((c) => sanitize(c.wb_token).length > 50)) {
        await syncCabinet(admin, cab).catch((e) => console.warn('[ff-orders-sync]', cab.name, (e as Error).message));
    }
}

async function syncCabinet(admin: any, cab: Cab) {
    const token = sanitize(cab.wb_token);
    const whRes = await fetch(`${MARKET_API}/api/v3/warehouses`, { headers: { Authorization: token } });
    if (!whRes.ok) throw new Error(`warehouses HTTP ${whRes.status}`);
    const wh = await whRes.json().catch(() => []);
    const names = new Map<number, string>();
    for (const w of Array.isArray(wh) ? wh : []) if (Number(w?.id) > 0 && w?.name) names.set(Number(w.id), String(w.name));

    const now = Math.floor(Date.now() / 1000);
    const dateTo = now;
    const dateFrom = now - WINDOW_DAYS * 86400;
    let next = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
        const url = `${MARKET_API}/api/v3/orders?limit=${PAGE}&next=${next}&dateFrom=${dateFrom}&dateTo=${dateTo}`;
        const res = await fetch(url, { headers: { Authorization: token } });
        if (res.status === 429) { await sleep(1500); page--; continue; }
        if (!res.ok) throw new Error(`orders HTTP ${res.status}`);
        const payload = await res.json().catch(() => null);
        const orders = Array.isArray(payload?.orders) ? payload.orders : [];
        if (!orders.length) break;
        const rows = toFbsOrderRows(cab.id, orders, names);
        for (let i = 0; i < rows.length; i += 500) {
            const { error } = await admin.from('fbs_orders').upsert(rows.slice(i, i + 500), { onConflict: 'cabinet_id,order_id' });
            if (error) throw new Error(error.message);
        }
        next = Number(payload?.next) || 0;
        if (!next) break;
        await sleep(250);
    }
}

function sanitize(raw: unknown): string {
    return typeof raw === 'string' ? raw.replace(/^﻿/, '').replace(/\s+/g, '').trim() : '';
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
