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
  // header row 0
  const out: LeadRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const kind = String(r[0] || '').trim().toUpperCase();
    const tg = String(r[1] || '').trim();
    if (!kind && !tg) continue;
    if (/кэшбек/i.test(tg) && !kind) continue; // separator
    out.push({
      kind,
      tg,
      order_date: String(r[2] || '').trim(),
      product: String(r[16] || '').trim(),
      keyword: String(r[19] || '').trim(),
      cash_paid: String(r[14] || '').trim(),
    });
  }
  return out;
}

function dealFromKind(kind: string): 'cashback' | 'barter' {
  if (/блог|barter|рилс/i.test(kind)) return 'barter';
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
    // Product header: ",Костюм черный,,,8,10,11" or "АРТ,8517..."
    const joined = r.map((c) => String(c || '').trim()).filter(Boolean);
    const artIdx = r.findIndex((c) => /^арт$/i.test(String(c || '').trim()));
    let article: string | null = null;
    if (artIdx >= 0 && r[artIdx + 1]) article = String(r[artIdx + 1]).trim();

    // Look ahead for date header row within next 3 lines
    let headerIdx = -1;
    for (let k = i; k < Math.min(i + 4, rows.length); k++) {
      const dates = rows[k]
        .map((c, idx) => ({ idx, label: String(c || '').trim() }))
        .filter((d) => /^\d{1,2}\.\d{2}/.test(d.label));
      if (dates.length >= 2) {
        headerIdx = k;
        break;
      }
    }
    if (headerIdx < 0) {
      i++;
      continue;
    }

    const dateCols = rows[headerIdx]
      .map((c, idx) => ({ idx, label: String(c || '').trim() }))
      .filter((d) => /^\d{1,2}\.\d{2}/.test(d.label));

    // product name: row above header if not "Запрос"
    let product = '';
    for (let k = headerIdx - 1; k >= Math.max(0, headerIdx - 3); k--) {
      const nameCell = String(rows[k][1] || rows[k][0] || '').trim();
      if (nameCell && !/^арт$/i.test(nameCell) && !/^\d+$/.test(nameCell)) {
        product = nameCell;
        // day totals on that row
        break;
      }
    }
    if (!product) product = tabName;

    const dayTotals: Record<string, number> = {};
    const prodRow = rows[Math.max(0, headerIdx - 1)] || [];
    for (const d of dateCols) {
      dayTotals[d.label] = parseIntSafe(prodRow[d.idx]);
    }

    const keywords: GraphBlock['keywords'] = [];
    let j = headerIdx + 1;
    for (; j < rows.length; j++) {
      const rr = rows[j];
      const c0 = String(rr[0] || '').trim();
      const c1 = String(rr[1] || '').trim();
      // next block starts with АРТ or empty gap then new product
      if (/^арт$/i.test(c0) || /^арт$/i.test(c1)) break;
      if (
        j > headerIdx + 1 &&
        !c1 &&
        !c0 &&
        rr.every((x) => !String(x || '').trim())
      ) {
        // blank — maybe end
        const peek = rows[j + 1];
        if (peek && /^арт$/i.test(String(peek[0] || peek[1] || '').trim())) break;
        continue;
      }
      // skip header-like
      if (/^запрос$/i.test(c1) || /^запрос$/i.test(c0)) continue;

      const key = c1 || c0;
      if (!key || /^\d+$/.test(key)) continue;
      // skip if looks like product title row without keyword pattern - still ok

      const byDay: Record<string, number> = {};
      let any = false;
      for (const d of dateCols) {
        const n = parseIntSafe(rr[d.idx]);
        byDay[d.label] = n;
        if (n > 0) any = true;
      }
      const cluster = parseIntSafe(rr[3]);
      if (any || cluster > 0) {
        keywords.push({ key, byDay, cluster });
      }

      // stop block if we hit another product name row with date totals and few text cols
      if (
        j > headerIdx + 2 &&
        c1 &&
        /костюм|жилет|брюк|топ|футбол/i.test(c1) &&
        dateCols.some((d) => parseIntSafe(rr[d.idx]) > 0) &&
        !/запрос|частота/i.test(c1)
      ) {
        // This might be next product header — back up
        break;
      }
    }

    blocks.push({
      tab: tabName,
      article,
      product,
      dateCols,
      dayTotals,
      keywords,
    });
    i = Math.max(j, headerIdx + 1);
  }
  return blocks;
}

function countUsed(
  leads: LeadRow[],
  opts: { dateLabel: string; product: string; keyword?: string | null },
): number {
  const day = opts.dateLabel.replace(/\.\d{4}$/, ''); // 24.03 or 24.03.2026
  let n = 0;
  for (const L of leads) {
    if (!L.tg && !L.kind) continue;
    const od = L.order_date.replace(/\.\d{4}$/, '');
    // match day.month
    if (od && day) {
      const a = od.split('.').slice(0, 2).join('.');
      const b = day.split('.').slice(0, 2).join('.');
      if (a !== b && !L.order_date.startsWith(opts.dateLabel) &&
        !opts.dateLabel.startsWith(od)) {
        // also allow full date equality
        if (norm(L.order_date) !== norm(opts.dateLabel)) continue;
      }
    }
    if (opts.product) {
      const p = norm(L.product);
      const want = norm(opts.product);
      if (p && want && !p.includes(want.slice(0, 6)) && !want.includes(p.slice(0, 6))) {
        continue;
      }
    }
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

    let planToday = dateLabel ? (b.dayTotals[dateLabel] || 0) : 0;

    // если сегодня нет колонки — суммарный план по keywords на сегодня из byDay
    if (dateLabel) {
      const sumKw = b.keywords.reduce((s, k) => s + (k.byDay[dateLabel!] || 0), 0);
      if (sumKw > planToday) planToday = sumKw;
    }

    // выбрать лучший ключ на сегодня
    let bestKey: string | null = null;
    let bestKeyPlan = 0;
    if (dateLabel) {
      for (const k of b.keywords) {
        const n = k.byDay[dateLabel] || 0;
        if (n > bestKeyPlan) {
          bestKeyPlan = n;
          bestKey = k.key;
        }
      }
    }
    // если на сегодня 0 — взять ключ с max cluster как «основной» для знания, но slots=0
    if (!bestKey && b.keywords.length) {
      const sorted = [...b.keywords].sort((a, c) => c.cluster - a.cluster);
      bestKey = sorted[0].key;
    }

    const used = dateLabel
      ? countUsed(leads, { dateLabel, product: b.product })
      : 0;
    const slotsLeft = Math.max(0, planToday - used);
    const open = Boolean(dateLabel) && planToday > 0 && slotsLeft > 0;

    offers.push({
      date: dateLabel,
      deal_type: 'both', // в графике смешанный поток; вид выбирает клиент/менеджер
      product_name: b.product,
      keyword: bestKey,
      article: b.article,
      cashback_pct: null,
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
          deal_type: 'both',
          product_name: b.product,
          keyword: k.key,
          article: b.article,
          cashback_pct: null,
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
  const tabs = [
    ...(discovered.graphs.length ? discovered.graphs : ELIUM_GRAPH_FALLBACK),
    ...extraGids.map((gid) => ({ gid, name: `gid:${gid}` })),
  ];
  // unique by gid
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
      leads_rows: 0,
      knowledge: '',
      fetched_at: new Date().toISOString(),
    };
    planCache.at = Date.now();
    planCache.snap = snap;
    return { ...snap, cabinet_key: cabinetKey, sheet_id: sheetId };
  }

  const offers = buildOffers(blocks, leads);
  const active = pickActive(offers);
  const cabLabel = sheetOverride?.cabinet_name || cabinetKey;
  const knowledge =
    `Кабинет: ${cabLabel}\nSheet: ${sheetId}\n` +
    buildKnowledge(blocks, leads, offers);

  const snap: SheetPlanSnapshot = {
    ok: true,
    source: 'csv',
    offers,
    active,
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

  if (!a || !a.is_open || a.slots_left <= 0) {
    await upsert({
      is_open: false,
      slots_left: 0,
      product_name: a?.product_name || null,
      keyword: a?.keyword || null,
      deal_type: 'both',
      order_deadline: a?.order_deadline || null,
      notes: (snap.knowledge || '').slice(0, 1800),
      ...meta,
    });
    return { ...snap, synced: true };
  }

  await upsert({
    is_open: true,
    deal_type: a.deal_type,
    product_name: a.product_name,
    keyword: a.keyword,
    cashback_pct: a.cashback_pct ?? 70,
    slots_left: a.slots_left,
    order_deadline: a.order_deadline,
    notes: (snap.knowledge || '').slice(0, 1800),
    ...meta,
  });
  return { ...snap, synced: true };
}
