/**
 * Отчёт реализации WB — наследник GET /api/v5/supplier/reportDetailByPeriod.
 *
 * Кабинеты кыргызские: list + detailed/{reportId} в доке помечены как
 * «может быть недоступен по стране регистрации». Берём только
 * POST /api/finance/v1/sales-reports/detailed по периоду.
 * period: daily — строки к дневным колонкам РНП, не недельный документ.
 *
 * Деньги в ответе — строки. rrdId / reportId daily могут быть больше 2^53−1,
 * поэтому перед JSON.parse оборачиваем их в кавычки.
 */

export const FINANCE_API = 'https://finance-api.wildberries.ru';
export const SALES_REPORTS_DETAILED_PATH = '/api/finance/v1/sales-reports/detailed';

/** Поля, которые пишем в raw_finance_report / свод РНП. */
export const FINANCE_RAW_FIELDS = [
    'rrdId',
    'reportId',
    'rrDate',
    'saleDt',
    'orderDt',
    'nmId',
    'vendorCode',
    'docTypeName',
    'sellerOperName',
    'quantity',
    'retailAmount',
    'retailPriceWithDisc',
    'forPay',
    'deliveryService',
    'penalty',
    'paidStorage',
    'deduction',
    'paidAcceptance',
    'currency',
] as const;

/** Дашборд считает ещё реализацию до скидок, компенсации и эквайринг. */
export const FINANCE_DASHBOARD_FIELDS = [
    ...FINANCE_RAW_FIELDS,
    'retailPrice',
    'additionalPayment',
    'acquiringFee',
    'bonusTypeName',
    'subjectName',
    'brandName',
] as const;

export type FinancePeriod = 'daily' | 'weekly';

export type FinancePage = {
    status: number;
    rows: Record<string, unknown>[];
    nextRrdId: string;
    retryAfter?: number;
};

export function parseMoney(v: unknown): number {
    if (v == null || v === '') return 0;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

export function pickField(
    obj: Record<string, unknown> | null | undefined,
    ...keys: string[]
): unknown {
    if (!obj) return null;
    for (const k of keys) {
        if (obj[k] != null && obj[k] !== '') return obj[k];
    }
    return null;
}

/** WB daily rrdId/reportId не влезают в JS number — вытаскиваем цифры до parse. */
export function quoteUnsafeInts(text: string): string {
    return text.replace(
        /"(rrdId|rrd_id|reportId|report_id|realizationreport_id)"\s*:\s*(-?\d+)/g,
        '"$1":"$2"',
    );
}

export function parseDetailedBody(text: string): Record<string, unknown>[] {
    if (!text || !text.trim()) return [];
    const data = JSON.parse(quoteUnsafeInts(text)) as unknown;
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === 'object') {
        const rec = data as Record<string, unknown>;
        for (const key of ['data', 'reports', 'items', 'report']) {
            if (Array.isArray(rec[key])) return rec[key] as Record<string, unknown>[];
        }
    }
    return [];
}

export function rowId(r: Record<string, unknown> | null | undefined): string {
    const v = pickField(r, 'rrdId', 'rrd_id');
    if (v == null) return '';
    const s = String(v).trim();
    return /^\d+$/.test(s) && s !== '0' ? s : '';
}

export function reportIdOf(r: Record<string, unknown> | null | undefined): string | null {
    const v = pickField(r, 'reportId', 'report_id', 'realizationreport_id');
    if (v == null || v === '') return null;
    const s = String(v).trim();
    return /^\d+$/.test(s) ? s : null;
}

function ymd(v: unknown): string | null {
    const s = String(v || '').split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export type RawFinanceRow = {
    cabinet_id: string;
    rrd_id: string;
    realizationreport_id: string | null;
    rr_dt: string | null;
    sale_dt: string | null;
    nm_id: number | null;
    sa_name: string | null;
    doc_type_name: string | null;
    supplier_oper_name: string | null;
    quantity: number;
    retail_amount: number;
    retail_price_withdisc_rub: number;
    ppvz_for_pay: number;
    delivery_rub: number;
    penalty: number;
    storage_fee: number;
    deduction: number;
    acceptance: number;
    currency_name: string | null;
    fetched_at: string;
};

export function toRawFinanceRow(cabinetId: string, r: Record<string, unknown>): RawFinanceRow {
    const n = (v: unknown) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
    };
    const saleDt = ymd(pickField(r, 'saleDt', 'sale_dt'))
        || ymd(pickField(r, 'rrDate', 'rr_dt'))
        || ymd(pickField(r, 'orderDt', 'order_dt'));
    const sa = pickField(r, 'vendorCode', 'sa_name');
    const doc = pickField(r, 'docTypeName', 'doc_type_name');
    const oper = pickField(r, 'sellerOperName', 'supplierOperName', 'supplier_oper_name');
    const curr = pickField(r, 'currency', 'currency_name');
    return {
        cabinet_id: cabinetId,
        rrd_id: rowId(r),
        realizationreport_id: reportIdOf(r),
        rr_dt: ymd(pickField(r, 'rrDate', 'rr_dt')),
        sale_dt: saleDt,
        nm_id: n(pickField(r, 'nmId', 'nm_id')) || null,
        sa_name: sa ? String(sa).slice(0, 200) : null,
        doc_type_name: doc ? String(doc) : null,
        supplier_oper_name: oper ? String(oper).slice(0, 200) : null,
        quantity: n(pickField(r, 'quantity')),
        retail_amount: parseMoney(pickField(r, 'retailAmount', 'retail_amount')),
        retail_price_withdisc_rub: parseMoney(pickField(r, 'retailPriceWithDisc', 'retail_price_withdisc_rub')),
        ppvz_for_pay: parseMoney(pickField(r, 'forPay', 'ppvzForPay', 'ppvz_for_pay')),
        delivery_rub: parseMoney(pickField(r, 'deliveryService', 'delivery_rub')),
        penalty: parseMoney(pickField(r, 'penalty')),
        storage_fee: parseMoney(pickField(r, 'paidStorage', 'storage_fee')),
        deduction: parseMoney(pickField(r, 'deduction')),
        acceptance: parseMoney(pickField(r, 'paidAcceptance', 'acceptance')),
        currency_name: curr ? String(curr) : null,
        fetched_at: new Date().toISOString(),
    };
}

/** Старый snake_case для дашборда / wb-formulas.js. */
export function toLegacyFinanceRow(r: Record<string, unknown>): Record<string, unknown> {
    const mapped = toRawFinanceRow('', r);
    return {
        rrd_id: mapped.rrd_id,
        realizationreport_id: mapped.realizationreport_id,
        rr_dt: mapped.rr_dt,
        sale_dt: mapped.sale_dt,
        nm_id: mapped.nm_id,
        sa_name: mapped.sa_name,
        doc_type_name: mapped.doc_type_name,
        supplier_oper_name: mapped.supplier_oper_name,
        quantity: mapped.quantity,
        retail_amount: mapped.retail_amount,
        retail_price: parseMoney(pickField(r, 'retailPrice', 'retail_price')),
        retail_price_withdisc_rub: mapped.retail_price_withdisc_rub,
        ppvz_for_pay: mapped.ppvz_for_pay,
        delivery_rub: mapped.delivery_rub,
        penalty: mapped.penalty,
        storage_fee: mapped.storage_fee,
        deduction: mapped.deduction,
        acceptance: mapped.acceptance,
        currency_name: mapped.currency_name,
        additional_payment: parseMoney(pickField(r, 'additionalPayment', 'additional_payment')),
        acquiring_fee: parseMoney(pickField(r, 'acquiringFee', 'acquiring_fee')),
        bonus_type_name: pickField(r, 'bonusTypeName', 'bonus_type_name'),
        subject_name: pickField(r, 'subjectName', 'subject_name'),
        brand_name: pickField(r, 'brandName', 'brand_name'),
    };
}

export function bodyRrdId(rrdId: string | number | undefined): string | number {
    if (rrdId == null || rrdId === '') return 0;
    const s = String(rrdId).trim();
    if (s === '0') return 0;
    if (/^\d+$/.test(s) && Number(s) <= Number.MAX_SAFE_INTEGER) return Number(s);
    return s;
}

export type FetchDetailedOpts = {
    token: string;
    dateFrom: string;
    dateTo: string;
    rrdId?: string | number;
    limit?: number;
    period?: FinancePeriod;
    fields?: readonly string[];
    fetchFn?: typeof fetch;
    timeoutMs?: number;
};

export async function fetchSalesReportsDetailedPage(opts: FetchDetailedOpts): Promise<FinancePage> {
    const fetchFn = opts.fetchFn || fetch;
    const body: Record<string, unknown> = {
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        period: opts.period || 'daily',
        limit: opts.limit ?? 100000,
        rrdId: bodyRrdId(opts.rrdId),
    };
    if (opts.fields?.length) body.fields = [...opts.fields];

    const res = await fetchFn(`${FINANCE_API}${SALES_REPORTS_DETAILED_PATH}`, {
        method: 'POST',
        headers: { Authorization: opts.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90000),
    });
    const text = await res.text();
    if (res.status === 429) {
        const retry = Number(res.headers.get('x-ratelimit-retry') || res.headers.get('retry-after') || 60);
        return { status: 429, rows: [], nextRrdId: '', retryAfter: retry };
    }
    if (res.status === 204 || !text.trim()) {
        return { status: res.status, rows: [], nextRrdId: '' };
    }
    if (!res.ok) {
        throw new Error(`Финотчёт WB: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const rows = parseDetailedBody(text);
    const last = rows.length ? rows[rows.length - 1] : null;
    return { status: res.status, rows, nextRrdId: last ? rowId(last) : '' };
}

export type FinanceAgg = {
    sc: number;
    ss: number;
    tt: number;
    log: number;
    sto: number;
    rc: number;
    locAmt: number;
    rubAmt: number;
};

export function addLegacyRowToAgg(
    byKey: Map<string, FinanceAgg>,
    row: Record<string, unknown>,
    filterNmId?: string | null,
): void {
    const nm = String(row.nm_id ?? '');
    if (filterNmId && nm !== filterNmId) return;
    const date = String(row.sale_dt ?? '').split('T')[0];
    if (!date) return;
    const key = `${nm}|${date}`;
    if (!byKey.has(key)) byKey.set(key, { sc: 0, ss: 0, tt: 0, log: 0, sto: 0, rc: 0, locAmt: 0, rubAmt: 0 });
    const d = byKey.get(key)!;
    const type = String(row.doc_type_name ?? '').toLowerCase();
    const qty = Number(row.quantity || 0);
    if (type === 'продажа') {
        d.sc += qty;
        d.ss += Number(row.retail_price_withdisc_rub || 0) * qty;
        d.tt += Number(row.ppvz_for_pay || 0);
    } else if (type === 'возврат') {
        d.rc += qty;
        d.tt += Number(row.ppvz_for_pay || 0);
    }
    d.log += Number(row.delivery_rub || 0);
    d.sto += Number(row.storage_fee || 0);
    const curr = String(row.currency_name ?? '').toUpperCase();
    if (curr && curr !== 'RUB' && curr !== 'РУБ') {
        const rub = Number(row.retail_price_withdisc_rub || 0) * qty;
        const loc = Number(row.retail_amount || 0);
        if (rub > 0 && loc > 0) {
            d.rubAmt += rub;
            d.locAmt += loc;
        }
    }
}

export function financeAggToRows(byKey: Map<string, FinanceAgg>): Record<string, unknown>[] {
    return Array.from(byKey.entries()).map(([key, d]) => {
        const [nm_id, date] = key.split('|');
        const { locAmt, rubAmt, ...sums } = d;
        const rate = rubAmt > 0 && locAmt > 0 ? locAmt / rubAmt : 0;
        return { nm_id: Number(nm_id), date, ...sums, rate };
    });
}
