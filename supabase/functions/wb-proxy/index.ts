// Supabase Edge Function: wb-proxy
// Securely proxies all Wildberries API requests.
// Requires a valid user JWT in Authorization header.
// Verifies cabinet ownership before any WB API call.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        // ── Auth: verify JWT ──────────────────────────────────────────────────
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, 401);
        }
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon   = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Verify the user's session token
        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);

        const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
        const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
        const isSuperAdmin = String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || user.id === SUPER_ADMIN_ID;

        if (!isSuperAdmin) {
            const adminCheck = createClient(supabaseUrl, supabaseService);
            const { data: space, error: spaceErr } = await adminCheck
                .from('spaces')
                .select('status')
                .eq('user_id', user.id)
                .maybeSingle();

            if (spaceErr) return json({ error: 'Space status check failed' }, 500);
            if (!space || space.status !== 'active') {
                const msg = space?.status === 'blocked'
                    ? 'Спейс заблокирован. Обратитесь в поддержку.'
                    : 'Спейс ожидает активации администратором.';
                return json({ error: msg, code: 'SPACE_INACTIVE', status: space?.status || 'pending' }, 403);
            }
        }

        // ── Parse body ────────────────────────────────────────────────────────
        const body = await req.json().catch(() => ({}));
        const { action, params = {}, cabinet_id } = body;

        if (!cabinet_id) return json({ error: 'cabinet_id required' }, 400);

        // ── Verify cabinet ownership ──────────────────────────────────────────
        const admin = createClient(supabaseUrl, supabaseService);
        const { data: cab, error: cabErr } = await admin
            .from('cabinets')
            .select('wb_token, name')
            .eq('id', cabinet_id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (cabErr || !cab) return json({ error: 'Cabinet not found or access denied' }, 403);

        // IMPORTANT — DO NOT CHANGE THIS: one cabinet = one WB token, and that
        // single token already has ALL scopes (stats, content, promotion,
        // analytics, etc). There is no separate "content token". Never add
        // fallback/probe logic between "content token" and "main token" again —
        // WB_TOKEN is used for every single API call, always.
        const WB_TOKEN = sanitizeWbToken(cab.wb_token);
        const WB_CONTENT_TOKEN = WB_TOKEN;
        const WB_PROMO_TOKEN = WB_TOKEN;
        if (!WB_TOKEN) return json({ error: 'WB token not configured for this cabinet' }, 400);
        if (!isValidWbToken(WB_TOKEN)) {
            return json({ error: 'WB token contains invalid characters. Re-paste the token in Supabase without spaces or line breaks.' }, 400);
        }

        // ── Route to WB API ───────────────────────────────────────────────────
        let result: unknown;

        switch (action) {

            // ── Statistics API ──────────────────────────────────────────────
            case 'orders': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/orders?dateFrom=${params.dateFrom || '2020-01-01'}&flag=0`;
                const wbRes = await fetch(url, { headers: { Authorization: WB_TOKEN } });
                return streamWbResponse(wbRes);
            }
            case 'stocks': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=${params.dateFrom || '2020-01-01'}`;
                const wbRes = await fetch(url, { headers: { Authorization: WB_TOKEN } });
                return streamWbResponse(wbRes);
            }
            case 'finance_report': {
                const dateFrom = String(params.dateFrom || '').split('T')[0];
                const dateTo   = String(params.dateTo   || '').split('T')[0];
                const limit    = Math.min(Number(params.limit) || 10000, 10000);
                const maxPages = params.aggregate ? 8 : 6;
                const filterNmId = params.nmId != null ? String(params.nmId) : null;

                // RNP mode: aggregate on server to avoid 546 (out of memory)
                if (params.aggregate) {
                    type Agg = { sc: number; ss: number; tt: number; log: number; sto: number; rc: number; locAmt: number; rubAmt: number };
                    const byKey = new Map<string, Agg>();
                    let rrdid = Number(params.rrdid || 0);

                    for (let attempt = 0; attempt < maxPages; attempt++) {
                        const url = `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod?dateFrom=${dateFrom}&dateTo=${dateTo}&rrdid=${rrdid}&limit=${limit}`;
                        const page = await wbGet(url, WB_TOKEN) as Record<string, unknown>[];
                        if (!Array.isArray(page) || !page.length) break;

                        for (const row of page) {
                            const nm = String(row.nm_id ?? '');
                            if (filterNmId && nm !== filterNmId) continue;
                            const date = String(row.sale_dt ?? '').split('T')[0];
                            if (!date) continue;
                            const key = `${nm}|${date}`;
                            if (!byKey.has(key)) byKey.set(key, { sc: 0, ss: 0, tt: 0, log: 0, sto: 0, rc: 0, locAmt: 0, rubAmt: 0 });
                            const d = byKey.get(key)!;
                            const type = String(row.doc_type_name ?? '').toLowerCase();
                            const qty  = Number(row.quantity || 0);
                            if (type === 'продажа') {
                                d.sc += qty;
                                d.ss += Number(row.retail_price_withdisc_rub || 0) * qty;
                                d.tt += Number(row.ppvz_for_pay || 0);
                            } else if (type === 'возврат') {
                                d.rc += qty;
                                d.tt += Number(row.ppvz_for_pay || 0);
                            }
                            d.log += Number(row.delivery_rub || 0);
                            d.sto += Number(row.storage_fee  || 0);

                            // RUB→local rate source: rows for non-RUB sellers carry both
                            // retail_amount (report currency, e.g. KGS) and
                            // retail_price_withdisc_rub (RUB, per unit).
                            const curr = String(row.currency_name ?? '').toUpperCase();
                            if (curr && curr !== 'RUB' && curr !== 'РУБ') {
                                const rub = Number(row.retail_price_withdisc_rub || 0) * qty;
                                const loc = Number(row.retail_amount || 0);
                                if (rub > 0 && loc > 0) { d.rubAmt += rub; d.locAmt += loc; }
                            }
                        }

                        if (page.length < limit) break;
                        rrdid = Number(page[page.length - 1].rrd_id || 0);
                    }

                    result = Array.from(byKey.entries()).map(([key, d]) => {
                        const [nm_id, date] = key.split('|');
                        const { locAmt, rubAmt, ...sums } = d;
                        // rate: local currency per 1 RUB for this nm/date (0 = unknown)
                        const rate = rubAmt > 0 && locAmt > 0 ? locAmt / rubAmt : 0;
                        return { nm_id: Number(nm_id), date, ...sums, rate };
                    });
                    break;
                }

                // Dashboard mode: raw rows with smaller pages
                const rows: unknown[] = [];
                let rrdid = Number(params.rrdid || 0);
                for (let attempt = 0; attempt < maxPages; attempt++) {
                    const url = `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod?dateFrom=${dateFrom}&dateTo=${dateTo}&rrdid=${rrdid}&limit=${limit}`;
                    const page = await wbGet(url, WB_TOKEN) as unknown[];
                    if (!Array.isArray(page) || !page.length) break;
                    rows.push(...page);
                    if (page.length < limit) break;
                    const last = page[page.length - 1] as Record<string, unknown>;
                    rrdid = Number(last.rrd_id || 0);
                }
                result = rows;
                break;
            }
            case 'sales': {
                const url = `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${params.dateFrom || '2020-01-01'}&flag=0`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }

            // ── Marketplace API (Supplies) ──────────────────────────────────
            case 'supplies': {
                const limit  = Math.min(Number(params.limit) || 100, 1000);
                const next   = Number(params.next ?? 0);
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies?limit=${limit}&next=${next}`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'supply_orders': {
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies/${params.supplyId}/orders`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'fbw_supplies': {
                const limit = Math.min(Number(params.limit) || 1000, 1000);
                const offset = Number(params.offset || 0);
                const url = `https://supplies-api.wildberries.ru/api/v1/supplies?limit=${limit}&offset=${offset}`;
                result = await wbPost(url, WB_TOKEN, params.filters || {});
                break;
            }
            case 'fbw_supply_goods': {
                const supplyId = String(params.supplyId || '').trim();
                if (!supplyId) return json({ error: 'supplyId required' }, 400);
                const limit = Math.min(Number(params.limit) || 1000, 1000);
                const offset = Number(params.offset || 0);
                const url = `https://supplies-api.wildberries.ru/api/v1/supplies/${encodeURIComponent(supplyId)}/goods?limit=${limit}&offset=${offset}`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'fbw_supply_detail': {
                const supplyId = String(params.supplyId || '').trim();
                if (!supplyId) return json({ error: 'supplyId required' }, 400);
                const url = `https://supplies-api.wildberries.ru/api/v1/supplies/${encodeURIComponent(supplyId)}`;
                result = await wbGet(url, WB_TOKEN);
                break;
            }
            case 'supply_barcode': {
                const url = `https://marketplace-api.wildberries.ru/api/v3/supplies/${params.supplyId}/barcode?type=png`;
                const res = await fetch(url, { headers: { Authorization: WB_TOKEN } });
                result = await res.json();
                break;
            }
            case 'stickers': {
                const url = 'https://marketplace-api.wildberries.ru/api/v3/orders/stickers?type=png&width=58&height=40';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: WB_TOKEN, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orders: params.orderIds })
                });
                result = await res.json();
                break;
            }

            // ── Content API ─────────────────────────────────────────────────
            case 'content_cards': {
                // Note: filter.nmID (array) is NOT a real WB Content API field —
                // it's silently ignored. Only textSearch (single value) works
                // for looking up a specific article.
                const body = {
                    settings: {
                        sort: { ascending: false },
                        filter: {
                            textSearch: String(params.textSearch || (params.nmIds?.[0] ?? '')),
                            withPhoto: params.withPhoto ?? -1,
                        },
                        cursor: {
                            limit: params.limit || 100,
                            ...(params.cursorNmId ? { nmID: Number(params.cursorNmId) } : {}),
                        }
                    }
                };
                try {
                    result = await wbPost(
                        'https://content-api.wildberries.ru/content/v2/get/cards/list',
                        WB_TOKEN, body
                    );
                } catch (e) {
                    const status = (e as { status?: number })?.status;
                    if (status === 401 || status === 403) {
                        console.warn('[wb-proxy] content_cards auth:', String(e));
                        result = { cards: [] };
                    } else throw e;
                }
                break;
            }
            case 'product_photos': {
                // PRIMARY: public WB media CDN (basket-XX.wbbasket.ru) — needs NO
                // seller token at all, so it's immune to invalid/expired content
                // tokens. WB shards products across basket hosts by `vol`
                // (nmId / 100000); there's no public mapping table anymore, so we
                // resolve it by probing card.json (a few hundred bytes) across
                // basket hosts. All probing happens server-side (Deno) so DNS/404
                // failures never reach the user's browser console. Once the
                // correct basket for a vol is found, it's reused for every other
                // requested nmId that shares the same vol (no extra probing).
                const nmIds: number[] = [...new Set((params.nmIds || []).map(Number).filter(Boolean))];
                const out: Record<string, string> = {};
                const gallery: Record<string, string[]> = {};
                const debug = { requested: nmIds.length, viaBasket: 0, viaContent: 0, notFound: 0 };
                if (!nmIds.length) { result = out; break; }

                const basketByVol = new Map<number, number>();
                const stillNeed: number[] = [];
                const basketDeadline = Date.now() + 20000; // safety budget for CDN probing

                for (const nm of nmIds) {
                    if (Date.now() > basketDeadline) { stillNeed.push(nm); continue; }
                    const vol = Math.floor(nm / 100000);
                    const part = Math.floor(nm / 1000);
                    let basket = basketByVol.get(vol);
                    if (basket == null) {
                        const found = await probeBasketHost(vol, part, nm);
                        if (found) { basket = found; basketByVol.set(vol, found); }
                    }
                    if (basket == null) { stillNeed.push(nm); continue; }

                    const urls = await verifyPhotoUrls(basket, vol, part, nm);
                    if (urls.length) {
                        out[String(nm)] = urls[0];
                        if (urls.length > 1) gallery[String(nm)] = urls;
                        debug.viaBasket++;
                    } else {
                        stillNeed.push(nm);
                    }
                }

                // FALLBACK: seller Content API for anything the public CDN probe
                // couldn't resolve (e.g. brand-new cards not yet on the CDN).
                if (stillNeed.length) {
                    const contentDeadline = Date.now() + 15000;
                    for (const nm of stillNeed) {
                        if (Date.now() > contentDeadline) { debug.notFound++; continue; }
                        const body = { settings: { filter: { textSearch: String(nm), withPhoto: -1 }, cursor: { limit: 100 } } };
                        try {
                            const cards = await wbPost(
                                'https://content-api.wildberries.ru/content/v2/get/cards/list',
                                WB_TOKEN, body
                            ) as { cards?: Record<string, unknown>[] };
                            const card = (cards?.cards || []).find(c => Number(c.nmID ?? c.nmId ?? 0) === nm);
                            if (card) {
                                const photos = (card.photos as Record<string, string>[] | undefined) || [];
                                const urls = photos.map(ph => {
                                    let u = ph?.big || ph?.c516x688 || ph?.c246x328 || ph?.tm || '';
                                    if (u && u.startsWith('//')) u = 'https:' + u;
                                    return u;
                                }).filter(Boolean);
                                if (urls.length) {
                                    out[String(nm)] = urls[0];
                                    gallery[String(nm)] = urls;
                                    debug.viaContent++;
                                } else debug.notFound++;
                            } else debug.notFound++;
                        } catch (e) {
                            console.warn('[wb-proxy] product_photos content fallback nm', nm, ':', String(e));
                            debug.notFound++;
                        }
                        await sleep(120);
                    }
                }

                console.log('[wb-proxy] product_photos debug:', JSON.stringify(debug));
                (out as Record<string, unknown>)._debug = debug;
                (out as Record<string, unknown>)._gallery = gallery;
                result = out;
                break;
            }

            // ── Promotion (Advertising) API v2/v3 ──────────────────────────
            case 'advert_list': {
                // GET /adv/v1/promotion/count — all campaigns grouped by type/status
                const allIds: number[] = [];
                try {
                    const res1 = await fetch('https://advert-api.wildberries.ru/adv/v1/promotion/count', {
                        headers: { Authorization: WB_PROMO_TOKEN }
                    });
                    const text1 = await res1.text();
                    console.log('[wb-proxy] promotion/count status:', res1.status, 'body:', text1.slice(0, 600));
                    if (res1.ok) {
                        const data1 = JSON.parse(text1);
                        // Structure: { adverts: [{ type, status, count, advert_list: [{advertId, changeTime}] }] }
                        const groups = data1?.adverts;
                        if (Array.isArray(groups)) {
                            for (const g of groups as Record<string, unknown>[]) {
                                const inner = g?.advert_list as Record<string, unknown>[] | undefined;
                                if (Array.isArray(inner)) {
                                    for (const a of inner) {
                                        if (a?.advertId) allIds.push(Number(a.advertId));
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {
                    console.warn('[wb-proxy] promotion/count error:', String(e));
                }
                // Fallback: /api/advert/v2/adverts?statuses=9,11
                if (!allIds.length) {
                    try {
                        const res2 = await fetch('https://advert-api.wildberries.ru/api/advert/v2/adverts?statuses=9%2C11', {
                            headers: { Authorization: WB_PROMO_TOKEN }
                        });
                        const text2 = await res2.text();
                        console.log('[wb-proxy] advert/v2 status:', res2.status, 'body:', text2.slice(0, 600));
                        if (res2.ok) {
                            const data2 = JSON.parse(text2);
                            const adverts: Record<string, unknown>[] = data2?.adverts || (Array.isArray(data2) ? data2 : []);
                            for (const a of adverts) {
                                const id = a?.advertId ?? a?.id ?? a?.advert_id;
                                if (id) allIds.push(Number(id));
                            }
                        }
                    } catch(e) {
                        console.warn('[wb-proxy] advert/v2 error:', String(e));
                    }
                }
                console.log('[wb-proxy] advert_list: found', allIds.length, 'IDs');
                result = { ids: allIds };
                break;
            }
            case 'advert_campaigns': {
                const campaigns: { id: number; name: string; status: number; statusLabel: string; type: number | null }[] = [];
                const statusMap: Record<number, string> = {
                    4: 'Готова', 7: 'Завершена', 8: 'Отклонена', 9: 'Работает', 11: 'Остановлен',
                };
                const idsFilter = params.advertIds ? `&ids=${(params.advertIds as (number|string)[]).join(',')}` : '';
                try {
                    const res = await fetch(
                        `https://advert-api.wildberries.ru/api/advert/v2/adverts?statuses=4%2C9%2C11${idsFilter}`,
                        { headers: { Authorization: WB_PROMO_TOKEN } },
                    );
                    const text = await res.text();
                    if (res.ok) {
                        const data = JSON.parse(text);
                        const adverts: Record<string, unknown>[] = data?.adverts || (Array.isArray(data) ? data : []);
                        for (const a of adverts) {
                            const id = Number(a.advertId ?? a.id ?? a.advert_id ?? 0);
                            if (!id) continue;
                            const status = Number(a.status ?? 0);
                            // Название кампании должно совпадать 1:1 с тем, что
                            // продавец видит в личном кабинете WB (cmp.wildberries.ru) —
                            // берём поле как есть, без изменений, и падаем на
                            // плейсхолдер только если WB реально не отдал имя.
                            const rawName = String(a.name ?? a.campaignName ?? '').trim();
                            campaigns.push({
                                id,
                                name: rawName || `Кампания ${id}`,
                                status,
                                statusLabel: statusMap[status] || 'Остановлен',
                                type: a.type != null ? Number(a.type) : null,
                            });
                        }
                    } else {
                        console.warn('[wb-proxy] advert_campaigns status:', res.status, text.slice(0, 300));
                    }
                } catch (e) {
                    console.warn('[wb-proxy] advert_campaigns error:', String(e));
                }
                result = { campaigns };
                break;
            }
            case 'advert_stats': {
                // GET /adv/v3/fullstats — max 50 ids per request, max 31 days
                const ids: (number | string)[] = params.advertIds || [];
                if (!ids.length) { result = []; break; }

                const dateFrom = params.dateFrom || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
                const dateTo   = params.dateTo   || new Date().toISOString().split('T')[0];

                const begin = new Date(dateFrom);
                const end   = new Date(dateTo);
                const dateChunks: { from: string; to: string }[] = [];
                let cur = new Date(begin);
                while (cur <= end) {
                    const chunkEnd = new Date(cur);
                    chunkEnd.setDate(chunkEnd.getDate() + 29);
                    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
                    dateChunks.push({ from: cur.toISOString().split('T')[0], to: chunkEnd.toISOString().split('T')[0] });
                    cur = new Date(chunkEnd);
                    cur.setDate(cur.getDate() + 1);
                }

                const allStats: unknown[] = [];
                for (const dc of dateChunks) {
                    for (let i = 0; i < ids.length; i += 50) {
                        const chunk = ids.slice(i, i + 50).join(',');
                        try {
                            const url = `https://advert-api.wildberries.ru/adv/v3/fullstats?ids=${chunk}&beginDate=${dc.from}&endDate=${dc.to}`;
                            const data = await wbGet(url, WB_PROMO_TOKEN);
                            if (Array.isArray(data)) allStats.push(...data);
                            else console.warn('[wb-proxy] advert_stats non-array response:', typeof data);
                        } catch(e) {
                            console.warn('[wb-proxy] advert_stats chunk error:', String(e));
                        }
                    }
                }
                console.log(`[wb-proxy] advert_stats: ${allStats.length} campaign-stats returned`);
                result = allStats;
                break;
            }

            // ── Финансы: баланс рекламного кабинета ──────────────────────────
            case 'advert_balance': {
                const url = 'https://advert-api.wildberries.ru/adv/v1/balance';
                const wbRes = await fetch(url, { headers: { Authorization: WB_PROMO_TOKEN } });
                const text = await wbRes.text();
                if (!wbRes.ok) {
                    console.warn('[wb-proxy] advert_balance failed:', wbRes.status, text.slice(0, 300));
                    return json({ error: `WB balance error ${wbRes.status}` }, wbRes.status >= 500 ? 502 : 400);
                }
                result = JSON.parse(text);
                break;
            }

            // ── Управление кампанией: старт / пауза ──────────────────────────
            // GET /adv/v0/start|pause?id={id}. Ставки/бюджет не трогаем —
            // это только включение/выключение уже настроенной кампании.
            case 'advert_start':
            case 'advert_pause': {
                const advertId = Number(params.advertId || 0);
                if (!advertId) return json({ error: 'advertId required' }, 400);
                const verb = action === 'advert_start' ? 'start' : 'pause';
                const url = `https://advert-api.wildberries.ru/adv/v0/${verb}?id=${advertId}`;
                const wbRes = await fetch(url, { method: 'GET', headers: { Authorization: WB_PROMO_TOKEN } });
                const text = await wbRes.text();
                if (!wbRes.ok) {
                    console.warn(`[wb-proxy] ${action} failed:`, wbRes.status, text.slice(0, 300));
                    // WB часто отдаёт пустое тело или неинформативный текст на
                    // 400/401/403 для этих ручек — переводим типовые случаи в
                    // понятное сообщение вместо голого "WB start error 400".
                    let detail = text.slice(0, 200);
                    try {
                        const parsed = JSON.parse(text);
                        detail = String(parsed?.error || parsed?.errorText || parsed?.message || detail);
                    } catch { /* not json, keep raw text */ }
                    let friendly = '';
                    if (wbRes.status === 401 || wbRes.status === 403) {
                        friendly = 'Токен WB не имеет прав на управление рекламой. В личном кабинете WB → «Управление API» проверьте, что у токена включена категория «Продвижение» с доступом на изменение (не только просмотр).';
                    } else if (verb === 'start' && /budget|бюджет/i.test(detail)) {
                        friendly = 'Недостаточно бюджета для запуска кампании. Пополните баланс РК в личном кабинете WB.';
                    } else if (!detail) {
                        friendly = `Кампанию не удалось ${verb === 'start' ? 'запустить' : 'поставить на паузу'} — WB вернул пустой ответ с кодом ${wbRes.status}. Возможно, кампания уже в этом статусе или недоступна для управления через API.`;
                    }
                    return json({ error: friendly || `WB ${verb} error ${wbRes.status}: ${detail}` }, wbRes.status >= 500 ? 502 : 400);
                }
                // WB campaign status changes are not instant (documented ~1 min
                // propagation) — попробуем один раз подтвердить реальный статус
                // почти сразу, но не блокируем ответ надолго; если WB ещё не
                // применил изменение, вызывающий код (dashboard.html) досчитает
                // через оптимистичное обновление и следующий advertising-sync.
                let confirmedStatus: number | null = null;
                try {
                    await new Promise((r) => setTimeout(r, 1200));
                    const checkRes = await fetch(
                        `https://advert-api.wildberries.ru/api/advert/v2/adverts?statuses=4%2C9%2C11&ids=${advertId}`,
                        { headers: { Authorization: WB_PROMO_TOKEN } },
                    );
                    if (checkRes.ok) {
                        const checkData = JSON.parse(await checkRes.text());
                        const adverts: Record<string, unknown>[] = checkData?.adverts || (Array.isArray(checkData) ? checkData : []);
                        const found = adverts.find((a) => Number(a.advertId ?? a.id ?? 0) === advertId);
                        if (found) confirmedStatus = Number(found.status ?? 0);
                    }
                } catch (e) {
                    console.warn('[wb-proxy] status confirm after', action, 'failed:', String(e));
                }
                result = { ok: true, advertId, action: verb, confirmedStatus };
                break;
            }

            // ── Поисковые фразы (кластеры) по кампании ───────────────────────
            // POST /adv/v0/normquery/stats — статистика кластеров-запросов
            // покупателей для кампании за период. Формат ответа WB не строго
            // документирован — разбираем на фронте максимально терпимо к
            // разным вариантам полей, здесь просто отдаём "как есть".
            case 'advert_keyword_stats': {
                const advertId = Number(params.advertId || 0);
                if (!advertId) return json({ error: 'advertId required' }, 400);
                const dateFrom = params.dateFrom || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
                const dateTo = params.dateTo || new Date().toISOString().split('T')[0];
                const url = 'https://advert-api.wildberries.ru/adv/v0/normquery/stats';
                const wbRes = await fetch(url, {
                    method: 'POST',
                    headers: { Authorization: WB_PROMO_TOKEN, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ from: dateFrom, to: dateTo, items: [{ id: advertId }] }),
                });
                const text = await wbRes.text();
                if (!wbRes.ok) {
                    console.warn('[wb-proxy] advert_keyword_stats failed:', wbRes.status, text.slice(0, 300));
                    return json({ error: `WB normquery/stats error ${wbRes.status}: ${text.slice(0, 200)}` }, wbRes.status >= 500 ? 502 : 400);
                }
                result = text ? JSON.parse(text) : [];
                break;
            }

            // ── Analytics API — Sales Funnel ────────────────────────────────
            case 'sales_funnel_history': {
                const today = new Date();
                const minStart = new Date(today);
                minStart.setDate(minStart.getDate() - 6);
                const fmt = (d: Date) => d.toISOString().split('T')[0];
                let dateFrom = String(params.dateFrom || '').split('T')[0];
                let dateTo   = String(params.dateTo   || '').split('T')[0];
                const nmIds = params.nmIds ||
                    (params.nmId != null ? [Number(params.nmId)] : []);
                if (!dateFrom || !dateTo || !nmIds.length) {
                    return json({ error: 'dateFrom, dateTo and nmId required' }, 400);
                }
                // WB: history only for the last 7 days
                if (dateFrom < fmt(minStart)) dateFrom = fmt(minStart);
                if (dateTo > fmt(today)) dateTo = fmt(today);
                if (dateFrom > dateTo) {
                    return json({ error: 'date range outside WB 7-day history limit' }, 400);
                }
                result = await wbPost(
                    'https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history',
                    WB_TOKEN,
                    {
                        selectedPeriod: { start: dateFrom, end: dateTo },
                        nmIds,
                        skipDeletedNm: params.skipDeletedNm !== false,
                        aggregationLevel: params.aggregationLevel || 'day',
                    }
                );
                break;
            }

            // ── Media (AB tests) ────────────────────────────────────────────
            case 'media_save': {
                const nmId = Number(params.nmId);
                const photoUrl = String(params.photoUrl || '').trim();
                if (!nmId || !photoUrl) return json({ error: 'nmId and photoUrl required' }, 400);

                let imageBytes: Uint8Array;
                let mimeType = 'image/jpeg';

                const storageMatch = photoUrl.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
                if (storageMatch) {
                    const bucket = storageMatch[1];
                    const path = decodeURIComponent(storageMatch[2]);
                    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
                    if (dlErr || !blob) {
                        return json({
                            error: true,
                            errorText: `Не удалось скачать фото из хранилища: ${dlErr?.message || 'файл не найден'}`,
                        }, 400);
                    }
                    imageBytes = new Uint8Array(await blob.arrayBuffer());
                    mimeType = blob.type || mimeType;
                } else {
                    const imgRes = await fetch(photoUrl);
                    if (!imgRes.ok) {
                        return json({
                            error: true,
                            errorText: `WB не сможет скачать фото (HTTP ${imgRes.status}). Ссылка должна быть публичной.`,
                        }, 400);
                    }
                    imageBytes = new Uint8Array(await imgRes.arrayBuffer());
                    mimeType = imgRes.headers.get('content-type') || mimeType;
                }

                if (imageBytes.length < 1000) {
                    return json({ error: true, errorText: 'Файл слишком маленький или пустой' }, 400);
                }

                const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
                const form = new FormData();
                form.append('uploadfile', new Blob([imageBytes], { type: mimeType }), `abtest.${ext}`);

                const fileRes = await fetch('https://content-api.wildberries.ru/content/v3/media/file', {
                    method: 'POST',
                    headers: {
                        Authorization: WB_CONTENT_TOKEN,
                        'X-Nm-Id': String(nmId),
                        'X-Photo-Number': '1',
                    },
                    body: form,
                });
                const fileJson = await fileRes.json().catch(() => ({})) as Record<string, unknown>;
                const errText = String(fileJson?.errorText || fileJson?.additionalErrors || '');
                if (!fileRes.ok || fileJson?.error === true || errText) {
                    const msg = errText || `WB API ${fileRes.status}`;
                    return json({ error: true, errorText: msg, details: fileJson }, fileRes.ok ? 200 : (fileRes.status >= 400 ? fileRes.status : 502));
                }
                result = { ok: true, error: false, errorText: '', nmId, photoSlot: 1, ...fileJson };
                break;
            }

            default:
                return json({ error: `Unknown action: ${action}` }, 400);
        }

        return json(result);

    } catch (err) {
        console.error('[wb-proxy] error:', err);
        let status = (err as { status?: number })?.status;
        // Fallback: extract status from "WB API 429: ..." message
        if (!status) {
            const m = String(err).match(/WB API (\d{3})/);
            if (m) status = Number(m[1]);
        }
        const httpStatus = status && status >= 400 && status < 500 ? status : 500;
        return json({ error: String(err), wb_status: status || null }, httpStatus);
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// WB shards product media across ~60+ basket-XX.wbbasket.ru hosts by `vol`
// (nmId / 100000), but there's no public host-range table anymore (old ranges
// like basket-01..14 only cover very old/low nmIds). We resolve the current
// host by probing the small card.json file across a wide range of basket
// numbers, done fully server-side so failed DNS lookups never surface as
// console errors in the user's browser.
const MAX_BASKET = 60;
const BASKET_PROBE_BATCH = 12;

async function probeBasketHost(vol: number, part: number, nm: number): Promise<number | null> {
    for (let start = 1; start <= MAX_BASKET; start += BASKET_PROBE_BATCH) {
        const batch = Array.from(
            { length: Math.min(BASKET_PROBE_BATCH, MAX_BASKET - start + 1) },
            (_, i) => start + i
        );
        const results = await Promise.all(batch.map(async (b) => {
            const bStr = String(b).padStart(2, '0');
            const url = `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
            try {
                const res = await fetch(url);
                return res.ok ? b : null;
            } catch {
                return null;
            }
        }));
        const found = results.find((r) => r != null);
        if (found != null) return found;
    }
    return null;
}

// Once the basket host is known, verify which numbered images actually exist
// (WB always uses .webp for current uploads) and return only working URLs.
async function verifyPhotoUrls(basket: number, vol: number, part: number, nm: number): Promise<string[]> {
    const bStr = String(basket).padStart(2, '0');
    const base = `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big`;
    const indices = Array.from({ length: 12 }, (_, i) => i + 1);
    const checks = await Promise.all(indices.map(async (i) => {
        const url = `${base}/${i}.webp`;
        try {
            const res = await fetch(url, { method: 'HEAD' });
            return res.ok ? { i, url } : null;
        } catch {
            return null;
        }
    }));
    return checks
        .filter((c): c is { i: number; url: string } => c != null)
        .sort((a, b) => a.i - b.i)
        .map((c) => c.url);
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function isValidWbToken(token: string): boolean {
    return token.length > 50 && /^[\x21-\x7E]+$/.test(token);
}

async function streamWbResponse(wbRes: Response): Promise<Response> {
    if (!wbRes.ok) {
        const text = await wbRes.text().catch(() => wbRes.statusText);
        return json({ error: `WB API ${wbRes.status}: ${text}` }, wbRes.status >= 400 ? wbRes.status : 502);
    }
    return new Response(wbRes.body, {
        status: wbRes.status,
        headers: {
            ...CORS,
            'Content-Type': wbRes.headers.get('Content-Type') || 'application/json',
            'Transfer-Encoding': 'chunked',
        },
    });
}

async function parseWbJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return null; // WB sometimes returns 200 with an empty body
    try {
        return JSON.parse(text);
    } catch {
        const err = new Error(`WB API ${res.status}: invalid JSON body: ${text.slice(0, 200)}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
}

async function wbGet(url: string, token: string): Promise<unknown> {
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const err = new Error(`WB API ${res.status}: ${text}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return parseWbJson(res);
}

async function wbPost(url: string, token: string, body: unknown): Promise<unknown> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const err = new Error(`WB API ${res.status}: ${text}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return parseWbJson(res);
}
