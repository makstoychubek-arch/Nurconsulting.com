// Supabase Edge Function: ab-test-rotate
// Server-side cron job that actually performs A/B test photo rotations on WB,
// independent of whether the dashboard tab is open in any browser.
// Auth: service_role key only (triggered by pg_cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceKey) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: tests, error: testsErr } = await admin
            .from('ab_tests')
            .select('*')
            .eq('status', 'active');

        if (testsErr) throw new Error(`ab_tests: ${testsErr.message}`);

        for (const test of tests || []) {
            try {
                const intervalMin = Number(test.rotation_interval_min) || 60;
                const dueSince = test.last_rotated_at || test.started_at;
                const elapsedMs = dueSince ? Date.now() - new Date(dueSince).getTime() : Infinity;
                if (elapsedMs < intervalMin * 60 * 1000) {
                    results.push({ test_id: test.id, skipped: 'not_due' });
                    continue;
                }

                const { data: variants, error: vErr } = await admin
                    .from('ab_test_variants')
                    .select('*')
                    .eq('test_id', test.id)
                    .order('variant_label');
                if (vErr) throw new Error(vErr.message);
                if (!variants || variants.length < 2) {
                    results.push({ test_id: test.id, skipped: 'not_enough_variants' });
                    continue;
                }

                const { data: cab, error: cabErr } = await admin
                    .from('cabinets')
                    .select('wb_token')
                    .eq('id', test.cabinet_id)
                    .maybeSingle();
                if (cabErr || !cab?.wb_token) {
                    results.push({ test_id: test.id, error: 'cabinet_or_token_missing' });
                    continue;
                }
                const WB_TOKEN = sanitizeWbToken(cab.wb_token);
                if (!isValidWbToken(WB_TOKEN)) {
                    results.push({ test_id: test.id, error: 'invalid_wb_token' });
                    continue;
                }

                const curIdx = Number(test.current_variant_index) || 0;
                const nextIdx = (curIdx + 1) % variants.length;
                const currentVariant = variants[curIdx];
                const nextVariant = variants[nextIdx];

                const rotateOk = await saveMediaOnWb(admin, WB_TOKEN, Number(test.nm_id), nextVariant.photo_url);
                if (!rotateOk.ok) {
                    results.push({ test_id: test.id, error: rotateOk.errorText || 'wb_media_save_failed' });
                    continue;
                }

                if (currentVariant) {
                    await admin.from('ab_test_variants').update({
                        minutes_active: (currentVariant.minutes_active || 0) + intervalMin,
                        is_currently_on_wb: false,
                    }).eq('id', currentVariant.id);
                }
                await admin.from('ab_test_variants').update({ is_currently_on_wb: true }).eq('id', nextVariant.id);

                const newRotCount = (Number(test.rotation_count) || 0) + 1;
                const shouldFinish = Boolean(test.max_rotations) && newRotCount >= Number(test.max_rotations);
                await admin.from('ab_tests').update({
                    current_variant_index: nextIdx,
                    rotation_count: newRotCount,
                    last_rotated_at: new Date().toISOString(),
                    status: shouldFinish ? 'finished' : 'active',
                    finished_at: shouldFinish ? new Date().toISOString() : null,
                }).eq('id', test.id);

                await admin.from('ab_test_rotation_log').insert({
                    test_id: test.id,
                    variant_label: nextVariant.variant_label,
                    action: 'rotate',
                });

                results.push({ test_id: test.id, rotated_to: nextVariant.variant_label, finished: shouldFinish });
            } catch (e) {
                console.error('[ab-test-rotate] test', test.id, e);
                results.push({ test_id: test.id, error: String(e) });
            }
        }

        // ── Пересчёт реальных заказов на вариант ────────────────────────────
        // orders/impressions на ab_test_variants раньше никогда не обновлялись
        // (всегда 0), поэтому "победитель" не мог определиться. Теперь считаем
        // заказы по каждому варианту из wb_orders, используя точные временные
        // окна показа фото из ab_test_rotation_log (лог хранит created_at
        // каждой ротации, а data->>'date' в wb_orders — точное время заказа).
        const statsResults: Array<Record<string, unknown>> = [];
        const { data: liveTests } = await admin
            .from('ab_tests')
            .select('*')
            .in('status', ['active', 'finished']);

        for (const test of liveTests || []) {
            try {
                // ВАЖНО: в таблице ab_test_rotation_log столбец времени называется
                // rotated_at (НЕ created_at) — раньше здесь была опечатка, из-за
                // которой запрос падал с ошибкой на каждом прогоне крона, и
                // impressions/clicks/orders у вариантов оставались нулевыми
                // вечно, независимо от того, сколько реально крутился тест.
                const { data: log } = await admin
                    .from('ab_test_rotation_log')
                    .select('variant_label, rotated_at')
                    .eq('test_id', test.id)
                    .order('rotated_at');
                if (!log || log.length === 0) continue;
                const logNorm = log.map((l) => ({ variant_label: l.variant_label, created_at: l.rotated_at }));

                const { data: variants } = await admin
                    .from('ab_test_variants')
                    .select('*')
                    .eq('test_id', test.id);
                if (!variants || variants.length === 0) continue;

                const windows = buildVariantWindows(logNorm);
                const windowEndNow = new Date();

                // ── ab_test_rotations: материализуем окна показа каждого варианта
                // (started_at/ended_at) в отдельную таблицу, как просили — вместо
                // того чтобы каждый раз пересчитывать их из ab_test_rotation_log
                // в памяти. Пересобираем полностью на каждый прогон (дешёво,
                // тестов и ротаций на тест немного), это гарантирует консистентность
                // с логом независимо от того, кто написал в лог (сервер или
                // клиентский fallback-таймер).
                const variantIdByLabel = new Map<string, string>(variants.map((v) => [v.variant_label, v.id]));
                await admin.from('ab_test_rotations').delete().eq('test_id', test.id);
                const rotationRows = windows.map((w) => ({
                    test_id: test.id,
                    variant_id: variantIdByLabel.get(w.label) || null,
                    variant_label: w.label,
                    started_at: w.start.toISOString(),
                    ended_at: w.end.getTime() >= windowEndNow.getTime() - 1000 ? null : w.end.toISOString(),
                }));
                if (rotationRows.length) await admin.from('ab_test_rotations').insert(rotationRows);

                const { data: orders } = await admin
                    .from('wb_orders')
                    .select('order_date, price, is_return, data')
                    .eq('cabinet_id', test.cabinet_id)
                    .eq('nm_id', test.nm_id)
                    .gte('order_date', String(test.started_at || '').split('T')[0] || '2020-01-01');

                const tally = new Map<string, { orders: number; revenue: number; impressions: number; clicks: number; atbs: number; adSpend: number }>();
                for (const v of variants) tally.set(v.variant_label, { orders: 0, revenue: 0, impressions: 0, clicks: 0, atbs: 0, adSpend: 0 });

                const windowEnd = new Date();
                for (const order of orders || []) {
                    if (order.is_return) continue;
                    const rawDate = (order.data as Record<string, unknown> | null)?.date as string | undefined;
                    const ts = rawDate ? new Date(rawDate) : new Date(`${order.order_date}T00:00:00Z`);
                    if (isNaN(ts.getTime())) continue;

                    let label: string | null = null;
                    for (let i = logNorm.length - 1; i >= 0; i--) {
                        const winStart = new Date(logNorm[i].created_at);
                        const winEnd = i + 1 < logNorm.length ? new Date(logNorm[i + 1].created_at) : windowEnd;
                        if (ts >= winStart && ts < winEnd) { label = logNorm[i].variant_label; break; }
                    }
                    if (!label || !tally.has(label)) continue;
                    const bucket = tally.get(label)!;
                    bucket.orders += 1;
                    bucket.revenue += Number(order.price) || 0;
                }

                // ── Показы/клики по рекламе для этого артикула ───────────────
                // WB fullstats отдаёт разбивку по товарам (nms) только на
                // уровне дня, без внутрисуточных временных отметок — поэтому
                // делим суточные показы/клики между вариантами пропорционально
                // тому, сколько времени (в мс) в течение этого дня был активен
                // каждый вариант (реальное окно ротации из лога).
                const selectedCampaigns: number[] = Array.isArray((test.settings as Record<string, unknown> | null)?.campaigns)
                    ? ((test.settings as Record<string, unknown>).campaigns as unknown[]).map(Number).filter((n) => !isNaN(n))
                    : [];
                const adsEnabled = (test.settings as Record<string, unknown> | null)?.sources
                    ? Boolean(((test.settings as Record<string, unknown>).sources as Record<string, unknown>).ads)
                    : true; // по умолчанию считаем (старые тесты без settings)

                if (adsEnabled) {
                    const sinceDate = String(test.started_at || '').split('T')[0] || '2020-01-01';
                    const { data: dailyRows } = await admin
                        .from('advertising_daily_stats')
                        .select('campaign_id, stat_date, data')
                        .eq('cabinet_id', test.cabinet_id)
                        .gte('stat_date', sinceDate);

                    for (const row of dailyRows || []) {
                        if (selectedCampaigns.length && !selectedCampaigns.includes(Number(row.campaign_id))) continue;
                        const apps = Array.isArray((row.data as Record<string, unknown> | null)?.apps)
                            ? ((row.data as Record<string, unknown>).apps as Array<Record<string, unknown>>)
                            : [];
                        let dayViews = 0;
                        let dayClicks = 0;
                        let dayAtbs = 0;
                        let daySpend = 0;
                        for (const app of apps) {
                            const nms = Array.isArray(app?.nms) ? (app.nms as Array<Record<string, unknown>>) : [];
                            for (const nm of nms) {
                                const nmId = Number(nm.nmId ?? nm.nm_id ?? 0);
                                if (nmId !== Number(test.nm_id)) continue;
                                dayViews += Number(nm.views || 0);
                                dayClicks += Number(nm.clicks || 0);
                                dayAtbs += Number(nm.atbs || 0);
                                daySpend += Number(nm.sum || 0);
                            }
                        }
                        if (!dayViews && !dayClicks) continue;

                        const dayStart = new Date(`${row.stat_date}T00:00:00Z`);
                        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
                        const overlaps: Array<{ label: string; ms: number }> = [];
                        let totalMs = 0;
                        for (const w of windows) {
                            const start = w.start > dayStart ? w.start : dayStart;
                            const end = (w.end < dayEnd ? w.end : dayEnd);
                            const ms = end.getTime() - start.getTime();
                            if (ms > 0) { overlaps.push({ label: w.label, ms }); totalMs += ms; }
                        }
                        if (!totalMs) continue;
                        for (const o of overlaps) {
                            if (!tally.has(o.label)) continue;
                            const share = o.ms / totalMs;
                            const bucket = tally.get(o.label)!;
                            bucket.impressions += dayViews * share;
                            bucket.clicks += dayClicks * share;
                            bucket.atbs += dayAtbs * share;
                            bucket.adSpend += daySpend * share;
                        }
                    }
                }

                for (const v of variants) {
                    const t = tally.get(v.variant_label) || { orders: 0, revenue: 0, impressions: 0, clicks: 0, atbs: 0, adSpend: 0 };
                    await admin.from('ab_test_variants').update({
                        orders: t.orders,
                        revenue: t.revenue,
                        impressions: Math.round(t.impressions),
                        clicks: Math.round(t.clicks),
                        atbs: Math.round(t.atbs),
                        ad_spend: Math.round(t.adSpend * 100) / 100,
                    }).eq('id', v.id);

                    const ctr = t.impressions > 0 ? (t.clicks / t.impressions * 100) : 0;
                    const cr = t.clicks > 0 ? (t.atbs / t.clicks * 100) : 0;
                    await admin.from('ab_test_variant_stats').upsert({
                        test_id: test.id,
                        variant_id: v.id,
                        source: 'ads',
                        impressions: Math.round(t.impressions),
                        clicks: Math.round(t.clicks),
                        ctr: Math.round(ctr * 100) / 100,
                        cr: Math.round(cr * 100) / 100,
                        orders: t.orders,
                        cart_adds: Math.round(t.atbs),
                        spend: Math.round(t.adSpend * 100) / 100,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'test_id,variant_id,source' });
                }
                statsResults.push({ test_id: test.id, tally: Object.fromEntries(tally) });

                // ── Источник "Воронка продаж" (карточка товара): показы/переходы/
                // заказы из seller-analytics-api sales-funnel — тем же способом
                // делим по окнам ротации. ВАЖНО: WB отдаёт историю только за
                // последние 7 дней, поэтому если тест идёт дольше — здесь будут
                // цифры только за последнюю неделю, это ограничение самого API.
                const funnelEnabled = Boolean(((test.settings as Record<string, unknown> | null)?.sources as Record<string, unknown> | undefined)?.funnel);
                if (funnelEnabled) {
                    try {
                        const funnelTally = await computeFunnelTally(admin, test, windows);
                        if (funnelTally) {
                            for (const v of variants) {
                                const t = funnelTally.get(v.variant_label) || { impressions: 0, clicks: 0, atbs: 0, orders: 0 };
                                const ctr = t.impressions > 0 ? (t.clicks / t.impressions * 100) : 0;
                                const cr = t.clicks > 0 ? (t.atbs / t.clicks * 100) : 0;
                                await admin.from('ab_test_variant_stats').upsert({
                                    test_id: test.id,
                                    variant_id: v.id,
                                    source: 'funnel',
                                    impressions: Math.round(t.impressions),
                                    clicks: Math.round(t.clicks),
                                    ctr: Math.round(ctr * 100) / 100,
                                    cr: Math.round(cr * 100) / 100,
                                    orders: Math.round(t.orders),
                                    cart_adds: Math.round(t.atbs),
                                    spend: 0,
                                    updated_at: new Date().toISOString(),
                                }, { onConflict: 'test_id,variant_id,source' });
                            }
                        }
                    } catch (e) {
                        console.error('[ab-test-rotate] funnel stats', test.id, e);
                    }
                }

                // ── Автозавершение теста ─────────────────────────────────────
                // 1) РК, к которой привязан тест, встала на паузу/кончились
                //    деньги — крутить дальше бессмысленно, останавливаем тест.
                // 2) Если включён "autoStop" и набралось достаточно показов —
                //    считаем вероятность "победы" каждого варианта по CTR
                //    (Beta-биномиальная модель) и останавливаем при явном лидере.
                if (test.status === 'active') {
                    let finishReason: string | null = null;

                    if (selectedCampaigns.length) {
                        const { data: campRows } = await admin
                            .from('advertising_campaigns')
                            .select('status')
                            .eq('cabinet_id', test.cabinet_id)
                            .in('campaign_id', selectedCampaigns);
                        const knownRows = campRows || [];
                        if (knownRows.length && knownRows.every((r) => Number(r.status) !== 9)) {
                            finishReason = 'campaign_stopped';
                        }
                    }

                    const autoStop = Boolean((test.settings as Record<string, unknown> | null)?.autoStop);
                    const minImpressions = Number((test.settings as Record<string, unknown> | null)?.minImpressions) || 100;
                    if (!finishReason && autoStop) {
                        const fresh = await admin.from('ab_test_variants').select('*').eq('test_id', test.id);
                        const freshVariants = fresh.data || [];
                        const totalImpr = freshVariants.reduce((s, v) => s + (Number(v.impressions) || 0), 0);
                        if (totalImpr >= minImpressions && freshVariants.length >= 2) {
                            const probs = probabilityBestByCtr(freshVariants);
                            const maxProb = Math.max(...probs.values());
                            if (maxProb >= 0.9) finishReason = 'winner_determined';
                        }
                    }

                    if (finishReason) {
                        const current = variants.find((v) => v.is_currently_on_wb) || variants[Number(test.current_variant_index) || 0];
                        if (current) {
                            await admin.from('ab_test_variants').update({
                                minutes_active: (Number(current.minutes_active) || 0) + Math.floor((Date.now() - new Date(test.last_rotated_at || test.started_at).getTime()) / 60000),
                                is_currently_on_wb: false,
                            }).eq('id', current.id);
                        }
                        await admin.from('ab_tests').update({
                            status: 'finished',
                            finished_at: new Date().toISOString(),
                            finish_reason: finishReason,
                        }).eq('id', test.id);
                        await admin.from('ab_test_rotation_log').insert({
                            test_id: test.id,
                            variant_label: current?.variant_label || 'stop',
                            action: 'stop',
                        });
                        statsResults.push({ test_id: test.id, autoFinished: finishReason });
                    }
                }

                // ── Уведомление в Telegram-канал по завершении теста ─────────
                // Срабатывает и для теста, завершённого автоматически прямо
                // сейчас (веткой выше), и для теста, завершённого вручную с
                // дашборда (status='finished' уже стоит) — notifyTestFinished
                // сам проверяет notification_log и шлёт сообщение только один
                // раз за всю жизнь теста (не по временному окну, а навсегда).
                const freshStatus = (await admin.from('ab_tests').select('status').eq('id', test.id).maybeSingle()).data?.status;
                if (freshStatus === 'finished') {
                    await notifyTestFinished(admin, test, variants);
                }
            } catch (e) {
                console.error('[ab-test-rotate] stats', test.id, e);
                statsResults.push({ test_id: test.id, error: String(e) });
            }
        }

        return json({ ok: true, processed: results.length, results, stats: statsResults, ms: Date.now() - started });
    } catch (err) {
        console.error('[ab-test-rotate] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

// Считает показы/переходы/добавления в корзину/заказы по карточке товара
// (не по рекламе) за окна ротации, используя WB seller-analytics
// sales-funnel/products/history. У этого эндпоинта есть жёсткое
// ограничение WB — история отдаётся максимум за последние 7 дней, поэтому
// для тестов длиннее недели тут будут только цифры за последнюю неделю
// (та часть, что вообще доступна через API). Поля в ответе WB не строго
// документированы, поэтому парсим максимально защитно, с запасными
// вариантами имён.
async function computeFunnelTally(
    admin: ReturnType<typeof createClient>,
    test: Record<string, unknown>,
    windows: Array<{ label: string; start: Date; end: Date }>,
): Promise<Map<string, { impressions: number; clicks: number; atbs: number; orders: number }> | null> {
    const { data: cab } = await admin.from('cabinets').select('wb_token').eq('id', test.cabinet_id as string).maybeSingle();
    const token = sanitizeWbToken(cab?.wb_token);
    if (!token || !isValidWbToken(token)) return null;

    const today = new Date();
    const minStart = new Date(today);
    minStart.setDate(minStart.getDate() - 6);
    const fmtD = (d: Date) => d.toISOString().split('T')[0];
    let dateFrom = String(test.started_at || '').split('T')[0] || fmtD(minStart);
    if (dateFrom < fmtD(minStart)) dateFrom = fmtD(minStart);
    const dateTo = fmtD(today);
    if (dateFrom > dateTo) return null;

    const res = await fetch('https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products/history', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            selectedPeriod: { start: dateFrom, end: dateTo },
            nmIds: [Number(test.nm_id)],
            skipDeletedNm: true,
            aggregationLevel: 'day',
        }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!data) return null;

    // Защитно ищем массив дневных точек в разных возможных обёртках ответа.
    const days = extractFunnelDays(data);
    if (!days.length) return null;

    const tally = new Map<string, { impressions: number; clicks: number; atbs: number; orders: number }>();
    for (const w of windows) {
        if (!tally.has(w.label)) tally.set(w.label, { impressions: 0, clicks: 0, atbs: 0, orders: 0 });
    }

    for (const day of days) {
        const dateStr = String(day.dt || day.date || day.day || '').split('T')[0];
        if (!dateStr) continue;
        const impressions = numField(day, ['openCardCount', 'views', 'opens', 'cardViews']);
        const clicks = numField(day, ['addToCartCount', 'clicks', 'toCart', 'addToCart']);
        const atbs = numField(day, ['addToCartCount', 'cartAdds']);
        const orders = numField(day, ['ordersCount', 'orders', 'orderCount']);
        if (!impressions && !clicks && !orders) continue;

        const dayStart = new Date(`${dateStr}T00:00:00Z`);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const overlaps: Array<{ label: string; ms: number }> = [];
        let totalMs = 0;
        for (const w of windows) {
            const start = w.start > dayStart ? w.start : dayStart;
            const end = w.end < dayEnd ? w.end : dayEnd;
            const ms = end.getTime() - start.getTime();
            if (ms > 0) { overlaps.push({ label: w.label, ms }); totalMs += ms; }
        }
        if (!totalMs) continue;
        for (const o of overlaps) {
            const bucket = tally.get(o.label);
            if (!bucket) continue;
            const share = o.ms / totalMs;
            bucket.impressions += impressions * share;
            bucket.clicks += clicks * share;
            bucket.atbs += atbs * share;
            bucket.orders += orders * share;
        }
    }
    return tally;
}

function numField(obj: Record<string, unknown>, keys: string[]): number {
    for (const k of keys) {
        if (obj[k] != null) return Number(obj[k]) || 0;
    }
    return 0;
}

function extractFunnelDays(data: Record<string, unknown>): Array<Record<string, unknown>> {
    const candidates = [data.data, data.history, data.items, data.days, data.result];
    for (const c of candidates) {
        if (Array.isArray(c) && c.length) {
            // Иногда это массив по товарам, каждый со своим history[]; иногда
            // сразу массив дней. Проверяем первую запись.
            const first = c[0] as Record<string, unknown>;
            if (first && Array.isArray(first.history)) {
                return (first.history as Array<Record<string, unknown>>);
            }
            return c as Array<Record<string, unknown>>;
        }
    }
    if (Array.isArray(data.cards) && data.cards.length) {
        const first = data.cards[0] as Record<string, unknown>;
        if (Array.isArray(first?.history)) return first.history as Array<Record<string, unknown>>;
    }
    return [];
}

// Уведомление в Telegram-канал о завершении теста: альбом из фото всех
// вариантов (sendMediaGroup) с подписью на первом фото — название товара,
// артикул, РК, время завершения и по каждому варианту CTR/дельта/вероятность
// победы (та же Beta-биномиальная модель, что и в вердикте на сайте, чтобы
// цифры не расходились). Защита от повторной отправки — notification_log по
// test_id (тест завершается один раз в жизни, поэтому проверяем факт, а не
// временное окно).
async function notifyTestFinished(
    admin: ReturnType<typeof createClient>,
    test: Record<string, unknown>,
    variants: Array<{ id: string; variant_label: string; photo_url?: string; impressions?: number; clicks?: number; is_currently_on_wb?: boolean }>,
): Promise<void> {
    const { data: dupes } = await admin
        .from('notification_log')
        .select('id')
        .eq('test_id', test.id as string)
        .eq('event_type', 'ab_test_finished')
        .limit(1);
    if (dupes && dupes.length) return;

    const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const tgChannelId = Deno.env.get('TELEGRAM_CHANNEL_ID') ?? '';
    const REPORT_BASE_URL = Deno.env.get('REPORT_BASE_URL') || 'https://nurcon.kg/ab-testing';

    const sorted = variants.slice().sort((a, b) => String(a.variant_label).localeCompare(String(b.variant_label), 'ru', { numeric: true }));
    const probs = probabilityBestByCtr(sorted);
    const maxProb = Math.max(...Array.from(probs.values()), 0);
    const leaderLabel = Array.from(probs.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

    // "Текущее" фото на карточке сейчас — та же логика, что при автозавершении
    // (is_currently_on_wb ещё не сброшен на момент вызова, либо смотрим по
    // current_variant_index как запасной вариант).
    const currentVariant = sorted.find((v) => v.is_currently_on_wb) || sorted[Number(test.current_variant_index) || 0] || sorted[0];
    const baselineCtr = currentVariant
        ? (Number(currentVariant.impressions) > 0 ? (Number(currentVariant.clicks) / Number(currentVariant.impressions) * 100) : 0)
        : 0;

    const selectedCampaigns: number[] = Array.isArray((test.settings as Record<string, unknown> | null)?.campaigns)
        ? ((test.settings as Record<string, unknown>).campaigns as unknown[]).map(Number).filter((n) => !isNaN(n))
        : [];
    const finishedAt = new Date();
    const finishedAtStr = finishedAt.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });

    const lines: string[] = [];
    lines.push(`${test.product_name || 'Товар ' + test.nm_id} · арт. ${test.nm_id}${selectedCampaigns.length ? ' · рк ' + selectedCampaigns[0] : ''}`);
    lines.push(`Тест завершён ${finishedAtStr}.`);

    for (const v of sorted) {
        const impressions = Number(v.impressions) || 0;
        const clicks = Number(v.clicks) || 0;
        const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
        const prob = probs.get(v.variant_label) || 0;
        const isCurrent = currentVariant && v.id === currentVariant.id;
        const isLeader = v.variant_label === leaderLabel && maxProb >= 0.5;
        const isClearLoser = !isLeader && sorted.length > 2 && prob > 0 && prob <= 0.15;
        const delta = isCurrent ? null : ctr - baselineCtr;

        let line = `Вариант ${v.variant_label}${isCurrent ? ' (текущий на ВБ)' : ''}: CTR ${ctr.toFixed(2)}%`;
        if (delta != null) line += ` (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`;
        if (isLeader) line += `, вероятность лучшего — ${Math.round(prob * 100)}% — победитель`;
        else if (isClearLoser) line += `, явно проигрывает`;
        else line += `, ${Math.round(prob * 100)}%`;
        lines.push(line);
    }

    lines.push(`Подробный отчёт: ${REPORT_BASE_URL}?test=${test.id}`);
    const caption = lines.join('\n');

    const photoUrls = sorted.map((v) => v.photo_url).filter((u): u is string => Boolean(u));

    if (tgToken && tgChannelId && photoUrls.length >= 2) {
        await sendTelegramMediaGroup(tgToken, tgChannelId, photoUrls, caption);
    } else if (tgToken && tgChannelId) {
        // Меньше 2 фото — sendMediaGroup у Telegram требует минимум 2,
        // отправляем просто текстом, чтобы уведомление всё равно дошло.
        await sendTelegramMessage(tgToken, tgChannelId, caption);
    } else {
        console.warn('[ab-test-rotate] TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID не заданы — уведомление о завершении теста не отправлено:', caption);
    }

    await admin.from('notification_log').insert({
        cabinet_id: test.cabinet_id as string,
        test_id: test.id as string,
        event_type: 'ab_test_finished',
        message_text: caption,
    });
}

async function sendTelegramMediaGroup(token: string, chatId: string, photoUrls: string[], caption: string): Promise<boolean> {
    try {
        // Telegram allows up to 10 items per album; MAX_AB_VARIANTS on the
        // frontend is already capped at 10, so no chunking needed here.
        const media = photoUrls.slice(0, 10).map((url, i) => ({
            type: 'photo',
            media: url,
            ...(i === 0 ? { caption } : {}),
        }));
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, media }),
        });
        if (!res.ok) {
            console.warn('[ab-test-rotate] telegram sendMediaGroup failed:', res.status, await res.text());
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[ab-test-rotate] telegram sendMediaGroup error:', String(e));
        return false;
    }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!res.ok) {
            console.warn('[ab-test-rotate] telegram sendMessage failed:', res.status, await res.text());
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[ab-test-rotate] telegram sendMessage error:', String(e));
        return false;
    }
}

// Оценка вероятности "победы" каждого варианта по CTR методом Монте-Карло
// на Beta-биномиальной модели (Beta(clicks+1, views-clicks+1)) — тот же
// подход используется на фронте для итогового отчёта, чтобы цифры совпадали.
function probabilityBestByCtr(
    variants: Array<{ variant_label: string; impressions?: number; clicks?: number }>,
    samples = 5000,
): Map<string, number> {
    const wins = new Map<string, number>();
    for (const v of variants) wins.set(v.variant_label, 0);
    for (let i = 0; i < samples; i++) {
        let bestLabel: string | null = null;
        let bestVal = -1;
        for (const v of variants) {
            const clicks = Math.max(0, Number(v.clicks) || 0);
            const views = Math.max(clicks, Number(v.impressions) || 0);
            const val = sampleBeta(clicks + 1, views - clicks + 1);
            if (val > bestVal) { bestVal = val; bestLabel = v.variant_label; }
        }
        if (bestLabel) wins.set(bestLabel, (wins.get(bestLabel) || 0) + 1);
    }
    const probs = new Map<string, number>();
    for (const [label, count] of wins) probs.set(label, count / samples);
    return probs;
}

function sampleGamma(shape: number): number {
    // Marsaglia & Tsang method, достаточно для shape >= 1; для shape < 1
    // используем boost trick через Gamma(shape+1) * U^(1/shape).
    if (shape < 1) {
        const u = Math.random();
        return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x: number, v: number;
        do {
            x = gaussian();
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.random();
        if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
    }
}

function gaussian(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleBeta(alpha: number, beta: number): number {
    const x = sampleGamma(Math.max(alpha, 0.01));
    const y = sampleGamma(Math.max(beta, 0.01));
    return x / (x + y);
}

// Строит непрерывные временные окна показа каждого варианта фото на основе
// лога ротаций: [created_at текущей записи; created_at следующей записи или
// "сейчас", если запись последняя].
function buildVariantWindows(
    log: Array<{ variant_label: string; created_at: string }>,
): Array<{ label: string; start: Date; end: Date }> {
    const now = new Date();
    return log.map((entry, i) => ({
        label: entry.variant_label,
        start: new Date(entry.created_at),
        end: i + 1 < log.length ? new Date(log[i + 1].created_at) : now,
    }));
}

// Mirrors wb-proxy's `media_save` action so the cron job can push a photo to
// WB without going through the user-JWT-gated proxy.
async function saveMediaOnWb(
    admin: ReturnType<typeof createClient>,
    wbToken: string,
    nmId: number,
    photoUrl: string,
): Promise<{ ok: boolean; errorText?: string }> {
    if (!nmId || !photoUrl) return { ok: false, errorText: 'nmId and photoUrl required' };

    let imageBytes: Uint8Array;
    let mimeType = 'image/jpeg';

    const storageMatch = String(photoUrl).match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
    if (storageMatch) {
        const bucket = storageMatch[1];
        const path = decodeURIComponent(storageMatch[2]);
        const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
        if (dlErr || !blob) {
            return { ok: false, errorText: `Не удалось скачать фото из хранилища: ${dlErr?.message || 'файл не найден'}` };
        }
        imageBytes = new Uint8Array(await blob.arrayBuffer());
        mimeType = blob.type || mimeType;
    } else {
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) {
            return { ok: false, errorText: `WB не сможет скачать фото (HTTP ${imgRes.status}).` };
        }
        imageBytes = new Uint8Array(await imgRes.arrayBuffer());
        mimeType = imgRes.headers.get('content-type') || mimeType;
    }

    if (imageBytes.length < 1000) {
        return { ok: false, errorText: 'Файл слишком маленький или пустой' };
    }

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('uploadfile', new Blob([imageBytes], { type: mimeType }), `abtest.${ext}`);

    const fileRes = await fetch('https://content-api.wildberries.ru/content/v3/media/file', {
        method: 'POST',
        headers: {
            Authorization: wbToken,
            'X-Nm-Id': String(nmId),
            'X-Photo-Number': '1',
        },
        body: form,
    });
    const fileJson = await fileRes.json().catch(() => ({})) as Record<string, unknown>;
    const errText = String(fileJson?.errorText || fileJson?.additionalErrors || '');
    if (!fileRes.ok || fileJson?.error === true || errText) {
        return { ok: false, errorText: errText || `WB API ${fileRes.status}` };
    }
    return { ok: true };
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function isValidWbToken(token: string): boolean {
    return token.length > 50 && /^[\x21-\x7E]+$/.test(token);
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
