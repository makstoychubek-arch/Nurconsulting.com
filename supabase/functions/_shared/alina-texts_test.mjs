// Тексты Алины: стандартные не изменились, переопределения с сайта, подстановки, чёрный список. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const tpl = new Function(stripTypeScriptTypes(readFileSync(new URL('./alina-templates.ts', import.meta.url), 'utf8').replace(/^export /gm, '')) +
  '\nreturn { TEXT_DEFS, setTextOverrides, fillText, tx, MSG_CLOSED, MSG_ASK_PICKUP, TZ_CASHBACK, tzBarter, msgOpenHuman, msgKey }')();
const gate = new Function(stripTypeScriptTypes(readFileSync(new URL('./alina-gate.ts', import.meta.url), 'utf8').replace(/^export /gm, '')) +
  '\nreturn { normLogin, isBlacklisted, gate }')();

// стандартные тексты
const ids = tpl.TEXT_DEFS.map((d) => d.id);
assert.equal(new Set(ids).size, ids.length, 'идентификаторы уникальны'); assert.equal(ids.length, 20);
for (const d of tpl.TEXT_DEFS) { assert.ok(d.text.trim().length > 5, d.id); for (const v of d.vars) assert.ok(d.text.includes('{' + v + '}'), `${d.id}: подстановка {${v}} есть в стандартном тексте`); assert.ok(!/\$\{/.test(d.text), d.id + ': нет остатков шаблонных строк'); }
assert.equal(tpl.MSG_CLOSED(), 'На сегодня места закончились 🙌 Напишите завтра — посмотрим');
assert.equal(tpl.msgOpenHuman('cashback', 'Пижама 2в1'), 'Да, актуально 🙌 по «Пижама 2в1»\nВысылаю ТЗ:'); assert.equal(tpl.msgOpenHuman('barter', null), 'Да, актуально 🙌\nВысылаю ТЗ:');
assert.match(tpl.msgKey('пижама женская'), /^Ключ для поиска: «пижама женская»\. Найдите по нему/); assert.match(tpl.tzBarter('18.11.2026 до 22:00 МСК'), /Заказать нужно 18\.11\.2026 до 22:00 МСК,/);
assert.match(tpl.tzBarter(null), /Заказать нужно в указанную дату ДО 22:00 ПО МСК,/);
assert.ok(tpl.TZ_CASHBACK().startsWith('ТЗ Для ОЗНАКОМЛЕНИЯ'));
console.log('ok   стандартные тексты на месте, подстановки совпадают с шаблонами');

// переопределения
tpl.setTextOverrides({ closed: 'Мест нет, пишите завтра', open_product: 'Актуально: «{товар}»', key: '   ', ask_pickup: 123, выдуманный: 'x' });
assert.equal(tpl.MSG_CLOSED(), 'Мест нет, пишите завтра', 'свой текст вместо стандартного');
assert.equal(tpl.msgOpenHuman('cashback', 'Пижама'), 'Актуально: «Пижама»', 'подстановка в своём тексте');
assert.match(tpl.msgKey('ключ'), /^Ключ для поиска:/, 'пустой или пробельный текст значит стандартный');
assert.equal(tpl.MSG_ASK_PICKUP(), 'Как заберёте — напишите/скиньте скрин. Отзыв сразу не публикуем, сначала согласуем', 'не строка игнорируется');
assert.equal(tpl.fillText('{а} и {б} и {неизвестная}', { а: '1', б: '2' }), '1 и 2 и {неизвестная}', 'неизвестная подстановка остаётся как написана');
tpl.setTextOverrides(null); assert.equal(tpl.MSG_CLOSED(), 'На сегодня места закончились 🙌 Напишите завтра — посмотрим', 'сброс возвращает стандартные');
console.log('ok   свои тексты: замена, подстановки, пустое значение, сброс');

// чёрный список
assert.equal(gate.normLogin(' @Bad_User '), 'bad_user'); assert.equal(gate.normLogin('https://t.me/Bad_User?start=1'), 'bad_user'); assert.equal(gate.normLogin('ab'), ''); assert.equal(gate.normLogin('Имя Фамилия'), '');
assert.equal(gate.isBlacklisted('BAD_USER', ['bad_user']), true); assert.equal(gate.isBlacklisted('@bad_user', ['@Bad_User']), true); assert.equal(gate.isBlacklisted('good_user', ['bad_user']), false);
assert.equal(gate.isBlacklisted(undefined, ['bad_user']), false, 'клиент без логина не блокируется'); assert.equal(gate.isBlacklisted('bad_user', []), false);
const S = { hoursOn: true, hoursFrom: '09:00', hoursTo: '22:00', offHoursText: '', topicsOff: [], managerGroup: 0, blacklist: ['bad_user'] };
const g = (o) => gate.gate({ text: 'Здравствуйте', nowMs: Date.parse('2026-11-18T12:00:00+03:00'), settings: S, alreadyToldOffHours: false, holdReply: 'Минутку', hasManagerGroup: true, ...o });
assert.deepEqual(g({ username: 'Bad_User' }), { kind: 'blocked' }, 'клиент из списка: молчим');
assert.deepEqual(g({ username: 'Bad_User', nowMs: Date.parse('2026-11-18T23:30:00+03:00') }), { kind: 'blocked' }, 'и вне часов ему тоже не отвечаем');
assert.deepEqual(g({ username: 'Bad_User', text: 'Можно поговорить с менеджером?' }), { kind: 'blocked' }, 'и вопрос менеджеру от него не уходит');
assert.equal(g({ username: 'good_user' }).kind, 'pass');
console.log('ok   чёрный список: логин без @ и регистра, ссылка t.me, без логина не блокируем, молчание всегда');
console.log('PASS: alina-texts');
