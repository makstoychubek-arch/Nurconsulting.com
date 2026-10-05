// Supabase Edge Function: orders-rescan
// pg_cron раз в 10 минут (только service role). На каждый кабинет — один запрос заказов WB за день из окна
// последних 30 дней: недостающие заказы добавляются (upsert по srid), ничего не удаляется.
// Лимит WB statistics — 1 запрос в минуту на токен, поэтому один день за вызов; 429 — просто ждём следующий вызов.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { orderPriceWithDisc } from '../_shared/wb-order-price.ts';
import { nextRescanDay, rescanRows } from '../_shared/orders-rescan.ts';

const WB_STATS = 'https://statistics-api.wildberries.ru';
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function moscowYmd(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const clean = (raw: unknown) => (typeof raw === 'string' ? raw.replace(/^﻿/, '').replace(/\s+/g, '').trim() : '');

Deno.serve(async (req) => {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, key)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const admin = createClient(url, key);
    const work = run(admin).catch((e) => console.warn('[orders-rescan]', (e as Error).message));
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});

async function run(admin: any) {
    const { data: cabs } = await admin.from('cabinets').select('id, name, wb_token, orders_rescan_to').not('wb_token', 'is', null).gt('wb_token', '');
    const today = moscowYmd();
    for (const cab of cabs || []) {
        const token = clean(cab.wb_token);
        if (token.length < 50) continue;
        const { day, next } = nextRescanDay(today, cab.orders_rescan_to ? String(cab.orders_rescan_to) : null);
        try {
            const res = await fetch(`${WB_STATS}/api/v1/supplier/orders?dateFrom=${day}&flag=1`, { headers: { Authorization: token } });
            if (!res.ok) continue; // 429 и прочее — повторим на следующем вызове, курсор не двигаем
            const js = await res.json().catch(() => null);
            if (!Array.isArray(js)) continue;
            const rows = rescanRows(cab.id, day, js, orderPriceWithDisc);
            for (let i = 0; i < rows.length; i += 500) {
                const { error } = await admin.from('wb_orders').upsert(rows.slice(i, i + 500), { onConflict: 'cabinet_id,srid' });
                if (error) throw new Error(`upsert ${day}: ${error.message}`);
            }
            await admin.from('cabinets').update({ orders_rescan_to: next }).eq('id', cab.id);
        } catch (e) {
            console.warn('[orders-rescan]', cab.name, day, (e as Error).message);
        }
    }
}
