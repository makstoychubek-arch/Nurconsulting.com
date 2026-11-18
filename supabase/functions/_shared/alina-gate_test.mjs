// Часы работы и темы для менеджера: окно времени (в том числе через полночь), один ответ вне часов, выбор темы. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./alina-gate.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const L = new Function(stripTypeScriptTypes(code) + '\nreturn { ALINA_TOPICS, detectTopic, parseHm, mskMinutes, isWorkingTime, offHoursReply, gate, DEFAULT_OFF_TEXT }')();
const msk = (hm) => Date.parse(`2026-11-18T${hm}:00+03:00`); // момент по Москве

assert.equal(L.parseHm('09:00'), 540); assert.equal(L.parseHm('9:5'), null); assert.equal(L.parseHm('24:00'), 1440); assert.equal(L.parseHm('24:30'), null); assert.equal(L.parseHm('мусор'), null);
assert.equal(L.mskMinutes(Date.parse('2026-11-18T06:30:00Z')), 9 * 60 + 30, 'по Москве UTC+3');
console.log('ok   разбор времени, московское время');

// окно 09:00–22:00
assert.equal(L.isWorkingTime(msk('08:59'), '09:00', '22:00'), false); assert.equal(L.isWorkingTime(msk('09:00'), '09:00', '22:00'), true);
assert.equal(L.isWorkingTime(msk('21:59'), '09:00', '22:00'), true); assert.equal(L.isWorkingTime(msk('22:00'), '09:00', '22:00'), false);
// через полночь 20:00–04:00
assert.equal(L.isWorkingTime(msk('23:30'), '20:00', '04:00'), true); assert.equal(L.isWorkingTime(msk('03:59'), '20:00', '04:00'), true); assert.equal(L.isWorkingTime(msk('12:00'), '20:00', '04:00'), false);
assert.equal(L.isWorkingTime(msk('03:00'), '00:00', '00:00'), true, 'одинаковые границы: круглосуточно'); assert.equal(L.isWorkingTime(msk('03:00'), 'мусор', '22:00'), true, 'неверное время не отключает Алину');
console.log('ok   окно часов: границы, через полночь, круглосуточно, неверный формат');

assert.equal(L.offHoursReply('', '09:00', '22:00'), 'Сейчас нерабочее время. Я на связи с 09:00 до 22:00 по Москве. Напишите мне после 09:00, отвечу сразу.');
assert.equal(L.offHoursReply('Ответим с {от}, до {до}. С {от}!', '10:00', '20:00'), 'Ответим с 10:00, до 20:00. С 10:00!');
console.log('ok   текст вне часов с подстановками');

// темы
const T = (t, off) => L.detectTopic(t, off)?.id ?? null;
assert.equal(T('Я заказала не ту модель'), 'other_item'); assert.equal(T('мне пришёл другой артикул'), 'other_item');
assert.equal(T('Выплата не пришла уже неделю'), 'payout_missing'); assert.equal(T('перевод так и не пришел'), 'payout_missing'); assert.equal(T('деньги не пришли'), 'payout_missing'); assert.equal(T('кэш не пришёл'), 'payout_missing');
assert.equal(T('Когда будет выплата?'), 'payout_when'); assert.equal(T('через сколько ждать деньги'), 'payout_when');
assert.equal(T('где чек'), 'receipt'); assert.equal(T('Можно поговорить с менеджером?'), 'manager'); assert.equal(T('позовите менеджера пожалуйста'), 'manager');
assert.equal(T('Здравствуйте, хочу участвовать'), null, 'обычное сообщение идёт в сценарий'); assert.equal(T(''), null);
assert.equal(T('Можно поговорить с менеджером?', ['manager']), null, 'выключенная тема не срабатывает'); assert.equal(T('где чек', ['manager']), 'receipt', 'остальные темы работают');
assert.equal(L.ALINA_TOPICS.length, 5); assert.equal(new Set(L.ALINA_TOPICS.map((t) => t.id)).size, 5);
console.log('ok   пять тем, выключение темы');

// общий вход
const S = { hoursOn: true, hoursFrom: '09:00', hoursTo: '22:00', offHoursText: '', topicsOff: [], managerGroup: 0 };
const g = (o) => L.gate({ text: 'Здравствуйте', nowMs: msk('12:00'), settings: S, alreadyToldOffHours: false, holdReply: 'Минутку, уточню.', hasManagerGroup: true, ...o });
assert.deepEqual(g({}), { kind: 'pass' });
assert.equal(g({ nowMs: msk('23:00') }).kind, 'offhours'); assert.match(g({ nowMs: msk('23:00') }).reply, /с 09:00 до 22:00/);
assert.equal(g({ nowMs: msk('23:00'), alreadyToldOffHours: true }).reply, null, 'вне часов отвечаем один раз, потом молчим');
assert.deepEqual(g({ nowMs: msk('23:00'), text: 'Можно поговорить с менеджером?' }).kind, 'offhours', 'вне часов вопросы менеджерам не уходят');
const e = g({ text: '  Можно   поговорить с менеджером?  ' });
assert.equal(e.kind, 'escalate'); assert.equal(e.topic, 'manager'); assert.equal(e.reply, 'Минутку, уточню.'); assert.match(e.question, /^Клиент просит подключить менеджера\.[^\n]*\nСообщение клиента: «Можно поговорить с менеджером\?»$/);
assert.equal(g({ text: 'Можно поговорить с менеджером?', hasManagerGroup: false }).kind, 'pass', 'нет группы менеджеров: сценарий отвечает сам');
assert.equal(g({ text: 'Можно поговорить с менеджером?', settings: { ...S, topicsOff: ['manager'] } }).kind, 'pass');
assert.equal(g({ nowMs: msk('03:00'), settings: { ...S, hoursOn: false } }).kind, 'pass', 'часы выключены: отвечает всегда');
assert.equal(g({ text: 'где чек '.repeat(80) }).question.length < 260, true, 'цитата сообщения обрезана');
console.log('ok   общий вход: часы, один ответ вне часов, тема менеджеру, нет группы, часы выключены');
console.log('PASS: alina-gate');
