import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const code = stripTypeScriptTypes(readFileSync(new URL('./price-guard.ts', import.meta.url), 'utf8').replace(/^export /gm, ''));
const L = new Function(code + '\nreturn { assessPriceChange, itemsHash, makeCode, codeHash, fmtPct, summaryText, DROP_LIMIT, MASS_COUNT }')();
const cur = (d) => ({ price: 5000, discount: 30, discounted: d });
// небольшое снижение и повышение не требуют кода
let a = L.assessPriceChange([{ nmID: 1, price: 4800, discount: 30 }, { nmID: 2, price: 5500, discount: 30 }], { 1: cur(3500), 2: cur(3500) });
assert.equal(a.needConfirm, false); assert.ok(a.maxDrop < 0.05);
// снижение больше 20% по одному артикулу
a = L.assessPriceChange([{ nmID: 1, price: 3500, discount: 30 }], { 1: cur(3500) });
assert.equal(a.needConfirm, true); assert.ok(a.maxDrop > 0.29 && a.maxDrop < 0.31, 'падение ' + a.maxDrop);
// ровно около лимита: 15% не требует, 25% требует
assert.equal(L.assessPriceChange([{ nmID: 1, price: 4250, discount: 30 }], { 1: cur(3500) }).needConfirm, false);
assert.equal(L.assessPriceChange([{ nmID: 1, price: 3750, discount: 30 }], { 1: cur(3500) }).needConfirm, true);
// массовое снижение 10+ артикулов больше чем на 10% (каждое меньше лимита 20%)
const many = Array.from({ length: 10 }, (_, i) => ({ nmID: 100 + i, price: 4300, discount: 30 }));
const curs = Object.fromEntries(many.map((m) => [m.nmID, cur(3500)]));
a = L.assessPriceChange(many, curs); assert.equal(a.massDrops, 10); assert.equal(a.needConfirm, true, 'массовое снижение');
a = L.assessPriceChange(many.slice(0, 9), curs); assert.equal(a.needConfirm, false, '9 артикулов с падением 14% ниже порога');
// текущая цена неизвестна: считаем рискованным
a = L.assessPriceChange([{ nmID: 7, price: 4000, discount: 30 }], {}); assert.equal(a.needConfirm, true); assert.equal(a.unknown, 1);
// скидка не передана: берётся текущая
a = L.assessPriceChange([{ nmID: 1, price: 5000 }], { 1: cur(3500) }); assert.equal(a.needConfirm, false); assert.equal(a.lines[0].to, 3500);
// подпись списка не зависит от порядка и отличается при другой цене
const h1 = await L.itemsHash([{ nmID: 2, price: 1 }, { nmID: 1, price: 2, discount: 5 }]), h2 = await L.itemsHash([{ nmID: 1, price: 2, discount: 5 }, { nmID: 2, price: 1 }]);
assert.equal(h1, h2); assert.notEqual(h1, await L.itemsHash([{ nmID: 2, price: 1 }, { nmID: 1, price: 3, discount: 5 }]));
// код: шесть цифр, хэш привязан к коду, id и списку
const c = L.makeCode(); assert.match(c, /^\d{6}$/);
assert.notEqual(await L.codeHash(c, 'a', h1), await L.codeHash('000000', 'a', h1)); assert.notEqual(await L.codeHash(c, 'a', h1), await L.codeHash(c, 'b', h1)); assert.notEqual(await L.codeHash(c, 'a', h1), await L.codeHash(c, 'a', 'x'));
assert.equal(L.fmtPct(-0.253), '-25,3%'); assert.equal(L.fmtPct(0.1), '+10,0%');
assert.match(L.summaryText(L.assessPriceChange([{ nmID: 1, price: 3500, discount: 30 }], { 1: cur(3500) })), /1 артикулов/);
console.log('PASS: price-guard');
