'use strict';
const assert = require('node:assert/strict');
const ER = require('./evidence-report.js');
const WB = require('./wb-formulas.js');

const empty = ER.buildReport(null, {});
assert.equal(empty.hasData, false);
assert.equal(empty.kpis.length, 8);
assert.equal(empty.pnl[empty.pnl.length - 1].label, 'Чистая прибыль');
assert.ok(ER.reportHtml(empty).includes('Evidence'));
assert.ok(ER.reportHtml(empty).includes('P&amp;L') || ER.reportHtml(empty).includes('P&L'));

const sale = {
    doc_type_name: 'Продажа',
    retail_price_withdisc_rub: 10000,
    retail_price: 12000,
    retail_amount: 12000,
    ppvz_for_pay: 8000,
    delivery_rub: 80,
    storage_fee: 12,
    penalty: 0,
    quantity: 1,
    nm_id: 1,
    sale_dt: '2026-09-10',
};
const m = WB.calculateMetrics([sale], { taxRate: 6, opex: 0, adsSum: 500 });
const rep = ER.buildReport(m, { stocks: { fbo: 10, fbs: 4, total: 14 }, from: '2026-09-01', to: '2026-09-10' });
assert.equal(rep.hasData, true);
assert.ok(rep.kpis[0].value.includes('₽'));
assert.equal(rep.stockRows[2].value, 14);
assert.ok(ER.reportHtml(rep).includes('2026-09-01'));
assert.equal(ER.money(null), '—');
assert.equal(ER.pct(12.34), '12.3%');
console.log('evidence-report_test: ok');
