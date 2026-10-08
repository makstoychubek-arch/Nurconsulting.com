/**
 * Штрафы из отчёта реализации WB: daily list → detailed/{reportId},
 * иначе последний закрытый weekly. reportId daily — строка (BigInt).
 */

const FINANCE_API = 'https://finance-api.wildberries.ru';

const EXCLUDED_DEDUCTION_NAMES = [
    'ВБ.Продвижение', 'WB Продвижение', 'ВБ.Медиа',
    'Перевод на баланс заёмщика', 'Погашение задолженности',
    'Погашение по займу', 'Продвижение через блогеров',
    'ВБ.Бренд-зона', 'Сторно платной приёмки',
    'НДС не облагается', 'Компенсация',
];

export type SalesReportMeta = {
    reportId: string;
    dateFrom: string;
    dateTo: string;
    period?: 'daily' | 'weekly';
    penaltySum?: number;
    deductionSum?: number;
};

export type PenaltyLine = { reason: string; amount: number };

/** Только поля для агрегации — полный detailed JSON у крупных кабинетов не влезает в edge. */
export const PENALTY_DETAIL_FIELDS = [
    'rrdId',
    'penalty',
    'deduction',
    'docTypeName',
    'sellerOperName',
    'bonusTypeName',
] as const;

export type PenaltyBundle = {
    /** false: WB ещё не опубликовал дневной отчёт за эту дату. Показывать нечего, надо подождать. */
    ready: boolean;
    rows: PenaltyLine[];
    periodFrom: string;
    periodTo: string;
    reportId: string | null;
    weekOpen: boolean;
    source: 'daily' | 'weekly';
    prevDate: string;
    prevTotal: number;
    prevItems: number | null;
};

/** Сначала однодневный отчёт на дату, иначе покрывающий период, иначе последний закрытый. */
export function pickSalesReport(reports: SalesReportMeta[], date: string): SalesReportMeta | null {
    const exactDaily = reports
        .filter((r) => r.dateFrom === date && r.dateTo === date)
        .sort((a, b) => b.reportId.localeCompare(a.reportId));
    if (exactDaily[0]) return exactDaily[0];

    const covering = reports
        .filter((r) => r.dateFrom <= date && date <= r.dateTo)
        .sort((a, b) => {
            const spanA = a.dateFrom.localeCompare(a.dateTo);
            const spanB = b.dateFrom.localeCompare(b.dateTo);
            if (spanA !== spanB) return spanB - spanA;
            return b.dateTo.localeCompare(a.dateTo);
        });
    if (covering[0]) return covering[0];
    const closed = reports
        .filter((r) => r.dateTo < date)
        .sort((a, b) => b.dateTo.localeCompare(a.dateTo));
    return closed[0] ?? null;
}

/** WB daily reportId не влезает в JS number — вытаскиваем цифры до JSON.parse. */
export function parseSalesReportsList(text: string): SalesReportMeta[] {
    if (!text.trim()) return [];
    const rewritten = text.replace(
        /"(reportId|report_id)"\s*:\s*(\d+)/g,
        '"$1":"$2"',
    );
    const data = JSON.parse(rewritten) as unknown;
    const rows = Array.isArray(data) ? data : [];
    return rows
        .map((r) => {
            const rec = r as Record<string, unknown>;
            const reportId = String(rec.reportId ?? rec.report_id ?? '').trim();
            const periodRaw = String(rec.period ?? '').toLowerCase();
            return {
                reportId,
                dateFrom: String(rec.dateFrom ?? rec.date_from ?? '').slice(0, 10),
                dateTo: String(rec.dateTo ?? rec.date_to ?? '').slice(0, 10),
                period: periodRaw === 'daily' || periodRaw === 'weekly' ? periodRaw : undefined,
                penaltySum: parseMoney(rec.penaltySum ?? rec.penalty_sum),
                deductionSum: parseMoney(rec.deductionSum ?? rec.deduction_sum),
            } satisfies SalesReportMeta;
        })
        .filter((r) => r.reportId && r.dateFrom && r.dateTo);
}

export function addDaysYmd(date: string, days: number): string {
    const ms = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
}

export function prettyRuDate(date: string): string {
    const [y, m, d] = date.split('-');
    return `${d}.${m}.${y}`;
}

async function financePost(
    token: string,
    path: string,
    body: Record<string, unknown>,
    timeoutMs = 60000,
): Promise<{ status: number; data: unknown; raw: string }> {
    let lastErr = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`${FINANCE_API}${path}`, {
            method: 'POST',
            headers: { Authorization: token, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await res.text();
        if (res.status === 429) {
            // Не ждём минутами: так функция упиралась во время и кабинеты в конце очереди оставались без отчёта.
            // Повторный запуск по расписанию (каждый час) всё равно доберёт.
            lastErr = text.slice(0, 120);
            if (attempt === 0) { await new Promise((r) => setTimeout(r, 8000)); continue; }
            break;
        }
        if (res.status === 204 || !text.trim()) return { status: res.status, data: [], raw: '' };
        if (!res.ok) throw new Error(`WB finance ${res.status}: ${text.slice(0, 160)}`);
        return { status: res.status, data: JSON.parse(text), raw: text };
    }
    throw new Error(`WB finance 429: ${lastErr}`);
}

async function listSalesReports(
    token: string,
    dateFrom: string,
    dateTo: string,
    period: 'daily' | 'weekly',
): Promise<SalesReportMeta[]> {
    const listed = await financePost(token, '/api/finance/v1/sales-reports/list', {
        dateFrom,
        dateTo,
        period,
        limit: 100,
        offset: 0,
    });
    const reports = parseSalesReportsList(listed.raw || JSON.stringify(listed.data ?? []));
    return reports.map((r) => ({ ...r, period: r.period ?? period }));
}

function prevDayFromList(reports: SalesReportMeta[], date: string): {
    prevDate: string;
    prevTotal: number;
    prevItems: number | null;
} {
    const prevDate = addDaysYmd(date, -1);
    const prev = reports.find((r) => r.dateFrom === prevDate && r.dateTo === prevDate);
    const prevTotal = prev ? (prev.penaltySum ?? 0) : 0;
    return {
        prevDate,
        prevTotal,
        prevItems: prevTotal === 0 ? 0 : null,
    };
}

/**
 * Штрафы за ОДИН день. Берём только дневной отчёт WB именно на эту дату.
 * Если он ещё не опубликован (утром WB часто не успевает), ready = false: ничего не показываем.
 * Раньше в этом случае подставлялся последний закрытый недельный отчёт: приходили штрафы за чужие
 * дни под видом вчерашних и абсурдные проценты.
 */
export async function fetchWeeklyPenaltyBundle(
    token: string,
    date: string,
): Promise<PenaltyBundle> {
    const dailyReports = await listSalesReports(token, addDaysYmd(date, -10), date, 'daily');
    const prev = prevDayFromList(dailyReports, date);
    const picked = pickDailyReport(dailyReports, date);

    const base = { periodFrom: date, periodTo: date, weekOpen: false, source: 'daily' as const, ...prev };
    if (!picked) return { ...base, ready: false, rows: [], reportId: null };
    if (!(Number(picked.penaltySum) > 0) && !(Number(picked.deductionSum) > 0)) {
        return { ...base, ready: true, rows: [], reportId: picked.reportId };
    }
    const detailed = await financePost(
        token,
        `/api/finance/v1/sales-reports/detailed/${encodeURIComponent(picked.reportId)}`,
        {
            limit: 100000,
            rrdId: 0,
            fields: [...PENALTY_DETAIL_FIELDS],
        },
        90000,
    );
    const raw = Array.isArray(detailed.data) ? detailed.data as Record<string, unknown>[] : [];
    return { ...base, ready: true, rows: aggregatePenaltyRows(raw), reportId: picked.reportId };
}

/** Дневной отчёт ровно на эту дату (если несколько, берём самый свежий). */
export function pickDailyReport(reports: SalesReportMeta[], date: string): SalesReportMeta | null {
    const exact = reports
        .filter((r) => r.dateFrom === date && r.dateTo === date)
        .sort((a, b) => b.reportId.localeCompare(a.reportId));
    return exact[0] ?? null;
}

export function aggregatePenaltyRows(raw: Record<string, unknown>[]): PenaltyLine[] {
    const byReason = new Map<string, number>();
    for (const r of raw) {
        const penalty = parseMoney(ffield(r, 'penalty'));
        const deduction = parseMoney(ffield(r, 'deduction'));
        const docType = String(ffield(r, 'docTypeName', 'doc_type_name') || '');
        const operName = String(ffield(
            r,
            'sellerOperName',
            'supplierOperName',
            'supplier_oper_name',
            'seller_oper_name',
        ) || '');
        const bonusName = String(ffield(r, 'bonusTypeName', 'bonus_type_name') || '');
        const blob = `${docType} ${operName} ${bonusName}`.toLowerCase();

        const excluded = EXCLUDED_DEDUCTION_NAMES.some((n) =>
            operName.includes(n) || bonusName.includes(n)
        );

        let amount = 0;
        if (penalty > 0) amount += penalty;
        if (deduction > 0 && !excluded) amount += deduction;
        if (amount <= 0 && !blob.includes('штраф') && !blob.includes('удерж')) continue;
        if (amount <= 0) continue;

        const reason = (bonusName || operName || docType || 'Удержание').trim();
        byReason.set(reason, (byReason.get(reason) || 0) + amount);
    }
    return [...byReason.entries()]
        .map(([reason, amount]) => ({ reason, amount }))
        .sort((a, b) => b.amount - a.amount);
}

function ffield(obj: Record<string, unknown>, ...keys: string[]): unknown {
    for (const k of keys) {
        if (obj[k] != null && obj[k] !== '') return obj[k];
    }
    return null;
}

function parseMoney(v: unknown): number {
    if (v == null || v === '') return 0;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function fmtSom(n: number): string {
    return Math.round(n).toLocaleString('ru-RU').replace(/\u00A0/g, ' ');
}

function somWithItems(total: number, items: number | null | undefined): string {
    const base = `${fmtSom(total)} сом`;
    return items == null ? base : `${base} (${items} поз.)`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Подпись: сторож + сравнение с прошлым днём. */
export function formatPenaltyCaption(opts: {
    cabinetName: string;
    date: string;
    dateLabel?: string;
    rows: PenaltyLine[];
    prevDate?: string;
    prevTotal?: number;
    prevItems?: number | null;
    weekOpen?: boolean;
    alertUser?: string;
    watchdogThreshold?: number;
}): string {
    const period = opts.dateLabel || prettyRuDate(opts.date);
    const openNote = opts.weekOpen
        ? `\nЕжедневный отчёт за ${period} ещё не готов — это последний закрытый`
        : '';
    if (!opts.rows.length) {
        const prevDate = opts.prevDate || addDaysYmd(opts.date, -1);
        const prevTotal = opts.prevTotal ?? 0;
        const lines = [
            `✅ <b>${escapeHtml(opts.cabinetName)}</b> — штрафы за ${period}${openNote}`,
            'Штрафов и удержаний нет',
        ];
        if (opts.prevDate != null || prevTotal > 0) {
            lines.push(
                `📈 К ${prettyRuDate(prevDate)}: ${somWithItems(prevTotal, opts.prevItems)} → сегодня ${somWithItems(0, 0)}`,
            );
        }
        return lines.filter(Boolean).join('\n');
    }
    const total = opts.rows.reduce((s, r) => s + r.amount, 0);
    const threshold = opts.watchdogThreshold ?? 500;
    const prevDate = opts.prevDate || addDaysYmd(opts.date, -1);
    const prevTotal = opts.prevTotal ?? 0;
    const delta = total - prevTotal;
    const signed = (n: number) => `${n > 0 ? '+' : ''}${fmtSom(n)}`;
    // Процент считаем только если вчера что-то было: иначе деление на ноль даёт «+19 537 500%».
    const change = prevTotal > 0
        ? `${signed(delta)}, ${signed(((total - prevTotal) / prevTotal) * 100)}%`
        : signed(delta);
    const lines = [
        `⚠️ <b>${escapeHtml(opts.cabinetName)}</b> — штрафы за ${period}`,
        `💸 Удержано: <b>${fmtSom(total)} сом</b> (${opts.rows.length} поз.)`,
    ];
    if (total >= threshold) {
        lines.push('🚨 Сторож: превышен порог удержаний');
    }
    lines.push(
        `📈 К ${prettyRuDate(prevDate)}: ${somWithItems(prevTotal, opts.prevItems)} → сегодня ${somWithItems(total, opts.rows.length)} (${change})`,
    );
    if (opts.alertUser) {
        lines.push(`@${escapeHtml(opts.alertUser.replace(/^@/, ''))} — <b>нужно разобраться</b>`);
    }
    if (openNote.trim()) lines.push(openNote.trim());
    return lines.join('\n');
}

// ── Запрос штрафов из Telegram-группы («штрафы вчера», «штрафы 05.10 Zevina») ──

export type CabinetPenaltySnapshot = {
    cabinetId: string;
    name: string;
    rows: PenaltyLine[];
    total: number;
    error?: string;
};

function bishkekIso(daysAgo: number): string {
    const d = new Date(Date.now() - daysAgo * 86400000);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bishkek' });
}

export function parsePenaltiesQuery(text: string, relaxed = false): { date: string; cabinet?: string } | null {
    const raw = String(text || '').replace(/@\w+/g, ' ').trim();
    const lower = raw.toLowerCase();
    const hasWord = /(штраф|удерж|penalt)/i.test(lower);
    if (!relaxed && !hasWord) return null;
    let date = '';
    if (/позавчера/.test(lower)) date = bishkekIso(2);
    else if (/вчера/.test(lower)) date = bishkekIso(1);
    else if (/сегодня/.test(lower)) date = bishkekIso(0);
    else {
        const m = raw.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
        if (m) {
            const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : bishkekIso(0).slice(0, 4);
            date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        } else if (hasWord) date = bishkekIso(1);
    }
    if (!date) return null;
    const tail = raw.match(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s+([a-zA-Zа-яА-ЯёЁ0-9._-]{2,30})\s*$/);
    return { date, cabinet: tail ? tail[1] : undefined };
}

// deno-lint-ignore no-explicit-any
export async function fetchAllCabinetPenalties(admin: any, date: string, onlyCabinet?: string): Promise<CabinetPenaltySnapshot[]> {
    const { data: cabinets } = await admin.from('cabinets').select('id, name, wb_token')
        .not('wb_token', 'is', null).gt('wb_token', '').order('name');
    const out: CabinetPenaltySnapshot[] = [];
    for (const cab of (cabinets || []) as Array<{ id: string; name: string; wb_token: string }>) {
        if (onlyCabinet && !cab.name.toLowerCase().includes(onlyCabinet.toLowerCase())) continue;
        const token = String(cab.wb_token || '').replace(/^﻿/, '').replace(/\s+/g, '').trim();
        try {
            const b = await fetchWeeklyPenaltyBundle(token, date);
            const total = b.rows.reduce((s, r) => s + r.amount, 0);
            out.push({ cabinetId: cab.id, name: cab.name, rows: b.rows, total, error: b.ready ? undefined : 'отчёт WB за этот день ещё не готов' });
        } catch (e) {
            out.push({ cabinetId: cab.id, name: cab.name, rows: [], total: 0, error: String(e).slice(0, 100) });
        }
        await new Promise((r) => setTimeout(r, 1500));
    }
    return out;
}

export function formatPenaltiesReply(date: string, snapshots: CabinetPenaltySnapshot[], alertUser?: string): string {
    const lines = [`⚠️ <b>Штрафы · ${prettyRuDate(date)}</b>`, ''];
    let grand = 0;
    for (const s of snapshots) {
        const name = escapeHtml(s.name);
        if (s.error && !s.rows.length) { lines.push(`<b>${name}</b> — ${escapeHtml(s.error)}`, ''); continue; }
        if (s.total <= 0) { lines.push(`✅ <b>${name}</b> — штрафов нет`, ''); continue; }
        grand += s.total;
        lines.push(`<b>${name}</b> — <b>${fmtSom(s.total)} сом</b>`);
        for (const r of s.rows.slice(0, 3)) lines.push(`• ${escapeHtml(r.reason.slice(0, 60))} — ${fmtSom(r.amount)}`);
        if (s.rows.length > 3) lines.push(`  …ещё ${s.rows.length - 3}`);
        lines.push('');
    }
    if (grand > 0 && alertUser) lines.push(`@${escapeHtml(alertUser.replace(/^@/, ''))} — <b>нужно разобраться</b>`);
    return lines.join('\n').trimEnd();
}
