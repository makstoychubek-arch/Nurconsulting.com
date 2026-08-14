/**
 * Диалог Сауле: смена цены WB (минимально).
 *
 * 1) артикул → «до 6000 · после 3360 — до/после + цена»
 * 2) «после 3000» / «до 5000» → «сохранила»
 */

import { getAdminClient } from './supabase-admin.ts';
import {
  cancelOtherPending,
  getActivePending,
  isCancelText,
  resolveCabinet,
  stripCabinetAliases,
} from './agent-actions.ts';
import { setChatFocus } from './agent-chat-focus.ts';
import {
  findCatalogProducts,
  scoreProductMatch,
} from './agent-product-catalog.ts';
import { sanitizeWbToken } from './wb-cabinet-tokens.ts';
import {
  sauleAmbiguousProducts,
  sauleAskProduct,
  saulePriceAsk,
  saulePriceSaved,
} from './agent-voice.ts';

export const PRICE_CHANGE_ACTION = 'price_change';
export const PRICE_AGENT = 'saule';

const PRICES_API = 'https://discounts-prices-api.wildberries.ru';

/** re-export для тестов / совместимости */
export { scoreProductMatch as scorePriceProduct };

export type PriceReply = {
  handled: boolean;
  reply?: string;
};

export type PriceEditTarget = {
  which: 'before' | 'after';
  value: number;
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
  return getAdminClient();
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
  const m =
    t.match(/(?:^|\s)(?:на\s+)?(\d{3,7})(?:\s*(?:₽|руб\.?|р\.?))?(?:\s|$)/i) ||
    t.match(/^(\d{3,7})$/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/\s/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 5_000_000) return null;
  return Math.round(n);
}

/** «после 3000» / «до скидки 5000» / «после скидки 2800». */
export function parsePriceEdit(text: string): PriceEditTarget | null {
  const t = String(text || '').trim().toLowerCase().replace(/ё/g, 'е');
  const after = t.match(
    /(?:^|\s)(после(?:\s+скидк[аиу])?)\s+(\d{3,7})(?:\s*(?:₽|руб\.?|р\.?))?(?:\s|$)/i,
  );
  if (after) {
    const value = Number(after[2]);
    if (Number.isFinite(value) && value >= 100) return { which: 'after', value: Math.round(value) };
  }
  const before = t.match(
    /(?:^|\s)(до(?:\s+скидк[аиу])?)\s+(\d{3,7})(?:\s*(?:₽|руб\.?|р\.?))?(?:\s|$)/i,
  );
  if (before) {
    const value = Number(before[2]);
    if (Number.isFinite(value) && value >= 100) return { which: 'before', value: Math.round(value) };
  }
  // «после скидки» и число отдельно в той же фразе
  const whichOnly = t.match(/(?:^|\s)(после|до)(?:\s+скидк[аиу])?(?:\s|$)/i);
  const num = parsePriceDelta(t);
  if (whichOnly && num != null && num >= 100) {
    const w = whichOnly[1].startsWith('после') ? 'after' : 'before';
    return { which: w, value: num };
  }
  return null;
}

/** Во что отправить на WB: price + discount%. */
export function resolveUploadPrices(
  currentPrice: number,
  currentDiscountPct: number,
  edit: PriceEditTarget,
): { price: number; discountPct: number; after: number } | null {
  if (edit.which === 'before') {
    const price = Math.round(edit.value);
    if (price < 100) return null;
    const discountPct = Math.max(0, Math.min(99, Math.round(currentDiscountPct)));
    const after = Math.round(price * (1 - discountPct / 100));
    return { price, discountPct, after };
  }
  // после скидки
  const after = Math.round(edit.value);
  if (after < 100) return null;
  const base = Math.round(currentPrice);
  if (after >= base) {
    return { price: after, discountPct: 0, after };
  }
  const discountPct = Math.max(1, Math.min(99, Math.round((1 - after / base) * 100)));
  // подогнать after под выбранный %
  const realized = Math.round(base * (1 - discountPct / 100));
  return { price: base, discountPct, after: realized };
}

async function findProducts(query: string, preferCabinetId?: string | null): Promise<PriceGoods[]> {
  const hits = await findCatalogProducts(query, {
    cabinetId: preferCabinetId,
    sources: ['wb_prices'],
    minScore: 4,
    max: 8,
  });
  return hits.map((h) => ({
    cabinetId: h.cabinetId,
    cabinetName: h.cabinetName,
    nmId: h.nmId,
    vendorCode: h.vendorCode || h.title,
    price: Number(h.price || 0),
    discountedPrice: Number(h.discountedPrice || h.price || 0),
    discountPct: Number(h.discountPct || 0),
    score: h.score,
  })).filter((g) => g.price > 0);
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
  // \w* не ест кириллические окончания
  t = t
    .replace(/саул[еэ][а-яё]*/gi, ' ')
    .replace(/карин[аеуыой][а-яё]*/gi, ' ')
    .replace(/(сниз|понизь|пониз|убав|уменьш|сброс)[а-яё]*/gi, ' ')
    .replace(/(менять|поменять|изменить|поменяй|измени)[а-яё]*/gi, ' ')
    .replace(/цен[аыуеойам]*/gi, ' ')
    .replace(/артикул[а-яё]*/gi, ' ')
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
    const reply = 'Не нашла. Модель/цвет или nm — или «отмена».';
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
      `${i + 1}. ${g.cabinetName} · ${g.vendorCode} · до ${formatMoney(g.price)} · после ${formatMoney(g.discountedPrice)}`
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
      reply: sauleAmbiguousProducts(lines),
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
    reply: saulePriceAsk(
      g.cabinetName,
      g.vendorCode,
      formatMoney(g.price),
      formatMoney(g.discountedPrice),
    ),
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
      reply: sauleAskProduct(),
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
    return { handled: true, reply: 'отмена' };
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
    const edit = parsePriceEdit(text);
    if (!edit) {
      if (looksLikeProductQuery(text) && !/(?:^|[\s,.:;!?/\\|])(до|после)(?=$|[\s,.:;!?/\\|])/i.test(text)) {
        const cab = await resolveCabinet(text);
        const hint = extractProductHint(text) || text;
        const goods = await findProducts(hint, cab.match?.id || null);
        return presentProduct(opts.chatId, opts.tgUserId, pending.id, goods, hint);
      }
      return {
        handled: true,
        reply: 'напиши: «после 3000» или «до 5000»',
      };
    }

    const price = Number(payload.price || 0);
    const nmId = Number(payload.nmId || 0);
    const cabinetId = String(payload.cabinetId || '');
    const discNow = Number(payload.discountPct || 0);
    if (!price || !nmId || !cabinetId) {
      await cancelPending(pending.id);
      return { handled: true, reply: 'сбился контекст — напиши снова артикул' };
    }

    const upload = resolveUploadPrices(price, discNow, edit);
    if (!upload) {
      return { handled: true, reply: 'цена слишком маленькая' };
    }

    const db = admin();
    const { data: cab } = await db
      .from('cabinets')
      .select('wb_token, name')
      .eq('id', cabinetId)
      .maybeSingle();
    if (!cab?.wb_token) {
      return { handled: true, reply: 'нет токена кабинета' };
    }

    const uploaded = await uploadNewPrice(
      String(cab.wb_token),
      nmId,
      upload.price,
      upload.discountPct,
    );
    if (!uploaded.ok) {
      return {
        handled: true,
        reply: `WB не принял: ${(uploaded.error || '').slice(0, 80)}`,
      };
    }

    const label = edit.which === 'after' ? 'после' : 'до';
    const result = saulePriceSaved(
      label,
      formatMoney(edit.which === 'after' ? upload.after : upload.price),
    );
    await finishPending(pending.id, result);
    await setChatFocus(opts.chatId, PRICE_AGENT, 'price_done', 8);
    return { handled: true, reply: result };
  }

  // await_product — фраза как товар
  const cab = await resolveCabinet(text);
  const hint = extractProductHint(text) || text;
  const prefer = cab.match?.id || null;
  const goods = await findProducts(hint, prefer);
  return presentProduct(opts.chatId, opts.tgUserId, pending.id, goods, hint);
}

function looksLikeProductQuery(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (parsePriceEdit(t)) return false;
  if (parsePriceDelta(t) != null && /^\s*(на\s+)?\d/.test(t) && t.length < 20) {
    return false;
  }
  return (
    /(жилет|лапш|фонар|вырез|укороч|костюм|пиджак|бомбер|кимоно|плать|рубашк|блузк|арт|nm\s*\d|\d{6,12}|бел|черн|беж|син|борд|шоколад|графит|элиум|база|зевин|saai)/i
      .test(t)
  );
}

export async function hasActivePriceDialog(chatId: number): Promise<boolean> {
  const pending = await getActivePending(chatId);
  return Boolean(
    pending &&
      pending.agent_key === PRICE_AGENT &&
      pending.action_type === PRICE_CHANGE_ACTION,
  );
}
