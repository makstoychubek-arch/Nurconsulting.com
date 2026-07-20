// Supabase Edge Function: daily-sales-report
// Ежедневный отчёт в Telegram-группу по каждому кабинету: таблица по артикулам
// продавца — заказы шт/руб, выкупы шт/руб, остаток товара + строка "Итого".
// Одно сообщение = один кабинет. Запускается по pg_cron в 09:00 UTC
// (15:00 по Бишкеку) и отчитывается за предыдущий день, когда WB уже
// выгрузил точные данные по выкупам и остаткам.
//
// Данные напрямую из WB Statistics API (не из локальных таблиц), чтобы
// выкупы и остатки были точными:
//   - /api/v1/supplier/orders?dateFrom=<D>&flag=1  — заказы ровно за день D
//   - /api/v1/supplier/sales?dateFrom=<D>&flag=1   — выкупы ровно за день D
//   - /api/v1/supplier/stocks?dateFrom=2019-06-20  — текущие остатки
//
// Auth: только service_role key (вызов из pg_cron / вручную curl'ом).
// Тело запроса (опционально): { "date": "YYYY-MM-DD" } — за какой день отчёт.
// Без date — берётся вчерашний день по Бишкеку (UTC+6).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATS_API = 'https://statistics-api.wildberries.ru';
const ANALYTICS_API = 'https://seller-analytics-api.wildberries.ru';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const tgChatId = Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceKey) {
        return json({ error: 'Unauthorized' }, 401);
    }
    if (!tgToken || !tgChatId) {
        return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_GROUP_CHAT_ID не заданы' }, 400);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : yesterdayBishkek();

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: cabinets, error: cabErr } = await admin
            .from('cabinets')
            .select('id, name, wb_token')
            .not('wb_token', 'is', null)
            .gt('wb_token', '');
        if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);

        // Опциональный фильтр { "cabinets": ["Имя"] } — переслать отчёт
        // только выбранным кабинетам (для ручных повторов).
        const onlyCabinets: string[] | null = Array.isArray(body?.cabinets) ? body.cabinets.map(String) : null;

        for (const cabinet of cabinets || []) {
            if (onlyCabinets && !onlyCabinets.includes(cabinet.name)) continue;
            const cabResult: Record<string, unknown> = { cabinet: cabinet.name };
            try {
                const token = sanitizeWbToken(cabinet.wb_token);
                if (!token || token.length < 50) {
                    cabResult.skipped = 'invalid_token';
                    results.push(cabResult);
                    continue;
                }

                // Дедупликация: не слать повторно отчёт за тот же день тому же кабинету
                const eventType = `daily_report_${reportDate}`;
                const { data: dupes } = await admin
                    .from('notification_log')
                    .select('id')
                    .eq('cabinet_id', cabinet.id)
                    .eq('event_type', eventType)
                    .limit(1);
                if (dupes && dupes.length && !body?.force) {
                    cabResult.skipped = 'already_sent';
                    results.push(cabResult);
                    continue;
                }

                // Каждый эндпоинт независимо: WB постепенно отключает старые
                // методы Statistics API (PLUG-404), поэтому падение одного
                // не должно ронять весь отчёт.
                const endpointErrors: Record<string, string> = {};
                const [orders, sales] = await Promise.all([
                    wbGetArray(`${STATS_API}/api/v1/supplier/orders?dateFrom=${reportDate}&flag=1`, token)
                        .catch((e) => { endpointErrors.orders = String(e); return []; }),
                    wbGetArray(`${STATS_API}/api/v1/supplier/sales?dateFrom=${reportDate}&flag=1`, token)
                        .catch((e) => { endpointErrors.sales = String(e); return []; }),
                ]);

                // Остатки: старый GET /api/v1/supplier/stocks отключён WB
                // (PLUG-404-20260720) — используем новый метод Analytics
                // POST /api/analytics/v1/stocks-report/wb-warehouses по nmId
                // из заказов/выкупов за отчётный день.
                const nmIds = collectNmIds(orders, sales);
                const stocks = nmIds.length
                    ? await fetchWarehouseStocks(token, nmIds)
                        .catch((e) => { endpointErrors.stocks = String(e); return []; })
                    : [];
                if (Object.keys(endpointErrors).length) cabResult.endpoint_errors = endpointErrors;

                const rows = buildArticleRows(orders, sales, stocks);
                if (!rows.length) {
                    cabResult.skipped = 'no_data';
                    results.push(cabResult);
                    continue;
                }

                const messages = formatReportMessages(cabinet.name, reportDate, rows);
                let sent = true;
                for (let mi = 0; mi < messages.length; mi++) {
                    // Пауза между частями — Telegram лимитирует ~1 сообщение/сек в чат
                    if (mi > 0) await new Promise((r) => setTimeout(r, 1200));
                    const tgErr = await sendTelegramMessage(tgToken, tgChatId, messages[mi]);
                    if (tgErr) {
                        sent = false;
                        cabResult.telegram_error = `part ${mi + 1}/${messages.length}, len=${messages[mi].length}: ${tgErr}`;
                        break;
                    }
                }
                if (sent) {
                    await admin.from('notification_log').insert({
                        cabinet_id: cabinet.id,
                        campaign_id: null,
                        event_type: eventType,
                        message_text: `daily report ${reportDate}: ${rows.length} articles`,
                    });
                }
                cabResult.sent = sent;
                cabResult.articles = rows.length;
            } catch (e) {
                cabResult.error = String(e);
            }
            results.push(cabResult);
        }

        return json({ ok: true, date: reportDate, results, ms: Date.now() - started });
    } catch (err) {
        console.error('[daily-sales-report] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

interface ArticleRow {
    article: string;
    ordersCount: number;
    ordersSum: number;
    buyoutCount: number;
    buyoutSum: number;
    stock: number;
}

// deno-lint-ignore no-explicit-any
function buildArticleRows(orders: any[], sales: any[], stocks: any[]): ArticleRow[] {
    const byArticle = new Map<string, ArticleRow>();
    const get = (article: string): ArticleRow => {
        let row = byArticle.get(article);
        if (!row) {
            row = { article, ordersCount: 0, ordersSum: 0, buyoutCount: 0, buyoutSum: 0, stock: 0 };
            byArticle.set(article, row);
        }
        return row;
    };

    for (const o of orders || []) {
        if (o?.isCancel) continue;
        const article = String(o?.supplierArticle || o?.nmId || '').trim();
        if (!article) continue;
        const row = get(article);
        row.ordersCount++;
        row.ordersSum += Number(o?.priceWithDisc ?? o?.totalPrice ?? 0);
    }

    for (const s of sales || []) {
        // saleID начинается с "S" — продажа (выкуп); "R" — возврат, не считаем.
        const saleId = String(s?.saleID || '');
        if (saleId && !saleId.startsWith('S')) continue;
        const article = String(s?.supplierArticle || s?.nmId || '').trim();
        if (!article) continue;
        const row = get(article);
        row.buyoutCount++;
        row.buyoutSum += Number(s?.priceWithDisc ?? s?.forPay ?? 0);
    }

    // Остатки из нового метода wb-warehouses приходят по nmId (без артикула
    // продавца), поэтому маппим nmId → артикул по данным заказов/выкупов.
    const articleByNmId = new Map<number, string>();
    for (const r of [...(orders || []), ...(sales || [])]) {
        const nmId = Number(r?.nmId || 0);
        const article = String(r?.supplierArticle || '').trim();
        if (nmId && article && !articleByNmId.has(nmId)) articleByNmId.set(nmId, article);
    }
    const stockByArticle = new Map<string, number>();
    for (const st of stocks || []) {
        const article = String(st?.supplierArticle || '').trim()
            || articleByNmId.get(Number(st?.nmId || 0))
            || '';
        if (!article) continue;
        stockByArticle.set(article, (stockByArticle.get(article) || 0) + Number(st?.quantity || 0));
    }
    for (const row of byArticle.values()) {
        row.stock = stockByArticle.get(row.article) || 0;
    }

    return [...byArticle.values()].sort((a, b) => b.ordersSum - a.ordersSum);
}

// Формат под мобильный Telegram: у <pre>-блока на телефоне ширина ~32-34
// символа, широкая таблица из 6 колонок переносилась и «разъезжалась».
// Поэтому каждый артикул — две строки: название, затем компактная строка
// цифр «Заказы │ Выкупы │ Остаток». Длинные отчёты режем на несколько
// сообщений (лимит Telegram — 4096 символов).
function formatReportMessages(cabinetName: string, date: string, rows: ArticleRow[]): string[] {
    const d = date.split('-');
    const prettyDate = `${d[2]}.${d[1]}.${d[0]}`;

    const padL = (s: string, w: number) => s.length >= w ? s : ' '.repeat(w - s.length) + s;
    const fmtNum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');

    const t = rows.reduce((acc, r) => ({
        oc: acc.oc + r.ordersCount, os: acc.os + r.ordersSum,
        bc: acc.bc + r.buyoutCount, bs: acc.bs + r.buyoutSum,
        st: acc.st + r.stock,
    }), { oc: 0, os: 0, bc: 0, bs: 0, st: 0 });

    const title = `📊 <b>${escapeHtml(cabinetName)}</b> — отчёт за ${prettyDate}`;
    const summary = [
        `🛒 Заказы: <b>${t.oc} шт · ${fmtNum(t.os)} сом</b>`,
        `✅ Выкупы: <b>${t.bc} шт · ${fmtNum(t.bs)} сом</b>`,
        `📦 Остаток: <b>${fmtNum(t.st)} шт</b>`,
    ].join('\n');

    const legend = 'Заказы шт·сом │ Выкупы шт·сом │ Ост';
    const sep = '─'.repeat(34);

    const articleBlock = (r: ArticleRow) => {
        const name = r.article.length <= 32 ? r.article : r.article.slice(0, 31) + '…';
        const nums = `${padL(String(r.ordersCount), 2)}·${padL(fmtNum(r.ordersSum), 7)} │ ${padL(String(r.buyoutCount), 2)}·${padL(fmtNum(r.buyoutSum), 7)} │ ${r.stock}`;
        return `${name}\n${nums}`;
    };

    // Режем строки артикулов на части так, чтобы каждое сообщение
    // укладывалось в лимит Telegram (4096) с запасом. Важно считать и
    // разделители между блоками (\n────\n = ~36 символов на блок).
    const MAX_BODY = 3200;
    const BLOCK_OVERHEAD = sep.length + 2;
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentLen = 0;
    for (const r of rows) {
        const block = articleBlock(r);
        const cost = block.length + BLOCK_OVERHEAD;
        if (currentLen + cost > MAX_BODY && current.length) {
            chunks.push(current);
            current = [];
            currentLen = 0;
        }
        current.push(block);
        currentLen += cost;
    }
    if (current.length) chunks.push(current);

    const totalsLine = `ИТОГО\n${padL(String(t.oc), 2)}·${padL(fmtNum(t.os), 7)} │ ${padL(String(t.bc), 2)}·${padL(fmtNum(t.bs), 7)} │ ${t.st}`;

    return chunks.map((chunk, i) => {
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;
        const parts: string[] = [];
        if (isFirst) {
            parts.push(title, summary, '');
        } else {
            parts.push(`${title} (продолжение ${i + 1}/${chunks.length})`, '');
        }
        const body = [legend, sep, chunk.join('\n' + sep + '\n')];
        if (isLast) body.push(sep, totalsLine);
        parts.push(`<pre>${escapeHtml(body.join('\n'))}</pre>`);
        return parts.join('\n');
    });
}

// deno-lint-ignore no-explicit-any
function collectNmIds(orders: any[], sales: any[]): number[] {
    const ids = new Set<number>();
    for (const r of [...(orders || []), ...(sales || [])]) {
        const nmId = Number(r?.nmId || 0);
        if (nmId) ids.add(nmId);
    }
    return [...ids].slice(0, 1000); // лимит nmIds у метода — 1000
}

// Новый метод остатков: POST /api/analytics/v1/stocks-report/wb-warehouses.
// Возвращает строки { nmId, warehouseName, quantity, ... }.
// deno-lint-ignore no-explicit-any
async function fetchWarehouseStocks(token: string, nmIds: number[]): Promise<any[]> {
    const res = await fetchWithTimeout(`${ANALYTICS_API}/api/analytics/v1/stocks-report/wb-warehouses`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nmIds, limit: 250000, offset: 0 }),
    }, 25000);
    const text = await res.text();
    if (!res.ok) throw new Error(`WB ${res.status}: ${text.slice(0, 180)}`);
    const data = JSON.parse(text);
    const items = data?.data?.items;
    return Array.isArray(items) ? items : [];
}

// deno-lint-ignore no-explicit-any
async function wbGetArray(url: string, token: string): Promise<any[]> {
    const res = await fetchWithTimeout(url, { headers: { Authorization: token } }, 25000);
    const text = await res.text();
    if (!res.ok) throw new Error(`WB ${res.status}: ${text.slice(0, 180)}`);
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
}

// Возвращает null при успехе, иначе строку с описанием ошибки Telegram.
async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        if (!res.ok) {
            const errText = await res.text();
            console.warn('[daily-sales-report] telegram failed:', res.status, errText);
            return `HTTP ${res.status}: ${errText.slice(0, 200)}`;
        }
        return null;
    } catch (e) {
        console.warn('[daily-sales-report] telegram error:', String(e));
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

// Вчерашний день по бишкекскому времени (UTC+6): отчёт в 15:00 Бишкека
// должен быть за предыдущие календарные сутки.
function yesterdayBishkek(): string {
    const nowBishkek = new Date(Date.now() + 6 * 3600 * 1000);
    nowBishkek.setUTCDate(nowBishkek.getUTCDate() - 1);
    return nowBishkek.toISOString().slice(0, 10);
}

function sanitizeWbToken(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim();
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
