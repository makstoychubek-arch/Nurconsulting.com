/**
 * Обмен таблицы «Раздачи» с листом Google (чистая логика, без сети).
 * Строки связываются по колонке «ID» в листе и row_id в базе. Правила:
 *  - изменился только лист: база берёт значения листа;
 *  - изменилась только база (правка на сайте): значения уходят в ту же строку листа, только изменённые ячейки;
 *  - изменились обе стороны: побеждает лист, расхождение записывается в конфликты;
 *  - строка исчезла из листа: удаляется в базе (лист главный), если лист прочитан целиком;
 *  - строка создана на сайте: дописывается в конец листа.
 */

export type ColType = 'text' | 'date' | 'num' | 'int' | 'bool';

/** Поле базы, тип и заголовок колонки листа (регулярное выражение по нижнему регистру). Дубль «Реквизиты» берётся по порядку. */
export const SHEET_FIELDS: Array<{ f: string; t: ColType; h: RegExp; nth?: number }> = [
  { f: 'model', t: 'text', h: /^товар$|^модель$/ },
  { f: 'kind', t: 'text', h: /^вид( раздачи)?$/ },
  { f: 'tg_link', t: 'text', h: /^ссылка\s*тг$|^тг$/ },
  { f: 'order_date', t: 'date', h: /^дата\s*заказа$/ },
  { f: 'order_price', t: 'num', h: /^цена\s*в\s*заказе$/ },
  { f: 'cash_amount', t: 'num', h: /^размер\s*кэша$/ },
  { f: 'cash_status', t: 'text', h: /^кэш\s*выплачен$/ },
  { f: 'pickup_planned', t: 'date', h: /^примерная\s*дата\s*забора$/ },
  { f: 'pickup_date', t: 'date', h: /^фактическая\s*дата\s*забора$/ },
  { f: 'barcode_cut', t: 'bool', h: /^разрезанный\s*шк$/ },
  { f: 'review_date', t: 'date', h: /^дата\s*публикации\s*отзыва$/ },
  { f: 'review_kind', t: 'text', h: /^вид\s*отзыва$/ },
  { f: 'requisites', t: 'text', h: /^реквизиты$/, nth: 0 },
  { f: 'requisites2', t: 'text', h: /^реквизиты$/, nth: 1 },
  { f: 'payout_date', t: 'date', h: /^фактическая\s*дата\s*выплаты$/ },
  { f: 'review_status', t: 'text', h: /^отзыв\s*опубликован$/ },
  { f: 'responsible', t: 'text', h: /^отв[е]?т?ственный$/ },
  { f: 'keyword', t: 'text', h: /^ключ$/ },
  { f: 'payout_planned', t: 'date', h: /^планируемая\s*дата\s*выплаты$/ },
  { f: 'filters', t: 'text', h: /^фильтры$/ },
  { f: 'comment', t: 'text', h: /^чёрный список|^черный список/ },
  { f: 'reels_views', t: 'int', h: /^просмотры\s*рилс$/ },
  { f: 'reels_link', t: 'text', h: /^ссылка\s*на\s*reels$/ },
];

export type Layout = { headerRow: number; col: Record<string, number>; idCol: number; idCollides: boolean; width: number };

export function detectLayout(values: string[][]): Layout | null {
  for (let i = 0; i < Math.min(8, values.length); i++) {
    const heads = values[i].map((h) => String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' '));
    const col: Record<string, number> = {};
    for (const s of SHEET_FIELDS) {
      let seen = 0;
      heads.forEach((h, idx) => {
        if (s.h.test(h)) { if ((s.nth ?? 0) === seen && col[s.f] == null) col[s.f] = idx; seen++; }
      });
    }
    if (col.tg_link != null && col.order_date != null && col.model != null) {
      const idx = heads.findIndex((h) => h === 'id' || h === 'id строки');
      return { headerRow: i + 1, col, idCol: idx >= 0 ? idx : heads.length, idCollides: idx < 0, width: Math.max(heads.length, idx + 1) };
    }
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Дата листа «14.11.2026» или «14.11.26» → «2026-11-14»; пусто, если не дата. */
export function toIsoDate(raw: string): string {
  const m = String(raw ?? '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(String(raw ?? '').trim()) ? String(raw).trim() : '';
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 1 || Number(m[1]) > 31) return '';
  return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
}
export function fromIsoDate(iso: string): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

function parseNum(raw: string): number | null {
  const s = String(raw ?? '').replace(/[\s ₽$сом]/gi, '').replace(',', '.');
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Значение ячейки листа → значение поля базы. */
export function cellToValue(t: ColType, raw: string): string | number | boolean | null {
  const s = String(raw ?? '').trim();
  if (t === 'text') return s === '' ? null : s;
  if (t === 'date') return toIsoDate(s) || null;
  if (t === 'num') return parseNum(s);
  if (t === 'int') { const n = parseNum(s); return n == null ? null : Math.round(n); }
  return /^(true|истина|да|1|x|✓)$/i.test(s); // bool: флажок листа
}

/** Значение поля базы → ячейка листа. */
export function valueToCell(t: ColType, v: unknown): string {
  if (v == null || v === '') return '';
  if (t === 'date') return fromIsoDate(String(v));
  if (t === 'bool') return v ? 'TRUE' : 'FALSE';
  if (t === 'text') { const s = String(v); return /^[=+\-]/.test(s) ? `'${s}` : s; } // не даём тексту стать формулой
  return String(v);
}

/** Канонический вид для сравнения ячейки листа и поля базы (форматирование «1 999» и «1999» не считается правкой). */
export function canon(t: ColType, v: unknown): string {
  if (t === 'bool') return v === true || /^(true|истина|да|1|x|✓)$/i.test(String(v ?? '').trim()) ? '1' : '0';
  const x = typeof v === 'string' && t !== 'text' ? cellToValue(t, v) : (t === 'date' ? (toIsoDate(String(v ?? '')) || null) : v);
  return x == null ? '' : String(x).trim();
}

export function hashCells(cells: string[]): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  const s = cells.map((c) => String(c ?? '').trim()).join('\u0001');
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    a = Math.imul(a ^ ch, 0x01000193) >>> 0;
    b = Math.imul(b + ch + i, 0x5bd1e995) >>> 0;
    b ^= b >>> 13;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export type SheetRow = { row: number; cells: string[] };
export type DbRow = Record<string, unknown> & { id: string; row_id: string | null; sheet_hash: string | null; synced_at: string | null; updated_at: string | null };

export type Plan = {
  insertDb: Array<Record<string, unknown>>;
  updateDb: Array<{ id: string; patch: Record<string, unknown>; sheet_hash: string }>;
  deleteDb: string[];
  cellWrites: Array<{ row: number; col: number; value: string }>;
  append: Array<{ rowId: string; cells: string[]; dbId: string }>;
  conflicts: Array<{ row_id: string; fields: string[]; site: Record<string, unknown>; sheet: Record<string, unknown> }>;
  stamp: Array<{ id: string; sheet_hash: string }>; // строки базы, у которых надо обновить sheet_hash и synced_at
  move: Array<{ id: string; pos: number }>; // строка сменила место в листе (сортировка): позиция в сетке сайта
  skippedDelete: boolean;
};

export function rowCells(layout: Layout, cells: string[]): string[] {
  const out: string[] = [];
  for (const s of SHEET_FIELDS) { const i = layout.col[s.f]; out.push(i == null ? '' : String(cells[i] ?? '')); }
  return out;
}

export function recordFromCells(layout: Layout, cells: string[]): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const s of SHEET_FIELDS) { const i = layout.col[s.f]; if (i != null) rec[s.f] = cellToValue(s.t, cells[i] ?? ''); }
  return rec;
}

const newId = (seed: number, now: number) => `r${now.toString(36)}${seed.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function planSync(opts: {
  layout: Layout;
  sheet: SheetRow[]; // строки данных листа (после шапки)
  db: DbRow[];
  cabinetId: string;
  now?: number;
  genId?: (i: number) => string;
}): Plan {
  const { layout, sheet, db, cabinetId } = opts;
  const now = opts.now ?? Date.now();
  const genId = opts.genId ?? ((i) => newId(i, now));
  const plan: Plan = { insertDb: [], updateDb: [], deleteDb: [], cellWrites: [], append: [], conflicts: [], stamp: [], move: [], skippedDelete: false };
  const byRowId = new Map(db.filter((d) => d.row_id).map((d) => [String(d.row_id), d]));
  const seen = new Set<string>();
  let idSeq = 0;
  const hashOf = (cells: string[]) => hashCells(rowCells(layout, cells));
  const meaningful = (cells: string[]) => rowCells(layout, cells).some((c) => c.trim() !== '');

  for (const sr of sheet) {
    if (!meaningful(sr.cells)) continue; // пустые строки листа не создают записей
    let rid = String(sr.cells[layout.idCol] ?? '').trim();
    if (!rid) {
      rid = genId(idSeq++);
      plan.cellWrites.push({ row: sr.row, col: layout.idCol, value: rid });
    }
    seen.add(rid);
    const sheetHash = hashOf(sr.cells);
    const rec = recordFromCells(layout, sr.cells);
    const pos = sr.row - layout.headerRow - 1; // позиция в сетке сайта (с 0)
    const d = byRowId.get(rid);
    if (!d) {
      plan.insertDb.push({ ...rec, cabinet_id: cabinetId, row_id: rid, sheet_hash: sheetHash, pos });
      continue;
    }
    if (d.pos !== pos) plan.move.push({ id: d.id, pos });
    const sheetChanged = d.sheet_hash !== sheetHash;
    const siteChanged = !!d.synced_at && !!d.updated_at && String(d.updated_at) > String(d.synced_at);
    // что реально различается между сайтом и листом
    const diffs = SHEET_FIELDS.filter((s) => layout.col[s.f] != null && canon(s.t, d[s.f]) !== canon(s.t, sr.cells[layout.col[s.f]] ?? ''));
    if (!diffs.length) { if (sheetChanged || siteChanged) plan.stamp.push({ id: d.id, sheet_hash: sheetHash }); continue; }
    if (sheetChanged && siteChanged) {
      // одновременная правка: лист главный; расхождение сохраняем
      const changedByShape = diffs.map((s) => s.f);
      plan.conflicts.push({ row_id: rid, fields: changedByShape, site: Object.fromEntries(diffs.map((s) => [s.f, d[s.f] ?? null])), sheet: Object.fromEntries(diffs.map((s) => [s.f, rec[s.f] ?? null])) });
      plan.updateDb.push({ id: d.id, patch: Object.fromEntries(diffs.map((s) => [s.f, rec[s.f] ?? null])), sheet_hash: sheetHash });
    } else if (!(siteChanged && !sheetChanged && d.synced_at)) {
      // изменился лист, либо расхождение без пометки правки: лист главный
      plan.updateDb.push({ id: d.id, patch: Object.fromEntries(diffs.map((s) => [s.f, rec[s.f] ?? null])), sheet_hash: sheetHash });
    } else {
      // правка на сайте: пишем в лист только отличающиеся ячейки; хэш считаем по итоговой строке
      const after = sr.cells.slice();
      for (const s of diffs) {
        const idx = layout.col[s.f];
        const value = valueToCell(s.t, d[s.f]);
        plan.cellWrites.push({ row: sr.row, col: idx, value });
        after[idx] = value;
      }
      plan.stamp.push({ id: d.id, sheet_hash: hashOf(after) });
    }
  }

  // строки базы без пары в листе
  const sheetIds = seen;
  for (const d of db) {
    if (d.row_id && sheetIds.has(String(d.row_id))) continue;
    if (d.row_id) { if (d.sheet_hash) plan.deleteDb.push(d.id); continue; } // была в листе и исчезла из него
    // создана на сайте: дописываем в конец листа
    const rid = genId(idSeq++);
    const cells: string[] = Array(Math.max(layout.width, layout.idCol + 1)).fill('');
    for (const s of SHEET_FIELDS) { const i = layout.col[s.f]; if (i != null) cells[i] = valueToCell(s.t, d[s.f]); }
    cells[layout.idCol] = rid;
    plan.append.push({ rowId: rid, cells, dbId: d.id });
  }
  // защита: если лист «почти пуст», а в базе много строк, удаления не выполняем (сбой чтения)
  const dataRows = sheet.filter((r) => meaningful(r.cells)).length;
  if (plan.deleteDb.length > 0 && (dataRows < db.length * 0.5)) { plan.deleteDb = []; plan.skippedDelete = true; }
  return plan;
}

// ── Оформление листа: шрифт, размер, высота строк, ширина колонок, цвета ─────────────────────────────

export type SheetFormat = {
  font: string | null; // «Times New Roman»
  size: number | null; // кегль ячеек данных, pt
  headerSize: number | null;
  headerBold: boolean;
  headerBg: string | null; // «#d9ead3»
  rowBg: string | null;
  headerH: number | null; // px
  rowH: number | null; // px
  cols: Record<string, number>; // поле → ширина колонки, px
};

type ApiColor = { red?: number; green?: number; blue?: number } | undefined;
type ApiCell = { effectiveFormat?: { textFormat?: { fontFamily?: string; fontSize?: number; bold?: boolean }; backgroundColor?: ApiColor } };
type ApiGrid = { rowData?: Array<{ values?: ApiCell[] }>; rowMetadata?: Array<{ pixelSize?: number }>; columnMetadata?: Array<{ pixelSize?: number }>; startRow?: number; startColumn?: number };

function hex(c: ApiColor): string | null {
  if (!c) return null;
  const h = (v?: number) => Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255).toString(16).padStart(2, '0');
  return `#${h(c.red)}${h(c.green)}${h(c.blue)}`;
}

/**
 * Разбирает ответ spreadsheets.get с gridData запрошенного диапазона A1:… (строки с первой).
 * Шапка берётся по номеру строки из раскладки, данные по первой строке под шапкой.
 */
export function parseSheetFormat(api: { sheets?: Array<{ data?: ApiGrid[] }> } | null | undefined, layout: Layout): SheetFormat | null {
  const grid = api?.sheets?.[0]?.data?.[0];
  if (!grid) return null;
  const rows = grid.rowData || [];
  const headRow = rows[layout.headerRow - 1];
  const dataRow = rows[layout.headerRow];
  const cell = (row: { values?: ApiCell[] } | undefined, col: number) => row?.values?.[col]?.effectiveFormat;
  const nameCol = layout.col.model ?? 0;
  const hf = cell(headRow, nameCol), df = cell(dataRow, nameCol);
  const pt = (n?: number) => (typeof n === 'number' && n > 0 ? n : null);
  const px = (n?: number) => (typeof n === 'number' && n > 0 ? Math.round(n) : null);
  const cols: Record<string, number> = {};
  for (const [field, idx] of Object.entries(layout.col)) {
    const w = px(grid.columnMetadata?.[idx]?.pixelSize);
    if (w) cols[field] = w;
  }
  const out: SheetFormat = {
    font: (df?.textFormat?.fontFamily || hf?.textFormat?.fontFamily || null),
    size: pt(df?.textFormat?.fontSize),
    headerSize: pt(hf?.textFormat?.fontSize),
    headerBold: Boolean(hf?.textFormat?.bold),
    headerBg: hex(hf?.backgroundColor),
    rowBg: hex(df?.backgroundColor),
    headerH: px(grid.rowMetadata?.[layout.headerRow - 1]?.pixelSize),
    rowH: px(grid.rowMetadata?.[layout.headerRow]?.pixelSize),
    cols,
  };
  return out.font || out.size || out.rowH || Object.keys(cols).length ? out : null;
}
