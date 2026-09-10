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
assert.equal(C.ZEVINA1_SECTIONS[0].items[0].transit, 3500);
assert.equal(C.ZEVINA1_SECTIONS[1].name, 'Костюм укороч');
assert.equal(C.ZEVINA1_SECTIONS[9].name, 'Костюм велюр');
assert.equal(C.ZEVINA1_SECTIONS[16].name, 'Платье Риджак');
assert.equal(C.ZEVINA1_SECTIONS.reduce((n, s) => n + s.items.length, 0), 126);
assert.equal(C.ZEVINA1_SECTIONS.some((s) => s.items.some((i) => i.name === 'ИТОГО')), false);

const sheetTransit = C.ZEVINA1_SECTIONS.reduce((n, s) => n + s.items.reduce((a, i) => a + i.transit, 0), 0);
const sheetPlan = C.ZEVINA1_SECTIONS.reduce((n, s) => n + s.items.reduce((a, i) => a + i.plan, 0), 0);
assert.equal(sheetTransit, 15712);
assert.equal(sheetPlan, 14900);

assert.equal(C.hasManualQty(0), true);
assert.equal(C.hasManualQty(''), false);
assert.equal(C.hasManualQty(undefined), false);
assert.equal(C.resolveSheetQty(undefined, 3500, true), 3500);
assert.equal(C.resolveSheetQty(12, 3500, true), 12);
assert.equal(C.resolveSheetQty(0, 3500, true), 0);
assert.equal(C.resolveSheetQty(undefined, 3500, false), 0);
assert.equal(C.parseQty('1 200'), 1200);
assert.equal(C.parseQty(''), 0);
assert.equal(C.readManualQty({ goods_transit: 40 }, 'goods_transit'), 40);
assert.equal(C.readManualQty({}, 'goods_transit'), undefined);

const live = [
    { nmId: 1218782505, fbo: 10, fbs: 20, transit: 3, plan: 99, sellerArticle: 'old' },
    { nmId: 999, fbo: 1, fbs: 0, transit: 8, plan: 7, sellerArticle: 'лишний' },
];
const groups = C.groupGoods(live, 'Zevina 1');
assert.equal(groups[0].name, 'Свитера');
assert.equal(groups[0].items[0].sellerArticle, 'Свитер-айвори');
assert.equal(groups[0].items[0].fbo, 10);
assert.equal(groups[0].items[0].fbs, 20);
assert.equal(groups[0].items[0].transit, 3500, 'WB in-way must not replace sheet transit');
assert.equal(groups[0].items[0].plan, 0, 'WB/RNP plan must not replace sheet plan');
assert.equal(groups[groups.length - 1].name, 'Прочие');
assert.equal(groups[groups.length - 1].items[0].nmId, 999);
assert.equal(groups[groups.length - 1].items[0].transit, 0, 'extra SKUs have empty transit unless edited');
assert.equal(groups[groups.length - 1].items[0].plan, 0);

const ivory = groups[0].items[0];
assert.equal(C.stockOf(ivory).total, 10 + 20 + 3500);

const edited = C.groupGoods([
    { nmId: 1218782505, fbo: 10, fbs: 20, transit: 40, plan: 5, transitManual: true, planManual: true },
], 'ИП Уркунбаев');
assert.equal(edited[0].items[0].transit, 40);
assert.equal(edited[0].items[0].plan, 5);

const suitLive = C.groupByCatalog([], C.ZEVINA1_SECTIONS)[1].items[0];
assert.equal(suitLive.nmId, 296564448);
assert.equal(suitLive.transit, 761);
assert.equal(suitLive.plan, 3000);
assert.equal(C.stockOf(suitLive).total, 3761);

const other = C.groupGoods([
    { nmId: 1, category: 'Блузки', sellerArticle: 'b', fbo: 2, fbs: 0, transit: 90, plan: 80 },
    { nmId: 2, category: '', sellerArticle: 'a', fbo: 1, fbs: 1, transit: 4, plan: 3 },
], 'Elium');
assert.equal(other[0].name, 'Блузки');
assert.equal(other[0].items[0].transit, 0, 'other cabinets leave transit empty');
assert.equal(other[0].items[0].plan, 0, 'other cabinets leave plan empty');
assert.equal(other[1].name, 'Без раздела');

const otherEdited = C.groupGoods([
    { nmId: 1, category: 'Блузки', sellerArticle: 'b', fbo: 2, fbs: 0, transit: 15, plan: 9, transitManual: true, planManual: true },
], 'Elium');
assert.equal(otherEdited[0].items[0].transit, 15);
assert.equal(otherEdited[0].items[0].plan, 9);

const filtered = C.filterGroups(groups, '1218782505');
assert.equal(filtered.length, 1);
assert.equal(filtered[0].items.length, 1);
assert.equal(filtered[0].items[0].nmId, 1218782505);

const hidden = C.hideGroups(groups, { [groups[0].key]: true });
assert.ok(hidden.length && hidden[0].name !== 'Свитера');
assert.equal(hidden[0].name, groups[1].name);
assert.equal(C.visibleCols({ nm: true, fbo: true }).map((c) => c.id).join(','), 'art,fbs,transit,plan,total');

assert.equal(C.warehouseQty({ fbo: 10, fbs: 6, transit: 3500, plan: 9 }), 16);
assert.equal(C.warehouseQty({ fbo: 0, fbs: 0, transit: 100 }), 0);
assert.equal(C.monthTitleRu(2026, 9), 'Сентябрь 2026');
assert.equal(C.dayLabel('2026-09-10'), '10.09');
const sept = C.monthDayKeys(2026, 9);
assert.equal(sept.length, 30);
assert.equal(sept[0], '2026-09-01');
assert.equal(sept[9], '2026-09-10');
assert.equal(C.monthDayKeys(2026, 2).length, 28);

const dailyIdx = C.indexDailyStocks([
    { nm_id: 1218782505, date: '2026-09-10', qty: 1426, fbo: 1400, fbs: 26 },
    { nmId: 296564448, date: '2026-09-10T00:00:00.000Z', qty: 960 },
]);
assert.equal(C.dailyQty(dailyIdx, 1218782505, '2026-09-10'), 1426);
assert.equal(C.dailyQty(dailyIdx, 1218782505, '2026-09-09'), null);
assert.equal(C.dailyQty(dailyIdx, 296564448, '2026-09-10'), 960);

const spark = C.sparkValues(dailyIdx, [1218782505, 296564448], sept);
assert.equal(spark[8], null, 'empty days stay empty, not zero');
assert.equal(spark[9], 1426 + 960);
assert.ok(spark.slice(0, 9).every((v) => v == null));
assert.equal(C.FIRST_SNAPSHOT_YMD, '2026-09-10');
assert.equal(C.SNAPSHOT_HOUR_BISHKEK, 3);
assert.equal(C.lastClosedSalesYmd(new Date('2026-09-10T20:59:00Z')), '2026-09-09', 'before 00:00 MSK the 10th is still selling');
assert.equal(C.lastClosedSalesYmd(new Date('2026-09-10T21:00:00Z')), '2026-09-10', '03:00 Bishkek / 00:00 MSK closes the previous MSK day');
assert.equal(C.canWriteDailySnapshot(new Date('2026-09-10T20:59:00Z')), false, '10.09 is not locked until 03:00 Bishkek on the 11th');
assert.equal(C.canWriteDailySnapshot(new Date('2026-09-10T21:00:00Z')), true, 'from 03:00 Bishkek the closed day may be written');
assert.equal(C.canWriteDailySnapshot(new Date('2026-09-09T12:00:00Z')), false, 'days before 10 Sep are never written');
const visibleSept = C.dailyDayKeys(2026, 9);
assert.equal(visibleSept[0], '2026-09-10');
assert.equal(visibleSept.length, 21);
assert.equal(visibleSept.includes('2026-09-09'), false);
assert.equal(C.dailyDayKeys(2026, 8).length, 0);
assert.equal(C.dailyDayKeys(2026, 10)[0], '2026-10-01');
assert.equal(C.sparklineSvg(spark, 280, 36).includes('circle'), true);
assert.equal(C.sparklineSvg([null, null], 80, 36), '');
assert.ok(C.sparklineSvg([10, null, 8], 80, 36).includes('polyline'));
assert.ok(C.sparklineSvg([10, null, 8], 80, 36).includes('polygon'));
assert.ok(C.sparklineSvg([10, 8], 80, 36).includes('#16a34a'));
assert.equal(C.sparkValues(dailyIdx, [1], ['2026-09-01'])[0], null);

const csv = C.exportExcelCsv(filtered, { hiddenCols: { nm: true } });
assert.match(csv, /^\uFEFF/);
assert.match(csv, /Артикул;ФБО;ФБС;В пути;В плане;Итого/);
assert.match(csv, /Свитер-айвори/);
assert.match(csv, /ВСЕГО/);
assert.equal(csv.includes('1218782505'), false);

console.log('goods-catalog_test: ok');
