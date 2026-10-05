// Supabase Edge Function: orders-rescan
// pg_cron раз в 10 минут (только service role). На каждый кабинет — один запрос заказов WB за день из окна
// последних 30 дней: недостающие заказы добавляются (upsert по srid), ничего не удаляется.
// Лимит WB statistics — 1 запрос в минуту на токен, поэтому один день за вызов; 429 — просто ждём следующий вызов.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { orderPriceWithDisc } from '../_shared/wb-order-price.ts';
import {
    FUNNEL_START_BACK, FUNNEL_WINDOW_DAYS, funnelRowsFromProducts, nextRescanDay, rescanRows,
} from '../_shared/orders-rescan.ts';

const WB_STATS = 'https://statistics-api.wildberries.ru';
const WB_ANALYTICS = 'https://seller-analytics-api.wildberries.ru';
// Дней воронки за вызов (лимит analytics — несколько запросов в минуту; между запросами пауза).
const FUNNEL_DAYS_PER_RUN = 4;
const FUNNEL_GAP_MS = 21000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
    const { data: cabs } = await admin.from('cabinets').select('id, name, wb_token, orders_rescan_to, funnel_rescan_to').not('wb_token', 'is', null).gt('wb_token', '');
    const today = moscowYmd();
    // Воронка идёт параллельно по кабинетам (у каждого свой токен и свой лимит), статистика — по очереди.
    const funnelJobs = (cabs || []).map((cab: any) => funnelRescan(admin, cab, today).catch((e) =>
        console.warn('[orders-rescan funnel]', cab.name, (e as Error).message)));
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
    await Promise.all(funnelJobs);
}

async function funnelRescan(admin: any, cab: any, today: string) {
    const token = clean(cab.wb_token);
    if (token.length < 50) return;
    const { data: arts } = await admin.from('rnp_articles').select('nm_id').eq('cabinet_id', cab.id);
    const allowed = new Set<number>((arts || []).map((a: any) => Number(a.nm_id)).filter((n: number) => n > 0));
    if (!allowed.size) return;
    let cursor: string | null = cab.funnel_rescan_to ? String(cab.funnel_rescan_to) : null;
    for (let i = 0; i < FUNNEL_DAYS_PER_RUN; i++) {
        if (i > 0) await sleep(FUNNEL_GAP_MS);
        // Сегодня/вчера и последние 7 дней обновляет auto-sync (history); здесь — дни глубже.
        const { day, next } = nextRescanDay(today, cursor, FUNNEL_START_BACK + 6, FUNNEL_WINDOW_DAYS);
        const products: any[] = [];
        let offset = 0;
        let ok = true;
        for (;;) {
            const res = await fetch(`${WB_ANALYTICS}/api/analytics/v3/sales-funnel/products`, {
                method: 'POST',
                headers: { Authorization: token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedPeriod: { start: day, end: day }, skipDeletedNm: true, limit: 1000, offset }),
            });
            if (!res.ok) { ok = false; break; }
            const js = await res.json().catch(() => null);
            const page: any[] = js?.data?.products || js?.products || [];
            products.push(...page);
            if (page.length < 1000) break;
            offset += 1000;
            await sleep(FUNNEL_GAP_MS);
        }
        if (!ok) return; // 429/ошибка — повторим на следующем вызове, курсор не двигаем
        const rows = funnelRowsFromProducts(cab.id, day, products, allowed);
        for (let k = 0; k < rows.length; k += 200) {
            const { error } = await admin.from('rnp_daily_data').upsert(rows.slice(k, k + 200), { onConflict: 'cabinet_id,nm_id,date' });
            if (error) throw new Error(`funnel upsert ${day}: ${error.message}`);
        }
        await admin.from('cabinets').update({ funnel_rescan_to: next }).eq('id', cab.id);
        cursor = next;
    }
}
