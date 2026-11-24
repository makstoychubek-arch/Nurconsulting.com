// Тест листа «Раздачи» как единственного источника: поиск строки по логину, лимит = число размеченных строк,
// запись только в свою строку без добавления новых, сортировка, ручные правки менеджера, повторы. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./alina-razdachi.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const lib = new Function(stripTypeScriptTypes(code) + `
return { normTg, normModel, normDate, todayMskKey, colLetter, parseRazdachiSheet, findClientRows, modelStats, writeClientRow, createCachedLoader, daysBetween, ruDay, isFreeRow, freeSlots, nearestFree, matchModels, claimFreeRow }`)();

const HEAD = ['ТОВАР', 'ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Кэш выплачен', 'Примерная Дата забора',
  'фактическая дата забора', 'Разрезанный ШК', 'Дата публикации отзыва ', 'Вид отзыва', 'Реквизиты', 'Реквизиты', 'Фактическая дата выплаты',
  'Отзыв опубликован', 'Отвественный', 'Ключ', 'Планируемая дата выплаты', 'Фильтры', 'Черный список/комментарии', 'Просмотры рилс', 'Ссылка на Reels'];
const mk = (model, tg, date, extra = {}) => {
  const r = Array(HEAD.length).fill('');
  r[0] = model; r[1] = 'БЛОГЕР'; r[2] = tg; r[3] = date;
  for (const [i, v] of Object.entries(extra)) r[Number(i)] = v;
  return r;
};
const DAY = '14.11.2026';
function grid() {
  // строка 1 пустая, как в рабочей таблице, шапка во второй
  return [Array(HEAD.length).fill(''), HEAD,
    mk('Пижама 3в1 шоколадный', '@milposhka', DAY),
    mk('Пижама 3в1 шоколадный', '@annagaechka', DAY),
    mk('Пижама 3в1 молочный', '@blossomm_ladyy', DAY),
    mk('Пижама 3в1 бордовый', '@blossomm_ladyy', DAY),
    mk('Пижама 2в1 шоколадный', 'https://t.me/Diana_chern2201', DAY),
    mk('Пижама 2в1 шоколадный', '', DAY), // размечена, блогера ещё нет
    mk('Пижама 3в1 шоколадный', '@milposhka', '15.11.2026'),
    ['', '', '', '', ...Array(HEAD.length - 4).fill('')]];
}
function colIdx(name) { return lib.parseRazdachiSheet(grid()).col[name]; }

// ── нормализация ──
assert.equal(lib.normTg('@KaevichK'), 'kaevichk');
assert.equal(lib.normTg(' https://t.me/Diana_chern2201?start=1 '), 'diana_chern2201');
assert.equal(lib.normTg('Anna Selivanova'), '', 'не логин');
assert.equal(lib.normModel('Пижама 3 в 1  Шоколадный'), 'пижама 3в1 шоколадный');
assert.equal(lib.normDate('4.1.26'), '04.01.2026');
assert.equal(lib.normDate('14.11', 2026), '14.11.2026');
assert.equal(lib.normDate('2026-11-14T00:00'), '14.11.2026');
assert.equal(lib.normDate('мусор'), '');
assert.equal(lib.todayMskKey(Date.parse('2026-11-17T22:30:00Z')), '18.11.2026', 'день по Москве');
assert.equal(lib.colLetter(0) + lib.colLetter(25) + lib.colLetter(26), 'AZAA');
console.log('ok   нормализация логина, модели, даты');

// ── разбор и лимиты ──
const sheet = lib.parseRazdachiSheet(grid());
assert.equal(sheet.headerRow, 2, 'шапка найдена во второй строке');
assert.equal(sheet.rows.length, 7, 'пустая строка без модели и даты не считается местом');
assert.equal(sheet.col.requisites, 12, 'для дубля «Реквизиты» берётся первая колонка');
let stats = lib.modelStats(sheet, DAY);
const by = Object.fromEntries(stats.map((s) => [s.model, s]));
assert.equal(by['Пижама 3в1 шоколадный'].total, 2, 'две строки на модель и дату = лимит 2');
assert.equal(by['Пижама 2в1 шоколадный'].total, 2);
assert.equal(by['Пижама 3в1 шоколадный'].left, 2);
assert.equal(lib.modelStats(sheet, '15.11.2026')[0].total, 1, 'другая дата считается отдельно');
const g2 = grid(); g2[2][4] = '1999'; // у milposhka заполнена цена в заказе: процесс идёт
stats = lib.modelStats(lib.parseRazdachiSheet(g2), DAY);
assert.deepEqual(stats.find((s) => s.model === 'Пижама 3в1 шоколадный'), { model: 'Пижама 3в1 шоколадный', date: DAY, total: 2, started: 1, left: 1 });
assert.equal(lib.modelStats(sheet, DAY, new Set(['annagaechka'])).find((s) => s.model === 'Пижама 3в1 шоколадный').left, 1, 'начавших из базы тоже учитываем');
console.log('ok   лимит модели на дату равен числу размеченных строк, занято по данным процесса');

// ── поиск клиента ──
assert.equal(lib.findClientRows(sheet, 'Milposhka', DAY).length, 1);
assert.equal(lib.findClientRows(sheet, '@MILPOSHKA', DAY)[0].row, 3);
assert.equal(lib.findClientRows(sheet, 'milposhka', '16.11.2026').length, 0, 'не в этот день');
assert.equal(lib.findClientRows(sheet, 'diana_chern2201', DAY).length, 1, 'ссылка t.me в ячейке тоже подходит');
assert.equal(lib.findClientRows(sheet, 'blossomm_ladyy', DAY).length, 2, 'у одного человека две строки: молочный и бордовый');
assert.equal(lib.findClientRows(sheet, 'someone_else', DAY).length, 0, 'неизвестный: к менеджеру');
assert.equal(lib.findClientRows(sheet, undefined, DAY).length, 0, 'без логина: к менеджеру');
console.log('ok   поиск по логину, две строки у одного человека, неизвестный и без логина');

// ── запись ──
function fakeIO(g, hooks = {}) {
  const log = { reads: [], writes: [] };
  const parseRange = (r) => { const m = r.match(/!([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/); return { c1: m[1], r1: m[2] ? Number(m[2]) : 1, c2: m[3], r2: m[4] ? Number(m[4]) : null }; };
  const colNum = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const io = {
    async read(range) {
      log.reads.push(range);
      if (hooks.failRead) return null;
      const { c1, r1, c2, r2 } = parseRange(range);
      const rows = g.slice(r1 - 1, r2 ? r2 : g.length);
      return rows.map((row) => row.slice(colNum(c1), c2 ? colNum(c2) + 1 : undefined));
    },
    async batchWrite(updates) {
      if (hooks.beforeWrite) hooks.beforeWrite(g);
      log.writes.push(updates);
      if (hooks.failWrite) return false;
      for (const u of updates) { const { c1, r1 } = parseRange(u.range); g[r1 - 1][colNum(c1)] = u.value; }
      if (hooks.afterWrite) hooks.afterWrite(g);
      return true;
    },
  };
  return { io, log };
}
const key = (tg, model, hintRow) => ({ tg, model, date: DAY, hintRow });
const rowsCount = (g) => g.length;

{ // обычная запись только в пустые ячейки своей строки, строки не добавляются
  const g = grid(); const n = rowsCount(g); const { io, log } = fakeIO(g);
  const res = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999', cash_pct: '', pickup_plan: '20.11.2026', responsible: 'Алина' });
  assert.equal(res.status, 'written'); assert.deepEqual(res.written, ['price', 'pickup_plan', 'responsible']);
  assert.equal(g[2][colIdx('price')], '1999'); assert.equal(g[2][colIdx('pickup_plan')], '20.11.2026');
  assert.equal(g[2][2], '@milposhka', 'ТГ, модель и дата не тронуты');
  assert.equal(rowsCount(g), n, 'новых строк нет');
  assert.equal(log.writes.length, 1); assert.ok(log.writes[0].every((u) => /^'Раздачи'![A-Z]+3$/.test(u.range)), 'пишем отдельные ячейки строки 3, не всю строку');
  // повтор той же заявки: ничего не меняется
  const again = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999', pickup_plan: '20.11.2026' });
  assert.equal(again.status, 'unchanged'); assert.equal(log.writes.length, 1, 'повтор не пишет');
  console.log('ok   запись только в свою строку, повтор заявки обновляет ту же строку без дублей');
}
{ // сортировка: строка переехала, номер-подсказка неверный
  const g = grid(); const moved = g.splice(2, 1)[0]; g.push(moved);
  const { io, log } = fakeIO(g);
  const res = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999' });
  assert.equal(res.status, 'written'); assert.equal(res.row, g.length, 'строка найдена по логину и модели на новом месте');
  assert.equal(g[g.length - 1][colIdx('price')], '1999');
  assert.ok(log.reads.some((r) => /A1:/.test(r)), 'лист перечитан целиком');
  console.log('ok   после сортировки строка находится заново, чужая строка не задета');
}
{ // менеджер уже заполнил ячейку: чужое не перезаписываем
  const g = grid(); g[2][colIdx('price')] = '2500'; const { io } = fakeIO(g);
  const res = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999', pickup_plan: '20.11.2026' });
  assert.equal(res.status, 'conflict'); assert.deepEqual(res.conflicts, ['price']); assert.deepEqual(res.written, ['pickup_plan']);
  assert.equal(g[2][colIdx('price')], '2500', 'цена менеджера осталась');
  console.log('ok   ручное значение менеджера не перезаписывается, остальное записано');
}
{ // менеджер заполнил строку между чтением и записью (строку вписали под другого человека)
  const g = grid(); const { io } = fakeIO(g, { beforeWrite: (gg) => { gg[2][2] = '@another_person'; } });
  const res = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999' });
  assert.equal(res.status, 'unverified', 'после записи строка уже не та: сообщаем, не считаем записанным');
  console.log('ok   правка строки между чтением и записью обнаруживается сверкой после записи');
}
{ // ячейку заняли между чтением и записью
  const g = grid(); const { io } = fakeIO(g, { afterWrite: (gg) => { gg[2][colIdx('price')] = '777'; } });
  const res = await lib.writeClientRow(io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1999' });
  assert.equal(res.status, 'unverified');
  console.log('ok   перезапись нашей ячейки другим человеком обнаруживается');
}
{ // нет строки / сбой чтения / сбой записи
  const g = grid(); const n = rowsCount(g);
  assert.equal((await lib.writeClientRow(fakeIO(g).io, 'Раздачи', sheet, key('nobody_here', 'Пижама 3в1 шоколадный', 0), { price: '1' })).status, 'not_found');
  assert.equal(rowsCount(g), n, 'нет строки: ничего не добавлено');
  assert.equal((await lib.writeClientRow(fakeIO(g, { failRead: true }).io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 0), { price: '1' })).status, 'failed');
  assert.equal((await lib.writeClientRow(fakeIO(g, { failWrite: true }).io, 'Раздачи', sheet, key('milposhka', 'Пижама 3в1 шоколадный', 3), { price: '1' })).status, 'failed');
  assert.equal(g[2][colIdx('price')], '', 'при сбое записи ячейка осталась пустой');
  // у одного человека две строки: пишем в нужную модель
  const r = await lib.writeClientRow(fakeIO(g).io, 'Раздачи', sheet, key('blossomm_ladyy', 'Пижама 3в1 бордовый', 0), { price: '1500' });
  assert.equal(r.status, 'written'); assert.equal(g[5][colIdx('price')], '1500'); assert.equal(g[4][colIdx('price')], '', 'молочная строка не тронута');
  console.log('ok   нет строки, сбои чтения и записи, две строки одного человека');
}

// ── кэш чтения ──
{
  let t = 1000, calls = 0, fail = false;
  const get = lib.createCachedLoader(async () => { calls++; await Promise.resolve(); if (fail) throw new Error('429'); return { n: calls }; }, 60_000, () => t);
  const [a, b, c] = await Promise.all([get(), get(), get()]);
  assert.equal(calls, 1, 'параллельные вызовы ждут один запрос'); assert.equal(a, b); assert.equal(b, c);
  t += 30_000; await get(); assert.equal(calls, 1, 'в течение минуты из кэша');
  t += 31_000; fail = true; const stale = await get(); assert.equal(calls, 2); assert.equal(stale.n, 1, 'при сбое отдаётся последнее удачное');
  fail = false; t += 61_000; assert.equal((await get()).n, 3, 'потом снова обновляется');
  const cold = lib.createCachedLoader(async () => { throw new Error('boom'); });
  await assert.rejects(cold(), /boom/);
  console.log('ok   кэш: один запрос на всех, из кэша минуту, при сбое последнее удачное');
}

// ── места и бронь ──
{
  const TODAY = '14.11.2026';
  assert.equal(lib.daysBetween('14.11.2026', '16.11.2026'), 2);
  assert.equal(lib.ruDay('14.11.2026', TODAY), 'сегодня');
  assert.equal(lib.ruDay('15.11.2026', TODAY), 'завтра, 15 ноября');
  assert.equal(lib.ruDay('16.11.2026', TODAY), 'послезавтра, 16 ноября');
  assert.equal(lib.ruDay('20.11.2026', TODAY), '20 ноября');
  const g = grid(); g.push(mk('Пижама 2в1 шоколадный', '', '16.11.2026'), mk('Пижама 3в1 молочный', '', '10.11.2026'));
  const sh = lib.parseRazdachiSheet(g);
  const fs = lib.freeSlots(sh, TODAY);
  assert.deepEqual(fs.map((x) => [x.model, x.date, x.rows.length]), [['Пижама 2в1 шоколадный', DAY, 1], ['Пижама 2в1 шоколадный', '16.11.2026', 1]], 'прошлое не берём, занятые строки не берём');
  assert.equal(lib.nearestFree(sh, 'Пижама 2в1 шоколадный', '15.11.2026').date, '16.11.2026');
  assert.equal(lib.nearestFree(sh, 'Пижама 3в1 молочный', TODAY), null);
  const models = ['Пижама 2в1 шоколадный', 'Пижама 3в1 шоколадный', 'Пижама 3в1 молочный', 'Пижама 3в1 бордовый'];
  assert.deepEqual(lib.matchModels(models, 'хочу 3 в 1 молочную'), ['Пижама 3в1 молочный']);
  assert.deepEqual(lib.matchModels(models, 'три в одном шоколадный'), ['Пижама 3в1 шоколадный']);
  assert.deepEqual(lib.matchModels(models, 'шоколадную').sort(), ['Пижама 2в1 шоколадный', 'Пижама 3в1 шоколадный'], 'формат не назван: обе');
  assert.deepEqual(lib.matchModels(models, 'привет'), []);
  // бронь
  const free = sh.rows.find((r) => r.model === 'Пижама 2в1 шоколадный' && !r.tg && r.date === DAY);
  const f1 = fakeIO(g);
  assert.equal((await lib.claimFreeRow(f1.io, 'Раздачи', sh, { row: free.row, model: free.model, date: DAY }, 'newguy')).status, 'claimed');
  assert.equal(g[free.row - 1][sh.col.tg], '@newguy');
  assert.equal(g[free.row - 1][sh.col.responsible], 'Алина');
  assert.equal((await lib.claimFreeRow(fakeIO(g).io, 'Раздачи', sh, { row: free.row, model: free.model, date: DAY }, 'other')).status, 'taken', 'занятую не перезаписываем');
  assert.equal(g[free.row - 1][sh.col.tg], '@newguy');
  assert.equal((await lib.claimFreeRow(fakeIO(g).io, 'Раздачи', sh, { row: 3, model: free.model, date: DAY }, 'x')).status, 'moved', 'строка другой модели');
  const g3 = grid(); const sh3 = lib.parseRazdachiSheet(g3);
  assert.equal((await lib.claimFreeRow(fakeIO(g3, { failWrite: true }).io, 'Раздачи', sh3, { row: 8, model: 'Пижама 2в1 шоколадный', date: DAY }, 'x')).status, 'failed');
  console.log('ok   свободные места, ближайшая дата, подбор модели, бронь только в свободную строку');
}
{
  const models = ['Пижама 2в1 шоколадный', 'Пижама 3в1 шоколадный', 'Пижама 3в1 молочный'];
  assert.deepEqual(lib.matchModels(models, 'Если со штанами шоколадная, то да'), ['Пижама 3в1 шоколадный']);
  assert.deepEqual(lib.matchModels(models, 'Интересует модель со штанами').sort(), ['Пижама 3в1 молочный', 'Пижама 3в1 шоколадный']);
  console.log('ok   «со штанами» это 3в1');
}
console.log('PASS: alina-razdachi');
