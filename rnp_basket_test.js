/**
 * Ссылка на фото WB: номер basket-хоста по vol артикула.
 *
 * Пары vol → хост сняты запросами к basket-XX.wbbasket.ru 16.09.2026 по
 * артикулам кабинетов Baza / Zevina / Elium. Прежняя формула «46 + (vol−8886)/216»
 * для vol 15444 давала basket-76, которого нет в DNS: в РНП вместо фото
 * оставалась заглушка, а в консоли — ERR_NAME_NOT_RESOLVED.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
const start = src.indexOf('    const _BASKET_ANCHORS');
const end = src.indexOf('    const _photoResolveCache');
assert.ok(start > 0 && end > start, 'в rnp-module.js должны быть опорные точки basket');
const basketNum = new Function(`${src.slice(start, end)}; return _basketNum;`)();

const measured = [
    [2473, 16], [2496, 16], [2626, 17], [2710, 17], [2801, 17], [2876, 18],
    [2952, 18], [2965, 18], [3074, 19], [3345, 20], [3480, 20], [3911, 22],
    [3996, 23], [4098, 23], [4143, 24], [4297, 24], [4357, 25], [4950, 27],
    [4993, 27], [5394, 28], [5476, 28], [5978, 30], [6114, 30], [6296, 31],
    [6336, 31], [6641, 32], [7053, 33], [7408, 35], [7662, 35], [7714, 36],
    [8493, 38], [8517, 38], [8897, 39], [8981, 39], [9719, 41], [10139, 41],
    [11503, 43], [11717, 43], [12187, 44], [12402, 44], [15444, 48],
];
for (const [vol, host] of measured) {
    assert.strictEqual(basketNum(vol), host, `vol ${vol} лежит на basket-${host}`);
}

// Старые артикулы — по проверенной таблице WB.
assert.strictEqual(basketNum(0), 1);
assert.strictEqual(basketNum(1000), 5);
assert.strictEqual(basketNum(2200), 15);

// Дальше последнего измерения экстраполируем шагом 760 vol — не 216, иначе
// номер хоста улетает в несуществующий.
assert.strictEqual(basketNum(16204), 49);
assert.ok(basketNum(20000) < 60, 'экстраполяция не должна выдавать несуществующий хост');

// Фото артикула заполняет синк из карточки WB — формула только страховка.
const autoSync = fs.readFileSync(
    path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8');
assert.ok(autoSync.includes('extractMainPhotoUrl'), 'photo_url берём из карточки WB');
assert.ok(!/photo_url: '',/.test(autoSync), 'новый артикул не должен сохраняться без фото');

const mainPhoto = fs.readFileSync(
    path.join(__dirname, 'supabase/functions/_shared/wb-main-photo.ts'), 'utf8');
assert.ok(/MAX_BASKET = (?:[3-9]\d|\d{3})/.test(mainPhoto),
    'проба хостов должна доходить до современных basket-48+');
assert.ok(mainPhoto.includes('function pickCachedPhotoUrl'),
    'review-style cards reuse a cached cover URL without probing');
assert.ok(mainPhoto.includes('function resolveWbCardPhotoUrl'),
    'question cards resolve the same WB cover as reviews');

console.log('rnp_basket_test: ok');
