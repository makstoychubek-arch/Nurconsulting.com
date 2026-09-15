// Supabase Edge Function: ab-test-rotate
// Server-side cron job that actually performs A/B test photo rotations on WB,
// independent of whether the dashboard tab is open in any browser.
// Auth: service_role key only (triggered by pg_cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    buildAbReportCard,
    demoAbReportCard,
    formatAbReportCaption,
    probabilityBestByCtr,
    type AbReportVariantIn,
} from '../_shared/ab-test-report-card.ts';
import { renderAbReportPng } from '../_shared/ab-test-report-png.ts';
import {
    extractMainPhotoUrl,
    hashWbPhotoSlot,
    mainPhotoChanged,
    probeWbBasketHost,
    WB_MAIN_PHOTO_SLOT,
} from '../_shared/wb-main-photo.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!isServiceAuthorized(req, serviceKey)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action || '');

    try {
        if (action === 'demo_snapshot') return await handleDemoSnapshot();
        if (action === 'preview_notify') return await handlePreviewNotify(admin, body);
        if (action === 'verify_main_photo') return await handleVerifyMainPhoto(admin, body);
        if (action === 'force_rotate') return await handleForceRotate(admin, body);

        const results: Array<Record<string, unknown>> = [];
        const { data: tests, error: testsErr } = await admin
            .from('ab_tests')
            .select('*')
            .eq('status', 'active');

        if (testsErr) throw new Error(`ab_tests: ${testsErr.message}`);

        for (const test of tests || []) {
            try {
                results.push(await rotateActiveTest(admin, test));
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

                    const autoStop = (test.settings as Record<string, unknown> | null)?.autoStop !== false;
                    const minImpressions = Number((test.settings as Record<string, unknown> | null)?.minImpressions) || 2000;
                    if (!finishReason && autoStop) {
                        const fresh = await admin.from('ab_test_variants').select('*').eq('test_id', test.id);
                        const freshVariants = fresh.data || [];
                        const eachReady = freshVariants.length >= 2
                            && freshVariants.every((v) => (Number(v.impressions) || 0) >= minImpressions);
                        if (eachReady) finishReason = 'impressions_cap';
                    }

                    if (finishReason) {
                        const current = variants.find((v) => v.is_currently_on_wb) || variants[Number(test.current_variant_index) || 0];
                        if (current) {
                            await admin.from('ab_test_variants').update({
                                minutes_active: (Number(current.minutes_active) || 0) + Math.floor((Date.now() - new Date(test.last_rotated_at || test.started_at).getTime()) / 60000),
                                is_currently_on_wb: false,
                            }).eq('id', current.id);
                        }
                        const { data: latestVars } = await admin.from('ab_test_variants').select('*').eq('test_id', test.id);
                        const ranked = [...(latestVars || variants)].sort((a, b) => {
                            const ctrA = (Number(a.impressions) || 0) > 0 ? (Number(a.clicks) || 0) / Number(a.impressions) : 0;
                            const ctrB = (Number(b.impressions) || 0) > 0 ? (Number(b.clicks) || 0) / Number(b.impressions) : 0;
                            return ctrB - ctrA;
                        });
                        const winner = ranked[0];
                        if (winner?.photo_url) {
                            const { data: cabRow } = await admin.from('cabinets')
                                .select('wb_token, wb_token_promotion, wb_token_analytics')
                                .eq('id', test.cabinet_id)
                                .maybeSingle();
                            const contentToken = sanitizeWbToken(cabRow?.wb_token);
                            if (isValidWbToken(contentToken)) {
                                await saveMediaOnWb(admin, contentToken, Number(test.nm_id), winner.photo_url);
                            }
                            await admin.from('ab_test_variants').update({ is_currently_on_wb: false }).eq('test_id', test.id);
                            await admin.from('ab_test_variants').update({ is_currently_on_wb: true }).eq('id', winner.id);
                        }
                        await pauseAbCampaigns(admin, test);
                        await admin.from('ab_tests').update({
                            status: 'finished',
                            finished_at: new Date().toISOString(),
                            finish_reason: finishReason,
                        }).eq('id', test.id);
                        await admin.from('ab_test_rotation_log').insert({
                            test_id: test.id,
                            variant_label: winner?.variant_label || current?.variant_label || 'stop',
                            action: 'stop',
                        });
                        statsResults.push({ test_id: test.id, autoFinished: finishReason, pausedCampaigns: true });
                    }
                }

                // ── Уведомление в Telegram-канал по завершении теста ─────────
                // Срабатывает и для теста, завершённого автоматически прямо
                // сейчас (веткой выше), и для теста, завершённого вручную с
                // дашборда (status='finished' уже стоит) — notifyTestFinished
                // сам проверяет notification_log и шлёт сообщение только один
                // раз за всю жизнь теста (не по временному окну, а навсегда).
                const { data: freshTest } = await admin.from('ab_tests').select('*').eq('id', test.id).maybeSingle();
                if (freshTest?.status === 'finished') {
                    const { data: notifyVars } = await admin.from('ab_test_variants').select('*').eq('test_id', test.id);
                    await notifyTestFinished(admin, freshTest, notifyVars || variants);
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

// Уведомление в Telegram-канал А/Б: PNG-снимок отчёта как на сайте
// (фото вариантов, CTR, дельта, вердикт), плюс короткая подпись со ссылкой.
// Если canvas не собрался — запасной альбом из фото вариантов.
// Демо/проверка канала: skipDedupe, event_type ab_test_finished_preview.
async function notifyTestFinished(
    admin: ReturnType<typeof createClient>,
    test: Record<string, unknown>,
    variants: AbReportVariantIn[],
    opts: { preview?: boolean; skipDedupe?: boolean } = {},
): Promise<{ sent: boolean; via: string; error?: string }> {
    const eventType = opts.preview ? 'ab_test_finished_preview' : 'ab_test_finished';
    if (!opts.skipDedupe && !opts.preview) {
        const { data: dupes } = await admin
            .from('notification_log')
            .select('id')
            .eq('test_id', test.id as string)
            .eq('event_type', 'ab_test_finished')
            .limit(1);
        if (dupes && dupes.length) return { sent: false, via: 'deduped' };
    }

    if (!opts.preview) {
        const gate = await shouldSendTelegram(admin, {
            channel: 'ab_tests',
            cabinetId: (test.cabinet_id as string) || null,
        });
        if (!gate.ok) return { sent: false, via: 'gated', error: gate.reason };
    }

    const tgToken = getTelegramToken();
    const tgChannelId = getTelegramChatId('ab_tests');
    if (!tgToken || !tgChannelId) {
        return { sent: false, via: 'no_telegram', error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_AB_TESTS не заданы' };
    }

    const model = await buildNotifyModel(admin, test, variants, opts.preview === true);
    const caption = formatAbReportCaption(model);

    let via = 'text';
    try {
        const png = await renderAbReportPng(model);
        const photoErr = await sendTelegramPhoto(tgToken, tgChannelId, png, caption);
        if (!photoErr) via = 'snapshot';
        else {
            console.warn('[ab-test-rotate] sendPhoto failed:', photoErr);
            const photoUrls = model.variants.map((v) => v.photoUrl).filter(Boolean);
            if (photoUrls.length >= 2) {
                const ok = await sendTelegramMediaGroup(tgToken, tgChannelId, photoUrls, caption);
                via = ok ? 'album' : 'text';
                if (!ok) await sendTelegramMessage(tgToken, tgChannelId, caption);
            } else {
                await sendTelegramMessage(tgToken, tgChannelId, caption);
            }
        }
    } catch (e) {
        console.warn('[ab-test-rotate] snapshot render failed:', String(e));
        const photoUrls = model.variants.map((v) => v.photoUrl).filter(Boolean);
        if (photoUrls.length >= 2) {
            const ok = await sendTelegramMediaGroup(tgToken, tgChannelId, photoUrls, caption);
            via = ok ? 'album' : 'text';
            if (!ok) await sendTelegramMessage(tgToken, tgChannelId, caption);
        } else {
            await sendTelegramMessage(tgToken, tgChannelId, caption);
        }
    }

    await admin.from('notification_log').insert({
        cabinet_id: (test.cabinet_id as string) || null,
        test_id: (test.id as string) || null,
        event_type: eventType,
        message_text: caption,
    });
    return { sent: true, via };
}

async function buildNotifyModel(
    admin: ReturnType<typeof createClient>,
    test: Record<string, unknown>,
    variants: AbReportVariantIn[],
    preview: boolean,
) {
    const REPORT_BASE_URL = Deno.env.get('REPORT_BASE_URL') || 'https://nurcon.kg/ab-testing';
    const selectedCampaigns: number[] = Array.isArray((test.settings as Record<string, unknown> | null)?.campaigns)
        ? ((test.settings as Record<string, unknown>).campaigns as unknown[]).map(Number).filter((n) => !isNaN(n))
        : [];
    const savedNames = ((test.settings as Record<string, unknown> | null)?.campaignNames || {}) as Record<string, string>;
    let campLabel = '';
    if (selectedCampaigns.length && test.cabinet_id) {
        const { data: campRows } = await admin
            .from('advertising_campaigns')
            .select('campaign_id, campaign_name')
            .eq('cabinet_id', test.cabinet_id as string)
            .in('campaign_id', selectedCampaigns);
        const nameById = new Map((campRows || []).map((r) => [Number(r.campaign_id), String(r.campaign_name || '').trim()]));
        campLabel = selectedCampaigns.map((id) => {
            const name = savedNames[String(id)] || nameById.get(id) || '';
            return name ? `${name} (${id})` : `рк ${id}`;
        }).join(', ');
    }
    const finishedAtStr = new Date().toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
    });
    const live = variants.find((v) => v.is_currently_on_wb)
        || variants[Number(test.current_variant_index) || 0]
        || variants[0];
    return buildAbReportCard({
        title: String(test.product_name || `Товар ${test.nm_id}`),
        nmId: test.nm_id as string | number,
        campaignLabel: campLabel,
        finishedAtStr,
        reason: String(test.finish_reason || ''),
        reportUrl: test.id ? `${REPORT_BASE_URL}?test=${test.id}` : REPORT_BASE_URL,
        preview,
        variants,
        currentVariantId: live?.id,
        probs: probabilityBestByCtr(variants),
    });
}

async function sendTelegramMediaGroup(token: string, chatId: string, photoUrls: string[], caption: string): Promise<boolean> {
    try {
        // Telegram allows up to 10 items per album; MAX_AB_VARIANTS on the
        // frontend is already capped at 10, so no chunking needed here.
        const media = photoUrls.slice(0, 10).map((url, i) => ({
            type: 'photo',
            media: url,
            ...(i === 0 ? { caption: caption.slice(0, 1024), parse_mode: 'HTML' } : {}),
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
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
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

async function sendTelegramPhoto(token: string, chatId: string, png: Uint8Array, caption: string): Promise<string | null> {
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
        form.append('photo', new Blob([png], { type: 'image/png' }), 'ab-report.png');
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form,
        });
        if (!res.ok) {
            const errText = await res.text();
            console.warn('[ab-test-rotate] telegram sendPhoto failed:', res.status, errText);
            return `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        }
        return null;
    } catch (e) {
        return String(e);
    }
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
            'X-Photo-Number': String(WB_MAIN_PHOTO_SLOT),
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

async function pauseAbCampaigns(
    admin: ReturnType<typeof createClient>,
    test: Record<string, unknown>,
): Promise<void> {
    const ids = Array.isArray((test.settings as Record<string, unknown> | null)?.campaigns)
        ? ((test.settings as Record<string, unknown>).campaigns as unknown[]).map(Number).filter((n) => n > 0)
        : [];
    if (!ids.length) return;
    const { data: cab } = await admin
        .from('cabinets')
        .select('wb_token, wb_token_promotion')
        .eq('id', test.cabinet_id as string)
        .maybeSingle();
    const token = pickCabinetToken(cab || {}, 'promotion');
    if (!isValidWbToken(token)) {
        console.warn('[ab-test-rotate] pause: no promotion token');
        return;
    }
    for (const id of ids) {
        try {
            const res = await fetch(`https://advert-api.wildberries.ru/adv/v0/pause?id=${id}`, {
                method: 'GET',
                headers: { Authorization: token },
            });
            if (!res.ok) {
                console.warn('[ab-test-rotate] pause RK', id, res.status, (await res.text()).slice(0, 180));
                continue;
            }
            await admin.from('advertising_campaigns').update({
                status: 11,
                updated_at: new Date().toISOString(),
            }).eq('cabinet_id', test.cabinet_id as string).eq('campaign_id', id);
        } catch (e) {
            console.warn('[ab-test-rotate] pause RK', id, e);
        }
    }
}

type Admin = ReturnType<typeof createClient>;

async function rotateActiveTest(
    admin: Admin,
    test: Record<string, unknown>,
    opts: { ignoreDue?: boolean } = {},
): Promise<Record<string, unknown>> {
    const intervalMin = Number(test.rotation_interval_min) || 60;
    const dueSince = test.last_rotated_at || test.started_at;
    const elapsedMs = dueSince ? Date.now() - new Date(String(dueSince)).getTime() : Infinity;
    if (!opts.ignoreDue && elapsedMs < intervalMin * 60 * 1000) {
        return { test_id: test.id, skipped: 'not_due' };
    }

    const { data: variants, error: vErr } = await admin
        .from('ab_test_variants')
        .select('*')
        .eq('test_id', test.id)
        .order('variant_label');
    if (vErr) throw new Error(vErr.message);
    if (!variants || variants.length < 2) {
        return { test_id: test.id, skipped: 'not_enough_variants' };
    }

    const { data: cab, error: cabErr } = await admin
        .from('cabinets')
        .select('wb_token')
        .eq('id', test.cabinet_id)
        .maybeSingle();
    if (cabErr || !cab?.wb_token) {
        return { test_id: test.id, error: 'cabinet_or_token_missing' };
    }
    const WB_TOKEN = sanitizeWbToken(cab.wb_token);
    if (!isValidWbToken(WB_TOKEN)) {
        return { test_id: test.id, error: 'invalid_wb_token' };
    }

    const curIdx = Number(test.current_variant_index) || 0;
    const nextIdx = (curIdx + 1) % variants.length;
    const currentVariant = variants[curIdx];
    const nextVariant = variants[nextIdx];

    const rotateOk = await saveMediaOnWb(admin, WB_TOKEN, Number(test.nm_id), nextVariant.photo_url);
    if (!rotateOk.ok) {
        return { test_id: test.id, error: rotateOk.errorText || 'wb_media_save_failed' };
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
    if (shouldFinish) await pauseAbCampaigns(admin, test);

    return {
        ok: true,
        test_id: test.id,
        rotated_to: nextVariant.variant_label,
        finished: shouldFinish,
        photo_slot: WB_MAIN_PHOTO_SLOT,
        nm_id: test.nm_id,
    };
}

async function handleDemoSnapshot(): Promise<Response> {
    const tgToken = getTelegramToken();
    const tgChannelId = getTelegramChatId('ab_tests');
    if (!tgToken || !tgChannelId) {
        return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_AB_TESTS не заданы' }, 400);
    }
    const model = demoAbReportCard();
    const png = await renderAbReportPng(model);
    const caption = formatAbReportCaption(model);
    const err = await sendTelegramPhoto(tgToken, tgChannelId, png, caption);
    if (err) return json({ ok: false, error: err }, 502);
    return json({ ok: true, via: 'snapshot', preview: true, variants: model.variants.length });
}

async function handlePreviewNotify(admin: Admin, body: Record<string, unknown>): Promise<Response> {
    let test: Record<string, unknown> | null = null;
    if (body.test_id) {
        const { data } = await admin.from('ab_tests').select('*').eq('id', body.test_id).maybeSingle();
        test = data;
    } else {
        const { data } = await admin
            .from('ab_tests')
            .select('*')
            .eq('status', 'finished')
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        test = data;
    }
    if (!test) {
        return handleDemoSnapshot();
    }
    const { data: variants } = await admin.from('ab_test_variants').select('*').eq('test_id', test.id);
    const result = await notifyTestFinished(admin, { ...test, finish_reason: test.finish_reason || 'impressions_cap' }, variants || [], {
        preview: true,
        skipDedupe: true,
    });
    return json({ ok: result.sent, ...result, test_id: test.id, nm_id: test.nm_id, product: test.product_name });
}

async function handleForceRotate(admin: Admin, body: Record<string, unknown>): Promise<Response> {
    const testId = String(body.test_id || '');
    if (!testId) return json({ error: 'test_id required' }, 400);
    const { data: test } = await admin.from('ab_tests').select('*').eq('id', testId).maybeSingle();
    if (!test || test.status !== 'active') return json({ error: 'not_active' }, 400);
    const result = await rotateActiveTest(admin, test, { ignoreDue: true });
    if (result.error) return json({ ok: false, ...result }, 200);
    return json({ ok: true, ...result });
}

async function fetchWbCard(token: string, nmId: number): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: {
                    filter: { textSearch: String(nmId), withPhoto: -1 },
                    cursor: { limit: 10 },
                },
            }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { cards?: Record<string, unknown>[] };
        const cards = data?.cards || [];
        return cards.find((c) => Number(c.nmID ?? c.nmId ?? 0) === nmId) || cards[0] || null;
    } catch {
        return null;
    }
}

async function sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
}

async function handleVerifyMainPhoto(admin: Admin, body: Record<string, unknown>): Promise<Response> {
    // mutate только по явному флагу — иначе случайный вызов сменит обложку на WB.
    const mutate = body.mutate === true;
    const nmOverride = Number(body.nm_id || 0);
    let test: Record<string, unknown> | null = null;
    if (body.test_id) {
        const { data } = await admin.from('ab_tests').select('*').eq('id', body.test_id).maybeSingle();
        test = data;
    } else if (!nmOverride) {
        const { data } = await admin
            .from('ab_tests')
            .select('*')
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        test = data;
    }
    const nmId = nmOverride || Number(test?.nm_id || 0);
    if (!nmId) {
        return json({ ok: false, error: 'no_nm_id', photo_slot: WB_MAIN_PHOTO_SLOT });
    }
    if (!test) {
        const basketOnly = await probeWbBasketHost(nmId);
        const s1 = basketOnly ? await hashWbPhotoSlot(basketOnly, nmId, WB_MAIN_PHOTO_SLOT) : null;
        const s2 = basketOnly ? await hashWbPhotoSlot(basketOnly, nmId, 2) : null;
        return json({
            ok: Boolean(s1),
            mutated: false,
            photo_slot: WB_MAIN_PHOTO_SLOT,
            nm_id: nmId,
            basket: basketOnly,
            slot1: s1,
            slot2: s2,
            slot1_is_main: true,
            slot1_differs_from_slot2: Boolean(s1 && s2 && s1.sha !== s2.sha),
            note: 'нет активного теста — только чтение CDN, слот 1 это обложка',
        });
    }
    const { data: cab } = await admin.from('cabinets').select('wb_token').eq('id', test.cabinet_id).maybeSingle();
    const token = sanitizeWbToken(cab?.wb_token);
    const basket = await probeWbBasketHost(nmId);
    const before1 = basket ? await hashWbPhotoSlot(basket, nmId, WB_MAIN_PHOTO_SLOT) : null;
    const before2 = basket ? await hashWbPhotoSlot(basket, nmId, 2) : null;
    const cardBefore = isValidWbToken(token) ? await fetchWbCard(token, nmId) : null;
    const apiPhotoBefore = extractMainPhotoUrl(cardBefore);

    if (!mutate || test.status !== 'active') {
        return json({
            ok: Boolean(before1),
            mutated: false,
            photo_slot: WB_MAIN_PHOTO_SLOT,
            nm_id: nmId,
            product: test.product_name,
            basket,
            slot1: before1,
            slot2: before2,
            content_api_main: apiPhotoBefore,
            note: test.status !== 'active'
                ? 'тест не активен — фото на WB не трогали'
                : 'mutate=false, только чтение',
        });
    }

    const rotated = await rotateActiveTest(admin, test, { ignoreDue: true });
    if (rotated.error || rotated.skipped) {
        return json({ ok: false, rotate: rotated, slot1_before: before1, slot2_before: before2, basket });
    }

    let after1 = before1;
    let after2 = before2;
    for (let i = 0; i < 4; i++) {
        await sleep(2500);
        after1 = basket ? await hashWbPhotoSlot(basket, nmId, WB_MAIN_PHOTO_SLOT) : null;
        after2 = basket ? await hashWbPhotoSlot(basket, nmId, 2) : null;
        const cmpTry = mainPhotoChanged(before1, after1, before2, after2);
        if (cmpTry.slot1Changed) break;
    }
    const cmp = mainPhotoChanged(before1, after1, before2, after2);
    const cardAfter = isValidWbToken(token) ? await fetchWbCard(token, nmId) : null;

    return json({
        ok: cmp.ok,
        mutated: true,
        photo_slot: WB_MAIN_PHOTO_SLOT,
        nm_id: nmId,
        product: test.product_name,
        rotated_to: rotated.rotated_to,
        basket,
        slot1_changed: cmp.slot1Changed,
        slot2_stable: cmp.slot2Stable,
        slot1_before: before1,
        slot1_after: after1,
        slot2_before: before2,
        slot2_after: after2,
        content_api_main_before: apiPhotoBefore,
        content_api_main_after: extractMainPhotoUrl(cardAfter),
        wb_api: 'content/v3/media/file X-Photo-Number=1',
    });
}
