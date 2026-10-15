'use strict';
const assert = require('node:assert/strict');
const P = require('./ads-pulse.js');

assert.equal(P.payKind({ paymentType: 'CPC' }), 'cpc');
assert.equal(P.payKind({ paymentType: 'cpm' }), 'cpm');
assert.equal(P.payKind({}), 'cpm');
assert.equal(P.kopToSom(25050), 250.5);
assert.equal(P.somToKop(12.34), 1234);
assert.equal(P.stepSom('cpc'), 1);
assert.equal(P.stepSom('cpm'), 5);
// ставку нельзя опустить ниже минимума и поднять выше лимита WB
assert.equal(P.clampKop(10, 5000), 5000);
assert.equal(P.clampKop(99999999, 100), 5000000);
assert.equal(P.clampKop(NaN, 0), 100);
// тип: CP + цветная последняя буква
const c = P.badge('cpc', 'xl'), m = P.badge('cpm', 'xl');
assert.match(c, /CP<i class="adp2-kc">C<\/i>/);
assert.match(m, /CP<i class="adp2-km">M<\/i>/);
assert.equal(P.fmtSom(1234567).replace(/\s/g, '_'), '1_234_567');
assert.equal(P.fmtSom(12.5), '12.50');
// ответ WB разной формы: товары берутся отовсюду, ставки из bids
const r = P.parseAdvertInfo({ bidType: 'Manual', advert: { nms: [3, 1] }, bids: [{ nm_id: 2, placement: 'search', bid_kopecks: 5000 }] });
assert.deepEqual(r.nms, [1, 2, 3]);
assert.equal(r.entries[0].kop, 5000);
assert.equal(r.bidType, 'manual');
assert.deepEqual(P.parseAdvertInfo(null).nms, []);
// то, что человек убрал/добавил на экране, видно сразу
assert.deepEqual(P.effectiveNms([1, 2, 3], { del: { 2: 1 }, add: { 9: 1 } }), [1, 3, 9]);
assert.deepEqual(P.effectiveNms([1], null), [1]);
// ответ v2/adverts: ставки в nm_settings.bids_kopecks (копейки), без поля bids
const v2 = P.parseAdvertInfo({ bidType: 'unified', advert: { nm_settings: [{ nm_id: 7, bids_kopecks: { search: 600, recommendations: 800 } }, { nm_id: 9, bids_kopecks: { search: 1500 } }] }, bids: [] });
assert.deepEqual(v2.nms, [7, 9]);
assert.deepEqual(v2.entries.map((e) => e.nm + ':' + e.placement + ':' + e.kop), ['7:search:600', '7:recommendations:800', '9:search:1500']);
console.log('ads-pulse_test: ok');
