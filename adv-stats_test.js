'use strict';
// «Окно кампании»: блоки «Статистика РК по дням и зонам показов» и «Ключевые фразы» (adv-stats.js).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const A = require('./adv-stats.js');
const NB = ' ';

// форматы как в макете
assert.equal(A.fmt('int', 1037412), '1' + NB + '037' + NB + '412');
assert.equal(A.fmt('rub0', 219.4), '219' + NB + '₽');
assert.equal(A.fmt('rub1', 6.7), '6,7' + NB + '₽');
assert.equal(A.fmt('pct', 3.2712), '3,27%');
assert.equal(A.fmt('pct', 6317.4), '6' + NB + '317%');
assert.equal(A.fmt('rub0', null), '');
assert.equal(A.fmt('rub0', 12, 'сом'), '12' + NB + 'сом');
assert.equal(A.ruDate('2026-10-31'), '31.10.2026');
assert.equal(A.dayLabel('2026-10-31'), '31.10.2026 / сб');
assert.equal(A.addDays('2026-10-31', 1), '2026-11-01');

// дни диапазона: свежие первыми, пропуски помечены
const raw = [
    { stat_date: '2026-10-30', views: 1000, clicks: 30, spend: 300, atbs: 6, orders: 3, sum_price: 6000, updated_at: '2026-10-31T10:00:00Z', data: { apps: [{ nms: [{ nmId: 11 }, { nmId: 12 }] }, { nms: [{ nmId: 11 }] }] } },
    { stat_date: '2026-10-28', views: 500, clicks: 10, spend: 100, atbs: 2, orders: 0, sum_price: 0, updated_at: '2026-10-29T10:00:00Z', data: {} },
];
const nd = A.normalizeDaily(raw);
assert.deepEqual(nd.nms.sort(), [11, 12]);
assert.equal(nd.upd, Date.parse('2026-10-31T10:00:00Z'));
const days = A.daysOf(nd.rows, '2026-10-28', '2026-10-30');
assert.deepEqual(days.map((d) => d.date), ['2026-10-30', '2026-10-29', '2026-10-28']);
assert.equal(days[1].none, true);
assert.deepEqual(A.prodMap([{ date: '2026-10-30', clicks: 5 }, { date: '2026-10-30', clicks: 7 }]), { '2026-10-30': 12 });

// модель: «По дням» считает как в макете
const data = { rows: nd.rows, from: '2026-10-28', to: '2026-10-30', prod: { '2026-10-30': 80 }, prodOk: true, zones: null, zoneTotal: null };
const mD = A.buildModel(data, 'd', {}, '₽');
assert.equal(mD.cols.length, 16);
assert.deepEqual(mD.rows.map((r) => r.kind), ['sum', 'band', 'day', 'day', 'day']);
const sum = mD.rows[0];
const idx = (id) => mD.cols.findIndex((c) => c.id === id);
assert.equal(sum.cells[idx('views')].v, 1500);
assert.equal(sum.cells[idx('ctr')].txt, '2,67%'); // 40 / 1500
assert.equal(sum.cells[idx('cpc')].txt, '10,0' + NB + '₽'); // 400 / 40
assert.equal(sum.cells[idx('cpm')].v, 400 / 1500 * 1000);
assert.equal(sum.cells[idx('atbs')].sm, '20%'); // 8 / 40
assert.equal(sum.cells[idx('orders')].sm, '38%'); // 3 / 8
assert.equal(sum.cells[idx('drr')].txt, '6,67%'); // 400 / 6000
assert.equal(sum.cells[idx('cro')].txt, '7,50%'); // 3 / 40
assert.equal(sum.cells[idx('pclicks')].v, 80);
// просмотры карточек и общий CTR WB API не отдаёт: честный прочерк
assert.equal(sum.cells[idx('pviews')].txt, '—');
assert.equal(sum.cells[idx('pctr')].txt, '—');
// день без данных не выдумываем
assert.equal(mD.rows[3].none, true);
assert.equal(mD.rows[3].cells[idx('views')].txt, '—');
// без воронки по товару «Переходы» общие тоже прочерк
const noProd = A.buildModel(Object.assign({}, data, { prodOk: false }), 'd', {}, '₽');
assert.equal(noProd.rows[0].cells[noProd.cols.findIndex((c) => c.id === 'pclicks')].txt, '—');

// вкладка «По зонам»: у каждого дня три строки зон, цифр по зонам нет, значит «—», колонки «по товару» пустые
const mZ = A.buildModel(data, 'z', {}, '₽');
assert.deepEqual(mZ.rows.slice(0, 5).map((r) => r.kind), ['sum', 'sub', 'sub', 'sub', 'band']);
assert.deepEqual(mZ.rows.slice(1, 4).map((r) => r.label), ['поиск', 'полки', 'каталог']);
assert.equal(mZ.rows[1].cells[idx('views')].txt, '—');
assert.equal(mZ.rows[1].share, '—');
assert.equal(mZ.rows[1].cells[idx('pclicks')].txt, '');
assert.equal(mZ.rows.filter((r) => r.kind === 'day').length, 3);
assert.equal(mZ.rows.length, 5 + 3 * 4);
// когда источник зон появится, строки заполняются без правки таблицы
const withZones = Object.assign({}, data, { zones: { '2026-10-30': { search: { views: 400, clicks: 12, spend: 120, atbs: 3, orders: 1, sum: 2000, pclicks: null }, shelf: { views: 600, clicks: 18, spend: 180, atbs: 3, orders: 2, sum: 4000, pclicks: null }, catalog: { views: 0, clicks: 0, spend: 0, atbs: 0, orders: 0, sum: 0, pclicks: null } } } });
const mZ2 = A.buildModel(withZones, 'z', {}, '₽');
const sub = mZ2.rows.filter((r) => r.kind === 'sub' && r.date === '2026-10-30');
assert.deepEqual(sub.map((r) => r.share), ['40%', '60%', '0%']);
assert.equal(sub[0].cells[idx('views')].txt, '400');
assert.equal(sub[2].cells[idx('orders')].txt, ''); // как в макете: пустая зона без корзин и заказов пуста
// вкладки одной зоны: сначала полоса «По дням», потом «За период»
const mS = A.buildModel(data, 's', {}, '₽');
assert.deepEqual(mS.rows.slice(0, 2).map((r) => r.kind), ['band', 'sum']);
assert.equal(mS.rows[2].cells[0].txt, '—');

// скрытые столбцы убираются из модели и из шапки
const mH = A.buildModel(data, 'd', { cpm: true, cpl: true }, '₽');
assert.equal(mH.cols.length, 14);
const html = A.tableHtml(mH, false);
assert.ok(!/<th[^>]*>CPM<\/th>/.test(html) && /colspan="5"/.test(html));
assert.ok(/<tr class="spk"><th class="d">Графики<\/th>/.test(html));
assert.ok(/<tr class="band"><td class="d">По дням<\/td>/.test(html));
// пока грузится: каркас на месте, цифры размыты
assert.ok(/class="sk"/.test(A.tableHtml(mD, true)) && !/class="sk"/.test(A.tableHtml(mD, false)));

// мини-график: не больше 18 столбиков
assert.equal((A.sparkSvg([1, 2, 3]).match(/<rect/g) || []).length, 3);
assert.equal((A.sparkSvg(Array.from({ length: 40 }, (_, i) => i + 1)).match(/<rect/g) || []).length, 18);
assert.equal(A.sparkSvg([]), '');

// экспорт: шапка, строки дней и зон, числа без форматирования
const ex = A.exportRows(mZ2);
assert.equal(ex[0][0], 'Дата');
assert.equal(ex[0].length, 17);
assert.ok(ex.some((r) => r[0] === '30.10.2026 поиск' && r[1] === 400));
assert.ok(ex.some((r) => r[0] === '30.10.2026' && r[1] === 1000));
const csv = A.toCsv([['а', 1.5, 'x;y']]);
assert.equal(csv, '﻿а;1,5;"x;y"');

// живой ответ WB (fullstats): расход лежит в поле sum
const live = A.liveItemRows([{ advertId: 5, currency: 'KGS', days: [{ date: '2026-10-30T00:00:00Z', views: 10, clicks: 1, sum: 7, atbs: 0, orders: 0, sum_price: 0, apps: [{ nms: [{ nmId: 9 }] }] }] }], 5);
assert.equal(live.rows[0].spend, 7);
assert.equal(live.rows[0].date, '2026-10-30');
assert.deepEqual(live.nms, [9]);
assert.equal(A.liveItemRows([], 5), null);

// ключи: склейка по фразе, фильтры, слова, ссылка на поиск WB
const kw = { rows: [
    { nmId: 1, normQuery: 'костюм женский', state: 'active', minus: false, bid: 100, clicks: 5, spend: 50, views: 100, orders: 1, frequency: 1000, searchPosition: 7 },
    { nmId: 2, normQuery: 'костюм женский', state: 'active', minus: false, bid: null, clicks: 1, spend: 10, views: 10, orders: 0 },
    { nmId: 1, normQuery: 'брюки', state: 'excluded', minus: true, bid: null, clicks: 0, spend: 0, views: 0, orders: 0 },
    { nmId: 1, normQuery: 'старое', state: 'archived', minus: false, bid: null, clicks: 9, spend: 9, views: 9, orders: 0 },
], pos: {}, filter: 'all', sort: 'spend', dir: -1, nm: 'all' };
const scope = A.kwScope(kw);
assert.equal(scope.length, 2); // архивные не показываем, одинаковые фразы разных артикулов склеены
assert.equal(scope[0].clicks, 6);
assert.equal(scope[0].freq, 1000);
assert.equal(scope[0].pos, 7);
assert.equal(scope[0].managed, true);
assert.equal(A.kwFiltered(Object.assign({}, kw, { filter: 'active' }), scope).length, 1);
assert.equal(A.kwFiltered(Object.assign({}, kw, { filter: 'managed' }), scope).length, 1);
assert.equal(A.kwFiltered(kw, scope)[0].q, 'костюм женский');
assert.equal(A.kwScope(Object.assign({}, kw, { nm: '2' })).length, 1);
const words = A.kwWords(scope);
assert.equal(words[0].q, 'костюм');
assert.equal(words[0].n, 1);
assert.equal(A.searchUrl('чёрный костюм'), 'https://www.wildberries.ru/catalog/0/search.aspx?search=%D1%87%D1%91%D1%80%D0%BD%D1%8B%D0%B9%20%D0%BA%D0%BE%D1%81%D1%82%D1%8E%D0%BC');

// стили «Минимализма»: цвета только из токенов темы, своих цветов нет
const css = fs.readFileSync(require('node:path').join(__dirname, 'adv-stats.css'), 'utf8');
assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'в adv-stats.css нет зашитых цветов');
assert.ok(!/rgba?\(/.test(css));
assert.ok(/--accent/.test(css) && /--on-accent/.test(css) && /--green/.test(css) && /--red/.test(css));
assert.ok(!/(^|\n)\.(t|bar|seg|scr|sub|sum|band)\b/.test(css), 'классы макета только под корнем .advs');

// подключение в сборку и страницу
const build = fs.readFileSync(require('node:path').join(__dirname, 'scripts/build-assets.js'), 'utf8');
assert.ok(build.includes("'adv-stats.js'") && build.includes("'adv-stats.css'"));
const dash = fs.readFileSync(require('node:path').join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(/adv-stats(\.[0-9a-f]+)?(\.min)?\.js/.test(dash) && /adv-stats(\.[0-9a-f]+)?\.css/.test(dash));
assert.ok(dash.indexOf('adv-stats') > dash.indexOf('ads-pulse'), 'adv-stats грузится после ads-pulse');

console.log('adv-stats_test: ok');
