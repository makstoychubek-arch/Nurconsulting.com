'use strict';
const assert = require('node:assert/strict');
const C = require('./goods-catalog.js');

assert.equal(C.isZevina1Cabinet('Zevina 1'), true);
assert.equal(C.isZevina1Cabinet('ИП Уркунбаев К.А.'), true);
assert.equal(C.isZevina1Cabinet('Zevina 2'), false);
assert.equal(C.isZevina1Cabinet('ОсОО Айлин Стиль'), false);
assert.equal(C.isZevina1Cabinet('Elium'), false);

assert.equal(C.ZEVINA1_SECTIONS.length, 17);
assert.equal(C.ZEVINA1_SECTIONS[0].name, 'Свитера');
assert.equal(C.ZEVINA1_SECTIONS[0].items[0].nmId, 1218782505);
assert.equal(C.ZEVINA1_SECTIONS[1].name, 'Костюм укороч');
assert.equal(C.ZEVINA1_SECTIONS[9].name, 'Костюм велюр');
assert.equal(C.ZEVINA1_SECTIONS[16].name, 'Платье Риджак');
assert.equal(C.ZEVINA1_SECTIONS.reduce((n, s) => n + s.items.length, 0), 126);

const live = [
    { nmId: 1218782505, fbo: 10, fbs: 20, transit: 3, plan: 0, sellerArticle: 'old' },
    { nmId: 999, fbo: 1, fbs: 0, transit: 0, plan: 0, sellerArticle: 'лишний' },
];
const groups = C.groupGoods(live, 'Zevina 1');
assert.equal(groups[0].name, 'Свитера');
assert.equal(groups[0].items[0].sellerArticle, 'Свитер-айвори');
assert.equal(groups[0].items[0].fbo, 10);
assert.equal(groups[0].items[0].fbs, 20);
assert.equal(groups[0].items[0].transit, 3);
assert.equal(groups[groups.length - 1].name, 'Прочие');
assert.equal(groups[groups.length - 1].items[0].nmId, 999);

const ivory = groups[0].items[0];
assert.equal(C.stockOf(ivory).total, 33);

const suit = C.ZEVINA1_SECTIONS[1].items[0];
const suitLive = C.groupByCatalog([], C.ZEVINA1_SECTIONS)[1].items[0];
assert.equal(suitLive.nmId, 296564448);
assert.equal(suitLive.plan, 3000);
assert.equal(C.stockOf(suitLive).total, 3000);

const other = C.groupGoods([
    { nmId: 1, category: 'Блузки', sellerArticle: 'b', fbo: 2, fbs: 0, transit: 0, plan: 0 },
    { nmId: 2, category: '', sellerArticle: 'a', fbo: 1, fbs: 1, transit: 0, plan: 0 },
], 'Elium');
assert.equal(other[0].name, 'Блузки');
assert.equal(other[1].name, 'Без раздела');

const filtered = C.filterGroups(groups, '1218782505');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].items.length, 1);
assert.equal(filtered[0].items[0].nmId, 1218782505);

console.log('goods-catalog_test: ok');
