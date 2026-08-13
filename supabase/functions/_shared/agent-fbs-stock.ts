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
  listCabinets,
  normName,
  parseSelection,
  resolveCabinet,
} from './agent-actions.ts';
import {
  CABINET_TOKEN_SELECT,
  isValidWbToken,
  pickCabinetToken,
} from './wb-cabinet-tokens.ts';

export const FBS_STOCK_ACTION = 'fbs_stock';
const CALLBACK_PREFIX = 'afs:';

export type FbsStockReply = {
  handled: boolean;
  agentKey?: 'anton';
  reply?: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  clearMarkup?: boolean;
};

type Wh = { id: number; name: string };
type ProductHit = { nm_id: number; title: string; cabinet_id: string; score: number };
type FbsPayload = {
  step: 'await_cabinet' | 'await_warehouse' | 'await_product';
  queryText: string;
  productText?: string;
  cabinetId?: string;
  cabinetName?: string;
  allCabinets?: boolean;
  warehouses?: Wh[];
  items?: Array<{ id: string; name: string }>;
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export function wantsFbsStock(text: string): boolean {
  return /(фбс|fbs)/i.test(text) &&
    /(остат|осталось|сколько|склад|налич|есть\s+ли)/i.test(text);
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
  return text
    .replace(/@\w+/g, ' ')
    .replace(/(^|[\s,.:;!?])(антон|anton|логист\w*)(?=$|[\s,.:;!?])/gi, ' ')
    .replace(/(^|[\s,.:;!?])(фбс|fbs)(?=$|[\s,.:;!?])/gi, ' ')
    .replace(
      /(^|[\s,.:;!?])(остат\w*|осталось|сколько|налич\w*|склад\w*|кабинет\w*|слыш\w*|дай|скинь|покажи|нужен|нужно|есть)(?=$|[\s,.:;!?])/gi,
      ' ',
    )
    .replace(/(^|[\s,.:;!?])по(?=$|[\s,.:;!?])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
): Promise<{ match?: { id: string; name: string }; products: ProductHit[] }> {
  const products = await findProducts(text);
  if (!products.length) return { products: [] };
  const byCab = new Map<string, { score: number; hits: ProductHit[] }>();
  for (const p of products) {
    const cur = byCab.get(p.cabinet_id) || { score: 0, hits: [] };
    cur.score += p.score;
    cur.hits.push(p);
    byCab.set(p.cabinet_id, cur);
  }
  const ranked = [...byCab.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return { products };
  const [topId, top] = ranked[0];
  const second = ranked[1]?.[1].score ?? 0;
  if (ranked.length > 1 && top.score < second + 3) {
    return { products };
  }
  const cabs = await listCabinets();
  const cab = cabs.find((c) => c.id === topId);
  if (!cab) return { products };
  return { match: cab, products: top.hits };
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
): Promise<{ vendor: string; skus: string[]; sizes: Array<{ techSize: string; skus: string[] }> }> {
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
  if (!res.ok) return { vendor: '', skus: [], sizes: [] };
  const data = await res.json().catch(() => ({}));
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const card = cards.find((c: Record<string, unknown>) =>
    Number(c.nmID || c.nmId) === nmId
  );
  if (!card) return { vendor: '', skus: [], sizes: [] };
  const sizes: Array<{ techSize: string; skus: string[] }> = [];
  const skus: string[] = [];
  for (const s of card.sizes || []) {
    const rowSkus = (s.skus || []).map(String);
    sizes.push({ techSize: String(s.techSize || s.wbSize || ''), skus: rowSkus });
    skus.push(...rowSkus);
  }
  return { vendor: String(card.vendorCode || ''), skus: [...new Set(skus)], sizes };
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

async function formatStocksForCabinet(opts: {
  cabinetId: string;
  cabinetName: string;
  warehouseIds: number[] | 'all';
  productText: string;
}): Promise<string> {
  const auth = await loadCabinetToken(opts.cabinetId);
  if (!auth) return `${opts.cabinetName}: нет WB-токена`;

  let warehouses: Wh[];
  try {
    warehouses = await fetchSellerWarehouses(auth.token);
  } catch (e) {
    return `${opts.cabinetName}: не смог получить склады (${e instanceof Error ? e.message : e})`;
  }
  if (!warehouses.length) return `${opts.cabinetName}: FBS-складов нет`;

  let selected: Wh[];
  if (opts.warehouseIds === 'all') {
    selected = warehouses;
  } else {
    const want = new Set(opts.warehouseIds);
    selected = warehouses.filter((w) => want.has(w.id));
  }
  if (!selected.length) return `${opts.cabinetName}: склад не найден`;

  const products = await findProducts(opts.productText, opts.cabinetId);
  if (!products.length) {
    return `${opts.cabinetName}: не понял товар. Напиши модель/цвет, например «укороченный костюм черный»`;
  }

  const lines: string[] = [`${opts.cabinetName} · FBS`];
  for (const p of products.slice(0, 3)) {
    const card = await fetchCardSkus(auth.token, p.nm_id);
    if (!card.skus.length) {
      lines.push(`• ${p.title}: нет баркодов в карточке`);
      continue;
    }
    let total = 0;
    const byWh: string[] = [];
    for (const wh of selected) {
      const stocks = await fetchWarehouseStocks(auth.token, wh.id, card.skus);
      let qty = 0;
      for (const v of stocks.values()) qty += v;
      total += qty;
      if (selected.length > 1) byWh.push(`  – ${wh.name}: ${qty}`);
    }
    const title = card.vendor || p.title;
    if (selected.length === 1) {
      lines.push(`• ${title}: ${total} шт · склад «${selected[0].name}»`);
    } else {
      lines.push(`• ${title}: ${total} шт`);
      lines.push(...byWh);
    }
  }
  return lines.join('\n');
}

async function askWarehousesReply(
  chatId: number,
  tgUserId: number,
  cabinet: { id: string; name: string },
  queryText: string,
  productText: string,
  pendingId?: string,
): Promise<FbsStockReply> {
  const auth = await loadCabinetToken(cabinet.id);
  if (!auth) {
    if (pendingId) await cancelPending(pendingId);
    return {
      handled: true,
      agentKey: 'anton',
      reply: `По «${cabinet.name}» нет рабочего WB-токена.`,
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
      reply: `Не смог прочитать FBS-склады «${cabinet.name}»: ${
        e instanceof Error ? e.message : e
      }`,
    };
  }

  if (!warehouses.length) {
    if (pendingId) await cancelPending(pendingId);
    return {
      handled: true,
      agentKey: 'anton',
      reply: `В «${cabinet.name}» нет FBS-складов продавца.`,
    };
  }

  // Один склад — сразу остаток, без лишних вопросов
  if (warehouses.length === 1) {
    if (!productText || productText.length < 3) {
      const payload: FbsPayload = {
        step: 'await_product',
        queryText,
        productText: '',
        cabinetId: cabinet.id,
        cabinetName: cabinet.name,
        warehouses,
        items: [],
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
        reply: `Кабинет «${cabinet.name}», склад один — «${warehouses[0].name}».\nПо какому товару остаток?`,
      };
    }

    const text = await formatStocksForCabinet({
      cabinetId: cabinet.id,
      cabinetName: cabinet.name,
      warehouseIds: [warehouses[0].id],
      productText,
    });
    if (pendingId) await finishPending(pendingId, text);
    else {
      // одноразовый ответ без pending
    }
    return { handled: true, agentKey: 'anton', reply: text };
  }

  const items = warehouses.map((w) => ({ id: String(w.id), name: w.name }));
  const payload: FbsPayload = {
    step: 'await_warehouse',
    queryText,
    productText,
    cabinetId: cabinet.id,
    cabinetName: cabinet.name,
    warehouses,
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
    reply: `Кабинет «${cabinet.name}». Какой склад FBS?`,
    replyMarkup: kbFromItems(items, { label: 'Все склады' }),
  };
}

async function askCabinetsReply(
  chatId: number,
  tgUserId: number,
  queryText: string,
  productText: string,
): Promise<FbsStockReply> {
  const cabinets = await listCabinets();
  const items = cabinets.map((c) => ({ id: c.id, name: c.name }));
  await savePending(chatId, tgUserId, {
    step: 'await_cabinet',
    queryText,
    productText,
    items,
  });
  return {
    handled: true,
    agentKey: 'anton',
    reply: 'По какому кабинету остаток FBS?',
    replyMarkup: kbFromItems(items, { label: 'Все кабинеты' }),
  };
}

async function resolveStocksAfterWarehouse(opts: {
  pendingId: string;
  payload: FbsPayload;
  warehouseIds: number[] | 'all';
}): Promise<FbsStockReply> {
  const productText = opts.payload.productText || extractProductText(opts.payload.queryText);
  if (!productText || productText.length < 3) {
    await updatePending(opts.pendingId, {
      status: 'awaiting_selection',
      payload: {
        ...opts.payload,
        step: 'await_product',
        warehouses: opts.payload.warehouses,
      },
    });
    return {
      handled: true,
      agentKey: 'anton',
      reply: 'Ок. По какому товару остаток? Напиши модель/цвет или артикул.',
    };
  }

  if (opts.payload.allCabinets) {
    const cabs = await listCabinets();
    const chunks: string[] = [];
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
      // для «всех кабинетов» после выбора склада одного кабинета не бывает —
      // здесь warehouseIds обычно 'all'
      chunks.push(
        await formatStocksForCabinet({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: ids === 'all' ? 'all' : ids,
          productText,
        }),
      );
    }
    const text = chunks.join('\n\n') || 'По кабинетам ничего не нашёл.';
    await finishPending(opts.pendingId, text);
    return { handled: true, agentKey: 'anton', reply: text };
  }

  if (!opts.payload.cabinetId || !opts.payload.cabinetName) {
    await cancelPending(opts.pendingId);
    return { handled: true, agentKey: 'anton', reply: 'Сброс — кабинет потерялся. Спроси остаток ещё раз.' };
  }

  const text = await formatStocksForCabinet({
    cabinetId: opts.payload.cabinetId,
    cabinetName: opts.payload.cabinetName,
    warehouseIds: opts.warehouseIds,
    productText,
  });
  await finishPending(opts.pendingId, text);
  return { handled: true, agentKey: 'anton', reply: text };
}

/** Старт нового FBS-запроса (из тимчата). */
export async function startFbsStockDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<FbsStockReply> {
  const queryText = opts.text.trim();
  const productText = extractProductText(queryText);

  // 1) Кабинет из текста / алиасов
  const resolved = await resolveCabinet(queryText);
  let cabinet = resolved.match;

  // 2) Авто из товара (укороченный костюм → Zevina 1)
  if (!cabinet && productText.length >= 3) {
    const auto = await autoCabinetFromProduct(queryText);
    cabinet = auto.match;
  }

  if (!cabinet) {
    // неоднозначно или не указан
    return await askCabinetsReply(opts.chatId, opts.tgUserId, queryText, productText);
  }

  return await askWarehousesReply(
    opts.chatId,
    opts.tgUserId,
    cabinet,
    queryText,
    productText,
  );
}

async function handleCabinetChoice(opts: {
  pendingId: string;
  payload: FbsPayload;
  chatId: number;
  tgUserId: number;
  choice: { id: string; name: string } | 'all';
}): Promise<FbsStockReply> {
  if (opts.choice === 'all') {
    // По всем кабинетам сразу нужны склады каждого — спрашиваем товар если нет, иначе агрегат по всем складам
    const productText = opts.payload.productText || extractProductText(opts.payload.queryText);
    if (!productText || productText.length < 3) {
      await updatePending(opts.pendingId, {
        payload: {
          ...opts.payload,
          step: 'await_product',
          allCabinets: true,
          items: [],
        },
        cabinet_name: 'Все кабинеты',
      });
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'Ок, все кабинеты. По какому товару остаток FBS?',
      };
    }
    const cabs = await listCabinets();
    const chunks: string[] = [];
    for (const cab of cabs) {
      chunks.push(
        await formatStocksForCabinet({
          cabinetId: cab.id,
          cabinetName: cab.name,
          warehouseIds: 'all',
          productText,
        }),
      );
    }
    const text = chunks.join('\n\n') || 'Пусто.';
    await finishPending(opts.pendingId, text);
    return { handled: true, agentKey: 'anton', reply: text };
  }

  return await askWarehousesReply(
    opts.chatId,
    opts.tgUserId,
    { id: opts.choice.id, name: opts.choice.name },
    opts.payload.queryText,
    opts.payload.productText || extractProductText(opts.payload.queryText),
    opts.pendingId,
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

  if (isCancelText(text)) {
    await cancelPending(pending.id);
    return { handled: true, agentKey: 'anton', reply: 'Ок, отменил запрос по FBS.' };
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
        reply: 'Не понял кабинет. Жми кнопку или напиши: Baza / Elium / SAAI / Zevina 1…',
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
    const choice = matchItemByText(text, items);
    if (!choice) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'Какой склад? Жми кнопку или напиши название.',
        replyMarkup: kbFromItems(items, { label: 'Все склады' }),
      };
    }
    const warehouseIds = choice === 'all'
      ? 'all' as const
      : [Number(choice.id)];
    return await resolveStocksAfterWarehouse({
      pendingId: pending.id,
      payload,
      warehouseIds,
    });
  }

  if (payload.step === 'await_product') {
    const productText = extractProductText(text) || text;
    if (productText.length < 3) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'Напиши товар коротко: модель и цвет.',
      };
    }
    if (payload.allCabinets) {
      const cabs = await listCabinets();
      const chunks: string[] = [];
      for (const cab of cabs) {
        chunks.push(
          await formatStocksForCabinet({
            cabinetId: cab.id,
            cabinetName: cab.name,
            warehouseIds: 'all',
            productText,
          }),
        );
      }
      const out = chunks.join('\n\n') || 'Пусто.';
      await finishPending(pending.id, out);
      return { handled: true, agentKey: 'anton', reply: out };
    }
    if (!payload.cabinetId || !payload.cabinetName) {
      await cancelPending(pending.id);
      return { handled: true, agentKey: 'anton', reply: 'Сброс. Спроси остаток FBS ещё раз.' };
    }
    const whs = payload.warehouses || [];
    const textOut = await formatStocksForCabinet({
      cabinetId: payload.cabinetId,
      cabinetName: payload.cabinetName,
      warehouseIds: whs.length ? whs.map((w) => w.id) : 'all',
      productText,
    });
    await finishPending(pending.id, textOut);
    return { handled: true, agentKey: 'anton', reply: textOut };
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
    return { handled: true, agentKey: 'anton', reply: 'Ок, отменил.' };
  }

  const payload = (pending.payload || {}) as FbsPayload;
  const items = payload.items || [];

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

  return { handled: true, agentKey: 'anton', reply: 'Жду название товара текстом.' };
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
