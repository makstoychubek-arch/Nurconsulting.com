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
// те же значения по умолчанию, что на сервере
const server = require('fs').readFileSync(__dirname + '/supabase/functions/_shared/alina-settings.ts', 'utf8');
for (const [k, v] of Object.entries({ pauseMaxSec: A.DEFAULTS.pauseMaxSec, remindMin: A.DEFAULTS.remindMin, admitLimit: A.DEFAULTS.admitLimit, admitHours: A.DEFAULTS.admitHours })) assert.ok(new RegExp(k + ': ' + v).test(server), 'значение ' + k + ' совпадает с серверным');
A.DEFAULTS.phrases.forEach((p) => assert.ok(server.includes(p), 'фраза совпадает с серверной: ' + p));
console.log('alina-settings-ui: ok');
