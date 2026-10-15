const assert = require('assert');
const T = require('./ff-terms.js');
const rows = [
    { id: 1, ff_name: 'A', kind: 'ship', value: 50, date_from: '2026-09-15', date_to: null },
    { id: 2, ff_name: 'B', kind: 'ship', value: 30, date_from: '2026-09-01', date_to: null },
];
let idx = T.index(rows);
assert.strictEqual(T.at(idx, 'A', 'ship', '2026-10-01').value, 50);
assert.strictEqual(T.at(idx, 'A', 'ship', '2026-09-14'), null);
assert.strictEqual(T.at(idx, 'B', 'ship', '2026-10-01').value, 30);   // у каждого ФФ свой тариф
// новая цена 70 с 16.10: старый период закрывается 15.10
let p = T.plan(rows, 'A', 'ship', 70, null, '2026-10-16', null);
assert.deepStrictEqual(p.update, [{ id: 1, date_to: '2026-10-15' }]);
assert.strictEqual(p.insert.value, 70); assert.strictEqual(p.insert.date_to, null);
// закрытый период в середине делит старый
p = T.plan(rows, 'A', 'ship', 60, null, '2026-10-01', '2026-10-10');
assert.deepStrictEqual(p.update, [{ id: 1, date_to: '2026-09-30' }]);
assert.strictEqual(p.add.length, 1); assert.strictEqual(p.add[0].date_from, '2026-10-11'); assert.strictEqual(p.add[0].value, 50);
// период целиком внутри нового удаляется
p = T.plan([{ id: 9, ff_name: 'A', kind: 'ship', value: 1, date_from: '2026-10-05', date_to: '2026-10-06' }], 'A', 'ship', 5, null, '2026-10-01', null);
assert.deepStrictEqual(p.remove, [9]);
// лимит только у хранения
assert.strictEqual(T.plan([], 'A', 'ship', 5, 100, '2026-10-01').insert.daily_cap, null);
assert.strictEqual(T.plan([], 'A', 'storage', 0.4, 6000, '2026-10-01').insert.daily_cap, 6000);
// дыры: 15–30 сентября задано, дальше до 5 октября — нет
idx = T.index([{ id: 1, ff_name: 'A', kind: 'ship', value: 50, date_from: '2026-09-15', date_to: '2026-09-30' }]);
assert.deepStrictEqual(T.gaps(idx, 'A', 'ship', '2026-09-01', '2026-10-05'), [{ from: '2026-10-01', to: '2026-10-05' }]);
// цена отправки по долям: 75% на A (50) и 25% на B (30) = 45
idx = T.index(rows);
assert.strictEqual(T.shipFor(idx, [{ k: 'A', w: 0.75 }, { k: 'B', w: 0.25 }], '2026-10-01'), 45);
assert.strictEqual(T.shipFor(idx, [{ k: 'Z', w: 1 }], '2026-10-01'), null);
// заказы: товар 7 в день 10.10 — 3 заказа на A и 1 на B
const oi = T.ordersIndex([{ nm_id: 7, order_date: '2026-10-10', ff_name: 'A' }, { nm_id: 7, order_date: '2026-10-10', ff_name: 'A' }, { nm_id: 7, order_date: '2026-10-10', ff_name: 'A' }, { nm_id: 7, order_date: '2026-10-10', ff_name: 'B' }]);
assert.deepStrictEqual(T.distFor(oi, 7, '2026-10-10'), [{ k: 'A', w: 0.75 }, { k: 'B', w: 0.25 }]);
assert.deepStrictEqual(T.distFor(oi, 7, '2026-10-11'), [{ k: 'A', w: 0.75 }, { k: 'B', w: 0.25 }]);   // день раньше
assert.strictEqual(T.distFor(oi, 7, '2026-10-13'), null);
assert.strictEqual(T.distFor(oi, 8, '2026-10-10'), null);
// курс: свой у ФФ важнее курса НБКР; без курсов — 1
assert.strictEqual(T.fxFor({ fx_rate: 1.06 }, { '2026-10-10': 1.03 }, '2026-10-10'), 1.06);
assert.strictEqual(T.fxFor({}, { '2026-10-10': 1.03 }, '2026-10-10'), 1.03);
assert.strictEqual(T.fxFor({}, { '2026-10-08': 1.02 }, '2026-10-10'), 1.02);   // ближайший прошлый
assert.strictEqual(T.fxFor({}, {}, '2026-10-10'), 1);
// цена отправки 50 ₽ × курс ФФ 1,06 = 53 сом
assert.strictEqual(T.shipFor(T.index([{ ff_name: 'A', kind: 'ship', value: 50, fx_rate: 1.06, date_from: '2026-09-01', date_to: null }]), [{ k: 'A', w: 1 }], '2026-10-01', {}), 53);
console.log('ff-terms_test: ok');

// plan: вид хранения (fixed) попадает в новую строку и сохраняется в «хвосте» разрезанного периода
const pf = T.plan([{ id: 'a', ff_name: 'W', kind: 'storage', value: 315, storage_mode: 'fixed', date_from: '2026-10-01', date_to: null }], 'W', 'storage', 400, 999, '2026-10-05', '2026-10-06', null, 'fixed');
assert.strictEqual(pf.insert.storage_mode, 'fixed'); assert.strictEqual(pf.insert.daily_cap, null, 'у фиксированного лимита нет');
assert.strictEqual(pf.add[0].storage_mode, 'fixed');
assert.strictEqual(T.plan([], 'W', 'storage', 0.4, 6000, '2026-10-01', null, null).insert.storage_mode, 'unit');
console.log('ff-terms storage_mode: ok');

// объединённые ФФ: одинаковые строки тарифов схлопываются, разные остаются
const dd = T.dedupe([{ ff_name: 'A', kind: 'ship', value: 50, date_from: '2026-10-10', date_to: null }, { ff_name: 'A', kind: 'ship', value: 50, date_from: '2026-10-10', date_to: null }, { ff_name: 'A', kind: 'ship', value: 60, date_from: '2026-10-10', date_to: null }]);
assert.strictEqual(dd.length, 2);
console.log('ff-terms dedupe: ok');
