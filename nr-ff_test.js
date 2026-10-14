const assert = require('assert');
const R = require('./fbs-rates.js');
const { compute } = require('./nr-ff.js');
let md = R.setRange({}, 'storage', 10, '2026-09-15', null);
md = R.setRange(md, 'ship', 50, '2026-09-15', '2026-10-09');
md = R.setRange(md, 'ship', 70, '2026-10-10', null);
const arts = [{ nm_id: 1, manual_data: md }, { nm_id: 2, manual_data: {} }, { nm_id: 3, manual_data: R.setRange({}, 'ship', 20, '2026-09-01', null) }];
// товар 1 лежит на двух ФФ: 75% на A, 25% на B; товар 2 — только на B; товар 3 — нигде (без ФФ)
const shares = { 1: [{ k: 'A', w: 0.75 }, { k: 'B', w: 0.25 }], 2: [{ k: 'B', w: 1 }] };
const orders = [{ nm_id: 1, d: '2026-10-09', orders_fbs: 2 }, { nm_id: 1, d: '2026-10-10', orders_fbs: 4 }, { nm_id: 2, d: '2026-10-10', orders_fbs: 4 }, { nm_id: 3, d: '2026-10-11', orders_fbs: 5 }];
const adj = [{ kind: 'swap', amount: 100, ff_name: 'A' }, { kind: 'cancel', amount: 40, ff_name: 'B' }, { kind: 'swap', amount: 7, ff_name: null }];
const t = compute(arts, orders, adj, '2026-10-01', '2026-10-31', '2026-10-14', shares);
// товар 1: хранение 14×10=140, отправка 2×50+4×70=380; делится 75/25
assert.strictEqual(t.byFf.A.storage, 105); assert.strictEqual(t.byFf.A.ship, 285); assert.strictEqual(t.byFf.A.payable, 105 + 285 - 100);
assert.strictEqual(t.byFf.B.storage, 35); assert.strictEqual(t.byFf.B.ship, 95); assert.strictEqual(t.byFf.B.missing, 4); assert.strictEqual(t.byFf.B.payable, 35 + 95 - 40);
// товар 3 без ФФ: 5 заказов × 20, плюс подмена 7
assert.strictEqual(t.byFf.none.ship, 100); assert.strictEqual(t.byFf.none.swap, 7);
// итог = сумма по ФФ
assert.ok(Math.abs(t.payable - (t.byFf.A.payable + t.byFf.B.payable + t.byFf.none.payable)) < 1e-9);
// будущие дни не считаются
assert.strictEqual(compute(arts, [], [], '2026-10-20', '2026-10-31', '2026-10-14', shares).storage, 0);
// хранение по остатку: 0,40 ₽/шт, лимит 100 ₽/сутки, с 10 октября; до 10-го — по тарифу за артикул
const stock = { terms: [{ rate: 0.4, daily_cap: 100, date_from: '2026-10-10', date_to: null }], daily: { '2026-10-10': { 1: 100, 2: 100 }, '2026-10-11': { 1: 300, 2: 100 } }, snapshot: { 1: 100, 2: 100 } };
const ts = compute(arts, [], [], '2026-10-09', '2026-10-12', '2026-10-14', shares, stock);
// 09.10: тариф за артикул 10 (только товар 1, делится 75/25) = 10; 10.10: 200×0.4=80; 11.10: 400×0.4=160→лимит 100; 12.10: снимок 200 → 80
assert.strictEqual(Math.round(ts.storage), 10 + 80 + 100 + 80);
// лимит и доли по ФФ: 11.10 стоки A=75%×300+0 =225, B=25%×300+100=175 → 100×225/400=56.25 и 43.75
assert.ok(ts.byFf.A.storage > ts.byFf.B.storage * 0.5);
// профит: ФФ готовой суммой за период
const W = require('./wb-formulas.js');
const row = { sale_dt: '2026-10-01', doc_type_name: 'Продажа', supplier_oper_name: 'Продажа', retail_price_withdisc_rub: 1000, retail_amount: 1000, ppvz_for_pay: 800, quantity: 1, nm_id: 1 };
const a = W.calculateMetrics([row], { ffPeriod: 0 }), b = W.calculateMetrics([row], { ffPeriod: 300 }), c = W.calculateMetrics([row], { ffPeriod: 300, ffInclude: false });
assert.strictEqual(a.profitFull - b.profitFull, 300);
assert.strictEqual(c.profitFull, a.profitFull);
console.log('nr-ff_test: ok');
