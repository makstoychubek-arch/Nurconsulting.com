'use strict';
const assert = require('node:assert/strict');
const WB = require('./wb-formulas.js');

assert.equal(typeof WB.calculateMetrics, 'function');
assert.match(WB.fmtMoney(4200), /4.200 сом/);
assert.equal(WB.fmtAds({ adsSum: 0 }), '—');
assert.match(WB.fmtAds({ adsSum: 4200, drr: 21 }), /4.200 сом · 21%/);

const sale = {
    doc_type_name: 'Продажа',
    retail_price_withdisc_rub: 10000,
    retail_price: 12000,
    ppvz_for_pay: 8000,
    quantity: 1,
    sale_dt: '2026-09-10',
};
const withoutAds = WB.calculateMetrics([sale], { taxRate: 6, opex: 0, adsSum: 0 });
const withAds = WB.calculateMetrics([sale], { taxRate: 6, opex: 0, adsSum: 1000 });
assert.equal(withoutAds.adsSum, 0);
assert.equal(withoutAds.drr, null);
assert.equal(withAds.adsSum, 1000);
assert.equal(withAds.drr, 10);
assert.equal(withAds.profitFull, withoutAds.profitFull - 1000);
assert.equal(withAds.profitBeforeCost, withoutAds.profitBeforeCost - 1000);

global.document = { querySelector() { return null; } };
const painted = {};
WB.applyMetricsToDashboard(withAds, (id, val) => { painted[id] = val; });
assert.match(painted['m-ads'], /сом/);
assert.match(painted['m-ads'], /10%/);
assert.match(painted['m-profit'], /сом/);
assert.doesNotMatch(painted['m-profit'], /₽/);

console.log('wb-formulas_test: ok');
