// Настройки Алины на сайте: допустимые значения, список изменений, фраза в предпросмотре. Совпадает с серверной проверкой.
const assert = require('assert');
const A = require('./alina-settings-ui.js');

assert.deepStrictEqual(A.normalize(null), A.DEFAULTS, 'по умолчанию');
const n = A.normalize({ typing: false, pauseMaxSec: 99, phrases: [' Привет ', '', 5], remindMin: '15', read: 'нет', copyButton: 0 });
assert.strictEqual(n.typing, false); assert.strictEqual(n.pauseMaxSec, 6); assert.deepStrictEqual(n.phrases, ['Привет', '5']);
assert.strictEqual(n.remindMin, 15); assert.strictEqual(n.read, true); assert.strictEqual(n.copyButton, true);
assert.strictEqual(A.normalize({ remindMin: 0 }).remindMin, 1); assert.strictEqual(A.normalize({ remindMin: 9999 }).remindMin, 120);
assert.deepStrictEqual(A.normalize({ phrases: [] }).phrases, A.DEFAULTS.phrases, 'пустой список фраз не оставляет Алину без ответа');
assert.strictEqual(A.normalize({ phrases: Array(30).fill('а') }).phrases.length, 12);
assert.deepStrictEqual(A.changedKeys(A.DEFAULTS, Object.assign({}, A.DEFAULTS, { typing: false, phrases: ['а'] })), ['typing', 'phrases']);
assert.deepStrictEqual(A.changedKeys(A.DEFAULTS, JSON.parse(JSON.stringify(A.DEFAULTS))), [], 'копия без правок не считается изменением');
assert.strictEqual(A.previewPhrase(A.DEFAULTS, 'Мара'), 'Мара, минутку, уточню.');
assert.strictEqual(A.previewPhrase(Object.assign({}, A.DEFAULTS, { useName: false }), 'Мара'), 'Минутку, уточню.');
assert.deepStrictEqual([A.DEFAULTS.admitLimit, A.DEFAULTS.admitHours, A.DEFAULTS.llmBudgetUsd], [30, 3, 0]);
assert.strictEqual(A.normalize({ admitLimit: 0 }).admitLimit, 0, '0 значит без лимита'); assert.strictEqual(A.normalize({ admitHours: 500 }).admitHours, 72); assert.strictEqual(A.normalize({ llmBudgetUsd: '12.345' }).llmBudgetUsd, 12.35);
const hh = A.normalize({ hoursOn: true, hoursFrom: '9:5', hoursTo: '7:30', offHoursText: '  Ответим утром  ', topicsOff: ['manager', 'manager', 'Плохо!', 'receipt'], managerGroup: '-1004465341061' });
assert.deepStrictEqual([hh.hoursOn, hh.hoursFrom, hh.hoursTo, hh.offHoursText, hh.topicsOff, hh.managerGroup], [true, '09:00', '07:30', 'Ответим утром', ['manager', 'receipt'], -1004465341061]);
assert.strictEqual(A.normalize({ managerGroup: 12345 }).managerGroup, 0); assert.strictEqual(A.normalize({ hoursFrom: '25:00' }).hoursFrom, '09:00');
assert.deepStrictEqual(A.normalize({ blacklist: ['@Bad_User', 'bad_user', 'https://t.me/Other_One', 'ab', 5] }).blacklist, ['bad_user', 'other_one']);
assert.deepStrictEqual(A.normalize({ texts: { closed: 'Мест нет', key: '  ', ask_pickup: 7, 'Плохой ключ': 'x' } }).texts, { closed: 'Мест нет' });
assert.strictEqual(A.previewText('Актуально: «{товар}», ключ {ключ}, {неизвестная}'), 'Актуально: «Пижама 2в1 шоколадный», ключ пижама женская, {неизвестная}');
assert.strictEqual(A.normLogin(' @Bad_User '), 'bad_user');
// те же значения по умолчанию, что на сервере
const server = require('fs').readFileSync(__dirname + '/supabase/functions/_shared/alina-settings.ts', 'utf8');
for (const [k, v] of Object.entries({ pauseMaxSec: A.DEFAULTS.pauseMaxSec, remindMin: A.DEFAULTS.remindMin, admitLimit: A.DEFAULTS.admitLimit, admitHours: A.DEFAULTS.admitHours })) assert.ok(new RegExp(k + ': ' + v).test(server), 'значение ' + k + ' совпадает с серверным');
const gateSrc = require('fs').readFileSync(__dirname + '/supabase/functions/_shared/alina-gate.ts', 'utf8');
['other_item', 'payout_missing', 'payout_when', 'receipt', 'manager'].forEach((id) => assert.ok(gateSrc.includes("id: '" + id + "'"), 'тема ' + id + ' есть и на сервере'));
assert.ok(/hoursFrom: '09:00'/.test(server) && /hoursTo: '22:00'/.test(server), 'часы по умолчанию совпадают с серверными');
A.DEFAULTS.phrases.forEach((p) => assert.ok(server.includes(p), 'фраза совпадает с серверной: ' + p));
console.log('alina-settings-ui: ok');
