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

const camelSale = {
    docTypeName: 'Продажа',
    retailPriceWithDisc: '10000',
    retailPrice: '12000',
    forPay: '8000',
    quantity: 1,
    saleDt: '2026-09-10',
};
const camel = WB.calculateMetrics([camelSale], { taxRate: 6, opex: 0, adsSum: 0 });
assert.equal(camel.salesSum, 10000);
assert.equal(camel.toTransferSum, 8000);
assert.equal(camel.realizationSum, 12000);

// Возврат в отчёте WB — положительные суммы, которые вычитают. Раньше forPay
// возврата прибавлялся к «к перечислению» и занижал комиссию.
const ret = {
    doc_type_name: 'Возврат',
    retail_price_withdisc_rub: 10000,
    retail_price: 12000,
    ppvz_for_pay: 8000,
    acquiring_fee: 300,
    quantity: 1,
    sale_dt: '2026-09-11',
};
const withReturn = WB.calculateMetrics([{ ...sale, acquiring_fee: 300 }, ret], { taxRate: 6, adsSum: 0 });
assert.equal(withReturn.returnsSum, 10000);
assert.equal(withReturn.toTransferSum, 0, 'продажа и равный ей возврат гасят друг друга');
assert.equal(withReturn.acquiringSum, 0, 'эквайринг возврата тоже возвращается');
assert.equal(withReturn.taxBase, 0, 'налог не берётся с возвращённого товара');
assert.equal(withReturn.buyoutRate, 50);

// ppvz_for_pay уже без комиссии и эквайринга, поэтому эквайринг нельзя
// вычитать из прибыли второй раз.
const acq = WB.calculateMetrics([{ ...sale, acquiring_fee: 300 }], { taxRate: 6, adsSum: 0 });
const noAcq = WB.calculateMetrics([sale], { taxRate: 6, adsSum: 0 });
assert.equal(acq.profitBeforeCost, noAcq.profitBeforeCost, 'эквайринг уже внутри forPay');
assert.equal(acq.commissionSum, noAcq.commissionSum - 300, 'на эквайринг комиссия меньше');
assert.equal(noAcq.commissionSum, 2000);
assert.equal(noAcq.profitBeforeCost, 8000 - 600);

// Компенсация раньше прибавлялась дважды: и напрямую, и через комиссию.
const comp = WB.calculateMetrics([{ ...sale, additional_payment: 500 }], { taxRate: 6, adsSum: 0 });
assert.equal(comp.compensationSum, 500);
assert.equal(comp.profitBeforeCost, noAcq.profitBeforeCost + 500);

// Без retail_price от WB реализация и СПП неизвестны — прочерк, не ноль.
const noPrice = WB.calculateMetrics([{ ...sale, retail_price: 0 }], { taxRate: 6, adsSum: 0 });
assert.equal(noPrice.hasRetailPrice, false);
assert.equal(noPrice.realizationSum, null);
assert.equal(noPrice.sppSum, null);
assert.equal(WB.fmtMoney(noPrice.realizationSum), '—');
assert.ok(noPrice.margin > 0, 'маржа считается от продаж, когда реализация неизвестна');
assert.equal(noAcq.hasRetailPrice, true);
assert.equal(noAcq.sppSum, 2000);

// Половина дней с retail_price давала реализацию меньше продаж и вдвое
// завышенную маржу — так на живых данных выходило 55.3% вместо 28.4%.
const halfPrice = WB.calculateMetrics(
    [sale, { ...sale, retail_price: 0, sale_dt: '2026-09-12' }], { taxRate: 6, adsSum: 0 });
assert.equal(halfPrice.hasRetailPrice, false, 'частичный retail_price не считается за полный');
assert.equal(halfPrice.realizationSum, null);
assert.equal(halfPrice.sppSum, null);
assert.ok(halfPrice.margin < 100 && halfPrice.margin > 0);
assert.ok(
    Math.abs(halfPrice.margin - Math.round((halfPrice.profitFull / halfPrice.salesSum) * 1000) / 10) < 0.05,
    'маржа берётся от продаж, а не от половины реализации');

// Компенсации и коррекции приходят строками «Продажа» с нулевой ценой: цены у
// них нет по своей природе, а не потому что WB её не отдал. На живых данных
// десяток таких строк на 7000 продаж гасил реализацию за весь месяц.
const withCompRow = WB.calculateMetrics([
    sale,
    { doc_type_name: 'Продажа', supplier_oper_name: 'Добровольная компенсация при возврате',
      retail_price_withdisc_rub: 0, retail_price: 0, ppvz_for_pay: 1340, quantity: 1, sale_dt: '2026-09-11' },
], { taxRate: 6, adsSum: 0 });
assert.equal(withCompRow.hasRetailPrice, true, 'нулевая компенсация не считается продажей без цены');
assert.equal(withCompRow.realizationSum, 12000);
assert.equal(withCompRow.sppSum, 2000);

console.log('wb-formulas_test: ok');
