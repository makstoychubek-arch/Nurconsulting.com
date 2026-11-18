// Настройки Алины: значения по умолчанию, границы, кэш 30 секунд, сбой базы. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./alina-settings.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export /gm, '');
let rows = [{ key: 'typing', value: false }, { key: 'pauseMaxSec', value: 99 }, { key: 'phrases', value: [' Привет ', '', 5] }, { key: 'remindMin', value: '15' }];
let fail = false, reads = 0;
const db = { from: () => ({ select: async () => { reads++; return fail ? { data: null, error: new Error('x') } : { data: rows, error: null }; } }) };
const lib = new Function('getAdminClient', stripTypeScriptTypes(code) + '\nreturn { ALINA_DEFAULTS, normalizeAlinaSettings, loadAlinaSettings }')(() => db);

const d = lib.normalizeAlinaSettings(null);
assert.deepEqual(d, lib.ALINA_DEFAULTS, 'без значений действуют настройки по умолчанию');
const n = lib.normalizeAlinaSettings({ typing: false, pauseMaxSec: 99, phrases: [' Привет ', '', 5], remindMin: '15', read: 'нет', copyButton: 0 });
assert.equal(n.typing, false); assert.equal(n.pauseMaxSec, 6, 'максимум паузы обрезан до 6 с');
assert.deepEqual(n.phrases, ['Привет', '5']); assert.equal(n.remindMin, 15);
assert.equal(n.read, true, 'неверный тип заменяется значением по умолчанию'); assert.equal(n.copyButton, true);
assert.equal(lib.normalizeAlinaSettings({ remindMin: 0 }).remindMin, 1); assert.equal(lib.normalizeAlinaSettings({ remindMin: 9999 }).remindMin, 120);
assert.deepEqual(lib.normalizeAlinaSettings({ phrases: [] }).phrases, lib.ALINA_DEFAULTS.phrases, 'пустой список фраз не оставляет Алину без ответа');
assert.equal(lib.normalizeAlinaSettings({ phrases: Array(30).fill('а') }).phrases.length, 12);
assert.deepEqual([d.admitLimit, d.admitHours, d.llmBudgetUsd], [30, 3, 0], 'лимит клиентов и бюджет по умолчанию прежние');
const lim = lib.normalizeAlinaSettings({ admitLimit: 0, admitHours: 500, llmBudgetUsd: '12.345' });
assert.equal(lim.admitLimit, 0, '0 = без лимита'); assert.equal(lim.admitHours, 72); assert.equal(lim.llmBudgetUsd, 12.35);
assert.equal(lib.normalizeAlinaSettings({ admitLimit: -5 }).admitLimit, 0); assert.equal(lib.normalizeAlinaSettings({ admitLimit: 'много' }).admitLimit, 30);
console.log('ok   значения по умолчанию, границы, неверные типы');

const a = await lib.loadAlinaSettings(1000); assert.equal(a.typing, false); assert.equal(reads, 1);
rows = [{ key: 'typing', value: true }];
assert.equal((await lib.loadAlinaSettings(20_000)).typing, false, 'в течение 30 секунд из кэша'); assert.equal(reads, 1);
assert.equal((await lib.loadAlinaSettings(40_000)).typing, true, 'потом подхватывает изменения с сайта'); assert.equal(reads, 2);
fail = true;
assert.equal((await lib.loadAlinaSettings(80_000)).typing, true, 'при сбое базы остаётся последнее удачное');
console.log('ok   кэш 30 секунд, подхват изменений, сбой базы');
console.log('PASS: alina-settings');
