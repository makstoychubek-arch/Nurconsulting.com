/**
 * Диалог Сауле: смена/снижение цены WB.
 *
 * 1) «снизь цену» / «цену менять» → какой артикул?
 * 2) «лапша белая» / «фонарь черный» / «укороченный черный» → текущая цена + «на сколько снизить?»
 * 3) «4000» / «1300» → «Хорошо, снижаю» + upload в WB Prices API
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  cancelOtherPending,
  getActivePending,
  isCancelText,
  listCabinets,
  resolveCabinet,
  stripCabinetAliases,
} from './agent-actions.ts';
import { setChatFocus } from './agent-chat-focus.ts';
import { sanitizeWbToken } from './wb-cabinet-tokens.ts';

export const PRICE_CHANGE_ACTION = 'price_change';
export const PRICE_AGENT = 'saule';

const PRICES_API = 'https://discounts-prices-api.wildberries.ru';

export type PriceReply = {
  handled: boolean;
  reply?: string;
};

type PriceGoods = {
  cabinetId: string;
  cabinetName: string;
  nmId: number;
  vendorCode: string;
  price: number;
  discountedPrice: number;
  discountPct: number;
  score: number;
};

type PricePayload = {
  step?: 'await_product' | 'await_amount';
  queryText?: string;
  cabinetId?: string | null;
  cabinetName?: string | null;
  nmId?: number;
  vendorCode?: string;
  title?: string;
  price?: number;
  discountedPrice?: number;
  discountPct?: number;
  candidates?: Array<{
    cabinetId: string;
    cabinetName: string;
    nmId: number;
    vendorCode: string;
    price: number;
    discountedPrice: number;
    discountPct: number;
  }>;
};

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export function wantsPriceChange(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  // явная смена/снижение
  if (
    /(сниз|понизь|пониз|убав|уменьш|сброс).{0,20}цен/i.test(t) ||
    /цен.{0,20}(сниз|понизь|пониз|убав|уменьш|сброс|меня|измени|поменя)/i.test(t) ||
    /(менять|поменять|изменить|поменяй|измени).{0,12}цен/i.test(t) ||
    /цен[ауые].{0,12}(менять|поменять|изменить|поменяй)/i.test(t) ||
    /(поставь|поставь|сделай).{0,12}цен/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function parsePriceDelta(text: string): number | null {
  const t = String(text || '').trim().toLowerCase().replace(/ё/g, 'е');
  // «на 4000», «4000», «4000 руб», «снизь на 1300»
  const m =
    t.match(/(?:^|\s)(?:на\s+)?(\d{3,7})(?:\s*(?:₽|руб\.?|р\.?))?(?:\s|$)/i) ||
    t.match(/^(\d{3,7})$/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/\s/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return null;
  return Math.round(n);
}

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Скоринг vendorCode / названия под фразу владельца. */
export function scorePriceProduct(vendorCode: string, query: string): number {
  const v = norm(vendorCode).replace(/ /g, '');
  const q = norm(stripCabinetAliases(query));
  if (!v || !q) return 0;
  let score = 0;

  if (/лапш/.test(q) && /лапш/.test(v)) score += 6;
  if (/фонар/.test(q) && /фонар/.test(v)) score += 6;
  if (/вырез/.test(q) && /вырез/.test(v)) score += 6;
  if (/блузк/.test(q) && /блуз/.test(v)) score += 2;
  if (/укороч/.test(q) && /укороч/.test(v)) score += 6;
  if (/костюм/.test(q) && /костюм/.test(v)) score += 3;
  if (/пиджак|жакет/.test(q) && /(пиджак|жакет)/.test(v)) score += 4;

  if (/бел/.test(q) && /бел/.test(v)) score += 4;
  if (/(черн|чёрн)/.test(q) && /черн/.test(v)) score += 4;
  if (/беж/.test(q) && /беж/.test(v)) score += 4;
  if (/коричнев|шоколад|мокко/.test(q) && /(коричнев|шоколад|мокко)/.test(v)) score += 4;
  if (/графит|сер(ый|ая)/.test(q) && /(графит|сер)/.test(v)) score += 3;
  if (/бордо|marsala/.test(q) && /бордо|бардо/.test(v)) score += 4;
  if (/син(ий|яя)|электрик|темносин/.test(q) && /(син|электрик)/.test(v)) score += 3;

  // прямой nm
  const nm = q.match(/\b(\d{6,12})\b/);
  if (nm && v.includes(nm[1])) score += 20;

  return score;
}

function discountPct(price: number, discounted: number): number {
  if (!price || price <= 0) return 0;
  const pct = Math.round((1 - discounted / price) * 100);
  return Math.max(0, Math.min(99, pct));
}

async function fetchCabinetGoods(
  cabinetId: string,
  cabinetName: string,
  tokenRaw: string,
  query: string,
): Promise<PriceGoods[]> {
  const token = sanitizeWbToken(tokenRaw);
  if (!token) return [];
  const out: PriceGoods[] = [];
  for (let offset = 0; offset < 800; offset += 100) {
    const url =
      `${PRICES_API}/api/v2/list/goods/filter?limit=100&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: token },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) break;
    const body = await res.json() as {
      data?: { listGoods?: Array<{
        nmID?: number;
        vendorCode?: string;
        sizes?: Array<{ price?: number; discountedPrice?: number }>;
      }> };
    };
    const goods = body?.data?.listGoods || [];
    if (!goods.length) break;
    for (const g of goods) {
      const nmId = Number(g.nmID || 0);
      const vendorCode = String(g.vendorCode || '');
      const score = scorePriceProduct(vendorCode, query);
      if (score < 5 && !/^\d{6,12}$/.test(norm(query).replace(/ /g, ''))) continue;
      const size = (g.sizes || [])[0] || {};
      const price = Number(size.price || 0);
      const discountedPrice = Number(size.discountedPrice || price);
      if (!nmId || !price) continue;
      out.push({
        cabinetId,
        cabinetName,
        nmId,
        vendorCode,
        price,
        discountedPrice,
        discountPct: discountPct(price, discountedPrice),
        score,
      });
    }
    if (goods.length < 100) break;
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

async function findProducts(query: string, preferCabinetId?: string | null): Promise<PriceGoods[]> {
  const cabinets = await listCabinets();
  const db = admin();
  const list = preferCabinetId
    ? cabinets.filter((c) => c.id === preferCabinetId)
    : cabinets;

  const all: PriceGoods[] = [];
  for (const cab of list) {
    const { data } = await db
      .from('cabinets')
      .select('id, name, wb_token')
      .eq('id', cab.id)
      .maybeSingle();
    if (!data?.wb_token) continue;
    try {
      const found = await fetchCabinetGoods(
        String(data.id),
        String(data.name),
        String(data.wb_token),
        query,
      );
      all.push(...found);
    } catch (e) {
      console.error('[price-change] fetch', cab.name, e);
    }
  }

  // прямой nm без скоринга — добрать точечно
  const nmOnly = norm(query).replace(/ /g, '').match(/^(\d{6,12})$/);
  if (nmOnly && !all.length) {
    for (const cab of list) {
      const { data } = await db
        .from('cabinets')
        .select('id, name, wb_token')
        .eq('id', cab.id)
        .maybeSingle();
      if (!data?.wb_token) continue;
      const token = sanitizeWbToken(data.wb_token);
      const res = await fetch(
        `${PRICES_API}/api/v2/list/goods/filter?limit=100&offset=0`,
        { headers: { Authorization: token }, signal: AbortSignal.timeout(20000) },
      );
      if (!res.ok) continue;
      const body = await res.json() as {
        data?: { listGoods?: Array<{ nmID?: number; vendorCode?: string; sizes?: Array<{ price?: number; discountedPrice?: number }> }> };
      };
      for (const g of body?.data?.listGoods || []) {
        if (Number(g.nmID) !== Number(nmOnly[1])) continue;
        const size = (g.sizes || [])[0] || {};
        const price = Number(size.price || 0);
        const discountedPrice = Number(size.discountedPrice || price);
        all.push({
          cabinetId: String(data.id),
          cabinetName: String(data.name),
          nmId: Number(g.nmID),
          vendorCode: String(g.vendorCode || ''),
          price,
          discountedPrice,
          discountPct: discountPct(price, discountedPrice),
          score: 20,
        });
      }
    }
  }

  all.sort((a, b) => b.score - a.score || a.vendorCode.localeCompare(b.vendorCode, 'ru'));
  // top cluster
  if (!all.length) return [];
  const best = all[0].score;
  return all.filter((g) => g.score >= best - 1).slice(0, 8);
}

async function uploadNewPrice(
  tokenRaw: string,
  nmId: number,
  newPrice: number,
  discountPct: number,
): Promise<{ ok: boolean; error?: string; uploadId?: number }> {
  const token = sanitizeWbToken(tokenRaw);
  const res = await fetch(`${PRICES_API}/api/v2/upload/task`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{ nmID: nmId, price: newPrice, discount: discountPct }],
    }),
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `WB HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  try {
    const j = JSON.parse(text) as { data?: { id?: number }; errorText?: string; error?: boolean };
    if (j.error || j.errorText) {
      return { ok: false, error: j.errorText || 'WB error' };
    }
    return { ok: true, uploadId: j.data?.id };
  } catch {
    return { ok: true };
  }
}

function formatMoney(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

function productLabel(g: { vendorCode: string; nmId: number }): string {
  return `${g.vendorCode || 'товар'} · nm ${g.nmId}`;
}

async function createPending(
  chatId: number,
  tgUserId: number,
  payload: PricePayload,
  cabinetId?: string | null,
  cabinetName?: string | null,
): Promise<string> {
  const db = admin();
  await cancelOtherPending(db, chatId);
  const { data, error } = await db
    .from('agent_pending_actions')
    .insert({
      chat_id: chatId,
      agent_key: PRICE_AGENT,
      action_type: PRICE_CHANGE_ACTION,
      status: 'awaiting_selection',
      cabinet_id: cabinetId || null,
      cabinet_name: cabinetName || null,
      payload,
      proposed_by_tg: tgUserId || null,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  await setChatFocus(chatId, PRICE_AGENT, 'price_change', 20);
  return String(data?.id || '');
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

function extractProductHint(text: string): string {
  let t = stripCabinetAliases(text);
  t = t
    .replace(/саул[еэ]\w*/gi, ' ')
    .replace(/карина\w*/gi, ' ')
    .replace(/(сниз|понизь|пониз|убав|уменьш|сброс)\w*/gi, ' ')
    .replace(/(менять|поменять|изменить|поменяй|измени)\w*/gi, ' ')
    .replace(/цен[аыуеойам]*/gi, ' ')
    .replace(/артикул\w*/gi, ' ')
    .replace(/пожалуйста|надо|нужно|давай|можно/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

async function presentProduct(
  chatId: number,
  tgUserId: number,
  pendingId: string | null,
  goods: PriceGoods[],
  queryText: string,
): Promise<PriceReply> {
  if (!goods.length) {
    const reply =
      'Не нашла такой артикул. Напиши модель/цвет — например «лапша белая», «фонарь черный», «укороченный черный» — или nm.';
    if (pendingId) {
      await updatePending(pendingId, {
        payload: { step: 'await_product', queryText },
      });
    } else {
      await createPending(chatId, tgUserId, { step: 'await_product', queryText });
    }
    await setChatFocus(chatId, PRICE_AGENT, 'price_change', 20);
    return { handled: true, reply };
  }

  if (goods.length > 1 && goods[0].score === goods[1].score) {
    const lines = goods.slice(0, 6).map((g, i) =>
      `${i + 1}. ${g.cabinetName} · ${g.vendorCode} · ${formatMoney(g.price)} (со скидкой ${formatMoney(g.discountedPrice)})`
    );
    const payload: PricePayload = {
      step: 'await_product',
      queryText,
      candidates: goods.slice(0, 6).map((g) => ({
        cabinetId: g.cabinetId,
        cabinetName: g.cabinetName,
        nmId: g.nmId,
        vendorCode: g.vendorCode,
        price: g.price,
        discountedPrice: g.discountedPrice,
        discountPct: g.discountPct,
      })),
    };
    if (pendingId) {
      await updatePending(pendingId, {
        status: 'awaiting_selection',
        payload,
      });
    } else {
      await createPending(chatId, tgUserId, payload);
    }
    await setChatFocus(chatId, PRICE_AGENT, 'price_change', 20);
    return {
      handled: true,
      reply: 'Несколько вариантов — напиши номер или точнее модель:\n' + lines.join('\n'),
    };
  }

  const g = goods[0];
  const payload: PricePayload = {
    step: 'await_amount',
    queryText,
    cabinetId: g.cabinetId,
    cabinetName: g.cabinetName,
    nmId: g.nmId,
    vendorCode: g.vendorCode,
    title: g.vendorCode,
    price: g.price,
    discountedPrice: g.discountedPrice,
    discountPct: g.discountPct,
  };
  if (pendingId) {
    await updatePending(pendingId, {
      status: 'awaiting_selection',
      cabinet_id: g.cabinetId,
      cabinet_name: g.cabinetName,
      payload,
    });
  } else {
    await createPending(chatId, tgUserId, payload, g.cabinetId, g.cabinetName);
  }
  await setChatFocus(chatId, PRICE_AGENT, 'price_change', 20);
  return {
    handled: true,
    reply: [
      `${g.cabinetName} · ${productLabel(g)}`,
      `Сейчас: ${formatMoney(g.price)} (со скидкой ${formatMoney(g.discountedPrice)})`,
      'На сколько снизить базовую цену? Напиши число — например 4000 или 1300.',
    ].join('\n'),
  };
}

/** Старт или продолжение по явному «снизь цену…». */
export async function startPriceChangeDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<PriceReply> {
  const text = String(opts.text || '').trim();
  if (!wantsPriceChange(text) && !await hasActivePriceDialog(opts.chatId)) {
    return { handled: false };
  }

  const existing = await getActivePending(opts.chatId);
  if (
    existing &&
    existing.agent_key === PRICE_AGENT &&
    existing.action_type === PRICE_CHANGE_ACTION
  ) {
    return continuePriceChangeDialog(opts);
  }

  const cab = await resolveCabinet(text);
  const hint = extractProductHint(text);
  await setChatFocus(opts.chatId, PRICE_AGENT, 'price_change', 20);

  if (!hint || hint.length < 3) {
    await createPending(
      opts.chatId,
      opts.tgUserId,
      {
        step: 'await_product',
        queryText: text,
        cabinetId: cab.match?.id || null,
        cabinetName: cab.match?.name || null,
      },
      cab.match?.id,
      cab.match?.name,
    );
    return {
      handled: true,
      reply:
        'Какой артикул снижаем? Напиши модель — «лапша белая», «фонарь черный», «укороченный черный» или nm.',
    };
  }

  const goods = await findProducts(hint, cab.match?.id || null);
  return presentProduct(opts.chatId, opts.tgUserId, null, goods, hint);
}

export async function continuePriceChangeDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<PriceReply> {
  const pending = await getActivePending(opts.chatId);
  if (
    !pending ||
    pending.agent_key !== PRICE_AGENT ||
    pending.action_type !== PRICE_CHANGE_ACTION
  ) {
    return { handled: false };
  }

  const text = String(opts.text || '').trim();
  const payload = (pending.payload || {}) as PricePayload;
  await setChatFocus(opts.chatId, PRICE_AGENT, 'price_change', 20);

  if (isCancelText(text)) {
    await cancelPending(pending.id);
    return { handled: true, reply: 'Ок, отменила. Цену не трогала.' };
  }

  // выбор из списка кандидатов
  if (payload.candidates?.length && payload.step === 'await_product') {
    const num = Number(text.replace(/[^\d]/g, ''));
    if (Number.isFinite(num) && num >= 1 && num <= payload.candidates.length) {
      const c = payload.candidates[num - 1];
      return presentProduct(opts.chatId, opts.tgUserId, pending.id, [{
        ...c,
        score: 10,
      }], payload.queryText || text);
    }
  }

  if (payload.step === 'await_amount') {
    const delta = parsePriceDelta(text);
    if (delta == null) {
      return {
        handled: true,
        reply: 'Нужна сумма снижения числом — например 4000 или 1300. Или «отмена».',
      };
    }
    // applyDelta finishes pending; fix focus chat id
    const price = Number(payload.price || 0);
    const nmId = Number(payload.nmId || 0);
    const cabinetId = String(payload.cabinetId || '');
    if (!price || !nmId || !cabinetId) {
      await cancelPending(pending.id);
      return { handled: true, reply: 'Сбился контекст. Напиши снова: «снизь цену …».' };
    }
    const newPrice = Math.round(price - delta);
    if (newPrice < 100) {
      return {
        handled: true,
        reply:
          `С ${formatMoney(price)} снять ${formatMoney(delta)} нельзя — выйдет меньше 100 ₽. Напиши меньшую сумму.`,
      };
    }
    const db = admin();
    const { data: cab } = await db
      .from('cabinets')
      .select('wb_token, name')
      .eq('id', cabinetId)
      .maybeSingle();
    if (!cab?.wb_token) {
      return { handled: true, reply: 'Нет токена кабинета — цену не могу отправить на WB.' };
    }
    const disc = Number(payload.discountPct || 0);
    const uploaded = await uploadNewPrice(String(cab.wb_token), nmId, newPrice, disc);
    if (!uploaded.ok) {
      return {
        handled: true,
        reply: `Не принял WB: ${uploaded.error || 'ошибка'}. Попробуй ещё раз числом или «отмена».`,
      };
    }
    const newDisc = Math.round(newPrice * (1 - disc / 100));
    const result = [
      'Хорошо, снижаю.',
      `${payload.cabinetName || cab.name} · ${payload.vendorCode || nmId}`,
      `${formatMoney(price)} → ${formatMoney(newPrice)}` +
        (disc ? ` (со скидкой ~${formatMoney(newDisc)})` : ''),
      uploaded.uploadId ? `Задача WB #${uploaded.uploadId}` : 'Отправила в WB.',
    ].join('\n');
    await finishPending(pending.id, result);
    await setChatFocus(opts.chatId, PRICE_AGENT, 'price_done', 8);
    return { handled: true, reply: result };
  }

  // await_product — фраза как товар
  const hint = extractProductHint(text) || text;
  const goods = await findProducts(hint, payload.cabinetId || null);
  return presentProduct(opts.chatId, opts.tgUserId, pending.id, goods, hint);
}

export async function hasActivePriceDialog(chatId: number): Promise<boolean> {
  const pending = await getActivePending(chatId);
  return Boolean(
    pending &&
      pending.agent_key === PRICE_AGENT &&
      pending.action_type === PRICE_CHANGE_ACTION,
  );
}
