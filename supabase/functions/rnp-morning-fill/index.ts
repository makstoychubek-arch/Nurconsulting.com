// Supabase Edge Function: rnp-morning-fill
// Утром по Бишкеку заливает вчера+сегодня в wb_orders → rnp_daily_data
// и обновляет остатки wb_stocks по размерам (FBO+FBS) по группе кабинетов.
// Пишет в тим от имени Карины.
//
// Cron:
//   00:20 UTC = 06:20 Бишкек — Zevina (не 06:00: в 00:00 UTC уже
//              auto-sync-4h и sync_daily_stats, Зевина ловит 429 и
//              не успевает написать «готово»)
//   01:15 UTC = 07:15 Бишкек — Baza (сдвиг с 07:00, чтобы не столкнуться
//              с daily-sales-report того же токена)
//   02:00 UTC = 08:00 Бишкек — Elium
//   03:00 / 03:15 / 03:30 UTC = 09:00–09:30 Бишкек — funnel_only, без Telegram.
//     К 06:00 МСК вчерашняя воронка карточки уже стабильна; иначе в РНП
//     остаётся count из statistics-api (66 вместо 47 на графике WB).
// 06/07/08 не ждут воронку: у Зевины ~170 арт. × 21с/чанк убивает
// edge function до сообщения «готово» — в тиме «начинаю» и тишина.
// Остатки по дням не пишет: колонка дня фиксируется в 03:00 Бишкек (00:00 МСК)
// функцией goods-daily-eod — после закрытия продаж за вчера.
//
// Body: { group: 'zevina'|'baza'|'elium'|'all', date?, notify?, today?,
//         funnel?, funnel_only? }
// group=all только с funnel_only (без заказов и без Telegram).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { orderPriceWithDisc } from '../_shared/wb-order-price.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { applyKeepFunnelOrders, funnelDayMetricFields, moscowYmd, wbFunnelWindow } from '../_shared/wb-funnel-day.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WB_STATS = 'https://statistics-api.wildberries.ru';
const WB_ANALYTICS = 'https://seller-analytics-api.wildberries.ru';
const ORDERS_MIN_INTERVAL_MS = 61000;
const lastOrderFetchAt = new Map<string, number>();

// Сколько srid влезает в один GET-фильтр PostgREST, чтобы URL остался коротким.
const SRID_QUERY_CHUNK = 80;

const GROUPS: Record<string, { title: string; match: (name: string) => boolean }> = {
    zevina: { title: 'Zevina', match: (n) => /zevina|зевин|уркунбаев|ailin|айлин/i.test(n) },
    baza: { title: 'Baza', match: (n) => /^baza$/i.test(n.trim()) || /бейшеев/i.test(n) },
    elium: { title: 'Elium', match: (n) => /elium|элиум|айзада/i.test(n) },
};

type Admin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const groupKey = String(body.group || '').toLowerCase().trim();
    const funnelOnly = body.funnel_only === true;
    const groupAll = groupKey === 'all';
    const group = GROUPS[groupKey];
    if (!group && !groupAll) return json({ error: 'group must be zevina, baza, elium or all' }, 400);
    if (groupAll && !funnelOnly) return json({ error: 'group=all только с funnel_only' }, 400);

    const fillDate = normDate(body.date) || yesterdayBishkek();
    const today = bishkekYmd();
    const datesIn = Array.isArray(body.dates)
        ? [...new Set((body.dates as unknown[]).map(normDate).filter(Boolean) as string[])].sort()
        : [];
    const alsoToday = body.today === false ? [] : (fillDate === today ? [] : [today]);
    const days = datesIn.length ? datesIn : [fillDate, ...alsoToday];
    const notify = funnelOnly || groupAll ? false : body.notify !== false;
    // Воронка по умолчанию выкл: 06/07/08 должны успеть написать «готово».
    // Явный funnel:true или funnel_only (09:00) — отдельный прогон.
    const wantFunnel = funnelOnly || body.funnel === true;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: cabinets, error: cabErr } = await admin
        .from('cabinets')
        .select('id, name, wb_token')
        .not('wb_token', 'is', null)
        .gt('wb_token', '');
    if (cabErr) return json({ error: cabErr.message }, 500);

    const targets = (cabinets || []).filter((c) => (
        groupAll
            ? Object.values(GROUPS).some((g) => g.match(String(c.name || '')))
            : Boolean(group?.match(String(c.name || '')))
    ));
    if (!targets.length) return json({ error: `Нет кабинетов для группы ${groupKey}` }, 400);

    const groupTitle = groupAll ? 'все кабинеты' : (group?.title || groupKey);
    const tg: { start: Record<string, unknown>; done: Record<string, unknown> } = {
        start: { ok: true, skipped: true },
        done: { ok: true, skipped: true },
    };
    if (notify) tg.start = await sendKarina(startText(groupTitle, fillDate, targets.map((c) => c.name)));

    const results: Record<string, unknown>[] = targets.map((cab) => ({
        cabinet: cab.name,
        id: cab.id,
        orders: {} as Record<string, number>,
        status: 'pending',
    }));

    try {
        // День снаружи, кабинеты параллельно: у Зевины разные токены, ждать 61с
        // дважды подряд не нужно — иначе edge function не укладывается в лимит.
        // funnel_only — только воронка карточки, без заказов и Telegram.
        if (!funnelOnly) {
            for (const day of days) {
                await Promise.all(targets.map(async (cab, i) => {
                    const row = results[i];
                    if (row.status === 'error') return;
                    const token = sanitizeWbToken(cab.wb_token);
                    if (!token || token.length < 50) {
                        row.status = 'error';
                        row.error = 'нет WB-токена';
                        return;
                    }
                    try {
                        const orders = await fetchSupplierOrdersExactDay(token, day);
                        await writeOrderRows(admin, cab.id, day, orders);
                        (row.orders as Record<string, number>)[day] = orders.filter((o) => !o.isReturn).length;
                    } catch (e) {
                        row.status = 'error';
                        row.error = `${day}: ${(e as Error).message}`;
                    }
                }));
            }
        }

        await Promise.all(targets.map(async (cab, i) => {
            const row = results[i];
            const token = sanitizeWbToken(cab.wb_token);
            const ordersFailed = row.status === 'error';
            if (!token || token.length < 50) {
                row.status = 'error';
                row.error = 'нет WB-токена';
                return;
            }
            try {
                if (!funnelOnly && !ordersFailed) {
                    row.rnp_daily = await rebuildRnpDaily(admin, cab.id, days);
                }
                if (!funnelOnly) {
                    try {
                        const stocks = await syncStocksViaAutoSync(supabaseUrl, serviceKey, cab.id);
                        row.stocks_fbo = stocks.fbo;
                        row.stocks_fbs = stocks.fbs;
                        row.stocks_error = stocks.error || null;
                    } catch (e) {
                        row.stocks_fbo = 0;
                        row.stocks_fbs = 0;
                        row.stocks_error = (e as Error).message;
                    }
                }
                if (wantFunnel) {
                    try {
                        row.funnel_days = await syncFunnelLast7Days(admin, cab.id, token);
                    } catch (e) {
                        row.funnel_error = (e as Error).message;
                        row.funnel_days = 0;
                    }
                } else {
                    row.funnel_days = 0;
                }
                if (funnelOnly && row.funnel_error) {
                    row.status = 'error';
                    row.error = row.funnel_error;
                } else if (funnelOnly || !ordersFailed) {
                    row.articles = await countActiveArticles(admin, cab.id);
                    row.status = 'done';
                }
            } catch (e) {
                row.status = 'error';
                row.error = (e as Error).message;
            }
        }));
    } finally {
        // Даже если заказы/воронка упали — не оставлять тим с «начинаю» без «готово».
        if (notify) {
            try {
                tg.done = await sendKarina(doneText(groupTitle, fillDate, today, results));
            } catch (e) {
                tg.done = { ok: false, error: (e as Error).message };
            }
        }
    }

    return json({
        ok: results.every((r) => r.status === 'done'),
        group: groupKey,
        funnel_only: funnelOnly,
        fill_date: fillDate,
        today,
        results,
        telegram: tg,
        ms: Date.now() - started,
    });
});

function startText(title: string, fillDate: string, names: string[]) {
    const d = ruDate(fillDate);
    const cabs = names.join(', ');
    return [
        'Всем привет ☀️',
        '',
        'Я Карина, начинаю заполнять РНП.',
        `Заполняю РНП за ${d} — кабинет ${cabs}.`,
        'Когда откроете модуль, цифры по артикулам уже будут на месте.',
    ].join('\n');
}

function doneText(title: string, fillDate: string, today: string, results: Record<string, unknown>[]) {
    const lines = [
        `Карина: РНП за ${ruDate(fillDate)} — ${title} готово.`,
        '',
    ];
    for (const r of results) {
        if (r.status !== 'done') {
            lines.push(`• ${r.cabinet}: ошибка — ${r.error}`);
            continue;
        }
        const orders = (r.orders || {}) as Record<string, number>;
        const y = Number(orders[fillDate] || 0);
        const t = Number(orders[today] || 0);
        const stockN = Number(r.stocks_fbo || 0) + Number(r.stocks_fbs || 0);
        const stockBit = r.stocks_error
            ? `остатки: ${r.stocks_error}`
            : `остатки по размерам ${stockN}`;
        lines.push(`• ${r.cabinet}: вчера ${y} заказов, сегодня ${t}, артикулов ${r.articles || 0}, ${stockBit}`);
    }
    lines.push('', 'Можно открывать РНП — колонка за вчера заполнена.');
    return lines.join('\n');
}

async function syncStocksViaAutoSync(
    supabaseUrl: string,
    serviceKey: string,
    cabinetId: string,
): Promise<{ fbo: number; fbs: number; error?: string }> {
    const res = await fetch(`${supabaseUrl}/functions/v1/auto-sync`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'stocks', cabinet_id: cabinetId }),
    });
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) return { fbo: 0, fbs: 0, error: String(body?.error || `HTTP ${res.status}`) };
    const r = (body?.results as Record<string, unknown>[] | undefined)?.[0];
    const err = r?.status === 'partial' || r?.status === 'error'
        ? String(r?.error || r?.error_msg || '').trim()
        : '';
    return {
        fbo: Number(r?.stocks_fbo || 0),
        fbs: Number(r?.stocks_fbs || 0),
        error: err || undefined,
    };
}

async function sendKarina(text: string): Promise<Record<string, unknown>> {
    const token = (Deno.env.get('KARINA_BOT_TOKEN') || getTelegramToken() || '').trim();
    const chatId = getTelegramChatId('team');
    if (!token || !chatId) return { ok: false, error: 'нет токена или TEAM_TELEGRAM_CHAT_ID' };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.ok === false) {
        return { ok: false, status: res.status, error: body?.description || 'telegram error' };
    }
    return { ok: true, message_id: body?.result?.message_id };
}

async function fetchSupplierOrdersExactDay(token: string, dayStr: string, maxAttempts = 6) {
    const lastAt = lastOrderFetchAt.get(token) || 0;
    const waitMs = lastAt ? Math.max(0, ORDERS_MIN_INTERVAL_MS - (Date.now() - lastAt)) : 0;
    if (waitMs > 0) await sleep(waitMs);

    const url = `${WB_STATS}/api/v1/supplier/orders?dateFrom=${dayStr}&flag=1`;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(url, { headers: { Authorization: token } });
        lastOrderFetchAt.set(token, Date.now());
        if (res.status === 429) {
            const raw = res.headers.get('x-ratelimit-retry') || res.headers.get('retry-after') || '60';
            const extra = Math.min((Number(raw) || 60) * 1000 + attempt * 5000, 180000);
            await sleep(extra);
            continue;
        }
        if (!res.ok) {
            const text = (await res.text().catch(() => '')).slice(0, 200);
            throw new Error(`orders HTTP ${res.status} ${text}`.trim());
        }
        const js = await res.json().catch(() => null);
        if (!Array.isArray(js)) {
            throw new Error('orders: WB вернул не массив — день не трогаем');
        }
        return js as Record<string, unknown>[];
    }
    throw new Error(`WB orders 429 после ${maxAttempts} попыток`);
}

async function writeOrderRows(
    admin: Admin,
    cabinetId: string,
    dayStr: string,
    dayOrders: Record<string, unknown>[],
) {
    if (!dayOrders.length) return;
    await admin.from('wb_orders').delete().eq('cabinet_id', cabinetId).eq('order_date', dayStr);
    const rows = dayOrders.map((o) => ({
        cabinet_id: cabinetId,
        // flag=1 отдаёт заказы за календарный день WB — пишем ту дату, которую
        // просили, а не ISO-дату из timestamp (иначе 4.09 уезжает на 3.09).
        order_date: dayStr,
        nm_id: o.nmId,
        barcode: o.barcode,
        srid: o.srid || null,
        // priceWithDisc — цена со скидкой продавца, та же база, что «Продажи» в
        // финотчёте. Поля priceWithDiscount у WB нет, и заказы падали в базу по
        // totalPrice (до скидки) — отсюда завышенные суммы заказов.
        price: orderPriceWithDisc(o),
        is_return: o.isReturn || false,
        data: o,
    }));
    const withSrid = rows.filter((r) => r.srid);
    const withoutSrid = rows.filter((r) => !r.srid);
    // Не перетягивать srid с другого дня: unique (cabinet_id, srid),
    // иначе догон 1–3 сентября стирает уже залитые 4–5.
    const srids = withSrid.map((r) => r.srid).filter(Boolean);
    let keep = withSrid;
    if (srids.length) {
        const owned = new Set<string>();
        // 500 srid в ?srid=in.(...) — это URL на 43 КБ, запрос обрывается.
        for (let i = 0; i < srids.length; i += SRID_QUERY_CHUNK) {
            const { data, error } = await admin.from('wb_orders')
                .select('srid, order_date')
                .eq('cabinet_id', cabinetId)
                .in('srid', srids.slice(i, i + SRID_QUERY_CHUNK));
            if (error) throw new Error(`srid-check(${dayStr}): ${error.message}`);
            for (const row of data || []) {
                const od = String(row.order_date || '').split('T')[0];
                if (od && od !== dayStr && row.srid) owned.add(String(row.srid));
            }
        }
        if (owned.size) keep = withSrid.filter((r) => !owned.has(String(r.srid)));
    }
    for (let i = 0; i < keep.length; i += 500) {
        const { error } = await admin.from('wb_orders').upsert(keep.slice(i, i + 500), {
            onConflict: 'cabinet_id,srid',
        });
        if (error) throw new Error(`upsert(${dayStr}): ${error.message}`);
    }
    if (withoutSrid.length) {
        for (let i = 0; i < withoutSrid.length; i += 500) {
            const { error } = await admin.from('wb_orders').insert(withoutSrid.slice(i, i + 500));
            if (error) throw new Error(`insert(${dayStr}): ${error.message}`);
        }
    }
}

async function rebuildRnpDaily(admin: Admin, cabinetId: string, days: string[]): Promise<number> {
    const { data: orders, error } = await admin
        .from('wb_orders')
        .select('nm_id, order_date, price, is_return, data')
        .eq('cabinet_id', cabinetId)
        .in('order_date', days);
    if (error) throw error;
    const byKey = new Map<string, { count: number; sum: number; sppSum: number; sppCnt: number }>();
    for (const o of orders || []) {
        if (o.is_return) continue;
        const date = String(o.order_date || '').split('T')[0];
        if (!date || o.nm_id == null) continue;
        const key = `${o.nm_id}|${date}`;
        let d = byKey.get(key);
        if (!d) {
            d = { count: 0, sum: 0, sppSum: 0, sppCnt: 0 };
            byKey.set(key, d);
        }
        d.count++;
        d.sum += Number(o.price || 0);
        const raw = o.data as Record<string, unknown> | null;
        const spp = raw?.spp ?? raw?.Spp;
        if (spp != null && Number(spp) > 0) {
            d.sppSum += Number(spp);
            d.sppCnt++;
        }
    }
    const upserts = [...byKey.entries()].map(([key, d]) => {
        const sep = key.indexOf('|');
        return {
            cabinet_id: cabinetId,
            nm_id: Number(key.slice(0, sep)),
            date: key.slice(sep + 1),
            orders_count: d.count,
            orders_sum: d.sum,
            avg_check: d.count > 0 ? d.sum / d.count : 0,
            spp_pct: d.sppCnt > 0 ? d.sppSum / d.sppCnt : 0,
            updated_at: new Date().toISOString(),
        };
    });
    await preserveFunnelOrders(admin, cabinetId, upserts);
    for (let i = 0; i < upserts.length; i += 100) {
        const { error: upErr } = await admin.from('rnp_daily_data').upsert(
            upserts.slice(i, i + 100),
            { onConflict: 'cabinet_id,nm_id,date' },
        );
        if (upErr) throw upErr;
    }
    return upserts.length;
}

async function syncFunnelLast7Days(admin: Admin, cabinetId: string, token: string): Promise<number> {
    const { data: arts } = await admin.from('rnp_articles')
        .select('nm_id')
        .eq('cabinet_id', cabinetId)
        .eq('is_active', true);
    const nmIds = [...new Set((arts || []).map((a: { nm_id: number }) => Number(a.nm_id)).filter((n) => n > 0))];
    if (!nmIds.length) return 0;
    const today = moscowYmd();
    const dateFrom = addDaysStr(today, -6);
    const upserts: Record<string, unknown>[] = [];
    // history: максимум 20 nmId, 3 запроса/мин (интервал 20 с).
    for (let i = 0; i < nmIds.length; i += 20) {
        if (i > 0) await sleep(21000);
        const chunk = nmIds.slice(i, i + 20);
        const items = await fetchFunnelChunk(token, dateFrom, today, chunk);
        for (const item of items) {
            const product = item.product as Record<string, unknown> | undefined;
            const nmId = Number(product?.nmId || item.nmId || 0);
            if (!nmId) continue;
            const history = (item.history || []) as Record<string, unknown>[];
            for (const day of history) {
                const date = String(day.date || '').split('T')[0];
                if (!date) continue;
                upserts.push({
                    cabinet_id: cabinetId,
                    nm_id: nmId,
                    date,
                    ...funnelDayMetricFields(day),
                });
            }
        }
    }
    for (let i = 0; i < upserts.length; i += 100) {
        const { error } = await admin.from('rnp_daily_data').upsert(
            upserts.slice(i, i + 100),
            { onConflict: 'cabinet_id,nm_id,date' },
        );
        if (error) throw error;
    }
    return upserts.length;
}

async function fetchFunnelChunk(
    token: string,
    dateFrom: string,
    dateTo: string,
    nmIds: number[],
    maxAttempts = 4,
): Promise<Record<string, unknown>[]> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const res = await fetch(`${WB_ANALYTICS}/api/analytics/v3/sales-funnel/products/history`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedPeriod: { start: dateFrom, end: dateTo },
                nmIds,
                skipDeletedNm: true,
                aggregationLevel: 'day',
            }),
        });
        if (res.status === 429) {
            await sleep(Math.min(25000 + attempt * 5000, 60000));
            continue;
        }
        if (res.status === 401 || res.status === 403) return [];
        if (!res.ok) throw new Error(`funnel HTTP ${res.status}`);
        const payload = await res.json().catch(() => []);
        return Array.isArray(payload) ? payload : (payload?.data || []);
    }
    throw new Error('funnel 429 после нескольких попыток');
}

async function countActiveArticles(admin: Admin, cabinetId: string): Promise<number> {
    const { count } = await admin.from('rnp_articles')
        .select('nm_id', { count: 'exact', head: true })
        .eq('cabinet_id', cabinetId)
        .eq('is_active', true);
    return count || 0;
}

async function preserveFunnelOrders(
    admin: Admin,
    cabinetId: string,
    upserts: Array<{ nm_id: number; date: string; orders_count: number }>,
) {
    if (!upserts.length) return;
    const { from, to } = wbFunnelWindow();
    const existing: Record<string, unknown>[] = [];
    let offset = 0;
    for (;;) {
        const { data, error } = await admin.from('rnp_daily_data')
            .select('nm_id, date, basket_count, funnel_order_conv')
            .eq('cabinet_id', cabinetId)
            .gte('date', from)
            .lte('date', to)
            .range(offset, offset + 999);
        if (error) return;
        const chunk = (data || []) as Record<string, unknown>[];
        existing.push(...chunk);
        if (chunk.length < 1000) break;
        offset += 1000;
    }
    applyKeepFunnelOrders(existing, upserts, to);
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}
function bishkekYmd(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}
function addDaysStr(day: string, n: number) {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
}
function yesterdayBishkek() {
    return addDaysStr(bishkekYmd(), -1);
}
function normDate(v: unknown): string | null {
    const s = String(v || '').split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function ruDate(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
}
