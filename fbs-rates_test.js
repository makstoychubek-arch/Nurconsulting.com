const assert = require('assert');
const R = require('./fbs-rates.js');
// хранение с 15 сентября «и дальше»
let md = R.setRange({}, 'storage', 30, '2026-09-15', null);
assert.strictEqual(R.rateOn(md, 'storage', '2026-09-14'), 0);
assert.strictEqual(R.rateOn(md, 'storage', '2026-09-15'), 30);
assert.strictEqual(R.rateOn(md, 'storage', '2027-01-01'), 30);
// отправка 50 с 15.09, с 16.10 — 70: старый период обрезается
md = R.setRange(md, 'ship', 50, '2026-09-15', null);
md = R.setRange(md, 'ship', 70, '2026-10-16', null);
assert.strictEqual(R.rateOn(md, 'ship', '2026-10-15'), 50);
assert.strictEqual(R.rateOn(md, 'ship', '2026-10-16'), 70);
assert.deepStrictEqual(R.list(md, 'ship').map(x => [x.f, x.t, x.v]), [['2026-09-15', '2026-10-15', 50], ['2026-10-16', null, 70]]);
// закрытый период в середине делит старый на две части
let m2 = R.setRange({}, 'ship', 50, '2026-09-01', null);
m2 = R.setRange(m2, 'ship', 60, '2026-09-10', '2026-09-20');
assert.deepStrictEqual(R.list(m2, 'ship').map(x => [x.f, x.t, x.v]), [['2026-09-01', '2026-09-09', 50], ['2026-09-10', '2026-09-20', 60], ['2026-09-21', null, 50]]);
// одинаковое значение подряд склеивается
let m3 = R.setRange(R.setRange({}, 'ship', 50, '2026-09-01', '2026-09-10'), 'ship', 50, '2026-09-11', null);
assert.strictEqual(R.list(m3, 'ship').length, 1);
// дыры: 15–30 сентября задано, дальше до 5 октября — нет
let m4 = R.setRange({}, 'ship', 50, '2026-09-15', '2026-09-30');
assert.deepStrictEqual(R.gaps(m4, 'ship', '2026-09-15', '2026-10-05'), [{ from: '2026-10-01', to: '2026-10-05' }]);
// старое одиночное значение действует всегда и заменяется при первой установке периода
const old = { fbs_ship_price: 40 };
assert.strictEqual(R.rateOn(old, 'ship', '2020-01-01'), 40);
const upd = R.setRange(old, 'ship', 55, '2026-10-01', null);
assert.strictEqual(upd.fbs_ship_price, undefined);
assert.strictEqual(R.rateOn(upd, 'ship', '2026-09-30'), 40);
assert.strictEqual(R.rateOn(upd, 'ship', '2026-10-01'), 55);
// сумма хранения за период: 30 × 16 дней
assert.strictEqual(R.sumDaily(md, 'storage', '2026-09-15', '2026-09-30'), 480);
console.log('fbs-rates_test: ok');
