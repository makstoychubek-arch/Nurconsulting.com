import assert from 'node:assert/strict';
import {
    FINANCE_API,
    SALES_REPORTS_DETAILED_PATH,
    addLegacyRowToAgg,
    bodyRrdId,
    fetchSalesReportsDetailedPage,
    financeAggToRows,
    parseDetailedBody,
    parseMoney,
    quoteUnsafeInts,
    rowId,
    toLegacyFinanceRow,
    toRawFinanceRow,
} from './wb-finance-report.ts';

assert.equal(FINANCE_API, 'https://finance-api.wildberries.ru');
assert.equal(SALES_REPORTS_DETAILED_PATH, '/api/finance/v1/sales-reports/detailed');

assert.equal(parseMoney('1 2647,29'), 12647.29);
assert.equal(parseMoney('8000'), 8000);
assert.equal(parseMoney(null), 0);

const quoted = quoteUnsafeInts(
    '{"rrdId":9007199254740993,"reportId":25009236420260902,"nmId":1}',
);
assert.match(quoted, /"rrdId":"9007199254740993"/);
assert.match(quoted, /"reportId":"25009236420260902"/);

const rows = parseDetailedBody(
    '[{"rrdId":9007199254740993,"reportId":25009236420260902,"nmId":305353723,'
    + '"docTypeName":"Продажа","saleDt":"2026-09-10","forPay":"8000.50",'
    + '"retailAmount":"12000","retailPriceWithDisc":"10000","quantity":1,'
    + '"paidStorage":"12.5","deliveryService":"80","penalty":"0",'
    + '"vendorCode":"ART-1","sellerOperName":"Продажа","currency":"KGS"}]',
);
assert.equal(rows.length, 1);
assert.equal(rowId(rows[0]), '9007199254740993');
assert.equal(typeof rows[0].rrdId, 'string');

const raw = toRawFinanceRow('cab-1', rows[0]);
assert.equal(raw.rrd_id, '9007199254740993');
assert.equal(raw.realizationreport_id, '25009236420260902');
assert.equal(raw.nm_id, 305353723);
assert.equal(raw.doc_type_name, 'Продажа');
assert.equal(raw.sale_dt, '2026-09-10');
assert.equal(raw.ppvz_for_pay, 8000.5);
assert.equal(raw.retail_amount, 12000);
assert.equal(raw.retail_price_withdisc_rub, 10000);
assert.equal(raw.storage_fee, 12.5);
assert.equal(raw.delivery_rub, 80);
assert.equal(raw.currency_name, 'KGS');
assert.equal(raw.sa_name, 'ART-1');

const legacySnake = toLegacyFinanceRow({
    rrd_id: 11,
    nm_id: 2,
    doc_type_name: 'Продажа',
    sale_dt: '2026-09-09',
    ppvz_for_pay: 100,
    retail_price_withdisc_rub: 200,
    quantity: 1,
});
assert.equal(legacySnake.ppvz_for_pay, 100);
assert.equal(legacySnake.nm_id, 2);

assert.equal(bodyRrdId(0), 0);
assert.equal(bodyRrdId('42'), 42);
assert.equal(bodyRrdId('9007199254740993'), '9007199254740993');

const byKey = new Map();
addLegacyRowToAgg(byKey, {
    nm_id: 1,
    sale_dt: '2026-09-10',
    doc_type_name: 'Продажа',
    quantity: 2,
    retail_price_withdisc_rub: 1000,
    ppvz_for_pay: 1500,
    currency_name: 'KGS',
    retail_amount: 2200,
});
const agg = financeAggToRows(byKey);
assert.equal(agg[0].sc, 2);
assert.equal(agg[0].ss, 2000);
assert.equal(agg[0].tt, 1500);
assert.ok(Number(agg[0].rate) > 1);

let seenBody = '';
const page = await fetchSalesReportsDetailedPage({
    token: 't',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-10',
    rrdId: 0,
    period: 'daily',
    fields: ['rrdId', 'forPay'],
    fetchFn: async (_url, init) => {
        seenBody = String(init?.body || '');
        return new Response('[]', { status: 200 });
    },
});
assert.equal(page.rows.length, 0);
const sent = JSON.parse(seenBody);
assert.equal(sent.period, 'daily');
assert.equal(sent.rrdId, 0);
assert.deepEqual(sent.fields, ['rrdId', 'forPay']);

const empty = await fetchSalesReportsDetailedPage({
    token: 't',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-10',
    fetchFn: async () => new Response('', { status: 204 }),
});
assert.equal(empty.status, 204);
assert.equal(empty.rows.length, 0);

console.log('wb-finance-report_test: ok');
