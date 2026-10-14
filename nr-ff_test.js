const assert = require('assert');
require('./fbs-rates.js');
const { compute } = require('./nr-ff.js');
const R = require('./fbs-rates.js');
let md = R.setRange({}, 'storage', 10, '2026-09-15', null);
md = R.setRange(md, 'ship', 50, '2026-09-15', '2026-10-09');
md = R.setRange(md, 'ship', 70, '2026-10-10', null);
const arts = [{ nm_id: 1, manual_data: md }, { nm_id: 2, manual_data: {} }];
const orders = [{ nm_id: 1, d: '2026-10-09', orders_fbs: 2 }, { nm_id: 1, d: '2026-10-10', orders_fbs: 3 }, { nm_id: 2, d: '2026-10-10', orders_fbs: 4 }];
const adj = [{ kind: 'swap', amount: 100 }, { kind: 'cancel', amount: 40 }];
const t = compute(arts, orders, adj, '2026-10-01', '2026-10-31', '2026-10-14');
// хранение: 14 дней (01..14 окт) × 10; отправка: 2×50 + 3×70; у артикула 2 нет цены → 4 заказа без цены
assert.strictEqual(t.storage, 140);
assert.strictEqual(t.ship, 310);
assert.strictEqual(t.missing, 4);
assert.strictEqual(t.swap, 100);
assert.strictEqual(t.cancel, 40);
assert.strictEqual(t.payable, 140 + 310 - 100 - 40);
// будущие дни не считаются
assert.strictEqual(compute(arts, [], [], '2026-10-20', '2026-10-31', '2026-10-14').storage, 0);
// профит: ФФ готовой суммой за период
const W = require('./wb-formulas.js');
const row = { sale_dt: '2026-10-01', doc_type_name: 'Продажа', supplier_oper_name: 'Продажа', retail_price_withdisc_rub: 1000, retail_amount: 1000, ppvz_for_pay: 800, quantity: 1, nm_id: 1 };
const a = W.calculateMetrics([row], { ffPeriod: 0 }), b = W.calculateMetrics([row], { ffPeriod: 300 }), c = W.calculateMetrics([row], { ffPeriod: 300, ffInclude: false });
assert.strictEqual(a.profitFull - b.profitFull, 300);
assert.strictEqual(c.profitFull, a.profitFull);
console.log('nr-ff_test: ok');
