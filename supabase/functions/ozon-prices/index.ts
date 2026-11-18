// ozon-prices: смена цен Ozon по артикулам (offer_id). Вызывает сайт от имени пользователя; пишет только владелец кабинета и команда.
//   { cabinet_id, items: [{ offer_id, price }] } — до 200 позиций за вызов.
// Ключи Ozon берутся из кабинета на сервере. Перед отправкой каждая цена проверяется (checkNewPrice), зачёркнутая цена и
// ограничение для акций подстраиваются (buildPriceItem). После успеха цены обновляются и в ozon_products, чтобы сайт показал новое сразу.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ozonCall, OzonError, type FetchFn, type OzonCreds } from '../_shared/ozon-api.ts';
import { buildPriceItem, checkNewPrice, type PriceRow } from '../_shared/ozon-prices.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fetchFn: FetchFn = (url, init) => fetch(url, init);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Invalid session' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const cabinetId = String(body.cabinet_id || '');
    if (!/^[0-9a-fA-F-]{36}$/.test(cabinetId)) return json({ error: 'cabinet_id required' }, 400);
    const items = Array.isArray(body.items) ? body.items as { offer_id: string; price: number }[] : [];
    if (!items.length || items.length > 200) return json({ error: 'items: от 1 до 200 позиций' }, 400);

    const admin = createClient(url, service);
    const { data: cab } = await admin.from('cabinets').select('user_id, ozon_client_id, ozon_api_key').eq('id', cabinetId).maybeSingle();
    // Запись цен: только владелец кабинета и команда.
    const { data: staff } = await admin.from('team_staff').select('email').eq('email', String(user.email || '').toLowerCase()).maybeSingle();
    if (cab?.user_id !== user.id && !staff) return json({ error: 'Нет доступа к кабинету' }, 403);
    if (!cab?.ozon_client_id || !cab?.ozon_api_key) return json({ error: 'В кабинете не подключён Ozon' }, 400);
    const creds: OzonCreds = { clientId: String(cab.ozon_client_id), apiKey: String(cab.ozon_api_key) };

    const ids = items.map((i) => String(i.offer_id));
    const { data: rows } = await admin.from('ozon_products').select('offer_id, price, old_price, min_price, currency').eq('cabinet_id', cabinetId).in('offer_id', ids);
    const rowBy = new Map((rows || []).map((r: PriceRow) => [r.offer_id, r]));

    const results: { offer_id: string; ok: boolean; error?: string }[] = [];
    const send: ReturnType<typeof buildPriceItem>[] = [];
    for (const it of items) {
        const row = rowBy.get(String(it.offer_id));
        if (!row) { results.push({ offer_id: String(it.offer_id), ok: false, error: 'товара нет в каталоге Ozon кабинета' }); continue; }
        const bad = checkNewPrice(row.price, Number(it.price));
        if (bad) { results.push({ offer_id: row.offer_id, ok: false, error: bad }); continue; }
        send.push(buildPriceItem(row, Number(it.price)));
    }

    for (let i = 0; i < send.length; i += 15) {
        const chunk = send.slice(i, i + 15);
        try {
            const r = await ozonCall(creds, '/v1/product/import/prices', { prices: chunk }, fetchFn);
            for (const p of ((r.result as Record<string, unknown>[]) || [])) {
                const offer = String(p.offer_id);
                if (p.updated) {
                    results.push({ offer_id: offer, ok: true });
                    const sent = chunk.find((c) => c.offer_id === offer);
                    if (sent) await admin.from('ozon_products').update({ price: Number(sent.price), old_price: Number(sent.old_price) || null, min_price: sent.min_price ? Number(sent.min_price) : null, updated_at: new Date().toISOString() }).eq('cabinet_id', cabinetId).eq('offer_id', offer);
                } else {
                    const errs = (Array.isArray(p.errors) ? p.errors : []) as Record<string, unknown>[];
                    results.push({ offer_id: offer, ok: false, error: String(errs[0]?.message || errs[0]?.code || 'Ozon не принял цену').slice(0, 160) });
                }
            }
        } catch (e) {
            const msg = e instanceof OzonError ? `Ozon ${e.status}: ${e.message}` : String((e as Error)?.message || e);
            for (const c of chunk) results.push({ offer_id: c.offer_id, ok: false, error: msg.slice(0, 160) });
        }
        await sleep(300);
    }
    const okN = results.filter((r) => r.ok).length;
    return json({ ok: okN === items.length, applied: okN, total: items.length, results });
});
