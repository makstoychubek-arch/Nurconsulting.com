const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const win = {};
vm.runInNewContext(fs.readFileSync(__dirname + '/rnp-metrics.js', 'utf8'), { window: win });
const M = win.NrRnpMetrics;

// Литраж по карточке: 35×45×4 см = 6,3 л
assert.strictEqual(M.litres({ dim_l_cm: 45, dim_w_cm: 35, dim_h_cm: 4 }), 6.3);
assert.strictEqual(M.litres({ dim_l_cm: '45', dim_w_cm: '35', dim_h_cm: '4' }), 6.3, 'числа из базы приходят строками');
assert.strictEqual(M.litres({ dim_l_cm: 45, dim_w_cm: 35 }), null, 'нет высоты: пусто, не ноль');
assert.strictEqual(M.litres(null), null);

// Тариф в сомах (по тарифу WB: 78,2 ₽ + 23,8 ₽ за литр, курс 1,0535)
const T = { ok: true, delivery_base: 82.389, delivery_liter: 25.073, storage_base: 0.126, storage_liter: 0.126 };
assert.strictEqual(Math.round(M.logisticsPerUnit(6.3, T)), 215, 'логистика ≈ 215 сом за шт');
assert.strictEqual(Math.round(M.logisticsPerUnit(1, T) * 10) / 10, 82.4, 'до литра: только база');
assert.strictEqual(Math.round(M.logisticsPerUnit(0.5, T) * 10) / 10, 82.4, 'меньше литра: только база');
assert.strictEqual(M.logisticsPerUnit(6.3, null), null, 'нет тарифа: пусто');
assert.strictEqual(M.logisticsPerUnit(6.3, { ok: false }), null);

const r = M.forArticle({ dim_l_cm: 45, dim_w_cm: 35, dim_h_cm: 4 }, 61, T);
assert.strictEqual(r.litres, 6.3);
assert.strictEqual(Math.round(r.litresStock), 384, '61 шт × 6,3 л');
assert.strictEqual(Math.round(r.storageUnit * 100) / 100, 0.79, 'хранение ≈ 0,79 сом за шт в день');
assert.strictEqual(Math.round(r.storageDay), 48, 'хранение на остаток ≈ 48 сом в день');
assert.strictEqual(Math.round(r.logistics), 215);

// Без габаритов: все метрики пустые
const e = M.forArticle({}, 61, T);
assert.ok(e.litres === null && e.litresStock === null && e.storageDay === null && e.logistics === null);

// Нулевой остаток: литраж остатка 0, хранение 0, логистика за шт остаётся
const z = M.forArticle({ dim_l_cm: 45, dim_w_cm: 35, dim_h_cm: 4 }, 0, T);
assert.strictEqual(z.litresStock, 0);
assert.strictEqual(z.storageDay, 0);
assert.strictEqual(Math.round(z.logistics), 215);

// Формат: запятая, пробел тысяч, прочерк
assert.strictEqual(M.fmt(6.3), '6,3');
assert.strictEqual(M.fmt(384.2), '384');
assert.strictEqual(M.fmt(1234.6), '1 235');
assert.strictEqual(M.fmt(null), '—');
assert.strictEqual(M.fmt(NaN), '—');
assert.strictEqual(M.fmt(0.8, 2), '0,80');

console.log('rnp-metrics_test: ok');
