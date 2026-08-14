/**
 * План раздач Elium из Google Sheet «Кэшбэки / Выкупы Элиум».
 *
 * Вкладки:
 *  - Раздачи — лог заявок (Вид БЛОГЕР/КЭШ, ТГ, ключ, товар…)
 *  - График раздач * — план по дням и ключам
 *  - Калькулятор — объёмы
 *
 * Env: ALINA_SHEET_ID (обязательно)
 */

import { scoreProductMatch } from './agent-product-catalog.ts';

export type SheetPlanOffer = {
  date: string | null;
  deal_type: 'cashback' | 'barter' | 'both';
  product_name: string | null;
  keyword: string | null;
  article: string | null;
  cashback_pct: number | null;
  plan_slots: number;
  used_slots: number;
  slots_left: number;
  order_deadline: string | null;
  is_open: boolean;
  status_raw: string | null;
  tab: string;
  row_index: number;
};

export type SheetPlanSnapshot = {
  ok: boolean;
  error?: string;
  source?: 'csv';
  offers: SheetPlanOffer[];
  active: SheetPlanOffer | null;
  /** Что реально ведётся в таблице: cashback / barter / both */
  deal_mode: 'cashback' | 'barter' | 'both';
  leads_rows: number;
  knowledge: string;
  fetched_at: string;
};

const planCache: { at: number; snap: SheetPlanSnapshot | null } = {
  at: 0,
  snap: null,
};
const CACHE_MS = 45_000;

/** Fallback gid'ы для старой таблицы Elium (если автодетект не сработал). */
const ELIUM_GRAPH_FALLBACK: { gid: string; name: string }[] = [
  { gid: '1266544300', name: 'График раздач муж кост' },
  { gid: '1599855805', name: 'График раздач жилетки' },
  { gid: '470127681', name: 'График раздач Жилетка серый' },
  { gid: '171758857', name: 'БРЮКИ График раздач' },
];
const ELIUM_RAZDACHI_FALLBACK = '2093674426';

export function extractSheetId(urlOrId: string): string | null {
  const s = urlOrId.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return null;
}

/** Автодетект вкладок: Раздач* + График* */
async function discoverTabs(
  sheetId: string,
): Promise<{ razdachiGid: string | null; graphs: { gid: string; name: string }[] }> {
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/edit?usp=sharing`,
      {
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: { 'User-Agent': 'NRSpace-Alina/1.0' },
      },
    );
    const html = await res.text();
    const tabs = [
      ...html.matchAll(/0,\\"(\d+)\\",\[\{\\"1\\":\[\[0,0,\\"([^\\"]+)\\"/g),
    ].map((m) => ({ gid: m[1], name: m[2] }));

    const graphs = tabs.filter((t) => /график|раздач/i.test(t.name) && !/^раздач/i.test(t.name));
    // вкладка лога: «Раздачи» / «Раздача» / «Выкупы»
    const raz = tabs.find((t) => /^раздач/i.test(t.name)) ||
      tabs.find((t) => /выкуп|кэш|кеш|лог/i.test(t.name));
    // графики: название содержит «график» или «раздач» но не сама «Раздачи»
    const graphTabs = tabs.filter((t) =>
      /график/i.test(t.name) ||
      (/раздач/i.test(t.name) && raz && t.gid !== raz.gid)
    );
    return {
      razdachiGid: raz?.gid || null,
      graphs: graphTabs.length ? graphTabs : graphs,
    };
  } catch (e) {
    console.error('[alina-sheet] discoverTabs', e);
    return { razdachiGid: null, graphs: [] };
  }
}

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ');
}

function todayMsk(): Date {
  return new Date(Date.now() + 3 * 3600_000);
}

function todayKeys(): string[] {
  const d = todayMsk();
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getUTCFullYear());
  return [`${dd}.${mm}`, `${dd}.${mm}.${yyyy}`, `${Number(dd)}.${mm}`];
}

function dateColMatchesToday(label: string): boolean {
  const t = norm(label).replace(/\s/g, '');
  return todayKeys().some((k) => t === norm(k).replace(/\s/g, '') || t.startsWith(norm(k).replace(/\s/g, '')));
}

function parseIntSafe(raw: unknown): number {
  const s = String(raw ?? '').replace(/\s/g, '').replace(',', '.');
  if (!s || s === '-' ) return 0;
  const m = s.match(/-?\d+/);
  return m ? Number(m[0]) : 0;
}

async function readCsv(sheetId: string, gid: string): Promise<string[][] | null> {
  const url =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'User-Agent': 'NRSpace-Alina/1.0' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (/<!doctype html|<html/i.test(text.slice(0, 200))) return null;
    return parseCsv(text);
  } catch (e) {
    console.error('[alina-sheet] csv', gid, e);
    return null;
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQ = false;
      } else cell += c;
      continue;
    }
    if (c === '"') {
      inQ = true;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (c === '\r') continue;
    cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

type LeadRow = {
  kind: string; // БЛОГЕР | КЭШ
  tg: string;
  order_date: string;
  product: string;
  keyword: string;
  cash_paid: string;
};

function parseRazdachi(rows: string[][]): LeadRow[] {
  if (!rows.length) return [];
  // Найти строку заголовков (Ссылка ТГ / Дата заказа / Ключ)
  let headerIdx = 0;
  const col: Record<string, number> = {};
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const map: Record<string, number> = {};
    rows[i].forEach((h, idx) => {
      const t = norm(h);
      if (/ссылка\s*тг|username|^тг$/.test(t)) map.tg = idx;
      if (/дата\s*заказ/.test(t)) map.order_date = idx;
      if (/^вид$|тип/.test(t) || idx === 0) map.kind = map.kind ?? idx;
      if (/^ключ|ключев|запрос/.test(t)) map.keyword = idx;
      if (/товар|артикул|цвет|столбец 1/.test(t)) map.product = idx;
      if (/кэш\s*выплач|выплачен/.test(t)) map.cash_paid = idx;
    });
    if (map.tg != null && map.order_date != null) {
      headerIdx = i;
      Object.assign(col, map);
      break;
    }
  }
  if (col.kind == null) col.kind = 0;
  if (col.tg == null) col.tg = 1;
  if (col.order_date == null) col.order_date = 2;
  if (col.keyword == null) col.keyword = 17;
  if (col.product == null) col.product = 16;

  const out: LeadRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const kind = String(r[col.kind] || '').trim().toUpperCase();
    const tg = String(r[col.tg] || '').trim();
    if (!kind && !tg) continue;
    if (/^@/.test(tg) === false && !kind && !/блог|кэш|кеш/i.test(tg)) continue;
    if (/кэшбек/i.test(tg) && !kind) continue;
    out.push({
      kind: kind || ( /блог/i.test(tg) ? 'БЛОГЕР' : 'КЭШБЕК'),
      tg,
      order_date: String(r[col.order_date] || '').trim(),
      product: String(r[col.product] || '').trim(),
      keyword: String(r[col.keyword] || '').trim(),
      cash_paid: col.cash_paid != null ? String(r[col.cash_paid] || '').trim() : '',
    });
  }
  return out;
}

function dealFromKind(kind: string): 'cashback' | 'barter' {
  if (/блог|barter|рилс/i.test(kind)) return 'barter';
  return 'cashback';
}

/** По колонке «ВИД РАЗДАЧИ» в Списке: только КЭШБЕК → cashback, только БЛОГЕР → barter. */
export function inferDealModeFromLeads(
  leads: LeadRow[],
): 'cashback' | 'barter' | 'both' {
  const env = (Deno.env.get('ALINA_OFFER_TYPE') || '').trim().toLowerCase();
  if (env === 'cashback' || env === 'barter' || env === 'both') return env;

  let cash = false;
  let barter = false;
  for (const L of leads) {
    const k = String(L.kind || '');
    if (/блог|barter|рилс/i.test(k)) barter = true;
    if (/кэш|кеш|cash/i.test(k)) cash = true;
  }
  if (cash && !barter) return 'cashback';
  if (barter && !cash) return 'barter';
  if (cash && barter) return 'both';
  // пустой лог — для BAZA/выкупов по умолчанию кэш
  const cab = (Deno.env.get('ALINA_CABINET_KEY') || '').toLowerCase();
  if (/baza|база|выкуп|кэш|кеш/.test(cab)) return 'cashback';
  return 'cashback';
}

type GraphBlock = {
  tab: string;
  article: string | null;
  product: string;
  dateCols: { idx: number; label: string }[];
  dayTotals: Record<string, number>; // label -> plan
  keywords: { key: string; byDay: Record<string, number>; cluster: number }[];
};

function parseGraphTab(rows: string[][], tabName: string): GraphBlock[] {
  const blocks: GraphBlock[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    const artIdx = r.findIndex((c) => /^арт$/i.test(String(c || '').trim()));
    let article: string | null = null;
    if (artIdx >= 0 && r[artIdx + 1]) article = String(r[artIdx + 1]).trim();

    // Заголовок: даты ИЛИ строка «Запрос / Частота / Частота кластера»
    let headerIdx = -1;
    let mode: 'dates' | 'cluster' = 'dates';
    for (let k = i; k < Math.min(i + 5, rows.length); k++) {
      const dates = rows[k]
        .map((c, idx) => ({ idx, label: String(c || '').trim() }))
        .filter((d) => /^\d{1,2}\.\d{2}/.test(d.label));
      if (dates.length >= 2) {
        headerIdx = k;
        mode = 'dates';
        break;
      }
      const cells = rows[k].map((c) => norm(c));
      if (cells.includes('запрос') && cells.some((c) => c.includes('кластер') || c === 'частота')) {
        headerIdx = k;
        mode = 'cluster';
        break;
      }
    }
    if (headerIdx < 0) {
      i++;
      continue;
    }

    let dateCols = mode === 'dates'
      ? rows[headerIdx]
        .map((c, idx) => ({ idx, label: String(c || '').trim() }))
        .filter((d) => /^\d{1,2}\.\d{2}/.test(d.label))
      : [];

    // product name + article from row above (e.g. "Фонарь белый 1240245305")
    let product = '';
    for (let k = headerIdx - 1; k >= Math.max(0, headerIdx - 3); k--) {
      const nameCell = String(rows[k][1] || rows[k][0] || '').trim();
      if (nameCell && !/^арт$/i.test(nameCell) && !/^запрос$/i.test(nameCell)) {
        product = nameCell.replace(/\s{2,}/g, ' ');
        const am = product.match(/(\d{6,})/);
        if (am) {
          article = article || am[1];
          product = product.replace(am[1], '').trim();
        }
        break;
      }
    }
    if (!product) product = tabName;

    const dayTotals: Record<string, number> = {};
    const prodRow = rows[Math.max(0, headerIdx - 1)] || [];
    for (const d of dateCols) {
      dayTotals[d.label] = parseIntSafe(prodRow[d.idx]);
    }

    // индекс колонки «Частота кластера»
    let clusterIdx = 3;
    rows[headerIdx].forEach((h, idx) => {
      if (norm(h).includes('кластер')) clusterIdx = idx;
    });
    let keyIdx = 1;
    rows[headerIdx].forEach((h, idx) => {
      if (norm(h) === 'запрос') keyIdx = idx;
    });

    const keywords: GraphBlock['keywords'] = [];
    let j = headerIdx + 1;
    for (; j < rows.length; j++) {
      const rr = rows[j];
      const c0 = String(rr[0] || '').trim();
      const c1 = String(rr[1] || '').trim();
      if (/^арт$/i.test(c0) || /^арт$/i.test(c1)) break;
      if (/^запрос$/i.test(c1) || /^запрос$/i.test(c0)) break;

      // следующий товар: "Фонарь черный …" / "Вырез белый …"
      if (
        j > headerIdx + 1 &&
        c1 &&
        /^(фонар|вырез|блузк|костюм|жилет|брюк|топ)/i.test(c1) &&
        !/запрос|частота/i.test(c1)
      ) {
        break;
      }

      if (
        j > headerIdx + 1 &&
        !c1 &&
        !c0 &&
        rr.every((x) => !String(x || '').trim())
      ) {
        const peek = rows[j + 1];
        const p1 = String(peek?.[1] || peek?.[0] || '');
        if (peek && (/^арт$/i.test(p1) || /^(фонар|вырез|блузк)/i.test(p1))) break;
        continue;
      }

      const key = String(rr[keyIdx] || c1 || c0).trim();
      if (!key || /^\d+$/.test(key) || /https?:\/\//i.test(key)) continue;

      const byDay: Record<string, number> = {};
      let any = false;
      for (const d of dateCols) {
        const n = parseIntSafe(rr[d.idx]);
        byDay[d.label] = n;
        if (n > 0) any = true;
      }
      const cluster = parseIntSafe(rr[clusterIdx]);
      if (any || cluster > 0) {
        keywords.push({ key, byDay, cluster });
      }
    }

    // Если дат нет — синтетический «сегодня» из суммы кластеров (активная раздача)
    if (!dateCols.length && keywords.some((k) => k.cluster > 0)) {
      const todayLabel = todayKeys()[0]; // dd.mm
      const total = keywords.reduce((s, k) => s + k.cluster, 0);
      dateCols.push({ idx: -1, label: todayLabel });
      dayTotals[todayLabel] = total;
      for (const k of keywords) {
        k.byDay[todayLabel] = k.cluster;
      }
    }

    if (keywords.length || Object.values(dayTotals).some((n) => n > 0)) {
      blocks.push({
        tab: tabName,
        article,
        product,
        dateCols,
        dayTotals,
        keywords,
      });
    }
    i = Math.max(j, headerIdx + 1);
  }
  return blocks;
}

function sameDay(orderDate: string, dateLabel: string): boolean {
  const od = norm(orderDate).replace(/\s/g, '');
  const day = norm(dateLabel).replace(/\s/g, '').replace(/\.\d{4}$/, '');
  if (!od || !day) return false;
  const a = od.split('.').slice(0, 2).join('.');
  const b = day.split('.').slice(0, 2).join('.');
  return a === b || od.startsWith(day) || od.includes(day);
}

function countUsed(
  leads: LeadRow[],
  opts: { dateLabel: string; product: string; keyword?: string | null },
): number {
  let n = 0;
  for (const L of leads) {
    if (!L.tg && !L.kind) continue;
    if (/test|удалить|alina_test/i.test(`${L.tg} ${L.keyword} ${L.product}`)) continue;
    // Только заявки с датой заказа на этот день (пустые даты не жрут слоты)
    if (!sameDay(L.order_date, opts.dateLabel)) continue;
    if (opts.keyword) {
      const k = norm(L.keyword);
      const want = norm(opts.keyword);
      if (k && want && k !== want) continue;
    }
    n++;
  }
  return n;
}

function buildOffers(
  blocks: GraphBlock[],
  leads: LeadRow[],
  dealMode: 'cashback' | 'barter' | 'both' = 'cashback',
): SheetPlanOffer[] {
  const offers: SheetPlanOffer[] = [];
  const todayLabels = todayKeys();

  for (const b of blocks) {
    // найти колонку сегодня; если нет — ближайший будущий день с планом; иначе последний день с планом
    let dateLabel: string | null = null;
    for (const d of b.dateCols) {
      if (dateColMatchesToday(d.label)) {
        dateLabel = d.label;
        break;
      }
    }
    if (!dateLabel) dateLabel = todayKeys()[0];

    let planToday = b.dayTotals[dateLabel] || 0;
    const sumKw = b.keywords.reduce((s, k) => s + (k.byDay[dateLabel!] || 0), 0);
    if (sumKw > planToday) planToday = sumKw;

    // Колонка дня есть, но нули — берём «Частота кластера» (раздача идёт, график ещё не разметили)
    const sumCluster = b.keywords.reduce((s, k) => s + (k.cluster || 0), 0);
    let usingCluster = false;
    if (planToday <= 0 && sumCluster > 0) {
      planToday = sumCluster;
      usingCluster = true;
      for (const k of b.keywords) {
        if (k.cluster > 0) k.byDay[dateLabel] = k.cluster;
      }
      b.dayTotals[dateLabel] = planToday;
    }

    // выбрать лучший ключ на сегодня
    let bestKey: string | null = null;
    let bestKeyPlan = 0;
    for (const k of b.keywords) {
      const n = usingCluster ? (k.cluster || 0) : (k.byDay[dateLabel!] || 0);
      if (n > bestKeyPlan) {
        bestKeyPlan = n;
        bestKey = k.key;
      }
    }
    if (!bestKey && b.keywords.length) {
      const sorted = [...b.keywords].sort((a, c) => c.cluster - a.cluster);
      bestKey = sorted[0].key;
      bestKeyPlan = sorted[0].cluster || 0;
    }

    const used = countUsed(leads, {
      dateLabel,
      product: b.product,
      keyword: bestKey,
    });
    const slotsLeft = Math.max(0, (bestKeyPlan || planToday) - used);
    const open = planToday > 0 && slotsLeft > 0;

    offers.push({
      date: dateLabel,
      deal_type: dealMode,
      product_name: b.product,
      keyword: bestKey,
      article: b.article,
      cashback_pct: dealMode === 'barter' ? null : 70,
      plan_slots: planToday,
      used_slots: used,
      slots_left: slotsLeft,
      order_deadline: dateLabel ? `${dateLabel} до 22:00 МСК` : null,
      is_open: open,
      status_raw: open ? 'открыто' : (planToday > 0 ? 'места закончились' : 'нет плана на сегодня'),
      tab: b.tab,
      row_index: 0,
    });

    // отдельные офферы по ключам с планом > 0 сегодня
    if (dateLabel) {
      for (const k of b.keywords) {
        const kp = k.byDay[dateLabel] || 0;
        if (kp <= 0) continue;
        const ku = countUsed(leads, {
          dateLabel,
          product: b.product,
          keyword: k.key,
        });
        const left = Math.max(0, kp - ku);
        offers.push({
          date: dateLabel,
          deal_type: dealMode,
          product_name: b.product,
          keyword: k.key,
          article: b.article,
          cashback_pct: dealMode === 'barter' ? null : 70,
          plan_slots: kp,
          used_slots: ku,
          slots_left: left,
          order_deadline: `${dateLabel} до 22:00 МСК`,
          is_open: left > 0,
          status_raw: left > 0 ? 'открыто' : 'ключ закрыт',
          tab: b.tab,
          row_index: 0,
        });
      }
    }

    void todayLabels;
  }
  return offers;
}

/** Уникальные открытые товары (для «по какому объявлению»). */
export function listOpenProductChoices(offers: SheetPlanOffer[]): SheetPlanOffer[] {
  const out: SheetPlanOffer[] = [];
  const seen = new Set<string>();
  for (const o of offers) {
    if (!o.is_open || o.slots_left <= 0) continue;
    const key = norm(`${o.product_name || ''}|${o.article || ''}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  out.sort((a, b) => String(a.product_name || '').localeCompare(String(b.product_name || ''), 'ru'));
  return out;
}

export async function getOpenProductChoices(): Promise<SheetPlanOffer[]> {
  const snap = await fetchSheetPlan(false);
  if (!snap.ok) return [];
  return listOpenProductChoices(snap.offers);
}

/** Найти оффер по тексту клиента / артикулу / подсказке с фото. */
export function matchOfferFromText(
  offers: SheetPlanOffer[],
  text: string,
): { offer: SheetPlanOffer | null; ambiguous: SheetPlanOffer[] } {
  const open = listOpenProductChoices(offers);
  if (!open.length) return { offer: null, ambiguous: [] };

  const t = norm(text);
  const digits = (text.match(/\d{6,}/g) || []);

  // точный артикул
  for (const art of digits) {
    const hit = open.find((o) => o.article && String(o.article) === art);
    if (hit) return { offer: hit, ambiguous: [] };
  }

  const scored = open.map((o) => {
    const name = o.product_name || '';
    const score = scoreProductMatch(`${name} ${o.article || ''}`, text);
    return { o, score };
  }).filter((x) => x.score >= 4).sort((a, b) => b.score - a.score);

  if (!scored.length) return { offer: null, ambiguous: open };
  const top = scored[0].score;
  const tied = scored.filter((x) => x.score === top).map((x) => x.o);
  if (tied.length === 1) return { offer: tied[0], ambiguous: [] };
  return { offer: null, ambiguous: tied };
}

export type ColorWant = 'black' | 'white' | 'other' | null;

export function detectColorWant(text: string): ColorWant {
  const t = norm(text);
  if (/чёрн|черн|black/i.test(t)) return 'black';
  if (/бел|white/i.test(t)) return 'white';
  // прочие цвета — не фильтруем как black/white, но и не null-блокируем
  if (/темн|син|беж|борд|граф|коричн|изумруд|хаки|розов|кремов|молочн/i.test(t)) {
    return 'other';
  }
  return null;
}

function offerHasColor(o: SheetPlanOffer, color: ColorWant): boolean {
  const n = norm(o.product_name || '');
  if (color === 'black') return /чёрн|черн/.test(n);
  if (color === 'white') return /бел/.test(n);
  return false;
}

/** Все уникальные товары из графика (и открытые, и закрытые на сегодня). */
export function listAllProductChoices(offers: SheetPlanOffer[]): SheetPlanOffer[] {
  const out: SheetPlanOffer[] = [];
  const seen = new Set<string>();
  for (const o of offers) {
    const key = norm(`${o.product_name || ''}|${o.article || ''}`);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

/**
 * Подбор по цвету/модели с учётом плана на сегодня.
 * Если просят чёрный, а слотов нет — предложить открытые альтернативы (белый…).
 */
export function resolveProductChoice(
  offers: SheetPlanOffer[],
  text: string,
): {
  offer: SheetPlanOffer | null;
  ambiguous: SheetPlanOffer[];
  unavailableColor: ColorWant;
  alternatives: SheetPlanOffer[];
} {
  const open = listOpenProductChoices(offers);
  const all = listAllProductChoices(offers);
  const color = detectColorWant(text);
  const matched = matchOfferFromText(offers, text);

  if (matched.offer) {
    return { offer: matched.offer, ambiguous: [], unavailableColor: null, alternatives: [] };
  }
  if (matched.ambiguous.length === 1) {
    return {
      offer: matched.ambiguous[0],
      ambiguous: [],
      unavailableColor: null,
      alternatives: [],
    };
  }
  if (matched.ambiguous.length > 1) {
    return {
      offer: null,
      ambiguous: matched.ambiguous,
      unavailableColor: null,
      alternatives: [],
    };
  }

  // Только цвет («черный») — среди открытых
  if (color && color !== 'other') {
    const openColor = open.filter((o) => offerHasColor(o, color));
    if (openColor.length === 1) {
      return { offer: openColor[0], ambiguous: [], unavailableColor: null, alternatives: [] };
    }
    if (openColor.length > 1) {
      return { offer: null, ambiguous: openColor, unavailableColor: null, alternatives: [] };
    }
    // цвета нет в открытых — есть ли вообще в графике
    const anyColor = all.filter((o) => offerHasColor(o, color));
    if (anyColor.length || /чёрн|черн|бел/i.test(text)) {
      return {
        offer: null,
        ambiguous: [],
        unavailableColor: color,
        alternatives: open,
      };
    }
  }

  return {
    offer: null,
    ambiguous: open,
    unavailableColor: null,
    alternatives: [],
  };
}

function pickActive(offers: SheetPlanOffer[]): SheetPlanOffer | null {
  // предпочитаем офферы с конкретным ключом и местами
  const open = offers.filter((o) => o.is_open && o.slots_left > 0 && o.keyword);
  if (open.length) {
    open.sort((a, b) => b.slots_left - a.slots_left);
    return open[0];
  }
  const openProd = offers.filter((o) => o.is_open && o.slots_left > 0);
  if (openProd.length) {
    openProd.sort((a, b) => b.slots_left - a.slots_left);
    return openProd[0];
  }
  // закрыто — вернуть любой «сегодняшний» для статуса
  return offers.find((o) => o.date && dateColMatchesToday(o.date)) ||
    offers[0] ||
    null;
}

function buildKnowledge(
  blocks: GraphBlock[],
  leads: LeadRow[],
  offers: SheetPlanOffer[],
): string {
  const lines: string[] = [];
  lines.push(`Сегодня (МСК): ${todayKeys()[1] || todayKeys()[0]}`);
  lines.push(`В логе «Раздачи»: ${leads.length} заявок (БЛОГЕР=бартер, КЭШ=кэшбек)`);
  const byKind = { barter: 0, cash: 0 };
  for (const L of leads) {
    if (/блог/i.test(L.kind)) byKind.barter++;
    else if (/кэш|кеш|cash/i.test(L.kind)) byKind.cash++;
  }
  lines.push(`Из них бартер: ${byKind.barter}, кэш: ${byKind.cash}`);

  for (const b of blocks) {
    const todayCol = b.dateCols.find((d) => dateColMatchesToday(d.label));
    const plan = todayCol ? b.dayTotals[todayCol.label] || 0 : 0;
    lines.push(
      `• ${b.product}${b.article ? ` (арт ${b.article})` : ''}: сегодня план ${plan}` +
        (todayCol ? ` [${todayCol.label}]` : ' [нет колонки сегодня]'),
    );
    const top = [...b.keywords].sort((a, c) => c.cluster - a.cluster).slice(0, 4);
    for (const k of top) {
      const kp = todayCol ? (k.byDay[todayCol.label] || 0) : 0;
      lines.push(`  – ключ «${k.key}»: сегодня ${kp}, вес ${k.cluster}`);
    }
  }

  const open = offers.filter((o) => o.is_open);
  lines.push(
    open.length
      ? `Свободно сейчас: ${open.map((o) => `${o.product_name}/${o.keyword}: ${o.slots_left}`).join('; ')}`
      : 'Свободных мест на сегодня НЕТ — клиентам говорим, что раздачи на сегодня закончены.',
  );
  return lines.join('\n');
}

export type ActiveSheet = {
  sheet_id: string;
  cabinet_key: string;
  cabinet_name: string | null;
};

/** Активная таблица: env → alina_campaign.sheet_id → alina_cabinet_sheets.is_active */
export async function resolveActiveSheet(
  // deno-lint-ignore no-explicit-any
  db: { from: (t: string) => any },
): Promise<ActiveSheet | null> {
  const envId = (Deno.env.get('ALINA_SHEET_ID') || '').trim();
  const envCab = (Deno.env.get('ALINA_CABINET_KEY') || 'active').trim();

  try {
    const { data: camp } = await db
      .from('alina_campaign')
      .select('sheet_id, cabinet_key')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (camp?.sheet_id) {
      return {
        sheet_id: String(camp.sheet_id),
        cabinet_key: String(camp.cabinet_key || envCab),
        cabinet_name: null,
      };
    }
  } catch { /* table may miss cols */ }

  try {
    const { data: row } = await db
      .from('alina_cabinet_sheets')
      .select('sheet_id, cabinet_key, cabinet_name, is_active')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.sheet_id) {
      return {
        sheet_id: String(row.sheet_id),
        cabinet_key: String(row.cabinet_key),
        cabinet_name: row.cabinet_name || null,
      };
    }
  } catch { /* optional */ }

  if (envId) {
    return { sheet_id: envId, cabinet_key: envCab, cabinet_name: null };
  }
  return null;
}

export async function fetchSheetPlan(
  force = false,
  sheetOverride?: ActiveSheet | null,
): Promise<SheetPlanSnapshot & { cabinet_key?: string; sheet_id?: string }> {
  if (!force && planCache.snap && Date.now() - planCache.at < CACHE_MS) {
    return planCache.snap;
  }

  const sheetId = (sheetOverride?.sheet_id || Deno.env.get('ALINA_SHEET_ID') || '').trim();
  const cabinetKey = sheetOverride?.cabinet_key ||
    (Deno.env.get('ALINA_CABINET_KEY') || '').trim() ||
    'active';
  if (!sheetId) {
    return {
      ok: false,
      error: 'Нет sheet_id — пришлите ссылку на таблицу раздач кабинета',
      offers: [],
      active: null,
      deal_mode: 'cashback',
      leads_rows: 0,
      knowledge: '',
      fetched_at: new Date().toISOString(),
    };
  }

  const discovered = await discoverTabs(sheetId);
  const leadsGid = (Deno.env.get('ALINA_LEADS_GID') || discovered.razdachiGid ||
    ELIUM_RAZDACHI_FALLBACK).trim();
  const raz = await readCsv(sheetId, leadsGid);
  const leads = raz ? parseRazdachi(raz) : [];

  const extraGids = (Deno.env.get('ALINA_GRAPH_GIDS') || '')
    .split(/[,\s]+/)
    .filter(Boolean);
  // Если явно заданы GRAPH_GIDS — только они (текущая раздача).
  // Иначе автодетект; можно сузить ALINA_GRAPH_FILTER=фонарь|вырез
  const filterRe = (Deno.env.get('ALINA_GRAPH_FILTER') || '').trim();
  let tabs: { gid: string; name: string }[] = [];
  if (extraGids.length) {
    tabs = extraGids.map((gid) => {
      const known = discovered.graphs.find((g) => g.gid === gid);
      return { gid, name: known?.name || `gid:${gid}` };
    });
  } else {
    tabs = discovered.graphs.length ? [...discovered.graphs] : [...ELIUM_GRAPH_FALLBACK];
    if (filterRe) {
      try {
        const re = new RegExp(filterRe, 'i');
        const filtered = tabs.filter((t) => re.test(t.name));
        if (filtered.length) tabs = filtered;
      } catch { /* bad regex */ }
    }
  }
  const seen = new Set<string>();
  const uniqTabs = tabs.filter((t) => {
    if (seen.has(t.gid)) return false;
    seen.add(t.gid);
    return true;
  });

  const blocks: GraphBlock[] = [];
  for (const t of uniqTabs) {
    const rows = await readCsv(sheetId, t.gid);
    if (!rows?.length) continue;
    blocks.push(...parseGraphTab(rows, t.name));
  }

  if (!blocks.length && !leads.length) {
    const snap: SheetPlanSnapshot = {
      ok: false,
      error:
        'Не прочитались вкладки Раздачи/График — доступ «по ссылке — читатель» и названия вкладок',
      source: 'csv',
      offers: [],
      active: null,
      deal_mode: 'cashback',
      leads_rows: 0,
      knowledge: '',
      fetched_at: new Date().toISOString(),
    };
    planCache.at = Date.now();
    planCache.snap = snap;
    return { ...snap, cabinet_key: cabinetKey, sheet_id: sheetId };
  }

  const dealMode = inferDealModeFromLeads(leads);
  const offers = buildOffers(blocks, leads, dealMode);
  const active = pickActive(offers);
  if (active) active.deal_type = dealMode;
  const cabLabel = sheetOverride?.cabinet_name || cabinetKey;
  const knowledge =
    `Кабинет: ${cabLabel}\nSheet: ${sheetId}\n` +
    `Режим раздачи: ${dealMode === 'cashback' ? 'только кэшбек' : dealMode === 'barter' ? 'только бартер' : 'кэшбек и бартер'}\n` +
    buildKnowledge(blocks, leads, offers);

  const snap: SheetPlanSnapshot = {
    ok: true,
    source: 'csv',
    offers,
    active,
    deal_mode: dealMode,
    leads_rows: leads.length,
    knowledge,
    fetched_at: new Date().toISOString(),
  };
  planCache.at = Date.now();
  planCache.snap = snap;
  return { ...snap, cabinet_key: cabinetKey, sheet_id: sheetId };
}

export async function syncCampaignFromSheet(
  // deno-lint-ignore no-explicit-any
  upsert: (patch: Record<string, unknown>) => Promise<any>,
  // deno-lint-ignore no-explicit-any
  db?: { from: (t: string) => any },
): Promise<SheetPlanSnapshot & { synced?: boolean; cabinet_key?: string; sheet_id?: string }> {
  let activeSheet: ActiveSheet | null = null;
  if (db) {
    try {
      activeSheet = await resolveActiveSheet(db);
    } catch { /* */ }
  }
  const snap = await fetchSheetPlan(true, activeSheet);
  if (!snap.ok) return { ...snap, synced: false };

  const a = snap.active;
  const meta = {
    cabinet_key: snap.cabinet_key || activeSheet?.cabinet_key || null,
    sheet_id: snap.sheet_id || activeSheet?.sheet_id || null,
  };

  const dealMode = snap.deal_mode || a?.deal_type || 'cashback';

  if (!a || !a.is_open || a.slots_left <= 0) {
    await upsert({
      is_open: false,
      slots_left: 0,
      product_name: a?.product_name || null,
      keyword: a?.keyword || null,
      deal_type: dealMode,
      order_deadline: a?.order_deadline || null,
      notes: (snap.knowledge || '').slice(0, 1800),
      ...meta,
    });
    return { ...snap, synced: true };
  }

  await upsert({
    is_open: true,
    deal_type: dealMode,
    product_name: a.product_name,
    keyword: a.keyword,
    cashback_pct: a.cashback_pct ?? (dealMode === 'barter' ? null : 70),
    slots_left: a.slots_left,
    order_deadline: a.order_deadline,
    // артикул в notes-префиксе — колонки article в campaign может не быть
    notes: [
      a.article ? `article:${a.article}` : '',
      `deal_mode:${dealMode}`,
      (snap.knowledge || '').slice(0, 1600),
    ].filter(Boolean).join('\n'),
    ...meta,
  });
  return { ...snap, synced: true };
}
