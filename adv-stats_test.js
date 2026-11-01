'use strict';
// «Окно кампании»: блок «Ключевые фразы» (adv-stats.js).
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
assert.equal(A.addDays('2026-10-31', 1), '2026-11-01');

// удалённый блок статистики не возвращается в API
['buildModel', 'tableHtml', 'sparkSvg', 'exportRows', 'toCsv', 'daysOf', 'normalizeDaily', 'liveItemRows', 'COLS'].forEach((k) => assert.equal(A[k], undefined, k));
assert.equal(typeof A.mount, 'function');
assert.ok(!/статистик/i.test(fs.readFileSync(require('node:path').join(__dirname, 'adv-stats.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));

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
