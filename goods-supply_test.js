// Блоки по складам в «Логистике»: деление штук по процентам без потерь.
const assert = require('assert');
global.window = undefined;
globalThis.addEventListener = () => {};
global.document = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } };
const realSI = global.setInterval; global.setInterval = () => 0;
require('./goods-supply.js');
const C = globalThis.NrGoodsSupplyCl;
assert.ok(C, 'модуль подключился');
assert.deepStrictEqual(C.splitInt(100, [50, 30, 20]), [50, 30, 20]);
const s = C.splitInt(101, [33, 33, 34]);
assert.strictEqual(s.reduce((a, b) => a + b, 0), 101, 'сумма сохраняется');
assert.deepStrictEqual(C.splitInt(0, [50, 50]), [0, 0]);
assert.deepStrictEqual(C.splitInt(10, [0, 0]), [0, 0]);
const sh = C.clShares({ 'M/44': 7 }, [{ p: 50 }, { p: 50 }]);
assert.strictEqual(sh['M/44'].reduce((a, b) => a + b, 0), 7);
assert.strictEqual(C.batchCost([{ price: 1500, boxes: 4 }, { price: null }]), 6000);
assert.strictEqual(C.batchCost([{ boxes: 4 }]), 0);
console.log("goods-supply cluster tests ok"); global.setInterval = realSI;
