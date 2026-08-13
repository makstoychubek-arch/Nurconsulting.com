/**
 * Диалог Антона по остаткам FBS:
 *  кабинет (кнопки / текст) → склад продавца → реальный остаток WB Marketplace.
 *
 * Примеры:
 *  - «остатки по фбс» → спросит кабинет → склады
 *  - «Айзада элиум Уметалиева» → кабинет Elium
 *  - «остаток фбс укороченный костюм черный» → сам кабинет (Zevina 1 / Уркунбаев)
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  cancelOtherPending,
  getActivePending,
  isCancelText,
  isConfirmText,
  listCabinets,
  normName,
  parseSelection,
  resolveCabinet,
  stripCabinetAliases,
} from './agent-actions.ts';
import {
  CABINET_TOKEN_SELECT,
  isValidWbToken,
  pickCabinetToken,
} from './wb-cabinet-tokens.ts';
import {
  antonAskCabinets,
  antonAskModelColor,
  antonAskProduct,
  antonAskProductAllCabs,
  antonAskWarehouse,
  antonCancel,
  antonConfirmCabinet,
  antonNeedYesNo,
  antonNoProduct,
  antonPickCabinetAgain,
  antonPickWarehouseAgain,
  antonStocksLead,
  antonWrongCabinet,
} from './agent-voice.ts';
import {
  renderFbsSizeTablePng,
  type FbsSizeTableRow,
} from './agent-fbs-table.ts';

export const FBS_STOCK_ACTION = 'fbs_stock';
const CALLBACK_PREFIX = 'afs:';

export type FbsStockReply = {
  handled: boolean;
  agentKey?: 'anton';
  reply?: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  clearMarkup?: boolean;
  photos?: Array<{
    bytes: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  }>;
};

type Wh = { id: number; name: string };
type ProductHit = { nm_id: number; title: string; cabinet_id: string; score: number };
type StockReport = {
  text: string;
  photo?: Uint8Array;
  caption?: string;
};
type FbsPayload = {
  step: 'await_cabinet' | 'await_confirm_cabinet' | 'await_warehouse' | 'await_product';
  queryText: string;
  productText?: string;
  cabinetId?: string;
  cabinetName?: string;
  allCabinets?: boolean;
  warehouses?: Wh[];
  items?: Array<{ id: string; name: string }>;
  /** Кабинет угадан по товару — после «да» показываем остаток коротко */
  guessedFromProduct?: boolean;
  minimal?: boolean;
  /** Сводная таблица-фото по размерам */
  wantTable?: boolean;
};

/** Человекочитаемые имена кабинетов для уточнений. */
function cabinetHumanName(name: string): string {
  const n = normName(name);
  if (n.includes('zevina1') || /^zevina1$/.test(n) || (n.includes('zevina') && /1/.test(name))) {
    return 'ИП Уркунбаев';
  }
  if (n.includes('zevina2') || (n.includes('zevina') && /2/.test(name))) {
    return 'Zevina 2';
  }
  if (n.includes('elium')) return 'Elium (Айзада / Уметалиева)';
  if (n.includes('baza')) return 'Baza';
  if (n.includes('saai')) return 'SAAI';
  return name;
}

function kbYesNo() {
  return {
    inline_keyboard: [[
      { text: 'Да', callback_data: `${CALLBACK_PREFIX}yes` },
      { text: 'Нет', callback_data: `${CALLBACK_PREFIX}no` },
    ]],
  };
}

function isNoText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(нет|не|не то|не тот|другой|мимо)$/i.test(t);
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export function wantsFbsStock(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  const hasFbs = /(фбс|fbs)/i.test(t);
  const hasCab =
    /(баз[аеуы]|baza|элиум|elium|saai|сааи|зевин|zevina|уркунбаев|айзада|уметалиев)/i
      .test(t);
  // «сводную по размерам база» / «таблица остатков zevina» — даже без слова fbs
  if (
    wantsFbsSizeTable(t) &&
    (hasFbs || hasCab || /(остат|склад)/i.test(t))
  ) {
    return true;
  }
  if (!hasFbs) return false;
  // явный остаток/склад
  if (/(остат|осталось|сколько|склад|налич|есть\s+ли)/i.test(t)) return true;
  // «а по базы fbs?», «fbs элиум»
  if (hasCab) return true;
  // короткая реплика про FBS в тимчате
  if (t.length <= 40) return true;
  return false;
}

/** «сводную», «по размерам», «таблицу» → PNG-таблица. */
export function wantsFbsSizeTable(text: string): boolean {
  return /(сводн|таблиц|по\s*размер|размер(ам|ов|ы)|красив\w*\s*(фото|таблиц)|фото\s*(свод|таблиц|остат))/i
    .test(text || '');
}

function reportToReply(report: StockReport, extra?: Partial<FbsStockReply>): FbsStockReply {
  const photos = report.photo
    ? [{
      bytes: report.photo,
      mime: 'image/png',
      filename: 'fbs-sizes.png',
      caption: (report.caption || report.text.split('\n')[0] || 'FBS по размерам').slice(0, 900),
    }]
    : undefined;
  return {
    handled: true,
    agentKey: 'anton',
    reply: report.text,
    photos,
    ...extra,
  };
}

export function isFbsStockCallback(data: string): boolean {
  return data.startsWith(CALLBACK_PREFIX);
}

function kbFromItems(items: Array<{ name: string }>, withAll?: { label: string }) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const buttons = items.map((it, i) => ({
    text: it.name.slice(0, 64),
    callback_data: `${CALLBACK_PREFIX}${i}`,
  }));
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  if (withAll) {
    rows.push([{ text: withAll.label, callback_data: `${CALLBACK_PREFIX}all` }]);
  }
  rows.push([{ text: 'Отмена', callback_data: `${CALLBACK_PREFIX}cancel` }]);
  return { inline_keyboard: rows };
}

function scoreProductName(name: string, text: string): number {
  const n = name.toLowerCase().replace(/ё/g, 'е');
  const t = text.toLowerCase().replace(/ё/g, 'е');
  let score = 0;
  if (/укороч/.test(t) && /укороч/.test(n)) score += 4;
  if (/костюм/.test(t) && /костюм/.test(n)) score += 4;
  if (/пиджак/.test(t) && /пиджак/.test(n)) score += 3;
  if (/брюч/.test(t) && /брюч/.test(n)) score += 3;
  if (/жилет/.test(t) && /жилет/.test(n)) score += 4;
  if (/блузк|лапш/.test(t) && (/блуз|лапш|фонар|вырез/.test(n))) score += 2;
  if (/фонар/.test(t) && (/фонар|лапш/.test(n))) score += 4;
  if (/вырез/.test(t) && /вырез/.test(n)) score += 4;

  const colorRules: Array<[RegExp, RegExp]> = [
    [/черн|чёрн/, /черн/],
    [/бел/, /бел/],
    [/бордо|бардо/, /борд|бард/],
    [/коричнев|шоко/, /коричнев|шоко/],
    [/сер(ый|ая|ое)?/, /сер(ый|ая|ое|ые)?|gray|grey/],
  ];
  let colorAsked = false;
  let colorHit = false;
  for (const [ask, have] of colorRules) {
    if (!ask.test(t)) continue;
    colorAsked = true;
    if (have.test(n)) {
      score += 4;
      colorHit = true;
    }
  }
  // чужой цвет при явном запросе цвета — сильно режем
  if (colorAsked && !colorHit) score -= 4;
  if (/спорт|sport|велюр|двойка|оверсайз/.test(n) && !/спорт|велюр|двойка|оверсайз/.test(t)) {
    score -= 2;
  }
  // vendor-style tokens
  for (const w of t.split(/[^a-zа-я0-9_]+/i).filter((x) => x.length >= 4)) {
    if (n.includes(w)) score += 1;
  }
  return score;
}

function extractProductText(text: string): string {
  // \b плохо работает с кириллицей в JS — режем служебные слова явно
  const cleaned = text
    .replace(/@\w+/g, ' ')
    .replace(/(^|[\s,.:;!?])(антон|anton|логист\w*)(?=$|[\s,.:;!?])/gi, ' ')
    .replace(/(^|[\s,.:;!?])(фбс|fbs)(?=$|[\s,.:;!?])/gi, ' ')
    .replace(
      /(^|[\s,.:;!?])(остат\w*|осталось|сколько|налич\w*|склад\w*|кабинет\w*|слыш\w*|дай|скинь|покажи|нужен|нужно|есть|все|всех|сейчас|сейча|вб|wb|wildberries|вайлд\w*|маркетплейс\w*|продавц\w*)(?=$|[\s,.:;!?])/gi,
      ' ',
    )
    .replace(/(^|[\s,.:;!?])(по|на|в|и|а|же|там|тут)(?=$|[\s,.:;!?])/gi, ' ')
    .replace(/[?!.…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // «остатки фбс элиум» / «по базы fbs» → не оставлять кабинет как товар
  return stripCabinetAliases(cleaned);
}

/** Есть ли реальная модель/цвет (не мусор после вырезания кабинета). */
function hasProductQuery(text: string | undefined): boolean {
  const t = (text || '').trim();
  if (t.length < 3) return false;
  const words = t.split(/\s+/).filter(Boolean);
  // одно короткое слово без модели/цвета — почти всегда кабинет/шум
  if (
    words.length === 1 &&
    words[0].length <= 8 &&
    !/(костюм|пиджак|блуз|фонар|вырез|жилет|брюк|укороч|лапш)/i.test(t)
  ) {
    return false;
  }
  // только служебный шум
  if (!/([а-яa-z]{4,})/i.test(t)) return false;
  return true;
}

async function findProducts(text: string, cabinetId?: string): Promise<ProductHit[]> {
  const db = admin();
  const productText = extractProductText(text);
  if (!productText || productText.length < 3) return [];

  const found: ProductHit[] = [];
  const seen = new Set<string>();

  let q = db.from('rnp_articles').select('cabinet_id, nm_id, name').limit(1200);
  if (cabinetId) q = q.eq('cabinet_id', cabinetId);
  const { data } = await q;
  const upsert = (hit: ProductHit) => {
    const key = `${hit.cabinet_id}:${hit.nm_id}`;
    const idx = found.findIndex((f) => `${f.cabinet_id}:${f.nm_id}` === key);
    if (idx >= 0) {
      if (hit.score > found[idx].score) found[idx] = hit;
      return;
    }
    seen.add(key);
    found.push(hit);
  };

  for (const row of data || []) {
    const score = scoreProductName(String(row.name || ''), productText);
    if (score < 6) continue;
    const nm = Number(row.nm_id);
    if (!Number.isFinite(nm)) continue;
    upsert({
      nm_id: nm,
      title: String(row.name || nm),
      cabinet_id: String(row.cabinet_id),
      score,
    });
  }

  // Доп. сигналы из FBS-заказов (vendorCode) — часто точнее, чем rnp name
  try {
    const { data: fbs } = await db
      .from('fbs_daily_orders')
      .select('cabinet, nm_id, article, product_name')
      .limit(400);
    const cabs = await listCabinets();
    const byName = new Map(cabs.map((c) => [normName(c.name), c]));
    for (const row of fbs || []) {
      const blob = `${row.article || ''} ${row.product_name || ''}`;
      const score = scoreProductName(blob, productText) + 1;
      if (score < 6) continue;
      const cab = byName.get(normName(String(row.cabinet || '')));
      if (!cab) continue;
      if (cabinetId && cab.id !== cabinetId) continue;
      const nm = Number(row.nm_id);
      if (!Number.isFinite(nm)) continue;
      upsert({
        nm_id: nm,
        title: String(row.article || row.product_name || nm),
        cabinet_id: cab.id,
        score,
      });
    }
  } catch { /* optional */ }

  found.sort((a, b) => b.score - a.score);
  if (!found.length) return [];
  const top = found[0].score;
  // только лучший скор (и равные ему) — без «похожих» костюмов другого фасона
  return found.filter((f) => f.score === top).slice(0, 3);
}

async function autoCabinetFromProduct(
  text: string,
): Promise<{
  match?: { id: string; name: string };
  products: ProductHit[];
  /** true = есть догадка, но лучше спросить «это кабинет …?» */
  unsure: boolean;
}> {
  const products = await findProducts(text);
  if (!products.length) {
    // Слабый намёк по ассортименту (костюмы/пиджаки → Уркунбаев)
    const t = extractProductText(text).toLowerCase();
    if (/(костюм|пиджак|укороч|брюч)/i.test(t)) {
      const cabs = await listCabinets();
      const z1 = cabs.find((c) => /zevina\s*1/i.test(c.name) || normName(c.name) === 'zevina1');
      if (z1) return { match: z1, products: [], unsure: true };
    }
    return { products: [], unsure: false };
  }
  const byCab = new Map<string, { score: number; hits: ProductHit[] }>();
  for (const p of products) {
    const cur = byCab.get(p.cabinet_id) || { score: 0, hits: [] };
    cur.score += p.score;
    cur.hits.push(p);
    byCab.set(p.cabinet_id, cur);
  }
  const ranked = [...byCab.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return { products, unsure: false };
  const [topId, top] = ranked[0];
  const second = ranked[1]?.[1].score ?? 0;
  if (ranked.length > 1 && top.score < second + 3) {
    return { products, unsure: false };
  }
  const cabs = await listCabinets();
  const cab = cabs.find((c) => c.id === topId);
  if (!cab) return { products, unsure: false };

  const productText = extractProductText(text);
  const colorAsked = /(черн|бел|борд|бардо|шоко|коричнев|сер)/i.test(productText);
  const topScore = top.hits[0]?.score ?? 0;
  const manyHits = top.hits.length > 1;
  const weak = topScore < 12;
  const vague = productText.split(/\s+/).filter(Boolean).length <= 2 && !colorAsked;
  const unsure = manyHits || weak || vague || top.hits.length === 0;
  return { match: cab, products: top.hits, unsure };
}

async function loadCabinetToken(cabinetId: string): Promise<{
  name: string;
  token: string;
} | null> {
  const db = admin();
  const { data } = await db
    .from('cabinets')
    .select(CABINET_TOKEN_SELECT)
    .eq('id', cabinetId)
    .maybeSingle();
  if (!data) return null;
  const token = pickCabinetToken(data, 'default');
  if (!isValidWbToken(token)) return null;
  return { name: String(data.name), token };
}

export async function fetchSellerWarehouses(token: string): Promise<Wh[]> {
  const res = await fetch('https://marketplace-api.wildberries.ru/api/v3/warehouses', {
    headers: { Authorization: token, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`warehouses ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return list
    .map((w: Record<string, unknown>) => ({
      id: Number(w.id),
      name: String(w.name || w.id),
    }))
    .filter((w: Wh) => Number.isFinite(w.id) && w.id > 0);
}

async function fetchCardSkus(
  token: string,
  nmId: number,
): Promise<{
  vendor: string;
  title: string;
  skus: string[];
  sizes: Array<{ techSize: string; skus: string[] }>;
}> {
  const empty = { vendor: '', title: '', skus: [] as string[], sizes: [] as Array<{ techSize: string; skus: string[] }> };
  const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      settings: {
        cursor: { limit: 20 },
        filter: { withPhoto: -1, textSearch: String(nmId) },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return empty;
  const data = await res.json().catch(() => ({}));
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const card = cards.find((c: Record<string, unknown>) =>
    Number(c.nmID || c.nmId) === nmId
  );
  if (!card) return empty;
  const sizes: Array<{ techSize: string; skus: string[] }> = [];
  const skus: string[] = [];
  for (const s of card.sizes || []) {
    const rowSkus = (s.skus || []).map(String);
    sizes.push({ techSize: String(s.techSize || s.wbSize || ''), skus: rowSkus });
    skus.push(...rowSkus);
  }
  const title = String(
    card.title || card.subjectName || card.name || '',
  ).trim();
  return {
    vendor: String(card.vendorCode || '').trim(),
    title,
    skus: [...new Set(skus)],
    sizes,
  };
}

async function fetchWarehouseStocks(
  token: string,
  warehouseId: number,
  skus: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < skus.length; i += 100) {
    const chunk = skus.slice(i, i + 100);
    const res = await fetch(
      `https://marketplace-api.wildberries.ru/api/v3/stocks/${warehouseId}`,
      {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ skus: chunk }),
        signal: AbortSignal.timeout(25000),
      },
    );
    if (!res.ok) continue;
    const data = await res.json().catch(() => ({}));
    for (const row of data?.stocks || []) {
      out.set(String(row.sku), Number(row.amount || 0));
    }
  }
  return out;
}

async function savePending(
  chatId: number,
  tgUserId: number,
  payload: FbsPayload,
  cabinetId?: string | null,
  cabinetName?: string | null,
): Promise<void> {
  const db = admin();
  await cancelOtherPending(db, chatId);
  await db.from('agent_pending_actions').insert({
    chat_id: chatId,
    agent_key: 'anton',
    action_type: FBS_STOCK_ACTION,
    status: 'awaiting_selection',
    cabinet_id: cabinetId || null,
    cabinet_name: cabinetName || null,
    proposed_by_tg: tgUserId,
    payload,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}

async function updatePending(
  pendingId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const db = admin();
  await db
    .from('agent_pending_actions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', pendingId);
}

async function finishPending(pendingId: string, resultText: string): Promise<void> {
  await updatePending(pendingId, {
    status: 'done',
    result_text: resultText.slice(0, 2000),
  });
}

async function cancelPending(pendingId: string): Promise<void> {
  await updatePending(pendingId, { status: 'cancelled' });
}

function matchItemByText(
  text: string,
  items: Array<{ id: string; name: string }>,
): { id: string; name: string } | 'all' | null {
  const t = normName(text);
  if (!t) return null;
  if (/^(все|всех|all|весь)$/i.test(text.trim())) return 'all';
  const sel = parseSelection(text, items.length);
  if (sel?.length === 1) return items[sel[0] - 1] || null;
  if (sel && sel.length === items.length) return 'all';

  const hits = items.filter((it) => {
    const n = normName(it.name);
    return t.includes(n) || n.includes(t) ||
      text.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 3)
        .some((w) => n.includes(normName(w)) || normName(w).includes(n));
  });
  if (hits.length === 1) return hits[0];

  // кабинетные алиасы через resolveCabinet вызываются снаружи
  return null;
}

async function loadCabinetArticles(
  cabinetId: string,
  limit = 12,
): Promise<Array<{ nm_id: number; title: string }>> {
  const db = admin();
  const { data } = await db
    .from('rnp_articles')
    .select('nm_id, name')
    .eq('cabinet_id', cabinetId)
    .limit(Math.max(limit * 3, 40));
  const out: Array<{ nm_id: number; title: string }> = [];
  const seen = new Set<number>();
  for (const row of data || []) {
    const nm = Number(row.nm_id);
    if (!Number.isFinite(nm) || seen.has(nm)) continue;
    seen.add(nm);
    out.push({ nm_id: nm, title: String(row.name || nm) });
    if (out.length >= limit) break;
  }
  return out;
}

async function sizeRowForCard(opts: {
  token: string;
  article: string;
  name: string;
  sizes: Array<{ techSize: string; skus: string[] }>;
  warehouses: Wh[];
}): Promise<FbsSizeTableRow | null> {
  const sizes: Record<string, number> = {};
  let total = 0;
  for (const sz of opts.sizes) {
    const label = (sz.techSize || '—').trim() || '—';
    let qty = 0;
    for (const wh of opts.warehouses) {
      const stocks = await fetchWarehouseStocks(opts.token, wh.id, sz.skus);
      for (const v of stocks.values()) qty += v;
    }
    if (qty > 0) sizes[label] = (sizes[label] || 0) + qty;
    total += qty;
  }
  if (total <= 0 && !Object.keys(sizes).length) return null;
  const article = opts.article || opts.name || '—';
  const name = opts.name || opts.article || '—';
  return { article, name, title: article, sizes, total };
}

async function maybeRenderTable(
  title: string,
  subtitle: string,
  rows: FbsSizeTableRow[],
  wantTable: boolean,
): Promise<{ photo?: Uint8Array; caption?: string }> {
  if (!rows.length) return {};
  // Сводка / «по размерам» — всегда фото; иначе тоже, если есть размеры
  const hasSizes = rows.some((r) => Object.keys(r.sizes).length > 0);
  if (!wantTable && !hasSizes) return {};
  try {
    const photo = await renderFbsSizeTablePng({ title, subtitle, rows });
    return { photo, caption: `${title}${subtitle ? ` · ${subtitle}` : ''}` };
  } catch (e) {
    console.error('[agent-fbs-stock] table png', e);
    return {};
  }
}

function textFromSizeRows(
  head: string,
  rows: FbsSizeTableRow[],
  warehouseLabel: string,
): string {
  const lines: string[] = [head];
  if (warehouseLabel) lines.push(`Склад: ${warehouseLabel}`);
  for (const r of rows.slice(0, 12)) {
    const label = r.article || r.title || r.name;
    const sizeBits = Object.entries(r.sizes)
      .sort((a, b) => {
        const na = Number(a[0]);
        const nb = Number(b[0]);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a[0].localeCompare(b[0], 'ru');
      })
      .map(([sz, q]) => `${sz}:${q}`);
    lines.push(
      sizeBits.length
        ? `• ${label}: ${r.total} шт (${sizeBits.join(' · ')})`
        : `• ${label}: ${r.total} шт`,
    );
  }
  const grand = rows.reduce((s, r) => s + r.total, 0);
  lines.push(`ОБЩИЙ ИТОГ: ${grand} шт`);
  return lines.join('\n');
}

/** Сводка остатков по выбранным складам без узкого товара (топ артикулов кабинета). */
async function formatWarehouseOverview(opts: {
  cabinetId: string;
  cabinetName: string;
  warehouseIds: number[] | 'all';
  wantTable?: boolean;
}): Promise<StockReport> {
  const human = cabinetHumanName(opts.cabinetName);
  const wantTable = opts.wantTable !== false; // сводка по умолчанию с фото-таблицей
  const auth = await loadCabinetToken(opts.cabinetId);
  if (!auth) return { text: `${human}: нет WB-токена` };

  let warehouses: Wh[];
  try {
    warehouses = await fetchSellerWarehouses(auth.token);
  } catch (e) {
    return {
      text: `${human}: не смог получить склады (${e instanceof Error ? e.message : e})`,
    };
  }
  if (!warehouses.length) return { text: `${human}: FBS-складов нет` };

  let selected: Wh[];
  if (opts.warehouseIds === 'all') {
    selected = warehouses;
  } else {
    const want = new Set(opts.warehouseIds);
    selected = warehouses.filter((w) => want.has(w.id));
  }
  if (!selected.length) return { text: `${human}: склад не найден` };

  // Больше строк для сводной «как в образце»
  const articles = await loadCabinetArticles(opts.cabinetId, 28);
  if (!articles.length) {
    console.log(
      `[agent-fbs-stock] overview no rnp_articles cabinet=${opts.cabinetId}`,
    );
    return {
      text: `${human}: в базе артикулов нет — напиши модель/цвет, поищу в карточке`,
    };
  }

  const tableRows: FbsSizeTableRow[] = [];
  for (const art of articles) {
    const card = await fetchCardSkus(auth.token, art.nm_id);
    if (!card.skus.length) continue;
    const row = await sizeRowForCard({
      token: auth.token,
      article: card.vendor || art.title,
      name: card.title || art.title || card.vendor,
      sizes: card.sizes.length
        ? card.sizes
        : [{ techSize: '—', skus: card.skus }],
      warehouses: selected,
    });
    if (row) tableRows.push(row);
  }
  tableRows.sort((a, b) => b.total - a.total);

  const whLabel = selected.map((w) => w.name).join(', ');
  console.log(
    `[agent-fbs-stock] overview cabinet=${opts.cabinetName} wh=${whLabel} rows=${tableRows.length}`,
  );

  if (!tableRows.length) {
    return {
      text: `${human} · FBS · ${whLabel}\nПо топ-артикулам пусто. Напиши модель/цвет — проверю точечно`,
    };
  }

  const head = `${human} · FBS сводная`;
  const text = textFromSizeRows(head, tableRows, whLabel) +
    '\n\nСводная таблица — на фото. Нужен другой артикул — напиши модель/цвет';
  const img = await maybeRenderTable(head, whLabel, tableRows, wantTable);
  return { text, photo: img.photo, caption: img.caption };
}

async function formatStocksForCabinet(opts: {
  cabinetId: string;
  cabinetName: string;
  warehouseIds: number[] | 'all';
  productText: string;
  minimal?: boolean;
  wantTable?: boolean;
}): Promise<StockReport> {
  const human = cabinetHumanName(opts.cabinetName);
  const wantTable = Boolean(opts.wantTable) || wantsFbsSizeTable(opts.productText);
  const auth = await loadCabinetToken(opts.cabinetId);
  if (!auth) return { text: `${human}: нет WB-токена` };

  let warehouses: Wh[];
  try {
    warehouses = await fetchSellerWarehouses(auth.token);
  } catch (e) {
    return {
      text: `${human}: не смог получить склады (${e instanceof Error ? e.message : e})`,
    };
  }
  if (!warehouses.length) return { text: `${human}: FBS-складов нет` };

  let selected: Wh[];
  if (opts.warehouseIds === 'all') {
    selected = warehouses;
  } else {
    const want = new Set(opts.warehouseIds);
    selected = warehouses.filter((w) => want.has(w.id));
  }
  if (!selected.length) return { text: `${human}: склад не найден` };

  if (!hasProductQuery(opts.productText)) {
    return await formatWarehouseOverview({
      cabinetId: opts.cabinetId,
      cabinetName: opts.cabinetName,
      warehouseIds: opts.warehouseIds,
      wantTable: true,
    });
  }

  const products = await findProducts(opts.productText, opts.cabinetId);
  if (!products.length) {
    const overview = await formatWarehouseOverview({
      cabinetId: opts.cabinetId,
      cabinetName: opts.cabinetName,
      warehouseIds: opts.warehouseIds,
      wantTable: true,
    });
    if (/артикулов нет|без баркодов/i.test(overview.text)) {
      return { text: antonNoProduct(human, Boolean(opts.minimal)) };
    }
    return {
      text: `${overview.text}\n\nПо запросу «${opts.productText.slice(0, 40)}» точного артикула не нашёл.`,
      photo: overview.photo,
      caption: overview.caption,
    };
  }

  const tableRows: FbsSizeTableRow[] = [];
  const lines: string[] = [antonStocksLead(human, Boolean(opts.minimal))];
  const whLabel = selected.map((w) => w.name).join(', ');

  for (const p of products.slice(0, opts.minimal ? 2 : 4)) {
    const card = await fetchCardSkus(auth.token, p.nm_id);
    if (!card.skus.length) {
      lines.push(
        opts.minimal
          ? `${p.title}: нет баркодов`
          : `• ${p.title}: нет баркодов в карточке`,
      );
      continue;
    }
    const row = await sizeRowForCard({
      token: auth.token,
      article: card.vendor || p.title,
      name: card.title || p.title || card.vendor,
      sizes: card.sizes.length
        ? card.sizes
        : [{ techSize: '—', skus: card.skus }],
      warehouses: selected,
    });
    if (!row) {
      lines.push(`• ${card.vendor || p.title}: 0 шт`);
      continue;
    }
    tableRows.push(row);
    const sizeBits = Object.entries(row.sizes)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ru'))
      .map(([sz, q]) => `${sz}:${q}`);
    const label = row.article || row.name;
    lines.push(
      sizeBits.length
        ? `• ${label}: ${row.total} шт (${sizeBits.join(' · ')})`
        : `• ${label}: ${row.total} шт`,
    );
  }
  if (selected.length > 1) lines.push(`Склады: ${whLabel}`);

  const img = await maybeRenderTable(
    `${human} · FBS по размерам`,
    whLabel,
    tableRows,
    wantTable || tableRows.length > 0,
  );
  if (img.photo) lines.push('', 'Таблица по размерам — на фото');
  return { text: lines.join('\n'), photo: img.photo, caption: img.caption };
}

async function askConfirmCabinet(
  chatId: number,
  tgUserId: number,
  cabinet: { id: string; name: string },
  queryText: string,
  productText: string,
): Promise<FbsStockReply> {
  const human = cabinetHumanName(cabinet.name);
  await savePending(chatId, tgUserId, {
    step: 'await_confirm_cabinet',
    queryText,
    productText,
    cabinetId: cabinet.id,
    cabinetName: cabinet.name,
    guessedFromProduct: true,
    minimal: true,
    wantTable: wantsFbsSizeTable(queryText),
    items: [
      { id: 'yes', name: 'Да' },
      { id: 'no', name: 'Нет' },
    ],
  }, cabinet.id, cabinet.name);

  return {
    handled: true,
    agentKey: 'anton',
    reply: antonConfirmCabinet(human),
    replyMarkup: kbYesNo(),
  };
}

async function askWarehousesReply(
  chatId: number,
  tgUserId: number,
  cabinet: { id: string; name: string },
  queryText: string,
  productText: string,
  pendingId?: string,
  opts?: { minimal?: boolean; wantTable?: boolean },
): Promise<FbsStockReply> {
  const human = cabinetHumanName(cabinet.name);
  const minimal = Boolean(opts?.minimal);
  const wantTable = Boolean(opts?.wantTable) || wantsFbsSizeTable(queryText);
  const auth = await loadCabinetToken(cabinet.id);
  if (!auth) {
    if (pendingId) await cancelPending(pendingId);
    return {
      handled: true,
      agentKey: 'anton',
      reply: `По «${human}» нет рабочего WB-токена.`,
    };
  }

  let warehouses: Wh[];
  try {
    warehouses = await fetchSellerWarehouses(auth.token);
  } catch (e) {
    if (pendingId) await cancelPending(pendingId);
    return {
      handled: true,
      agentKey: 'anton',
      reply: `Не смог прочитать FBS-склады «${human}»: ${
        e instanceof Error ? e.message : e
      }`,
    };
  }

  if (!warehouses.length) {
    if (pendingId) await cancelPending(pendingId);
    return {
      handled: true,
      agentKey: 'anton',
      reply: `В «${human}» нет FBS-складов продавца.`,
    };
  }

  const cleanProduct = hasProductQuery(productText) ? productText.trim() : '';

  // Один склад — сразу сводка/остаток, без лишних вопросов
  if (warehouses.length === 1) {
    let productsPreview: ProductHit[] = [];
    if (cleanProduct) {
      productsPreview = await findProducts(cleanProduct, cabinet.id);
    }
    if (cleanProduct && productsPreview.length) {
      const report = await formatStocksForCabinet({
        cabinetId: cabinet.id,
        cabinetName: cabinet.name,
        warehouseIds: [warehouses[0].id],
        productText: cleanProduct,
        minimal,
        wantTable,
      });
      if (pendingId) await finishPending(pendingId, report.text);
      return reportToReply(report);
    }

    // Нет точного товара — сводка по единственному складу (+ фото-таблица)
    const overview = await formatWarehouseOverview({
      cabinetId: cabinet.id,
      cabinetName: cabinet.name,
      warehouseIds: [warehouses[0].id],
      wantTable: true,
    });
    if (pendingId) await finishPending(pendingId, overview.text);
    return reportToReply(overview);
  }

  const items = warehouses.map((w) => ({ id: String(w.id), name: w.name }));
  const payload: FbsPayload = {
    step: 'await_warehouse',
    queryText,
    productText: cleanProduct,
    cabinetId: cabinet.id,
    cabinetName: cabinet.name,
    warehouses,
    minimal,
    wantTable,
    items,
  };
  if (pendingId) {
    await updatePending(pendingId, {
      status: 'awaiting_selection',
      cabinet_id: cabinet.id,
      cabinet_name: cabinet.name,
      payload,
    });
  } else {
    await savePending(chatId, tgUserId, payload, cabinet.id, cabinet.name);
  }

  return {
    handled: true,
    agentKey: 'anton',
    reply: antonAskWarehouse(human, minimal),
    replyMarkup: kbFromItems(items, { label: 'Все склады' }),
  };
}

async function askCabinetsReply(
  chatId: number,
  tgUserId: number,
  queryText: string,
  productText: string,
  wantTable = false,
): Promise<FbsStockReply> {
  const cabinets = await listCabinets();
  const items = cabinets.map((c) => ({ id: c.id, name: c.name }));
  await savePending(chatId, tgUserId, {
    step: 'await_cabinet',
    queryText,
    productText,
    wantTable: wantTable || wantsFbsSizeTable(queryText),
    items,
  });
  return {
    handled: true,
    agentKey: 'anton',
    reply: antonAskCabinets(),
    replyMarkup: kbFromItems(items, { label: 'Все кабинеты' }),
  };
}

async function resolveStocksAfterWarehouse(opts: {
  pendingId: string;
  payload: FbsPayload;
  warehouseIds: number[] | 'all';
}): Promise<FbsStockReply> {
  const rawProduct = opts.payload.productText || extractProductText(opts.payload.queryText);
  const productText = hasProductQuery(rawProduct) ? rawProduct.trim() : '';
  const wantTable = Boolean(opts.payload.wantTable) ||
    wantsFbsSizeTable(opts.payload.queryText);

  if (opts.payload.allCabinets) {
    const cabs = await listCabinets();
    const chunks: string[] = [];
    const photos: NonNullable<FbsStockReply['photos']> = [];
    for (const cab of cabs) {
      const auth = await loadCabinetToken(cab.id);
      if (!auth) continue;
      let whs: Wh[] = [];
      try {
        whs = await fetchSellerWarehouses(auth.token);
      } catch {
        continue;
      }
      if (!whs.length) continue;
      const ids = opts.warehouseIds === 'all' ? 'all' as const : opts.warehouseIds;
      const report = productText
        ? await formatStocksForCabinet({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: ids === 'all' ? 'all' : ids,
          productText,
          wantTable,
        })
        : await formatWarehouseOverview({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: ids === 'all' ? 'all' : ids,
          wantTable: true,
        });
      chunks.push(report.text);
      if (report.photo) {
        photos.push({
          bytes: report.photo,
          mime: 'image/png',
          filename: `fbs-${cab.name}.png`,
          caption: report.caption || cab.name,
        });
      }
    }
    const text = chunks.join('\n\n') || 'По кабинетам ничего не нашёл.';
    await finishPending(opts.pendingId, text);
    return { handled: true, agentKey: 'anton', reply: text, photos: photos.slice(0, 4) };
  }

  if (!opts.payload.cabinetId || !opts.payload.cabinetName) {
    await cancelPending(opts.pendingId);
    return { handled: true, agentKey: 'anton', reply: 'Сброс — кабинет потерялся. Спроси остаток ещё раз.' };
  }

  // Нет модели — сразу сводка по выбранному складу (+ размеры / фото)
  const report = productText
    ? await formatStocksForCabinet({
      cabinetId: opts.payload.cabinetId,
      cabinetName: opts.payload.cabinetName,
      warehouseIds: opts.warehouseIds,
      productText,
      minimal: opts.payload.minimal,
      wantTable,
    })
    : await formatWarehouseOverview({
      cabinetId: opts.payload.cabinetId,
      cabinetName: opts.payload.cabinetName,
      warehouseIds: opts.warehouseIds,
      wantTable: true,
    });
  await finishPending(opts.pendingId, report.text);
  return reportToReply(report);
}

/** Старт нового FBS-запроса (из тимчата). */
export async function startFbsStockDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<FbsStockReply> {
  const queryText = opts.text.trim();
  const productText = extractProductText(queryText);
  const wantTable = wantsFbsSizeTable(queryText);

  // 1) Кабинет из текста / алиасов — уверенно, без «это он?»
  const resolved = await resolveCabinet(queryText);
  if (resolved.match) {
    return await askWarehousesReply(
      opts.chatId,
      opts.tgUserId,
      resolved.match,
      queryText,
      productText,
      undefined,
      { wantTable },
    );
  }

  // 2) Авто из товара → если неуверен — коротко уточнить кабинет
  if (hasProductQuery(productText)) {
    const auto = await autoCabinetFromProduct(queryText);
    if (auto.match) {
      if (auto.unsure || !auto.products.length || auto.products.length > 1) {
        return await askConfirmCabinet(
          opts.chatId,
          opts.tgUserId,
          auto.match,
          queryText,
          productText,
        );
      }
      // уверенный матч одного артикула — можно сразу, но коротко
      return await askWarehousesReply(
        opts.chatId,
        opts.tgUserId,
        auto.match,
        queryText,
        productText,
        undefined,
        { minimal: true, wantTable },
      );
    }
  }

  return await askCabinetsReply(opts.chatId, opts.tgUserId, queryText, productText, wantTable);
}

async function handleCabinetChoice(opts: {
  pendingId: string;
  payload: FbsPayload;
  chatId: number;
  tgUserId: number;
  choice: { id: string; name: string } | 'all';
}): Promise<FbsStockReply> {
  if (opts.choice === 'all') {
    // По всем кабинетам: с товаром — точечно, без — сводка топ-артикулов
    const raw = opts.payload.productText || extractProductText(opts.payload.queryText);
    const productText = hasProductQuery(raw) ? raw.trim() : '';
    const wantTable = Boolean(opts.payload.wantTable) ||
      wantsFbsSizeTable(opts.payload.queryText);
    const cabs = await listCabinets();
    const chunks: string[] = [];
    const photos: NonNullable<FbsStockReply['photos']> = [];
    for (const cab of cabs) {
      const report = productText
        ? await formatStocksForCabinet({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: 'all',
          productText,
          wantTable,
        })
        : await formatWarehouseOverview({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: 'all',
          wantTable: true,
        });
      chunks.push(report.text);
      if (report.photo) {
        photos.push({
          bytes: report.photo,
          mime: 'image/png',
          filename: `fbs-${cab.name}.png`,
          caption: report.caption || cab.name,
        });
      }
    }
    const text = chunks.join('\n\n') || antonAskProductAllCabs();
    await finishPending(opts.pendingId, text);
    return { handled: true, agentKey: 'anton', reply: text, photos: photos.slice(0, 4) };
  }

  const rawProduct = opts.payload.productText || extractProductText(opts.payload.queryText);
  return await askWarehousesReply(
    opts.chatId,
    opts.tgUserId,
    { id: opts.choice.id, name: opts.choice.name },
    opts.payload.queryText,
    hasProductQuery(rawProduct) ? rawProduct.trim() : '',
    opts.pendingId,
    {
      wantTable: Boolean(opts.payload.wantTable) ||
        wantsFbsSizeTable(opts.payload.queryText),
    },
  );
}

/** Продолжение диалога текстом (кнопка или «элиум» / «WIN WIN»). */
export async function continueFbsStockDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<FbsStockReply> {
  const pending = await getActivePending(opts.chatId);
  if (!pending || pending.agent_key !== 'anton' || pending.action_type !== FBS_STOCK_ACTION) {
    return { handled: false };
  }
  const payload = (pending.payload || {}) as FbsPayload;
  const text = opts.text.trim();

  // Уточнение кабинета: «да» / «нет» — до общего cancel («нет» ≠ отмена диалога)
  if (payload.step === 'await_confirm_cabinet') {
    if (isConfirmText(text) || /^(ага|угу|верно|точно|тот)$/i.test(text.trim())) {
      if (!payload.cabinetId || !payload.cabinetName) {
        await cancelPending(pending.id);
        return { handled: true, agentKey: 'anton', reply: 'Сброс. Спроси остаток ещё раз.' };
      }
      return await askWarehousesReply(
        opts.chatId,
        opts.tgUserId,
        { id: payload.cabinetId, name: payload.cabinetName },
        payload.queryText,
        payload.productText || extractProductText(payload.queryText),
        pending.id,
        { minimal: true },
      );
    }
    if (isNoText(text) || isCancelText(text)) {
      // не тот кабинет → покажем все
      const cabinets = await listCabinets();
      const items = cabinets.map((c) => ({ id: c.id, name: c.name }));
      await updatePending(pending.id, {
        status: 'awaiting_selection',
        payload: {
          ...payload,
          step: 'await_cabinet',
          items,
          guessedFromProduct: false,
        },
      });
      return {
        handled: true,
        agentKey: 'anton',
        reply: antonWrongCabinet(),
        replyMarkup: kbFromItems(items, { label: 'Все кабинеты' }),
      };
    }
    return {
      handled: true,
      agentKey: 'anton',
      reply: antonNeedYesNo(cabinetHumanName(payload.cabinetName || '')),
      replyMarkup: kbYesNo(),
    };
  }

  if (isCancelText(text)) {
    await cancelPending(pending.id);
    return { handled: true, agentKey: 'anton', reply: antonCancel() };
  }

  if (payload.step === 'await_cabinet') {
    const items = payload.items || [];
    let choice = matchItemByText(text, items);
    if (!choice) {
      const resolved = await resolveCabinet(text);
      if (resolved.match) {
        choice = { id: resolved.match.id, name: resolved.match.name };
      }
    }
    if (!choice) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: antonPickCabinetAgain(),
        replyMarkup: kbFromItems(items, { label: 'Все кабинеты' }),
      };
    }
    return await handleCabinetChoice({
      pendingId: pending.id,
      payload,
      chatId: opts.chatId,
      tgUserId: opts.tgUserId,
      choice,
    });
  }

  if (payload.step === 'await_warehouse') {
    const items = payload.items || [];
    // «сводную по размерам» без названия склада → все склады + фото-таблица
    if (wantsFbsSizeTable(text) && !matchItemByText(text, items)) {
      return await resolveStocksAfterWarehouse({
        pendingId: pending.id,
        payload: { ...payload, wantTable: true },
        warehouseIds: 'all',
      });
    }
    const choice = matchItemByText(text, items);
    if (!choice) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: antonPickWarehouseAgain(),
        replyMarkup: kbFromItems(items, { label: 'Все склады' }),
      };
    }
    const warehouseIds = choice === 'all'
      ? 'all' as const
      : [Number(choice.id)];
    return await resolveStocksAfterWarehouse({
      pendingId: pending.id,
      payload: {
        ...payload,
        wantTable: Boolean(payload.wantTable) || wantsFbsSizeTable(text),
      },
      warehouseIds,
    });
  }

  if (payload.step === 'await_product') {
    const productText = extractProductText(text) || text;
    const wantTable = Boolean(payload.wantTable) || wantsFbsSizeTable(text) ||
      wantsFbsSizeTable(payload.queryText);
    if (productText.length < 3) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: antonAskModelColor(),
      };
    }
    if (payload.allCabinets) {
      const cabs = await listCabinets();
      const chunks: string[] = [];
      const photos: NonNullable<FbsStockReply['photos']> = [];
      for (const cab of cabs) {
        const report = await formatStocksForCabinet({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: 'all',
          productText,
          wantTable,
        });
        chunks.push(report.text);
        if (report.photo) {
          photos.push({
            bytes: report.photo,
            mime: 'image/png',
            filename: `fbs-${cab.name}.png`,
            caption: report.caption || cab.name,
          });
        }
      }
      const out = chunks.join('\n\n') || 'Пусто.';
      await finishPending(pending.id, out);
      return { handled: true, agentKey: 'anton', reply: out, photos: photos.slice(0, 4) };
    }
    if (!payload.cabinetId || !payload.cabinetName) {
      await cancelPending(pending.id);
      return { handled: true, agentKey: 'anton', reply: 'Сброс. Спроси остаток FBS ещё раз.' };
    }
    const whs = payload.warehouses || [];
    const report = await formatStocksForCabinet({
      cabinetId: payload.cabinetId,
      cabinetName: payload.cabinetName,
      warehouseIds: whs.length ? whs.map((w) => w.id) : 'all',
      productText,
      minimal: payload.minimal,
      wantTable,
    });
    await finishPending(pending.id, report.text);
    return reportToReply(report);
  }

  return { handled: false };
}

/** Callback с инлайн-кнопок. */
export async function handleFbsStockCallback(opts: {
  chatId: number;
  tgUserId: number;
  data: string;
}): Promise<FbsStockReply> {
  if (!isFbsStockCallback(opts.data)) return { handled: false };
  const pending = await getActivePending(opts.chatId);
  if (!pending || pending.agent_key !== 'anton' || pending.action_type !== FBS_STOCK_ACTION) {
    return { handled: true, agentKey: 'anton', reply: 'Этот выбор уже не актуален. Спроси остаток FBS заново.' };
  }
  const key = opts.data.slice(CALLBACK_PREFIX.length);
  if (key === 'cancel') {
    await cancelPending(pending.id);
    return { handled: true, agentKey: 'anton', reply: antonCancel() };
  }

  const payload = (pending.payload || {}) as FbsPayload;
  const items = payload.items || [];

  if (payload.step === 'await_confirm_cabinet') {
    if (key === 'yes') {
      if (!payload.cabinetId || !payload.cabinetName) {
        await cancelPending(pending.id);
        return { handled: true, agentKey: 'anton', reply: 'Сброс — спроси ещё раз' };
      }
      return await askWarehousesReply(
        opts.chatId,
        opts.tgUserId,
        { id: payload.cabinetId, name: payload.cabinetName },
        payload.queryText,
        payload.productText || extractProductText(payload.queryText),
        pending.id,
        { minimal: true },
      );
    }
    if (key === 'no') {
      const cabinets = await listCabinets();
      const cabItems = cabinets.map((c) => ({ id: c.id, name: c.name }));
      await updatePending(pending.id, {
        status: 'awaiting_selection',
        payload: {
          ...payload,
          step: 'await_cabinet',
          items: cabItems,
          guessedFromProduct: false,
        },
      });
      return {
        handled: true,
        agentKey: 'anton',
        reply: antonWrongCabinet(),
        replyMarkup: kbFromItems(cabItems, { label: 'Все кабинеты' }),
      };
    }
  }

  if (payload.step === 'await_cabinet') {
    const choice = key === 'all'
      ? 'all' as const
      : items[Number(key)];
    if (choice == null || (choice !== 'all' && !choice.id)) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'Кнопка устарела. Выбери кабинет ещё раз.',
        replyMarkup: kbFromItems(items, { label: 'Все кабинеты' }),
      };
    }
    return await handleCabinetChoice({
      pendingId: pending.id,
      payload,
      chatId: opts.chatId,
      tgUserId: opts.tgUserId,
      choice,
    });
  }

  if (payload.step === 'await_warehouse') {
    if (key === 'all') {
      return await resolveStocksAfterWarehouse({
        pendingId: pending.id,
        payload,
        warehouseIds: 'all',
      });
    }
    const item = items[Number(key)];
    if (!item) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'Кнопка устарела. Выбери склад ещё раз.',
        replyMarkup: kbFromItems(items, { label: 'Все склады' }),
      };
    }
    return await resolveStocksAfterWarehouse({
      pendingId: pending.id,
      payload,
      warehouseIds: [Number(item.id)],
    });
  }

  return { handled: true, agentKey: 'anton', reply: antonAskModelColor() };
}

export async function hasActiveFbsStockDialog(chatId: number): Promise<boolean> {
  const pending = await getActivePending(chatId);
  return Boolean(
    pending &&
      pending.agent_key === 'anton' &&
      pending.action_type === FBS_STOCK_ACTION,
  );
}

// re-export helper for actions module typing
export type { FbsPayload };
