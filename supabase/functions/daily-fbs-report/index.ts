// Supabase Edge Function: daily-fbs-report
// Ежедневный сводный отчёт FBS → Telegram (картинка + Excel).
// Cron: 01:00 UTC = 07:00 Бишкек (см. миграцию daily_fbs_report).
//
// Auth: service_role / setup (service-auth.ts)
// Body:
//   { "date": "YYYY-MM-DD" } — отчётный день (по умолчанию вчера Бишкек)
//   { "force": true } — игнор дедупа
//   { "test": true } — только проверка Telegram-канала (текст)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    getTelegramChatId,
    getTelegramToken,
    isTelegramConfigured,
    telegramConfigError,
} from '../_shared/telegram-routing.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
    CABINET_TOKEN_SELECT,
    isValidWbToken,
    pickCabinetToken,
} from '../_shared/wb-cabinet-tokens.ts';
import {
    fetchWbFbsOrdersForDay,
    prettyRuDate,
    yesterdayBishkek,
    type FbsOrderRow,
} from '../_shared/wb-fbs-orders.ts';
import { buildFbsExcel } from '../_shared/fbs-excel.ts';
import { aggregateByModel, renderFbsSummaryImage } from '../_shared/fbs-summary-image.ts';
import {
    karinaFbsCaption,
    karinaFbsDocumentCaption,
    karinaFbsTestMessage,
} from '../_shared/karina-voice.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-nr-setup-key',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    if (!isServiceAuthorized(req, serviceKey, Boolean(body?.test || body?.force))) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const tgToken = getTelegramToken();
    const tgChatId = getTelegramChatId('fbs');

    if (body?.test) {
        if (!isTelegramConfigured('fbs')) {
            return json({ ok: false, error: telegramConfigError('fbs'), chatId: tgChatId || null }, 400);
        }
        const err = await sendTelegramMessage(tgToken, tgChatId, karinaFbsTestMessage());
        return json({ ok: !err, error: err, chatId: tgChatId });
    }

    if (!isTelegramConfigured('fbs')) {
        return json({ error: telegramConfigError('fbs') }, 400);
    }

    const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : yesterdayBishkek();
    const force = Boolean(body?.force);
    const admin = createClient(supabaseUrl, serviceKey);
    const pretty = prettyRuDate(reportDate);
    const eventType = `daily_fbs_${reportDate}`;

    try {
        if (!force) {
            const { data: dupes } = await admin
                .from('notification_log')
                .select('id')
                .eq('event_type', eventType)
                .limit(1);
            if (dupes?.length) {
                return json({ ok: true, skipped: 'already_sent', date: reportDate, ms: Date.now() - started });
            }
        }

        const { data: activeRows, error: actErr } = await admin
            .from('fbs_active_cabinets')
            .select('cabinet')
            .eq('is_active', true);
        if (actErr) throw new Error(`fbs_active_cabinets: ${actErr.message}`);

        const activeNames = (activeRows || []).map((r) => String(r.cabinet));
        if (!activeNames.length) {
            await admin.from('fbs_report_log').insert({
                report_date: reportDate,
                status: 'error',
                rows_count: 0,
                cabinets: [],
                errors: [{ error: 'no_active_cabinets' }],
                message: 'Нет активных FBS-кабинетов',
            });
            return json({ ok: false, error: 'no_active_cabinets', date: reportDate }, 400);
        }

        const { data: cabinets, error: cabErr } = await admin
            .from('cabinets')
            .select(CABINET_TOKEN_SELECT)
            .in('name', activeNames);
        if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);

        const cabByName = new Map((cabinets || []).map((c) => [c.name, c]));
        const allRows: FbsOrderRow[] = [];
        const cabinetStats: Array<Record<string, unknown>> = [];
        const failedCabinets: string[] = [];

        for (const name of activeNames) {
            const cab = cabByName.get(name);
            const stat: Record<string, unknown> = { cabinet: name };
            if (!cab) {
                failedCabinets.push(name);
                stat.error = 'cabinet_not_found';
                cabinetStats.push(stat);
                continue;
            }
            const token = pickCabinetToken(cab, 'default');
            if (!isValidWbToken(token)) {
                failedCabinets.push(name);
                stat.error = 'invalid_token';
                cabinetStats.push(stat);
                continue;
            }
            try {
                const fetched = await fetchWbFbsOrdersForDay(token, name, reportDate);
                // Дедуп по order_id (пагинация WB иногда отдаёт пересечения)
                const byId = new Map<string, FbsOrderRow>();
                for (const r of fetched) {
                    const key = r.orderId || `${r.barcode}:${r.orderCreatedAt.toISOString()}`;
                    if (!byId.has(key)) byId.set(key, r);
                }
                const rows = [...byId.values()];

                // Перезапись сырых строк за день+кабинет
                const { error: delErr } = await admin
                    .from('fbs_daily_orders')
                    .delete()
                    .eq('report_date', reportDate)
                    .eq('marketplace', 'wb')
                    .eq('cabinet', name);
                if (delErr) throw new Error(`delete: ${delErr.message}`);

                if (rows.length) {
                    const payload = rows.map((r) => ({
                        report_date: reportDate,
                        marketplace: r.marketplace,
                        cabinet: r.cabinet,
                        order_id: r.orderId || null,
                        nm_id: r.nmId,
                        barcode: r.barcode,
                        article: r.article,
                        product_name: r.productName,
                        size: r.size || null,
                        qty: r.qty,
                        order_created_at: r.orderCreatedAt.toISOString(),
                    }));
                    const { error: insErr } = await admin.from('fbs_daily_orders').insert(payload);
                    if (insErr) throw new Error(`insert: ${insErr.message}`);
                }

                allRows.push(...rows);
                stat.orders = rows.length;
                cabinetStats.push(stat);
            } catch (e) {
                failedCabinets.push(name);
                stat.error = String(e);
                cabinetStats.push(stat);
            }
        }

        // Агрегация для Excel
        const aggMap = new Map<string, {
            barcode: string;
            article: string;
            productName: string;
            size: string;
            qty: number;
        }>();
        for (const r of allRows) {
            const key = `${r.barcode}|${r.productName}|${r.size}`;
            const cur = aggMap.get(key);
            if (cur) cur.qty += r.qty;
            else {
                aggMap.set(key, {
                    barcode: r.barcode,
                    article: r.article,
                    productName: r.productName,
                    size: r.size,
                    qty: r.qty,
                });
            }
        }
        const excelRows = [...aggMap.values()];
        const models = aggregateByModel(excelRows);
        const totalQty = excelRows.reduce((a, r) => a + r.qty, 0);

        const png = await renderFbsSummaryImage(pretty, models);
        const caption = karinaFbsCaption({
            prettyDate: pretty,
            totalQty,
            modelsCount: models.length,
            failedCabinets,
        });
        const docCaption = karinaFbsDocumentCaption();

        let photoErr = await sendTelegramPhoto(tgToken, tgChatId, png, caption);
        if (photoErr) {
            await sleep(1500);
            photoErr = await sendTelegramPhoto(tgToken, tgChatId, png, caption);
        }
        if (photoErr) throw new Error(`telegram photo: ${photoErr}`);

        if (excelRows.length) {
            const xlsx = await buildFbsExcel(excelRows, reportDate);
            const fileName = `FBS_заказы_${reportDate}.xlsx`;
            let docErr = await sendTelegramDocument(
                tgToken,
                tgChatId,
                xlsx,
                fileName,
                docCaption,
            );
            if (docErr) {
                await sleep(1500);
                docErr = await sendTelegramDocument(
                    tgToken,
                    tgChatId,
                    xlsx,
                    fileName,
                    docCaption,
                );
            }
            if (docErr) throw new Error(`telegram document: ${docErr}`);
        }

        const status = failedCabinets.length
            ? (allRows.length ? 'partial' : 'error')
            : (allRows.length ? 'success' : 'empty');

        await admin.from('fbs_report_log').insert({
            report_date: reportDate,
            status,
            rows_count: allRows.length,
            cabinets: cabinetStats,
            errors: failedCabinets.length ? failedCabinets.map((c) => ({ cabinet: c })) : [],
            message: `sent ${allRows.length} raw / ${excelRows.length} agg`,
        });

        const primaryCab = cabByName.get(activeNames[0]);
        await admin.from('notification_log').insert({
            cabinet_id: primaryCab?.id ?? null,
            campaign_id: null,
            event_type: eventType,
            message_text: `fbs ${reportDate}: ${allRows.length} orders, status=${status}`,
        });

        return json({
            ok: true,
            date: reportDate,
            status,
            fetched: allRows.length,
            aggregated: excelRows.length,
            models: models.length,
            totalQty,
            failedCabinets,
            cabinetStats,
            chatId: tgChatId,
            ms: Date.now() - started,
        });
    } catch (e) {
        console.error('[daily-fbs-report]', e);
        try {
            await admin.from('fbs_report_log').insert({
                report_date: reportDate,
                status: 'error',
                rows_count: 0,
                cabinets: [],
                errors: [{ error: String(e) }],
                message: String(e),
            });
        } catch { /* ignore log failure */ }
        return json({ error: String(e), date: reportDate }, 500);
    }
});

async function sendTelegramPhoto(
    token: string,
    chatId: string,
    png: Uint8Array,
    caption: string,
): Promise<string | null> {
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
        form.append('photo', new Blob([png], { type: 'image/png' }), 'fbs-summary.png');
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        return null;
    } catch (e) {
        return String(e);
    }
}

async function sendTelegramDocument(
    token: string,
    chatId: string,
    bytes: Uint8Array,
    fileName: string,
    caption: string,
): Promise<string | null> {
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append(
            'document',
            new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }),
            fileName,
        );
        const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        return null;
    } catch (e) {
        return String(e);
    }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<string | null> {
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
            signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        return null;
    } catch (e) {
        return String(e);
    }
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
