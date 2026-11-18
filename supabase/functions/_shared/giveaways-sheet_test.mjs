// Обмен «Раздач» с листом: связь по ID, правки с сайта и из листа, конфликт, удаление, новые строки. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./giveaways-sheet.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const L = new Function(stripTypeScriptTypes(code) + '\nreturn { parseSheetFormat, SHEET_FIELDS, detectLayout, toIsoDate, fromIsoDate, cellToValue, valueToCell, canon, hashCells, planSync, rowCells, recordFromCells }')();

const HEAD = ['ТОВАР', 'ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Кэш выплачен', 'Примерная Дата забора', 'фактическая дата забора', 'Разрезанный ШК', 'Дата публикации отзыва ', 'Вид отзыва', 'Реквизиты', 'Реквизиты', 'Фактическая дата выплаты', 'Отзыв опубликован', 'Отвественный', 'Ключ', 'Планируемая дата выплаты', 'Фильтры', 'Черный список/комментарии', 'Просмотры рилс', 'Ссылка на Reels'];
const mk = (model, tg, date, extra = {}) => { const r = Array(HEAD.length).fill(''); r[0] = model; r[1] = 'БЛОГЕР'; r[2] = tg; r[3] = date; for (const [i, v] of Object.entries(extra)) r[Number(i)] = v; return r; };
const CAB = 'cab1';
const values = (rows) => [Array(HEAD.length).fill(''), HEAD, ...rows];
const layoutOf = (rows) => L.detectLayout(values(rows));
const sheetRows = (rows, layout) => rows.map((cells, i) => ({ row: layout.headerRow + 1 + i, cells }));
let seq = 0; const genId = () => 'id' + (++seq);

// ── раскладка и значения ──
{
  const lay = layoutOf([mk('А', '@a', '14.11.2026')]);
  assert.equal(lay.headerRow, 2); assert.equal(lay.col.model, 0); assert.equal(lay.col.requisites, 12); assert.equal(lay.col.requisites2, 13, 'дубль «Реквизиты»: первая и вторая колонки');
  assert.equal(lay.col.payout_date, 14); assert.equal(lay.col.comment, 20);
  assert.equal(lay.idCol, 23, 'колонки ID нет: добавляется справа от последней'); assert.equal(lay.idCollides, true);
  const withId = L.detectLayout([[...HEAD, 'ID']]); assert.equal(withId.idCol, 23); assert.equal(withId.idCollides, false);
  assert.equal(L.toIsoDate('14.11.2026'), '2026-11-14'); assert.equal(L.toIsoDate('4.1.26'), '2026-01-04'); assert.equal(L.toIsoDate('мусор'), ''); assert.equal(L.fromIsoDate('2026-11-14'), '14.11.2026');
  assert.equal(L.cellToValue('num', '1 999'), 1999); assert.equal(L.cellToValue('num', '1 999,5 ₽'), 1999.5); assert.equal(L.cellToValue('int', '2 300'), 2300);
  assert.equal(L.cellToValue('bool', 'TRUE'), true); assert.equal(L.cellToValue('bool', ''), false); assert.equal(L.cellToValue('text', '  '), null);
  assert.equal(L.valueToCell('text', '=1+1'), "'=1+1", 'текст не превращается в формулу'); assert.equal(L.valueToCell('date', '2026-11-14'), '14.11.2026');
  assert.equal(L.canon('num', '1 999'), L.canon('num', 1999), 'формат числа не считается правкой');
  assert.equal(L.canon('date', '14.11.2026'), L.canon('date', '2026-11-14'));
  console.log('ok   раскладка листа, дубль «Реквизиты», колонка ID, даты, числа, защита от формул');
}

// ── первый обмен: лист → база, ID проставляются в лист ──
const base = [mk('Пижама 3в1 шоколадный', '@a01', '14.11.2026'), mk('Пижама 3в1 шоколадный', '@a02', '14.11.2026', { 4: '1 999' }), Array(HEAD.length).fill('')];
const lay = layoutOf(base);
let p = L.planSync({ layout: lay, sheet: sheetRows(base, lay), db: [], cabinetId: CAB, genId });
assert.equal(p.insertDb.length, 2, 'пустая строка листа не создаёт записи');
assert.equal(p.cellWrites.length, 2); assert.ok(p.cellWrites.every((w) => w.col === 23 && /^id\d+$/.test(w.value)), 'ID записываются в колонку X');
assert.equal(p.insertDb[1].order_price, 1999); assert.equal(p.insertDb[0].cabinet_id, CAB); assert.equal(p.insertDb[0].tg_link, '@a01');
console.log('ok   первый обмен: записи из листа, ID в колонку справа, пустые строки пропущены');

// состояние базы после первого обмена
const synced = (rows, lay2) => rows.map((cells, i) => {
  const rec = L.recordFromCells(lay2, cells);
  return { ...rec, pos: cells.__pos ?? (lay2.headerRow + 1 + i - lay2.headerRow - 1), id: 'db' + i, row_id: cells[lay2.idCol] || 'id' + (i + 1), sheet_hash: L.hashCells(L.rowCells(lay2, cells)), synced_at: '2026-11-18T10:00:00Z', updated_at: '2026-11-18T10:00:00Z' };
});
const rowsWithId = base.slice(0, 2).map((r, i) => { const c = r.slice(); c[23] = 'id' + (i + 1); return c; });
const lay2 = layoutOf(rowsWithId);
const dbRows = () => synced(rowsWithId, lay2);

// ── ничего не менялось ──
p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId, lay2), db: dbRows(), cabinetId: CAB, genId });
assert.deepEqual([p.insertDb.length, p.updateDb.length, p.deleteDb.length, p.cellWrites.length, p.append.length, p.conflicts.length], [0, 0, 0, 0, 0, 0]);
// сортировка листа: те же ID в другом порядке
p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId.slice().reverse(), lay2), db: dbRows(), cabinetId: CAB, genId });
assert.deepEqual([p.insertDb.length, p.updateDb.length, p.deleteDb.length, p.cellWrites.length], [0, 0, 0, 0], 'сортировка и перемещение строк ничего не ломают');
console.log('ok   без правок и после сортировки листа обмен ничего не делает');

// ── правка в листе ──
{
  const edited = rowsWithId.map((r) => r.slice()); edited[0][4] = '2 500'; edited[0][6] = 'Да';
  p = L.planSync({ layout: lay2, sheet: sheetRows(edited, lay2), db: dbRows(), cabinetId: CAB, genId });
  assert.equal(p.updateDb.length, 1); assert.deepEqual(p.updateDb[0].patch, { order_price: 2500, cash_status: 'Да' }); assert.equal(p.cellWrites.length, 0);
  console.log('ok   правка в листе попадает в базу, в лист ничего не пишется');
}
// ── правка на сайте ──
{
  const db = dbRows(); db[1].pickup_planned = '2026-11-20'; db[1].comment = '=ЗЛО()'; db[1].updated_at = '2026-11-18T10:05:00Z';
  p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId, lay2), db, cabinetId: CAB, genId });
  assert.equal(p.updateDb.length, 0); assert.equal(p.cellWrites.length, 2, 'пишутся только изменённые ячейки');
  const w = Object.fromEntries(p.cellWrites.map((x) => [x.col, x.value]));
  assert.equal(w[lay2.col.pickup_planned], '20.11.2026'); assert.equal(w[lay2.col.comment], "'=ЗЛО()");
  assert.ok(p.cellWrites.every((x) => x.row === 4), 'в строку этого блогера (3-я строка данных = 4-я строка листа)');
  const after = rowsWithId[1].slice(); after[lay2.col.pickup_planned] = '20.11.2026'; after[lay2.col.comment] = "'=ЗЛО()";
  assert.equal(p.stamp[0].sheet_hash, L.hashCells(L.rowCells(lay2, after)), 'хэш считается по итоговой строке листа');
  console.log('ok   правка на сайте уходит в ту же строку листа, только изменённые ячейки, формулы обезврежены');
}
// ── обе стороны, одна и та же ячейка ──
{
  const db = dbRows(); db[0].order_price = 3000; db[0].updated_at = '2026-11-18T10:05:00Z';
  const edited = rowsWithId.map((r) => r.slice()); edited[0][4] = '2 500';
  p = L.planSync({ layout: lay2, sheet: sheetRows(edited, lay2), db, cabinetId: CAB, genId });
  assert.equal(p.conflicts.length, 1); assert.deepEqual(p.conflicts[0].fields, ['order_price']); assert.equal(p.conflicts[0].site.order_price, 3000); assert.equal(p.conflicts[0].sheet.order_price, 2500);
  assert.deepEqual(p.updateDb[0].patch, { order_price: 2500 }, 'лист главный'); assert.equal(p.cellWrites.length, 0);
  console.log('ok   одновременная правка: побеждает лист, расхождение записано');
}
// ── строка исчезла из листа / лист прочитан плохо ──
{
  p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId.slice(0, 1), lay2), db: dbRows(), cabinetId: CAB, genId });
  assert.deepEqual(p.deleteDb, ['db1'], 'удалённая в листе строка удаляется в базе');
  const many = Array.from({ length: 10 }, (_, i) => ({ ...L.recordFromCells(lay2, mk('М', '@u' + i, '14.11.2026')), id: 'x' + i, row_id: 'idx' + i, sheet_hash: 'h', synced_at: 'a', updated_at: 'a' }));
  p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId.slice(0, 2), lay2), db: many, cabinetId: CAB, genId });
  assert.deepEqual(p.deleteDb, []); assert.equal(p.skippedDelete, true, 'лист почти пуст при полной базе: считаем сбоем чтения, ничего не удаляем');
  console.log('ok   удаление в листе подхватывается, при подозрительно пустом листе защита');
}
// ── строка создана на сайте ──
{
  const db = dbRows(); db.push({ id: 'new1', row_id: null, sheet_hash: null, synced_at: null, updated_at: '2026-11-18T10:06:00Z', model: 'Пижама 2в1 белый', kind: 'БЛОГЕР', tg_link: '@site_user', order_date: '2026-11-14' });
  p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId, lay2), db, cabinetId: CAB, genId });
  assert.equal(p.append.length, 1); const c = p.append[0].cells;
  assert.equal(c[0], 'Пижама 2в1 белый'); assert.equal(c[2], '@site_user'); assert.equal(c[3], '14.11.2026'); assert.equal(c[23], p.append[0].rowId); assert.equal(p.append[0].dbId, 'new1');
  console.log('ok   строка с сайта дописывается в конец листа с ID');
}
// ── новая строка менеджера в листе ──
{
  const added = rowsWithId.concat([mk('Пижама 2в1 бордовый', '@mgr_added', '14.11.2026')]);
  p = L.planSync({ layout: lay2, sheet: sheetRows(added, lay2), db: dbRows(), cabinetId: CAB, genId });
  assert.equal(p.insertDb.length, 1); assert.equal(p.insertDb[0].tg_link, '@mgr_added'); assert.equal(p.cellWrites.length, 1);
  console.log('ok   новая строка менеджера в листе появляется на сайте, ей проставляется ID');
}
// ── позиция в сетке сайта и сортировка листа ──
{
  assert.deepEqual(L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId, lay2), db: dbRows(), cabinetId: CAB, genId }).move, [], 'позиции совпадают: ничего не двигаем');
  const rev = rowsWithId.slice().reverse();
  p = L.planSync({ layout: lay2, sheet: sheetRows(rev, lay2), db: dbRows(), cabinetId: CAB, genId });
  assert.deepEqual(p.move.sort((a, b) => a.pos - b.pos), [{ id: 'db1', pos: 0 }, { id: 'db0', pos: 1 }], 'после сортировки листа строки меняются местами на сайте');
  p = L.planSync({ layout: lay2, sheet: sheetRows(rowsWithId.concat([mk('Новая', '@n', '14.11.2026')]), lay2), db: dbRows(), cabinetId: CAB, genId });
  assert.equal(p.insertDb[0].pos, 2, 'новая строка листа занимает свою позицию');
  console.log('ok   позиция в сетке сайта: сортировка листа двигает строки, новая строка получает место');
}
// ── оформление листа ──
{
  const lay = L.detectLayout(values([mk('А', '@a', '14.11.2026')]));
  const colMeta = Array.from({ length: 23 }, (_, i) => ({ pixelSize: 100 + i }));
  const api = { sheets: [{ data: [{
    rowMetadata: [{ pixelSize: 21 }, { pixelSize: 38 }, { pixelSize: 25 }],
    columnMetadata: colMeta,
    rowData: [
      { values: Array(23).fill({}) },
      { values: Array(23).fill({ effectiveFormat: { textFormat: { fontFamily: 'Times New Roman', fontSize: 9, bold: true }, backgroundColor: { red: 217 / 255, green: 234 / 255, blue: 211 / 255 } } }) },
      { values: Array(23).fill({ effectiveFormat: { textFormat: { fontFamily: 'Times New Roman', fontSize: 11 }, backgroundColor: { red: 1, green: 1, blue: 1 } } }) },
    ],
  }] }] };
  const f = L.parseSheetFormat(api, lay);
  assert.equal(lay.headerRow, 2);
  assert.deepEqual([f.font, f.size, f.headerSize, f.headerBold, f.headerBg, f.rowBg, f.headerH, f.rowH], ['Times New Roman', 11, 9, true, '#d9ead3', '#ffffff', 38, 25], 'шрифт, кегль, высоты и цвета как в листе');
  assert.equal(f.cols.model, 100); assert.equal(f.cols.tg_link, 102); assert.equal(f.cols.reels_link, 122, 'ширина колонки по полю, а не по порядку');
  assert.equal(L.parseSheetFormat(null, lay), null); assert.equal(L.parseSheetFormat({ sheets: [{ data: [{}] }] }, lay), null, 'без данных оформления ничего не меняем');
  console.log('ok   оформление листа: шрифт, кегль, высота строк, ширина колонок, цвета');
}
console.log('PASS: giveaways-sheet');
