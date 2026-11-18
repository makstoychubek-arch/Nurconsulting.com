// Обмен «Раздач» с листом целиком на подставных листе и базе: порядок записи, уникальные позиции, сбои. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const sheetLib = readFileSync(new URL('../_shared/giveaways-sheet.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const handler = readFileSync(new URL('./handler.ts', import.meta.url), 'utf8').replace(/^import [^;]*;\n/ms, '').replace(/^export \{[^}]*\};?\n/m, '').replace(/^export /gm, '');
const { syncCabinet } = new Function(stripTypeScriptTypes(sheetLib + '\n' + handler) + '\nreturn { syncCabinet }')();

const HEAD = ['ТОВАР', 'ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Кэш выплачен', 'Примерная Дата забора', 'фактическая дата забора', 'Разрезанный ШК', 'Дата публикации отзыва ', 'Вид отзыва', 'Реквизиты', 'Реквизиты', 'Фактическая дата выплаты', 'Отзыв опубликован', 'Отвественный', 'Ключ', 'Планируемая дата выплаты', 'Фильтры', 'Черный список/комментарии', 'Просмотры рилс', 'Ссылка на Reels'];
const mk = (model, tg, date, extra = {}) => { const r = Array(HEAD.length).fill(''); r[0] = model; r[1] = 'БЛОГЕР'; r[2] = tg; r[3] = date; for (const [i, v] of Object.entries(extra)) r[Number(i)] = v; return r; };
const colNum = (s) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function setup(rows, opts = {}) {
  const grid = opts.noHeader ? [['какой-то', 'другой лист'], ['1', '2']] : [Array(HEAD.length).fill(''), HEAD, ...rows.map((r) => r.slice())];
  const dbRows = []; let nextId = 1; const events = []; const log = [];
  const sheets = {
    async readAll() { return opts.readFail ? null : grid.map((r) => r.slice()); },
    async writeCells(_i, _t, cells) {
      log.push('writeCells'); if (opts.writeFail) return false;
      for (const c of cells) { while (grid.length < c.row) grid.push([]); const row = grid[c.row - 1]; while (row.length <= c.col) row.push(''); row[c.col] = c.value; }
      return true;
    },
    async append(_i, _t, rows2) { log.push('append'); if (opts.appendFail) return null; const first = grid.length + 1; rows2.forEach((r) => grid.push(r.slice())); return first; },
  };
  const posTaken = (pos, except) => pos != null && dbRows.some((d) => d.pos === pos && d.id !== except);
  const db = {
    async claim() { events.push('claim'); return !opts.busy; },
    async loadRows() { return dbRows.map((d) => ({ ...d })); },
    async insertRows(rs) { for (const r of rs) { if (posTaken(r.pos)) throw new Error('нарушена уникальность pos'); dbRows.push({ id: 'g' + nextId++, updated_at: '2026-11-18T10:00:00Z', ...r }); } return true; },
    async updateRow(id, patch) { const d = dbRows.find((x) => x.id === id); if (!d) return false; if ('pos' in patch && posTaken(patch.pos, id)) throw new Error('нарушена уникальность pos'); Object.assign(d, patch); d.updated_at = patch.synced_at || d.updated_at; return true; },
    async removeRows(ids) { for (const id of ids) dbRows.splice(dbRows.findIndex((d) => d.id === id), 1); return true; },
    async insertConflicts(_c, items) { events.push('conflicts:' + items.length); },
    async finish(_c, stats, error) { events.push(error ? 'error:' + error : 'ok'); db.last = { stats, error }; },
  };
  return { grid, dbRows, sheets, db, events, log, run: (o) => syncCabinet({ cabinet_id: 'cab', sheet_id: 'S', tab: 'Раздачи' }, sheets, db, () => '2026-11-18T10:00:00Z', o) };
}

const DAY = '14.11.2026';
const BASE = [mk('Пижама 3в1 шоколадный', '@a01', DAY), mk('Пижама 3в1 молочный', '@a02', DAY, { 4: '1 999' }), mk('Пижама 2в1 белый', '@a03', DAY)];

{ // первый обмен: ID и заголовок в лист, строки и позиции в базу; повтор ничего не меняет
  const t = setup(BASE); let r = await t.run();
  assert.equal(r.ok, true); assert.deepEqual([r.stats.inserted, r.stats.wrote_cells], [3, 3]);
  assert.equal(t.grid[1][23], 'ID', 'в шапку добавлена колонка ID'); assert.ok(t.grid.slice(2).every((row) => /^r/.test(row[23])), 'каждой строке листа поставлен ID');
  assert.deepEqual(t.dbRows.map((d) => d.pos).sort(), [0, 1, 2]); assert.equal(t.dbRows.find((d) => d.tg_link === '@a02').order_price, 1999);
  assert.equal(t.grid.length, 5, 'строки в конец листа не добавлялись');
  const writes = t.log.length; r = await t.run();
  assert.deepEqual([r.stats.inserted, r.stats.updated, r.stats.wrote_cells, r.stats.appended], [0, 0, 0, 0]); assert.equal(t.log.length, writes, 'повторный обмен в лист не пишет');
  console.log('ok   первый обмен и повтор: ID и шапка в лист, строки и позиции в базу, повтор тихий');
  // сортировка в листе: строки меняются местами, позиции уникальны на каждом шаге
  const [h1, h2, ...body] = t.grid; t.grid.length = 0; t.grid.push(h1, h2, ...body.reverse());
  r = await t.run(); assert.equal(r.ok, true);
  assert.equal(t.dbRows.find((d) => d.tg_link === '@a03').pos, 0); assert.equal(t.dbRows.find((d) => d.tg_link === '@a01').pos, 2);
  console.log('ok   сортировка листа: позиции на сайте меняются без нарушения уникальности');
  // правка на сайте уходит в лист
  const a1 = t.dbRows.find((d) => d.tg_link === '@a01'); a1.pickup_planned = '2026-11-25'; a1.updated_at = '2026-11-18T11:00:00Z'; a1.synced_at = '2026-11-18T10:00:00Z';
  r = await t.run(); assert.equal(r.stats.wrote_cells, 1);
  const row = t.grid.find((rw) => rw[2] === '@a01'); assert.equal(row[7], '25.11.2026');
  console.log('ok   правка на сайте записана в ту же строку листа');
  // строка создана на сайте
  t.dbRows.push({ id: 'site1', row_id: null, sheet_hash: null, synced_at: null, updated_at: '2026-11-18T12:00:00Z', pos: 900, model: 'Новая', kind: 'БЛОГЕР', tg_link: '@from_site', order_date: '2026-11-14' });
  r = await t.run(); assert.equal(r.stats.appended, 1);
  const site = t.dbRows.find((d) => d.id === 'site1'); assert.ok(/^r/.test(site.row_id)); assert.equal(site.pos, t.grid.length - 3, 'позиция равна месту в листе');
  assert.equal(t.grid.at(-1)[2], '@from_site'); assert.equal(t.grid.at(-1)[23], site.row_id);
  console.log('ok   строка с сайта дописана в конец листа, позиция в сетке совпала');
}
{ // пробный прогон ничего не пишет
  const t = setup(BASE); const r = await t.run({ dryRun: true });
  assert.equal(r.ok, true); assert.equal(r.stats.inserted, 3); assert.equal(t.log.length, 0); assert.equal(t.dbRows.length, 0); assert.equal(t.grid[1].length, HEAD.length, 'лист не тронут');
  console.log('ok   пробный прогон: считает, но не пишет ни в лист, ни в базу');
}
{ // сбои: лист не читается, не пишется, занят
  let t = setup(BASE, { readFail: true }); let r = await t.run(); assert.equal(r.ok, false); assert.match(r.error, /Лист не прочитался/); assert.equal(t.dbRows.length, 0);
  t = setup(BASE, { writeFail: true }); r = await t.run(); assert.equal(r.ok, false); assert.equal(t.dbRows.length, 0, 'запись в лист не прошла: база не менялась'); assert.ok(t.events.some((e) => e.startsWith('error:')));
  t = setup(BASE, { busy: true }); r = await t.run(); assert.deepEqual([r.ok, r.busy], [true, true]); assert.equal(t.log.length, 0, 'обмен уже идёт: ничего не делаем');
  t = setup([], { noHeader: true }); r = await t.run(); assert.equal(r.ok, false); assert.match(r.error, /шапка/);
  console.log('ok   сбои: лист не читается, не пишется, занят, нет шапки');
}
console.log('PASS: giveaways-sync');
