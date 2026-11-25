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
  size: /^размер(?:\s*кэша)?$/, // раньше «Размер кэша»; кэшбека нет, колонка теперь «Размер» (одежды)
  pickup_plan: /^примерная\s*дата\s*забора$/,
  pickup_fact: /^фактическая\s*дата\s*забора$|^факт забора$/,
  review_date: /^дата\s*публикации\s*отзыва$/,
  integration: /^дата\s*интеграции$/, // колонка N (раньше вторые «Реквизиты»)
  review_kind: /^вид\s*отзыва$/,
  requisites: /^реквизиты$/,
  published: /^отзыв\s*опубликован$/,
  responsible: /^отв[е]?[т]?ственный$|^ответственный$/,
  key: /^ключ$/,
  reels: /^ссылка\s*на\s*reels$/,
};

// Поля, по которым видно, что процесс по строке уже начался.
// «Ключ» сюда не входит: в таблице МАРС он вписан заранее у каждой размеченной строки (это план, а не признак начатого процесса), из-за чего все места считались занятыми.
const STARTED_FIELDS = ['price', 'pickup_plan', 'pickup_fact', 'review_date', 'review_kind', 'requisites', 'integration', 'published'];

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

// ── Места и бронь (владелец, 24 ноября 2026) ─────────────────────────────────────────
// Строка без логина и без данных процесса это свободное место. Алина берёт место сама: сегодня сразу, на другую дату по согласию клиента.

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function dateToUtc(key: string): number {
  const [d, m, y] = key.split('.').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Сколько дней от одной даты (дд.мм.гггг) до другой. */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateToUtc(toKey) - dateToUtc(fromKey)) / 86400000);
}

/** «сегодня», «завтра, 25 ноября», «послезавтра, 26 ноября» или «28 ноября». */
export function ruDay(dateKey: string, today: string): string {
  const n = daysBetween(today, dateKey);
  const [d, m] = dateKey.split('.').map(Number);
  const abs = `${d} ${MONTHS_GEN[m - 1]}`;
  if (n === 0) return 'сегодня';
  if (n === 1) return `завтра, ${abs}`;
  if (n === 2) return `послезавтра, ${abs}`;
  return abs;
}

export const isFreeRow = (r: RazRow): boolean => !r.tg && !r.started;

export type FreeSlot = { model: string; date: string; rows: RazRow[] };

/** Свободные места по моделям и датам от сегодняшней даты на horizon дней вперёд, по возрастанию даты. */
export function freeSlots(sheet: RazSheet, today: string, horizon = 14): FreeSlot[] {
  const map = new Map<string, FreeSlot>();
  for (const r of sheet.rows) {
    if (!isFreeRow(r)) continue;
    const n = daysBetween(today, r.date);
    if (n < 0 || n > horizon) continue;
    const k = normModel(r.model) + '|' + r.date;
    const s = map.get(k) ?? { model: r.model, date: r.date, rows: [] };
    s.rows.push(r);
    map.set(k, s);
  }
  return [...map.values()].sort((a, b) => dateToUtc(a.date) - dateToUtc(b.date) || a.model.localeCompare(b.model, 'ru'));
}

/** Ближайшая дата со свободным местом по модели. */
export function nearestFree(sheet: RazSheet, model: string, today: string, horizon = 14): FreeSlot | null {
  const k = normModel(model);
  return freeSlots(sheet, today, horizon).find((s) => normModel(s.model) === k) ?? null;
}

const COLOR_WORDS: [RegExp, string][] = [
  [/шоколад|шоко/, 'шоколад'], [/молоч/, 'молоч'], [/бордо/, 'бордо'], [/лапш|вишн/, 'лапша'], [/ бел(?:ый|ая|ое|ые)?(?=\s)/, 'бел'],
];

/** Какие из моделей клиент имеет в виду: по формату («3в1», «2 в 1», «три в одном») и цвету. Пусто, если модель не названа. */
export function matchModels(models: string[], text: string): string[] {
  const t = ' ' + normModel(text).replace(/(^|\s)три в одном(?=\s|$)/g, '$13в1').replace(/(^|\s)два в одном(?=\s|$)/g, '$12в1').replace(/([23]) в одном/g, '$1в1') + ' ';
  const fmt = (t.match(/([23])в1/) || [])[1] || (/штан|брюк/.test(t) ? '3' : /шорт/.test(t) ? '2' : '');
  const colors = COLOR_WORDS.filter(([re]) => re.test(t)).map(([, c]) => c);
  if (!fmt && !colors.length) return [];
  const uniq = [...new Map(models.map((m) => [normModel(m), m])).values()];
  const scored = uniq.map((m) => {
    const nm = normModel(m);
    const mf = (nm.match(/([23])в1/) || [])[1] || '';
    if (fmt && mf && fmt !== mf) return { m, s: -1 };
    const colorHit = colors.length ? colors.some((c) => nm.includes(c)) : false;
    if (colors.length && !colorHit) return { m, s: -1 };
    return { m, s: (fmt && mf === fmt ? 2 : 0) + (colorHit ? 2 : 0) };
  }).filter((x) => x.s > 0);
  const best = Math.max(0, ...scored.map((x) => x.s));
  return scored.filter((x) => x.s === best).map((x) => x.m);
}

export type ClaimResult = { status: 'claimed' | 'taken' | 'moved' | 'failed' | 'unverified'; row: number };

/** Вписывает логин клиента в свободную строку. Перед записью строку читаем заново: занята или сдвинулась, не пишем. После записи сверяем. */
export async function claimFreeRow(
  io: SheetIO,
  tab: string,
  sheet: RazSheet,
  target: { row: number; model: string; date: string },
  tg: string,
  responsible = 'Алина',
): Promise<ClaimResult> {
  const width = Math.max(sheet.headers.length, 1);
  const last = colLetter(width - 1);
  const q = quoteTab(tab);
  const readRow = async (): Promise<string[] | null> => {
    const v = await io.read(`${q}!A${target.row}:${last}${target.row}`);
    return v ? (v[0] ?? []).map((c) => String(c ?? '')) : null;
  };
  const cells = await readRow();
  if (!cells) return { status: 'failed', row: target.row };
  if (normModel(cells[sheet.col.model]) !== normModel(target.model) || normDate(cells[sheet.col.date]) !== target.date) return { status: 'moved', row: target.row };
  if (String(cells[sheet.col.tg] ?? '').trim() !== '') return { status: 'taken', row: target.row };
  const updates = [{ range: `${q}!${colLetter(sheet.col.tg)}${target.row}`, value: `@${tg}` }];
  if (sheet.col.responsible != null && String(cells[sheet.col.responsible] ?? '').trim() === '') {
    updates.push({ range: `${q}!${colLetter(sheet.col.responsible)}${target.row}`, value: responsible });
  }
  if (!await io.batchWrite(updates)) return { status: 'failed', row: target.row };
  const after = await readRow();
  if (!after) return { status: 'unverified', row: target.row };
  return { status: normTg(after[sheet.col.tg]) === normTg(tg) ? 'claimed' : 'taken', row: target.row };
}

// После 20:30 МСК на сегодняшний день уже не берём (заказ нужно сделать до 22:00): предлагаем ближайшую следующую дату.
export const TODAY_CUTOFF_MIN = 20 * 60 + 30;
export function mskMinutes(now = Date.now()): number {
  const d = new Date(now + 3 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
/** Разовое исключение владельца (alina_settings.lateException): до указанного времени места на сегодня берём и после 20:30 МСК. */
let lateException = false;
export const setLateException = (v: boolean): void => { lateException = v; };
export const lateExceptionOn = (): boolean => lateException;
/** День ещё не согласован владельцем (alina_settings.dayPlan): места на сегодня не отдаём, как после 20:30. */
let dayClosed = false;
export const setDayClosed = (v: boolean): void => { dayClosed = v; };
export const dayClosedOn = (): boolean => dayClosed && !lateException;
export const tooLateForToday = (now = Date.now()): boolean => !lateException && (dayClosed || mskMinutes(now) >= TODAY_CUTOFF_MIN);
