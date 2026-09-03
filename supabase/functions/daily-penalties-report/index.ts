// Supabase Edge Function: daily-penalties-report
// Ежедневный отчёт в Telegram: штрафы и удержания по каждому кабинету
// (картинка-таблица: причина + сумма в сом). Запуск pg_cron 09:00 UTC
// = 15:00 Бишкек, за предыдущий день.
//
// Источник: недельный отчёт реализации WB
// POST /api/finance/v1/sales-reports/list + detailed/{reportId}.
// Запрос за один день даёт 204, пока неделя не закрыта.
//
// Тело: { "date", "force", "cabinets": ["Имя"],
//         "periodFrom", "periodTo", "rows": [{reason, amount}] }
// `rows` — готовые строки (локальный fetch WB), без detailed/{reportId} в worker.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCanvas } from 'https://deno.land/x/canvas@v1.4.2/mod.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import {
    fetchWeeklyPenaltyBundle,
    prettyRuDate,
} from '../_shared/wb-penalties-snapshot.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Кого тегать в TG, если есть штрафы (можно переопределить через secret)
const ALERT_USERNAME = (Deno.env.get('TELEGRAM_ALERT_USERNAME') || 'maraWuW').replace(/^@/, '');

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const started = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const tgToken = getTelegramToken() || (Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '');
    const tgChatId = getTelegramChatId('penalties') || (Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ?? '');

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (!isServiceAuthorized(req, serviceKey, true)) {
        return json({ error: 'Unauthorized' }, 401);
    }
    if (!tgToken || !tgChatId) {
        return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_PENALTIES (или TELEGRAM_GROUP_CHAT_ID) не заданы' }, 400);
    }

    const reportDate = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : yesterdayBishkek();
    const onlyCabinets: string[] | null = Array.isArray(body?.cabinets) ? body.cabinets.map(String) : null;

    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const admin = createClient(supabaseUrl, serviceKey || bearer);
    const results: Array<Record<string, unknown>> = [];

    try {
        const { data: cabinets, error: cabErr } = await admin
            .from('cabinets')
            .select('id, name, wb_token')
            .not('wb_token', 'is', null)
            .gt('wb_token', '');
        if (cabErr) throw new Error(`cabinets: ${cabErr.message}`);

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

                const presetRows = Array.isArray(body?.rows) ? body.rows as Array<Record<string, unknown>> : null;
                const bundle = presetRows
                    ? {
                        rows: presetRows
                            .map((r) => ({ reason: String(r.reason || 'Удержание'), amount: Number(r.amount) || 0 }))
                            .filter((r) => r.amount > 0),
                        periodFrom: typeof body?.periodFrom === 'string' ? body.periodFrom : reportDate,
                        periodTo: typeof body?.periodTo === 'string' ? body.periodTo : reportDate,
                        weekOpen: Boolean(body?.weekOpen),
                        reportId: null,
                    }
                    : await fetchWeeklyPenaltyBundle(token, reportDate);
                const rows = bundle.rows;
                const periodKey = `${bundle.periodFrom}_${bundle.periodTo}`;
                const eventType = `daily_penalties_${periodKey}`;
                const { data: dupes } = await admin
                    .from('notification_log')
                    .select('id')
                    .eq('cabinet_id', cabinet.id)
                    .eq('event_type', eventType)
                    .limit(1);
                if (dupes?.length && !body?.force) {
                    cabResult.skipped = bundle.weekOpen ? 'week_not_closed' : 'already_sent';
                    cabResult.period = periodKey;
                    results.push(cabResult);
                    continue;
                }
                if (bundle.weekOpen && !rows.length && !body?.force) {
                    cabResult.skipped = 'week_not_closed';
                    cabResult.period = periodKey;
                    results.push(cabResult);
                    continue;
                }

                const caption = buildCaption(cabinet.name, reportDate, rows, bundle);
                cabResult.period = periodKey;
                cabResult.week_open = bundle.weekOpen;
                let sent = false;

                if (!rows.length) {
                    const tgErr = await sendTelegramMessage(tgToken, tgChatId, caption);
                    sent = !tgErr;
                    if (tgErr) cabResult.telegram_error = tgErr;
                    cabResult.empty = true;
                } else {
                    const ROWS_PER_PAGE = 35;
                    const pages: PenaltyRow[][] = [];
                    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
                        pages.push(rows.slice(i, i + ROWS_PER_PAGE));
                    }
                    for (let pi = 0; pi < pages.length; pi++) {
                        if (pi > 0) await sleep(1200);
                        const png = await renderPenaltyImage(
                            cabinet.name, bundle.periodFrom === bundle.periodTo
                                ? reportDate
                                : `${prettyRuDate(bundle.periodFrom)}–${prettyRuDate(bundle.periodTo)}`,
                            pages[pi],
                            { pageNum: pi + 1, pageCount: pages.length, totalsRows: pi === pages.length - 1 ? rows : null },
                        );
                        let tgErr = await sendTelegramPhoto(tgToken, tgChatId, png, pi === 0 ? caption : '');
                        if (tgErr) {
                            await sleep(2000);
                            tgErr = await sendTelegramPhoto(tgToken, tgChatId, png, pi === 0 ? caption : '');
                        }
                        if (tgErr) throw new Error(tgErr);
                    }
                    sent = true;
                    cabResult.items = rows.length;
                }

                if (sent) {
                    await admin.from('notification_log').insert({
                        cabinet_id: cabinet.id,
                        campaign_id: null,
                        event_type: eventType,
                        message_text: `penalties ${periodKey}: ${rows.length} items`,
                    });
                }
                cabResult.sent = sent;
            } catch (e) {
                const msg = String(e);
                if (msg.includes('403') || msg.includes('401') || msg.toLowerCase().includes('finance')) {
                    cabResult.skipped = 'no_finance_token';
                } else {
                    cabResult.error = msg;
                }
            }
            results.push(cabResult);
            // Finance API: 1 req/min — пауза только если сами ходили в WB
            const remaining = (cabinets || []).filter((c) => !onlyCabinets || onlyCabinets.includes(c.name));
            if (!Array.isArray(body?.rows) && cabinet !== remaining[remaining.length - 1]) await sleep(65000);
        }

        return json({ ok: true, date: reportDate, results, ms: Date.now() - started });
    } catch (err) {
        console.error('[daily-penalties-report] fatal:', err);
        return json({ error: String(err) }, 500);
    }
});

interface PenaltyRow {
    reason: string;
    amount: number;
}

function buildCaption(
    cabinetName: string,
    date: string,
    rows: PenaltyRow[],
    bundle: { periodFrom: string; periodTo: string; weekOpen: boolean },
): string {
    const period = bundle.periodFrom === bundle.periodTo
        ? prettyRuDate(date)
        : `${prettyRuDate(bundle.periodFrom)}–${prettyRuDate(bundle.periodTo)}`;
    const openNote = bundle.weekOpen
        ? `\nНеделя ${prettyRuDate(date)} ещё не закрыта — это последний отчёт WB`
        : '';
    if (!rows.length) {
        return `✅ <b>${escapeHtml(cabinetName)}</b> — штрафы за ${period}${openNote}\nШтрафов и удержаний нет`;
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const fmtNum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
    return [
        `⚠️ <b>${escapeHtml(cabinetName)}</b> — штрафы за ${period}`,
        `💸 Удержано: <b>${fmtNum(total)} сом</b> (${rows.length} поз.)`,
        `@${escapeHtml(ALERT_USERNAME)} — <b>нужно разобраться</b>`,
        openNote.trim(),
    ].filter(Boolean).join('\n');
}

// ── Картинка-таблица (стиль как daily-sales-report) ───────────────────────

let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;
async function ensureFonts(): Promise<void> {
    if (fontRegular && fontBold) return;
    const base = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf';
    const [reg, bold] = await Promise.all([
        fetchWithTimeout(`${base}/DejaVuSans.ttf`, {}, 20000).then((r) => r.arrayBuffer()),
        fetchWithTimeout(`${base}/DejaVuSans-Bold.ttf`, {}, 20000).then((r) => r.arrayBuffer()),
    ]);
    fontRegular = new Uint8Array(reg);
    fontBold = new Uint8Array(bold);
}

async function renderPenaltyImage(
    cabinetName: string,
    date: string,
    rows: PenaltyRow[],
    opts: { pageNum: number; pageCount: number; totalsRows: PenaltyRow[] | null },
): Promise<Uint8Array> {
    await ensureFonts();
    const fmtNum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
    const prettyDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? prettyRuDate(date)
        : date;
    const showTotals = opts.totalsRows != null;
    const totalAmount = (opts.totalsRows || rows).reduce((s, r) => s + r.amount, 0);

    const S = 2;
    const COLS: Array<{ title: string; w: number; align: 'left' | 'center' }> = [
        { title: 'Причина удержания', w: 420, align: 'left' },
        { title: 'Сумма\nсом', w: 130, align: 'center' },
    ];
    const PAD = 14;
    const width = COLS.reduce((a, c) => a + c.w, 0) + PAD * 2;
    const titleH = 56;
    const headerH = 58;
    const rowH = 44;
    const totalH = showTotals ? 48 : 0;
    const height = titleH + headerH + rows.length * rowH + totalH + PAD * 2;

    const canvas = createCanvas(width * S, height * S);
    canvas.loadFont(fontRegular!, { family: 'DejaVu' });
    canvas.loadFont(fontBold!, { family: 'DejaVu', weight: 'bold' });
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 22px DejaVu';
    ctx.textBaseline = 'middle';
    const pageSuffix = opts.pageCount > 1 ? ` (стр. ${opts.pageNum}/${opts.pageCount})` : '';
    ctx.fillText(`${cabinetName} — штрафы за ${prettyDate}${pageSuffix}`, PAD, PAD + titleH / 2 - 4);

    const colX: number[] = [];
    let x = PAD;
    for (const c of COLS) { colX.push(x); x += c.w; }
    const tableTop = PAD + titleH;
    const tableW = width - PAD * 2;

    ctx.fillStyle = '#f5d0d0';
    ctx.fillRect(PAD, tableTop, tableW, headerH);
    ctx.fillStyle = '#5c1010';
    ctx.font = 'bold 15px DejaVu';
    COLS.forEach((c, i) => {
        c.title.split('\n').forEach((line, li) => {
            const ty = tableTop + headerH / 2 + (li - (c.title.split('\n').length - 1) / 2) * 18;
            drawCell(ctx, line, colX[i], ty, c.w, c.align);
        });
    });

    ctx.font = '14px DejaVu';
    rows.forEach((r, ri) => {
        const y = tableTop + headerH + ri * rowH;
        if (ri % 2 === 1) {
            ctx.fillStyle = '#fdf5f5';
            ctx.fillRect(PAD, y, tableW, rowH);
        }
        ctx.fillStyle = '#222222';
        const cy = y + rowH / 2;
        drawCell(ctx, fitText(ctx, r.reason, COLS[0].w - 16), colX[0], cy, COLS[0].w, 'left');
        ctx.fillStyle = '#b91c1c';
        drawCell(ctx, fmtNum(r.amount), colX[1], cy, COLS[1].w, 'center');
    });

    if (showTotals) {
        const totalY = tableTop + headerH + rows.length * rowH;
        ctx.fillStyle = '#f5d0d0';
        ctx.fillRect(PAD, totalY, tableW, totalH);
        ctx.fillStyle = '#5c1010';
        ctx.font = 'bold 16px DejaVu';
        const tcy = totalY + totalH / 2;
        drawCell(ctx, 'Итого', colX[0], tcy, COLS[0].w, 'left');
        drawCell(ctx, fmtNum(totalAmount), colX[1], tcy, COLS[1].w, 'center');
    }

    ctx.strokeStyle = '#e8c4c4';
    ctx.lineWidth = 1;
    for (let ri = 0; ri <= rows.length; ri++) {
        const y = tableTop + headerH + ri * rowH;
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(PAD + tableW, y);
        ctx.stroke();
    }
    const tableBottom = tableTop + headerH + rows.length * rowH + totalH;
    ctx.strokeStyle = '#ddb8b8';
    ctx.beginPath();
    ctx.moveTo(colX[1], tableTop);
    ctx.lineTo(colX[1], tableBottom);
    ctx.stroke();
    ctx.strokeRect(PAD, tableTop, tableW, tableBottom - tableTop);

    return canvas.toBuffer('image/png');
}

// deno-lint-ignore no-explicit-any
function drawCell(ctx: any, text: string, x: number, y: number, w: number, align: 'left' | 'center') {
    if (align === 'center') {
        const tw = ctx.measureText(text).width;
        ctx.fillText(text, x + (w - tw) / 2, y);
    } else {
        ctx.fillText(text, x + 8, y);
    }
}

// deno-lint-ignore no-explicit-any
function fitText(ctx: any, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}

async function sendTelegramPhoto(token: string, chatId: string, png: Uint8Array, caption: string): Promise<string | null> {
    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        if (caption) {
            form.append('caption', caption);
            form.append('parse_mode', 'HTML');
        }
        form.append('photo', new Blob([png], { type: 'image/png' }), 'penalties.png');
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form }, 30000);
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        return null;
    } catch (e) {
        return String(e);
    }
}

async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
        if (!res.ok) return `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
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

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
