/**
 * Лист «Раздачи» как единственный источник для Алины.
 * Каждая заранее размеченная строка (модель, дата, ТГ блогера) это место этого человека. Лимит модели на дату равен числу таких строк.
 * Алина находит строку по @логину, заполняет в ней только свои поля и никогда не добавляет строки в конец листа.
 * Модуль чистый: чтение и запись листа передаются снаружи, поэтому его можно проверять без сети.
 */

export type RazRow = {
  row: number; // номер строки на листе, с 1
  model: string;
  kind: string;
  tg: string; // нормализованный логин без @
  date: string; // дд.мм.гггг
  started: boolean; // в строке уже есть данные процесса
  cells: string[];
};

export type RazSheet = {
  headerRow: number;
  headers: string[];
  col: Record<string, number>;
  rows: RazRow[];
};

// Имена полей Алины → заголовки колонок (в нижнем регистре). Для дублей («Реквизиты») берётся первая колонка.
const FIELD_HEADERS: Record<string, RegExp> = {
  model: /^товар$|^модель$/,
  kind: /^вид( раздачи)?$/,
  tg: /^ссылка\s*тг$|^тг$|^username$/,
  date: /^дата\s*заказа$/,
  price: /^цена\s*в\s*заказе$/,
  cash_pct: /^размер\s*кэша$/,
  pickup_plan: /^примерная\s*дата\s*забора$/,
  pickup_fact: /^фактическая\s*дата\s*забора$|^факт забора$/,
  review_date: /^дата\s*публикации\s*отзыва$/,
  review_kind: /^вид\s*отзыва$/,
  requisites: /^реквизиты$/,
  published: /^отзыв\s*опубликован$/,
  responsible: /^отв[е]?[т]?ственный$|^ответственный$/,
  key: /^ключ$/,
  reels: /^ссылка\s*на\s*reels$/,
};

// Поля, по которым видно, что процесс по строке уже начался.
// «Ключ» сюда не входит: в таблице МАРС он вписан заранее у каждой размеченной строки (это план, а не признак начатого процесса), из-за чего все места считались занятыми.
const STARTED_FIELDS = ['price', 'pickup_plan', 'pickup_fact', 'review_date', 'review_kind', 'requisites', 'published'];

export function normTg(raw: unknown): string {
  let s = String(raw ?? '').normalize('NFKC').replace(/[​-‍﻿]/g, '').trim().toLowerCase();
  s = s.replace(/^https?:\/\/(?:www\.)?t\.me\//, '').replace(/^@+/, '').replace(/[/?#].*$/, '').replace(/[.,;:\s]+$/, '');
  return /^[a-z0-9_]{3,64}$/.test(s) ? s : '';
}

export function normModel(raw: unknown): string {
  return String(raw ?? '').normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
    .replace(/(\d)\s*в\s*(\d)/g, '$1в$2').replace(/\s+/g, ' ').trim();
}

/** «14.11.2026», «14.11.26», «14.11», «2026-11-14» → «14.11.2026». Пустая строка, если это не дата. */
export function normDate(raw: unknown, defaultYear = new Date().getFullYear()): string {
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/);
  let d: number, mo: number, y: number;
  if (m) {
    d = Number(m[1]); mo = Number(m[2]);
    y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
  } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
  } else return '';
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`;
}

export function todayMskKey(now = Date.now()): string {
  const d = new Date(now + 3 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

export function colLetter(index: number): string {
  let n = index + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function parseRazdachiSheet(values: string[][], defaultYear?: number): RazSheet | null {
  let headerRow = -1;
  let col: Record<string, number> = {};
  for (let i = 0; i < Math.min(8, values.length); i++) {
    const map: Record<string, number> = {};
    values[i].forEach((h, idx) => {
      const t = String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      for (const [name, re] of Object.entries(FIELD_HEADERS)) if (re.test(t) && map[name] == null) map[name] = idx;
    });
    if (map.tg != null && map.date != null && map.model != null) { headerRow = i; col = map; break; }
  }
  if (headerRow < 0) return null;
  const headers = values[headerRow].map((h) => String(h ?? ''));
  const rows: RazRow[] = [];
  for (let i = headerRow + 1; i < values.length; i++) {
    const cells = values[i].map((c) => String(c ?? ''));
    const model = String(cells[col.model] ?? '').trim();
    const date = normDate(cells[col.date], defaultYear);
    if (!model || !date) continue; // строка без модели или даты не размечена
    const tg = normTg(cells[col.tg]);
    const started = STARTED_FIELDS.some((f) => col[f] != null && String(cells[col[f]] ?? '').trim() !== '');
    rows.push({ row: i + 1, model, kind: String(cells[col.kind] ?? '').trim(), tg, date, started, cells });
  }
  return { headerRow: headerRow + 1, headers, col, rows };
}

export function findClientRows(sheet: RazSheet, username: string | undefined | null, date: string): RazRow[] {
  const tg = normTg(username);
  if (!tg) return [];
  return sheet.rows.filter((r) => r.tg === tg && r.date === date);
}

export type ModelStat = { model: string; date: string; total: number; started: number; left: number };

/** Лимит модели на дату равен числу размеченных строк; «занято» это строки, по которым процесс уже идёт. */
export function modelStats(sheet: RazSheet, date: string, startedTg: Set<string> = new Set()): ModelStat[] {
  const map = new Map<string, ModelStat>();
  for (const r of sheet.rows) {
    if (r.date !== date) continue;
    const key = normModel(r.model);
    const s = map.get(key) ?? { model: r.model, date, total: 0, started: 0, left: 0 };
    s.total++;
    if (r.started || (r.tg && startedTg.has(r.tg))) s.started++;
    map.set(key, s);
  }
  return [...map.values()].map((s) => ({ ...s, left: s.total - s.started }));
}

// ── Запись ────────────────────────────────────────────────────────────────

export type SheetIO = {
  /** Значения диапазона в A1-нотации (с форматированием как на листе). null при ошибке чтения. */
  read(range: string): Promise<string[][] | null>;
  /** Запись отдельных ячеек. false при ошибке. */
  batchWrite(updates: { range: string; value: string }[]): Promise<boolean>;
};

export type WriteKey = { tg: string; model: string; date?: string; hintRow?: number | null };

export type WriteResult = {
  status: 'written' | 'unchanged' | 'conflict' | 'not_found' | 'failed' | 'unverified';
  row?: number;
  written: string[];
  conflicts: string[];
};

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

function rowMatches(sheet: RazSheet, cells: string[], key: WriteKey): boolean {
  if (normTg(cells[sheet.col.tg]) !== normTg(key.tg)) return false;
  if (normModel(cells[sheet.col.model]) !== normModel(key.model)) return false;
  if (key.date && normDate(cells[sheet.col.date]) !== key.date) return false;
  return true;
}

/**
 * Записывает поля Алины в уже размеченную строку клиента. Правила:
 * - строка ищется по логину, модели и дате; номер строки только подсказка (после сортировки он уезжает);
 * - пишутся только пустые ячейки или те, где уже стоит то же значение; чужое значение не перезаписывается (конфликт);
 * - новые строки не добавляются; после записи строка читается снова и сверяется.
 */
export async function writeClientRow(
  io: SheetIO,
  tab: string,
  sheet: RazSheet,
  key: WriteKey,
  fields: Record<string, string>,
): Promise<WriteResult> {
  const width = Math.max(sheet.headers.length, 1);
  const last = colLetter(width - 1);
  const q = quoteTab(tab);
  const readRow = async (row: number): Promise<string[] | null> => {
    const v = await io.read(`${q}!A${row}:${last}${row}`);
    return v ? (v[0] ?? []).map((c) => String(c ?? '')) : null;
  };

  let row = key.hintRow ?? 0;
  let cells: string[] | null = row ? await readRow(row) : null;
  if (!cells || !rowMatches(sheet, cells, key)) {
    // подсказка не подошла: сортировка или правка. Читаем лист целиком и ищем строку заново.
    const all = await io.read(`${q}!A1:${last}`);
    if (!all) return { status: 'failed', written: [], conflicts: [] };
    const fresh = parseRazdachiSheet(all);
    const found = fresh?.rows.find((r) => rowMatches(sheet, r.cells, key));
    if (!found) return { status: 'not_found', written: [], conflicts: [] };
    row = found.row;
    cells = found.cells;
  }

  const updates: { range: string; value: string }[] = [];
  const written: string[] = [];
  const conflicts: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    const idx = sheet.col[name];
    if (idx == null || value === '' || value == null) continue;
    const current = String(cells[idx] ?? '').trim();
    if (current === value) continue;
    if (current !== '') { conflicts.push(name); continue; }
    updates.push({ range: `${q}!${colLetter(idx)}${row}`, value });
    written.push(name);
  }
  if (!updates.length) return { status: conflicts.length ? 'conflict' : 'unchanged', row, written: [], conflicts };

  if (!await io.batchWrite(updates)) return { status: 'failed', row, written: [], conflicts };

  // Сверка после записи: строка на месте, наши значения не затёрты.
  const after = await readRow(row);
  const ok = after && rowMatches(sheet, after, key) &&
    updates.every((u, i) => String(after[sheet.col[written[i]]] ?? '').trim() === fields[written[i]]);
  return { status: ok ? (conflicts.length ? 'conflict' : 'written') : 'unverified', row, written, conflicts };
}

// ── Кэш чтения ────────────────────────────────────────────────────────────

/** Чтение листа не чаще раза в ttl; параллельные вызовы ждут один запрос; при ошибке отдаём последнее удачное. */
export function createCachedLoader<T>(load: () => Promise<T>, ttlMs = 60_000, now: () => number = Date.now) {
  let at = 0;
  let value: T | null = null;
  let inflight: Promise<T> | null = null;
  return async (force = false): Promise<T> => {
    if (!force && value !== null && now() - at < ttlMs) return value;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        value = await load();
        at = now();
        return value;
      } catch (e) {
        if (value !== null) return value; // 429 или сбой: используем последнее удачное
        throw e;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
}
