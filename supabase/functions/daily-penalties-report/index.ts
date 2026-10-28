// Supabase Edge Function: daily-penalties-report
// Ежедневный отчёт в Telegram-группу «Штрафы»: карточка-картинка в стиле А/Б-отчёта,
// под ней только отметка ответственного (если штрафы есть).
// Cron: 01:10 UTC (07:10 Бишкек). Auth: service_role key ИЛИ JWT этого проекта
// (ключ в cron и секрет функции расходятся — байт-в-байт сверка ломала канал).
//
// WB: sales-reports/list (daily) → detailed/{reportId} со slim fields,
// иначе последний закрытый weekly. Поле операции — sellerOperName.
//
// Запуски: основной в 07:10 Бишкек и повторы каждый час до 18:10: WB выдаёт дневной отчёт с задержкой.
// Пока отчёта нет, молчим и не пишем в журнал; как только появился, шлём один раз (журнал не даёт дублей).
// Последний запуск дня идёт с final: true и один раз сообщает, что WB отчёт так и не выдал.
//
// Тело: { "date", "force", "test", "health", "final", "cabinets": ["Имя"] }
// test: true — отправить и сразу удалить (не оставляем мусор).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { fetchWeeklyPenaltyBundle, prettyRuDate } from '../_shared/wb-penalties-snapshot.ts';
import { cabinetLegalName } from '../_shared/wb-restock-reply.ts';
import { renderPenaltyCardPng } from '../_shared/penalty-card-png.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_USERNAME = (Deno.env.get('TELEGRAM_ALERT_USERNAME') || 'maraWuW').replace(/^@/, '');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tgToken = getTelegramToken() || (Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '');
    const tgChatId = getTelegramChatId('penalties');

    if (!await isServiceAuthorized(req, serviceKey)) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (body?.health === true) {
        return json({
            ok: true,
            health: true,
            chat: tgChatId ? `…${tgChatId.slice(-6)}` : '',
            token: Boolean(tgToken),
        });
    }
    if (!tgToken || !tgChatId) {
        return json({
            error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_PENALTIES не заданы',
        }, 400);
    }
    // Служебное: убрать ошибочно отправленные сообщения (только с сервисным ключом)
    if (Array.isArray(body?.delete_message_ids)) {
        const deleted: number[] = [];
        const failed: Array<Record<string, unknown>> = [];
        for (const raw of body.delete_message_ids as unknown[]) {
            const id = Number(raw);
            if (!Number.isFinite(id)) continue;
            const err = await deleteTelegramMessage(tgToken, tgChatId, id);
            if (err) failed.push({ id, error: String(err) }); else deleted.push(id);
        }
        return json({ ok: true, deleted, failed });
    }

    const isTest = body?.test === true;
    const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : yesterdayBishkek();
    const onlyCabinets: string[] | null = Array.isArray(body?.cabinets) ? body.cabinets.map(String) : null;

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: cabinets, error: cabErr } = await admin
            .from('cabinets')
            .select('id, name, wb_token')
            .not('wb_token', 'is', null)
            .gt('wb_token', '')
            .eq('nr_managed', true); // только кабинеты команды, не клиентов
        if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);

        const targets = (cabinets || []).filter((c) => !onlyCabinets || onlyCabinets.includes(c.name));
        for (let i = 0; i < targets.length; i++) {
            const cabinet = targets[i];
            const cabResult: Record<string, unknown> = { cabinet: cabinet.name };
            try {
                const gate = await shouldSendTelegram(admin, { channel: 'penalties', cabinetId: cabinet.id });
                if (!gate.ok) {
                    cabResult.skipped = gate.reason;
                    results.push(cabResult);
                    continue;
                }
                const token = sanitizeWbToken(cabinet.wb_token);
                if (!token || token.length < 50) {
                    cabResult.skipped = 'invalid_token';
                    results.push(cabResult);
                    continue;
                }

                const eventType = `daily_penalties_${reportDate}`;
                if (!isTest) {
                    const { data: dupes } = await admin
                        .from('notification_log')
                        .select('id')
                        .eq('cabinet_id', cabinet.id)
                        .eq('event_type', eventType)
                        .limit(1);
                    if (dupes?.length && !body?.force) {
                        cabResult.skipped = 'already_sent';
                        results.push(cabResult);
                        continue;
                    }
                }

                const bundle = await fetchWeeklyPenaltyBundle(token, reportDate);
                if (!bundle.ready) {
                    cabResult.skipped = 'report_not_ready';
                    if (body?.final === true && !isTest) {
                        const text = `🕓 <b>${esc(cabinetLegalName(cabinet.name))}</b> — штрафы за ${prettyRuDate(reportDate)}\nWB так и не выдал дневной отчёт. Проверим завтра.`;
                        const tg = await sendTelegramMessage(tgToken, tgChatId, text);
                        if (!tg.error) {
                            await admin.from('notification_log').insert({
                                cabinet_id: cabinet.id, campaign_id: null, event_type: eventType,
                                message_text: `penalties ${reportDate}: report not published`,
                            });
                            cabResult.sent_notice = true;
                        }
                    }
                    results.push(cabResult);
                    if (i < targets.length - 1) await sleep(1500);
                    continue;
                }
                const rows = bundle.rows;
                const periodKey = `${bundle.periodFrom}_${bundle.periodTo}`;
                // Подпись — только отметка, и только когда штрафы есть
                // Отметка: при настоящих удержаниях и при сторно (возврат штрафов, подпись «сторнировали», сумма со знаком +)
                const stornoSum = bundle.rows.filter((r) => r.amount < 0).reduce((a, r) => a + Math.abs(r.amount), 0);
                const caption = stornoSum > 0
                    ? `@${esc(ALERT_USERNAME)} сторнировали штрафы: +${Math.round(stornoSum).toLocaleString('ru-RU').replace(/\u00A0/g, ' ')} сом (WB вернул удержанное)`
                    : bundle.rows.some((r) => r.amount > 0) ? `@${esc(ALERT_USERNAME)}` : '';
                const legalName = cabinetLegalName(cabinet.name);
                // Если дневной отчёт ещё не готов, берём последний закрытый — подписываем его периодом
                const dateLabel = bundle.weekOpen
                    ? `${prettyRuDate(bundle.periodFrom)} – ${prettyRuDate(bundle.periodTo)}`
                    : prettyRuDate(reportDate);
                cabResult.period = periodKey;
                cabResult.week_open = bundle.weekOpen;
                cabResult.source = bundle.source;

                let sent = false;
                const sentIds: number[] = [];

                if (!rows.length) {
                    const png = await renderPenaltyCardPng({
                        legalName, dateLabel, rows: [], pageNum: 1, pageCount: 1, totals: null,
                        empty: { prevTotal: bundle.prevTotal ?? 0 },
                    });
                    const tg = await sendTelegramPhoto(tgToken, tgChatId, png, '');
                    sent = !tg.error;
                    if (tg.error) cabResult.telegram_error = tg.error;
                    if (tg.messageId) sentIds.push(tg.messageId);
                    cabResult.empty = true;
                } else {
                    const ROWS_PER_PAGE = 35;
                    const pages: PenaltyRow[][] = [];
                    for (let p = 0; p < rows.length; p += ROWS_PER_PAGE) {
                        pages.push(rows.slice(p, p + ROWS_PER_PAGE));
                    }
                    const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
                    for (let pi = 0; pi < pages.length; pi++) {
                        if (pi > 0) await sleep(1200);
                        const last = pi === pages.length - 1;
                        const png = await renderPenaltyCardPng({
                            legalName, dateLabel, rows: pages[pi], pageNum: pi + 1, pageCount: pages.length,
                            totals: last ? { total: totalAmount, items: rows.length, prevTotal: bundle.prevTotal ?? 0 } : null,
                        });
                        let tg = await sendTelegramPhoto(tgToken, tgChatId, png, pi === 0 ? caption : '');
                        if (tg.error) {
                            await sleep(2000);
                            tg = await sendTelegramPhoto(tgToken, tgChatId, png, pi === 0 ? caption : '');
                        }
                        if (tg.error) throw new Error(tg.error);
                        if (tg.messageId) sentIds.push(tg.messageId);
                    }
                    sent = true;
                    cabResult.items = rows.length;
                }

                if (isTest && sentIds.length) {
                    await sleep(400);
                    const deleted: number[] = [];
                    for (const id of sentIds) {
                        const delErr = await deleteTelegramMessage(tgToken, tgChatId, id);
                        if (!delErr) deleted.push(id);
                    }
                    cabResult.deleted = deleted;
                    cabResult.test = true;
                }

                if (sent && !isTest) {
                    await admin.from('notification_log').insert({
                        cabinet_id: cabinet.id,
                        campaign_id: null,
                        event_type: eventType,
                        message_text: `penalties ${periodKey}: ${rows.length} items ids=${sentIds.join(',')}`,
                    });
                }
                cabResult.sent = sent;
                cabResult.message_ids = sentIds;
            } catch (e) {
                const msg = String(e);
                if (msg.includes('403') || msg.includes('401') || msg.toLowerCase().includes('finance')) {
                    cabResult.skipped = 'no_finance_token';
                    cabResult.error = msg.slice(0, 180);
                } else {
                    cabResult.error = msg.slice(0, 240);
                }
            }
            results.push(cabResult);
            if (i < targets.length - 1) await sleep(4000);
        }

        return json({
            ok: true,
            date: reportDate,
            chat: `…${tgChatId.slice(-6)}`,
            results,
            ms: Date.now() - started,
        });
    } catch (err) {
        console.error('[daily-penalties-report] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface PenaltyRow {
    reason: string;
    amount: number;
}

type TgSendResult = { error: string | null; messageId: number | null };

async function sendTelegramPhoto(token: string, chatId: string, png: Uint8Array, caption: string): Promise<TgSendResult> {
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        if (caption) {
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
        }
        form.append('photo', new Blob([png], { type: 'image/png' }), 'penalties.png');
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form }, 30000);
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) return { error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`, messageId: null };
        const messageId = Number((data as { result?: { message_id?: number } })?.result?.message_id);
        return { error: null, messageId: Number.isFinite(messageId) ? messageId : null };
    } catch (e) {
        return { error: String(e), messageId: null };
    }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<TgSendResult> {
    try {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) return { error: `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`, messageId: null };
        const messageId = Number((data as { result?: { message_id?: number } })?.result?.message_id);
        return { error: null, messageId: Number.isFinite(messageId) ? messageId : null };
    } catch (e) {
        return { error: String(e), messageId: null };
    }
}

async function deleteTelegramMessage(token: string, chatId: string, messageId: number): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        }, 15000);
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`;
        return null;
    } catch (e) {
        return String(e);
    }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function yesterdayBishkek(): string {
    const nowBishkek = new Date(Date.now() + 6 * 3600 * 1000);
    nowBishkek.setUTCDate(nowBishkek.getUTCDate() - 1);
    return nowBishkek.toISOString().slice(0, 10);
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
