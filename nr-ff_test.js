const assert = require('assert');
const R = require('./fbs-rates.js');
const { compute } = require('./nr-ff.js');
let md = R.setRange({}, 'storage', 10, '2026-09-15', null);
md = R.setRange(md, 'ship', 50, '2026-09-15', '2026-10-09');
md = R.setRange(md, 'ship', 70, '2026-10-10', null);
const arts = [{ nm_id: 1, manual_data: Object.assign({ ff_id: 'A' }, md) }, { nm_id: 2, manual_data: { ff_id: 'B' } }, { nm_id: 3, manual_data: R.setRange({ ff_id: 'B' }, 'ship', 20, '2026-09-01', null) }];
const orders = [{ nm_id: 1, d: '2026-10-09', orders_fbs: 2 }, { nm_id: 1, d: '2026-10-10', orders_fbs: 3 }, { nm_id: 2, d: '2026-10-10', orders_fbs: 4 }, { nm_id: 3, d: '2026-10-11', orders_fbs: 5 }];
const adj = [{ kind: 'swap', amount: 100, ff_id: 'A' }, { kind: 'cancel', amount: 40, ff_id: 'B' }, { kind: 'swap', amount: 7, ff_id: null }];
const t = compute(arts, orders, adj, '2026-10-01', '2026-10-31', '2026-10-14', ['A', 'B']);
// ФФ A: хранение 14×10, отправка 2×50+3×70, подмена 100
assert.strictEqual(t.byFf.A.storage, 140); assert.strictEqual(t.byFf.A.ship, 310); assert.strictEqual(t.byFf.A.payable, 140 + 310 - 100);
// ФФ B: товар 2 без цены (4 заказа), товар 3 по 20 → 100; отмена 40
assert.strictEqual(t.byFf.B.ship, 100); assert.strictEqual(t.byFf.B.missing, 4); assert.strictEqual(t.byFf.B.payable, 100 - 40);
// подмена без ФФ — отдельно
assert.strictEqual(t.byFf.none.swap, 7);
// итог = сумма по ФФ
assert.strictEqual(t.payable, t.byFf.A.payable + t.byFf.B.payable + t.byFf.none.payable);
// неизвестный ФФ (удалён) → «без ФФ»
assert.ok(compute(arts, orders, [], '2026-10-01', '2026-10-31', '2026-10-14', ['A']).byFf.none.ship === 100);
// будущие дни не считаются
assert.strictEqual(compute(arts, [], [], '2026-10-20', '2026-10-31', '2026-10-14', ['A', 'B']).storage, 0);
// профит: ФФ готовой суммой за период
const W = require('./wb-formulas.js');
const row = { sale_dt: '2026-10-01', doc_type_name: 'Продажа', supplier_oper_name: 'Продажа', retail_price_withdisc_rub: 1000, retail_amount: 1000, ppvz_for_pay: 800, quantity: 1, nm_id: 1 };
const a = W.calculateMetrics([row], { ffPeriod: 0 }), b = W.calculateMetrics([row], { ffPeriod: 300 }), c = W.calculateMetrics([row], { ffPeriod: 300, ffInclude: false });
assert.strictEqual(a.profitFull - b.profitFull, 300);
assert.strictEqual(c.profitFull, a.profitFull);
console.log('nr-ff_test: ok');
