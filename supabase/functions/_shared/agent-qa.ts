/**
 * Умные ответы в тимчате (детерминированно, без CRM-пути клиентов).
 * Примеры:
 *  - «Алина, видишь таблицу по выкупам на сегодня?»
 *  - «дай главное фото фонаря»
 *  - «Антон, сколько остаток кабинет база блузки белой фонаря»
 */

import { resolveCabinet, listCabinets } from './agent-actions.ts';
import { getAdminClient } from './supabase-admin.ts';
import {
  fetchSheetPlan,
  listAllProductChoices,
  matchOfferFromText,
  resolveProductChoice,
  type SheetPlanOffer,
} from './alina-sheet-plan.ts';
import { alinaSelfbuyStatsText } from './alina-selfbuy.ts';
import { fetchWbMainPhoto } from './alina-wb-photo.ts';
import { detectNamedAgents, detectMentionedAgents } from './agent-team.ts';
import { wantsFbsStock } from './agent-fbs-stock.ts';
import { alinaAskProduct, alinaSeesSheet, antonWbStockLead, pick } from './agent-voice.ts';
import { findCatalogProducts } from './agent-product-catalog.ts';
import {
  analyzeDirectCompetitors,
  wantsCompetitorAnalysis,
} from './agent-competitors.ts';
import { detectWbRoleOp, runWbRoleOp } from './agent-wb-role-ops.ts';
import {
  getChatFocus,
  rememberLastProduct,
  type LastProductFocus,
} from './agent-chat-focus.ts';
import { filterStopTokens } from './agent-ru-text.ts';
import { wantsPriceChange } from './agent-price-change.ts';

function alinaPickModel(lines: string[]): string {
  return [alinaAskProduct(), ...lines].join('\n');
}

function alinaPhotoOk(name: string, extra?: string): string {
  const base = pick([
    `Главное фото «${name}»`,
    `Вот главное с WB: «${name}»`,
    `Скинула «${name}»`,
    `Фото карточки «${name}»`,
  ]);
  return extra ? `${base} (${extra})` : base;
}

function alinaPhotoMiss(name: string): string {
  return pick([
    `Не вытащила фото с WB по «${name}»`,
    `По «${name}» фото не нашла`,
    `Пусто по фото «${name}» — другой nm/название?`,
  ]);
}

export type TeamQaResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  photos?: Array<{
    url?: string;
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  }>;
  /** Нужны chatId/userId — роутер сам стартует FBS-диалог */
  deferFbsStock?: boolean;
  /** Снимок для follow-up «сводная» */
  summarySnapshot?: {
    title: string;
    subtitle?: string;
    columns: string[];
    rows: string[][];
    agentKey: string;
    source?: string;
  };
};

function admin() {
  return getAdminClient();
}

function namedAgents(text: string): string[] {
  return [...new Set([...detectMentionedAgents(text), ...detectNamedAgents(text)])];
}

function wantsAlinaSheet(text: string): boolean {
  const t = text.toLowerCase();
  return /(таблиц|выкуп|раздач|план\s+на\s+сегодня|слот|самовыкуп|график\s+раздач)/i.test(t);
}

function wantsWbProductPhoto(text: string): boolean {
  const t = text.toLowerCase();
  if (/сгенерир|нарисуй|ии\s*фото|dall|фотоворон/i.test(t)) return false;
  if (!/(фото|фотк|фоту|картинк)/i.test(t)) return false;
  return (
    /главн[а-яё]*\s+фото|фото\s+с\s*вб|фото\s+(товар|фонар|вырез|блузк|карточк)/i.test(t) ||
    /(дай|скинь|пришли|покажи|есть).{0,20}(фото|фотк)/i.test(t) ||
    /(фото|фотк).{0,30}(фонар|вырез|блузк|бел|черн|чёрн)/i.test(t)
  );
}

function wantsStock(text: string): boolean {
  // FBS-остатки — отдельный диалог Антона (wantsFbsStock)
  if (wantsFbsStock(text)) return false;
  return /(остат|осталось|сколько\s+на\s+склад|на\s+склад)/i.test(text);
}

/** Спросить цену / до скидки (не смена цены). */
export function wantsPriceLookup(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t.trim()) return false;
  if (wantsPriceChange(t)) return false;
  if (
    /до\s*скидк|старая\s*цен|цен[аыу]?\s*до\s*скид|без\s*скидк|полная\s*цен|базовая\s*цен/i
      .test(t)
  ) {
    return true;
  }
  // цен… + опечатка «уена»
  if (/цен[аыуеойам]*|уена/i.test(t)) return true;
  if (/скок[оа]\s*(сто|стоит)|сколько\s*стоит|какая\s*стоит/i.test(t)) {
    return true;
  }
  return false;
}

export function wantsBeforeDiscount(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return /до\s*скидк|старая\s*цен|цен[аыу]?\s*до\s*скид|без\s*скидк|полная\s*цен|базовая\s*цен/i
    .test(t);
}

/** «дай артикул / какой nm / арт на лапшу бел» — не конкуренты и не смена цены. */
export function wantsArticleLookup(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t.trim()) return false;
  if (wantsCompetitorAnalysis(t)) return false;
  if (wantsPriceChange(t)) return false;
  if (
    /(дай|скинь|пришли|покажи|напиши|скажи|какой|какая|какие).{0,28}(артикул|арт\.?|\bnm\b)/i
      .test(t)
  ) {
    return true;
  }
  if (
    /(артикул|арт\.?|\bnm\b).{0,28}(дай|скинь|пришли|покажи|напиши|скажи|какой|какая|на\s)/i
      .test(t)
  ) {
    return true;
  }
  if (/^(какой\s+)?(артикул|арт|nm)\b/i.test(t.trim())) return true;
  return false;
}

const PRICE_STOP_EXACT = new Set([
  'какая',
  'какой',
  'какие',
  'какую',
  'скажи',
  'напиши',
  'покажи',
  'дай',
  'плиз',
  'пожалуйста',
  'сейчас',
  'просто',
  'только',
  'без',
  'продажи',
  'продажу',
  'спрашиваю',
  'спросить',
  'интересует',
  'vsmyсли',
  'всмысли',
  'всмысле',
  'а',
  'и',
  'или',
  'это',
  'там',
  'есть',
  'руб',
  'рублей',
  'р',
]);

/** Вытащить товар из фразы про цену (с опечатками вроде «уена»). */
export function extractPriceProductQuery(text: string): string {
  let t = String(text || '');
  t = t
    .replace(/саул[еэ][а-яё]*/gi, ' ')
    .replace(/карин[аеуыой][а-яё]*/gi, ' ')
    .replace(/до\s*скидк[аиуеой]*/gi, ' ')
    .replace(/после\s*скидк[аиуеой]*/gi, ' ')
    .replace(/без\s*скидк[аиуеой]*/gi, ' ')
    .replace(/старая\s*цен[аыуеойам]*/gi, ' ')
    .replace(/полная\s*цен[аыуеойам]*/gi, ' ')
    .replace(/базовая\s*цен[аыуеойам]*/gi, ' ')
    .replace(/цен[аыуеойам]*/gi, ' ')
    .replace(/уена/gi, ' ')
    .replace(/сколько\s*стоит/gi, ' ')
    .replace(/скок[оа]\s*стоит?/gi, ' ')
    .replace(/артикул[а-яё]*/gi, ' ')
    .replace(/[?!.,:;«»"'()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return filterStopTokens(t, {
    exact: PRICE_STOP_EXACT,
    minLen: 2,
    dropNumbers: false,
  });
}

const ARTICLE_STOP_EXACT = new Set([
  ...PRICE_STOP_EXACT,
  'артикул',
  'артикула',
  'артикулу',
  'артикулы',
  'арт',
  'nm',
  'nmid',
  'номер',
  'нужен',
  'нужна',
  'нужно',
  'наш',
  'наша',
  'наше',
  'на',
]);

/** Товар из «артикул дай на лапшу бел». */
export function extractArticleProductQuery(text: string): string {
  let t = String(text || '');
  t = t
    .replace(/саул[еэ][а-яё]*/gi, ' ')
    .replace(/карин[аеуыой][а-яё]*/gi, ' ')
    .replace(/артикул[а-яё]*/gi, ' ')
    .replace(/\bart\.?\b/gi, ' ')
    .replace(/\bnm\b/gi, ' ')
    .replace(/[?!.,:;«»"'()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return filterStopTokens(t, {
    exact: ARTICLE_STOP_EXACT,
    minLen: 2,
    dropNumbers: false,
  });
}

export function formatArticleLookupLine(hit: {
  vendorCode?: string | null;
  title?: string | null;
  nmId?: number | null;
  cabinetName?: string | null;
  price?: number | null;
  discountedPrice?: number | null;
}): string {
  const name = String(hit.vendorCode || hit.title || 'товар').trim();
  const nm = hit.nmId != null && Number(hit.nmId) > 0 ? Number(hit.nmId) : null;
  const cab = hit.cabinetName ? ` · ${hit.cabinetName}` : '';
  if (!nm) return `${name}${cab} — nm в каталоге нет`;
  const before = hit.price != null && Number(hit.price) > 0
    ? Number(hit.price)
    : null;
  const after = hit.discountedPrice != null && Number(hit.discountedPrice) > 0
    ? Number(hit.discountedPrice)
    : null;
  let money = '';
  if (before != null && after != null && before !== after) {
    money = ` · до ${formatMoneyRu(before)} / после ${formatMoneyRu(after)}`;
  } else if (after != null || before != null) {
    money = ` · ${formatMoneyRu(after ?? before!)}`;
  }
  return `${name}: nm ${nm}${cab}${money}`;
}

async function answerArticleLookup(
  text: string,
  opts?: { chatId?: number },
): Promise<TeamQaResult> {
  const query = extractArticleProductQuery(text);
  const chatId = opts?.chatId;

  if ((!query || query.length < 2) && chatId) {
    const focus = await getChatFocus(chatId);
    const lp = focus?.lastProduct;
    if (lp?.nmId && lp.vendorCode) {
      return {
        handled: true,
        agentKey: 'saule',
        reply: formatArticleLookupLine(lp),
      };
    }
  }

  if (!query || query.length < 2) {
    return {
      handled: true,
      agentKey: 'saule',
      reply: pick([
        'Какой товар? Модель + цвет — скажу nm из каталога',
        'Назови модель/цвет (лапша белая, фонарь…) — найду артикул',
      ]),
    };
  }

  const cab = await resolveCabinet(text);
  const hits = await findCatalogProducts(query, {
    cabinetId: cab.match?.id || null,
    max: 6,
    minScore: 5,
  });

  if (!hits.length) {
    return {
      handled: true,
      agentKey: 'saule',
      reply: pick([
        `Не нашла «${query}» в каталоге. Уточни модель/цвет`,
        `По «${query}» nm нет — другой фасон/цвет?`,
      ]),
    };
  }

  // один явный лидер или топ-кластер
  const top = hits[0];
  const close = hits.filter((h) => h.score >= top.score - 1).slice(0, 4);
  if (chatId && top.nmId) {
    await rememberLastProduct(chatId, 'saule', hitToLastProduct(top));
  }

  if (close.length === 1 || (close.length > 1 && close[0].score > close[1].score)) {
    return {
      handled: true,
      agentKey: 'saule',
      reply: formatArticleLookupLine(top),
    };
  }

  return {
    handled: true,
    agentKey: 'saule',
    reply: [
      `Несколько похожих на «${query}»:`,
      ...close.map((h) => `• ${formatArticleLookupLine(h)}`),
    ].join('\n'),
  };
}

function formatMoneyRu(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

export function formatPriceLookupLine(
  hit: {
    vendorCode?: string | null;
    title?: string | null;
    price?: number | null;
    discountedPrice?: number | null;
  },
  mode: 'full' | 'before' | 'after' = 'full',
): string {
  const name = String(hit.vendorCode || hit.title || 'товар').trim();
  const before = hit.price != null && Number(hit.price) > 0
    ? Number(hit.price)
    : null;
  const after = hit.discountedPrice != null && Number(hit.discountedPrice) > 0
    ? Number(hit.discountedPrice)
    : before;

  if (mode === 'before') {
    if (before != null && after != null && before !== after) {
      return `${name} — до скидки ${formatMoneyRu(before)} (сейчас после ${formatMoneyRu(after)})`;
    }
    if (before != null) return `${name} — до скидки ${formatMoneyRu(before)}`;
    if (after != null) {
      return `${name} — цены до скидки нет, сейчас ${formatMoneyRu(after)}`;
    }
    return `${name} — не вижу цену до скидки в WB`;
  }

  if (mode === 'after') {
    if (after != null) return `${name} — ${formatMoneyRu(after)}`;
    if (before != null) return `${name} — ${formatMoneyRu(before)}`;
    return `${name} — цену не вижу`;
  }

  if (before != null && after != null && before !== after) {
    return `${name} — до скидки ${formatMoneyRu(before)} · после ${formatMoneyRu(after)}`;
  }
  if (after != null || before != null) {
    return `${name} — ${formatMoneyRu(after ?? before!)}`;
  }
  return `${name} — цену не вижу`;
}

function hitToLastProduct(hit: {
  vendorCode?: string | null;
  title?: string | null;
  nmId?: number | null;
  cabinetId?: string | null;
  cabinetName?: string | null;
  price?: number | null;
  discountedPrice?: number | null;
  discountPct?: number | null;
}): LastProductFocus {
  return {
    vendorCode: String(hit.vendorCode || hit.title || '').trim(),
    title: hit.title ?? null,
    nmId: hit.nmId == null ? null : Number(hit.nmId),
    cabinetId: hit.cabinetId ?? null,
    cabinetName: hit.cabinetName ?? null,
    price: hit.price == null ? null : Number(hit.price),
    discountedPrice: hit.discountedPrice == null
      ? null
      : Number(hit.discountedPrice),
    discountPct: hit.discountPct == null ? null : Number(hit.discountPct),
  };
}

async function answerPriceLookup(
  text: string,
  opts?: { chatId?: number },
): Promise<TeamQaResult> {
  const beforeOnly = wantsBeforeDiscount(text);
  const mode: 'full' | 'before' | 'after' = beforeOnly ? 'before' : 'full';
  const query = extractPriceProductQuery(text);
  const chatId = opts?.chatId;

  // Follow-up «А до скидки?» — берём последний товар из фокуса
  if ((!query || query.length < 2) && chatId) {
    const focus = await getChatFocus(chatId);
    const lp = focus?.lastProduct;
    if (lp?.vendorCode) {
      // если в sticky нет «до», перезапросим WB по vendorCode
      if (
        beforeOnly &&
        (lp.price == null || lp.price <= 0) &&
        lp.vendorCode
      ) {
        const refreshed = await findCatalogProducts(lp.vendorCode, {
          sources: ['wb_prices'],
          cabinetId: lp.cabinetId || null,
          max: 3,
          minScore: 4,
        });
        const best = refreshed[0];
        if (best) {
          const product = hitToLastProduct(best);
          await rememberLastProduct(chatId, 'saule', product);
          return {
            handled: true,
            agentKey: 'saule',
            reply: formatPriceLookupLine(best, mode),
          };
        }
      }
      await rememberLastProduct(chatId, 'saule', lp);
      return {
        handled: true,
        agentKey: 'saule',
        reply: formatPriceLookupLine(lp, mode),
      };
    }
    if (beforeOnly) {
      return {
        handled: true,
        agentKey: 'saule',
        reply: pick([
          'Какой артикул? Модель/цвет — скажу до и после скидки',
          'Назови товар: фонарь белый / лапша… — гляну цену до скидки',
          'Без артикула не вижу. Кинь модель + цвет',
        ]),
      };
    }
  }

  if (!query || query.length < 2) {
    return {
      handled: true,
      agentKey: 'saule',
      reply: pick([
        'Какой товар? Модель и цвет — скажу цену',
        'Назови артикул: фонарь / лапша / жилетка…',
      ]),
    };
  }

  const cab = await resolveCabinet(text);
  const hits = await findCatalogProducts(query, {
    sources: ['wb_prices'],
    cabinetId: cab.match?.id || null,
    max: 5,
    minScore: 5,
  });

  if (!hits.length) {
    return {
      handled: true,
      agentKey: 'saule',
      reply: pick([
        `Не нашла «${query}» в ценах WB. Уточни модель/цвет или nm`,
        `По «${query}» цены нет в каталоге — другой артикул?`,
      ]),
    };
  }

  const top = hits.slice(0, 3);
  const lines = top.map((h) => formatPriceLookupLine(h, mode));
  if (chatId && top[0]) {
    await rememberLastProduct(chatId, 'saule', hitToLastProduct(top[0]));
  }

  return {
    handled: true,
    agentKey: 'saule',
    reply: lines.join('\n'),
  };
}

function getOpenFromSnap(offers: SheetPlanOffer[]): SheetPlanOffer[] {
  const open = offers.filter((o) => o.is_open && (o.slots_left ?? 0) > 0);
  const seen = new Set<string>();
  const out: SheetPlanOffer[] = [];
  for (const o of open) {
    const k = `${o.product_name}|${o.article}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

async function answerAlinaSheet(text: string): Promise<TeamQaResult> {
  const snap = await fetchSheetPlan(false);
  if (!snap.ok) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: `Таблицу сейчас не вижу: ${snap.error || 'ошибка чтения'}`,
    };
  }

  const open = getOpenFromSnap(snap.offers || []);
  const mode = snap.deal_mode === 'cashback'
    ? 'только кэшбек'
    : snap.deal_mode === 'barter'
    ? 'только бартер'
    : 'кэшбек и бартер';
  const openLines = open.slice(0, 10).map((o) =>
    `• ${o.product_name}${o.keyword ? ` · ключ «${o.keyword}»` : ''} · мест ${o.slots_left}`
  );
  let reply = alinaSeesSheet(openLines, mode);

  try {
    const stats = await alinaSelfbuyStatsText();
    const crmLine = stats.split('\n').find((l) => /лид|в работе|сегодня/i.test(l));
    if (crmLine) reply += '\n' + crmLine.replace(/^[-•\s]+/, '');
  } catch { /* */ }

  return { handled: true, agentKey: 'alina', reply };
}

async function answerProductPhoto(text: string): Promise<TeamQaResult> {
  const snap = await fetchSheetPlan(false);
  const offers = snap.offers || [];
  let picked = resolveProductChoice(offers, text);
  if (!picked.offer) {
    const m = matchOfferFromText(offers, text);
    if (m.offer) picked = { ...picked, offer: m.offer };
    else if (m.ambiguous.length === 1) picked = { ...picked, offer: m.ambiguous[0] };
    else if (m.ambiguous.length > 1) {
      return {
        handled: true,
        agentKey: 'alina',
        reply: alinaPickModel(
          m.ambiguous.map((o) => `• ${o.product_name}`),
        ),
      };
    }
  }
  if (!picked.offer && picked.ambiguous.length === 1) {
    picked = { ...picked, offer: picked.ambiguous[0] };
  }
  if (!picked.offer && picked.ambiguous.length > 1) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: alinaPickModel(
        picked.ambiguous.map((o) => `• ${o.product_name}`),
      ),
    };
  }
  if (!picked.offer?.article) {
    // fallback: общий каталог (все кабинеты), не только таблица раздач
    try {
      const hits = await findCatalogProducts(text, {
        sources: ['wb_prices', 'rnp'],
        minScore: 4,
        max: 5,
      });
      if (hits.length === 1 || (hits.length > 1 && hits[0].score > hits[1].score)) {
        const h = hits[0];
        const photo = await fetchWbMainPhoto(String(h.nmId));
        if (photo) {
          return {
            handled: true,
            agentKey: 'alina',
            reply: alinaPhotoOk(h.vendorCode || h.title, h.cabinetName),
            photos: [{
              url: photo.url,
              bytes: photo.bytes,
              mime: photo.mime,
              filename: photo.filename,
              caption: `${h.cabinetName} · ${h.vendorCode || h.title}`,
            }],
          };
        }
      }
      if (hits.length > 1) {
        return {
          handled: true,
          agentKey: 'alina',
          reply: alinaPickModel(
            hits.slice(0, 6).map((h) => `• ${h.cabinetName} · ${h.vendorCode || h.title}`),
          ),
        };
      }
    } catch { /* */ }
    const all = listAllProductChoices(offers);
    return {
      handled: true,
      agentKey: 'alina',
      reply: all.length
        ? alinaPickModel(all.map((o) => `• ${o.product_name}`))
        : 'Не нашла модель — напиши точнее или nm',
    };
  }

  const photo = await fetchWbMainPhoto(picked.offer.article);
  if (!photo) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: alinaPhotoMiss(picked.offer.product_name || 'товар'),
    };
  }
  return {
    handled: true,
    agentKey: 'alina',
    reply: alinaPhotoOk(picked.offer.product_name || 'товар'),
    photos: [{
      url: photo.url,
      bytes: photo.bytes,
      mime: photo.mime,
      filename: photo.filename,
      caption: pick([
        `Главное фото «${picked.offer.product_name}»`,
        `${picked.offer.product_name}`,
        `WB · ${picked.offer.product_name}`,
      ]),
    }],
  };
}

async function resolveNmIdsForProduct(
  cabinetId: string | null,
  text: string,
): Promise<Array<{ nm_id: number; title: string; cabinet_id?: string }>> {
  const found: Array<{ nm_id: number; title: string; score: number; cabinet_id?: string }> = [];
  const seen = new Set<string>();

  try {
    const snap = await fetchSheetPlan(false);
    const picked = resolveProductChoice(snap.offers || [], text);
    const candidates = [
      ...(picked.offer ? [picked.offer] : []),
      ...picked.ambiguous.slice(0, 4),
    ];
    if (!candidates.length) {
      const m = matchOfferFromText(snap.offers || [], text);
      if (m.offer) candidates.push(m.offer);
      candidates.push(...m.ambiguous.slice(0, 4));
    }
    for (const o of candidates) {
      const nm = Number(o.article);
      if (!Number.isFinite(nm)) continue;
      const key = `${cabinetId || 'sheet'}:${nm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        nm_id: nm,
        title: o.product_name || String(nm),
        score: 10,
        cabinet_id: cabinetId || undefined,
      });
    }
  } catch { /* */ }

  try {
    const hits = await findCatalogProducts(text, {
      cabinetId: cabinetId || null,
      sources: ['rnp', 'wb_prices'],
      minScore: 4,
      max: 8,
    });
    for (const h of hits) {
      const key = `${h.cabinetId}:${h.nmId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        nm_id: h.nmId,
        title: h.vendorCode || h.title,
        score: h.score,
        cabinet_id: h.cabinetId,
      });
    }
  } catch { /* */ }

  found.sort((a, b) => b.score - a.score);
  return found.slice(0, 6).map(({ nm_id, title, cabinet_id }) => ({
    nm_id,
    title,
    cabinet_id,
  }));
}

async function answerStock(text: string): Promise<TeamQaResult> {
  const resolved = await resolveCabinet(text);
  if (!resolved.match && (resolved.candidates?.length || 0) > 1) {
    // если товар однозначно из одного кабинета — не спрашиваем
    const guessed = await resolveNmIdsForProduct(null, text);
    const cabs = [...new Set(guessed.map((g) => g.cabinet_id).filter(Boolean))];
    if (cabs.length !== 1) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'По какому кабинету? ' +
          (resolved.candidates || []).map((c) => c.name).join(', '),
      };
    }
  }
  let cabinet = resolved.match;
  if (!cabinet) {
    const guessed = await resolveNmIdsForProduct(null, text);
    if (guessed[0]?.cabinet_id) {
      const all = await listCabinets();
      const hit = all.find((c) => c.id === guessed[0].cabinet_id);
      if (hit) cabinet = hit;
    }
  }
  if (!cabinet) {
    cabinet = (await resolveCabinet('база')).match;
  }
  if (!cabinet) {
    return {
      handled: true,
      agentKey: 'anton',
      reply: 'Не нашёл кабинет. Напиши: база / elium / saai / zevina',
    };
  }

  const products = await resolveNmIdsForProduct(cabinet.id, text);
  if (!products.length) {
    return {
      handled: true,
      agentKey: 'anton',
      reply: pick([
        'Не понял товар в ' + cabinet.name + '. Пример: «жилетка темно синяя» / «фонарь белый»',
        cabinet.name + ': какая модель/цвет? Например «лапша белая»',
        'Уточни товар по ' + cabinet.name + ' — фасон + цвет',
      ]),
    };
  }

  const db = admin();
  const lines: string[] = [antonWbStockLead(cabinet.name)];

  for (const p of products) {
    const { data: rows } = await db
      .from('wb_stocks')
      .select('quantity, warehouse_name, in_way_to_client')
      .eq('cabinet_id', cabinet.id)
      .eq('nm_id', p.nm_id);
    const list = rows || [];
    const byWh = new Map<string, number>();
    let qty = 0;
    let inWay = 0;
    for (const r of list) {
      const q = Number(r.quantity || 0);
      qty += q;
      inWay += Number(r.in_way_to_client || 0);
      const wh = String(r.warehouse_name || 'склад');
      byWh.set(wh, (byWh.get(wh) || 0) + q);
    }
    lines.push(
      `• ${p.title}: ${qty} шт` + (inWay ? ` (в пути к клиенту ${inWay})` : ''),
    );
    const top = [...byWh.entries()]
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [wh, q] of top) {
      lines.push(`  – ${wh}: ${q}`);
    }
    if (!list.length) lines.push('  – в базе остатков по этому nm нет (нужен sync stocks)');
    else if (!top.length) lines.push('  – везде 0');
  }

  return { handled: true, agentKey: 'anton', reply: lines.join('\n') };
}

/**
 * Точка входа для тимчата.
 * Каждый бот получает свой webhook — отвечаем только «своим» интентом,
 * чужие глотаем (handled без reply), чтобы не дублировать LLM.
 */
export async function tryTeamSmartQa(
  text: string,
  triggeringBot: string,
  opts?: { chatId?: number },
): Promise<TeamQaResult> {
  const t = (text || '').trim();
  if (!t || t.length > 900) return { handled: false };
  const named = namedAgents(t);

  // ── Ролевые операции WB OpenAPI (чтение по кабинету) ─────────────────────
  {
    const role = detectWbRoleOp(t);
    if (role) {
      if (named.length && !named.includes(role) && !(role === 'saule' && named.includes('karina'))) {
        // именной пинг другому — не перехватываем
      } else {
        const op = await runWbRoleOp(t, triggeringBot);
        if (op.handled) {
          return {
            handled: true,
            agentKey: op.agentKey || role,
            reply: op.reply,
          };
        }
      }
    }
  }

  // ── Конкуренты WB (Сауле) ────────────────────────────────────────────────
  if (wantsCompetitorAnalysis(t)) {
    // чужой именной пинг — не перехватываем
    if (named.length && !named.includes('saule') && !named.includes('karina')) {
      return { handled: false };
    }
    if (triggeringBot !== 'saule') {
      return { handled: true }; // отвечает только Сауле
    }
    const result = await analyzeDirectCompetitors(t, { chatId: opts?.chatId });
    return {
      handled: true,
      agentKey: 'saule',
      reply: result.reply,
      summarySnapshot: result.summaryRows?.length
        ? {
          title: result.summaryTitle || 'Конкуренты',
          subtitle: result.queryUsed,
          columns: ['Арт', 'Товар', 'Цена', '★', 'Отзывы', 'Кто'],
          rows: result.summaryRows,
          agentKey: 'saule',
          source: 'competitors',
        }
        : undefined,
    };
  }

  // ── Артикул / nm (Сауле) — из каталога, не из примеров в чате ───────────
  if (wantsArticleLookup(t)) {
    if (
      triggeringBot === 'saule' &&
      (!named.length || named.includes('saule') || named.includes('karina'))
    ) {
      return await answerArticleLookup(t, { chatId: opts?.chatId });
    }
    if (!named.length || named.includes('saule') || named.includes('karina')) {
      return { handled: true };
    }
  }

  // ── Фото с WB (Алина), Муху на это глушим ───────────────────────────────
  if (wantsWbProductPhoto(t)) {
    if (triggeringBot === 'muha' && !/сгенерир|нарисуй/i.test(t)) {
      return { handled: true }; // не генерить AI-фото вместо карточки
    }
    if (triggeringBot === 'alina' && (!named.length || named.includes('alina'))) {
      return await answerProductPhoto(t);
    }
    if (named.includes('alina') && triggeringBot !== 'alina') {
      return { handled: true };
    }
  }

  // ── Таблица выкупов (Алина) ──────────────────────────────────────────────
  if (wantsAlinaSheet(t)) {
    if (triggeringBot === 'alina' && (!named.length || named.includes('alina'))) {
      return await answerAlinaSheet(t);
    }
    if (named.includes('alina') && triggeringBot !== 'alina') {
      return { handled: true };
    }
  }

  // ── Остатки FBS (Антон, мультишаг с кнопками) ───────────────────────────
  if (wantsFbsStock(t)) {
    if (triggeringBot === 'anton' && (!named.length || named.includes('anton'))) {
      return { handled: true, agentKey: 'anton', deferFbsStock: true };
    }
    // чужие боты молчат, пока вопрос про FBS-остатки
    if (!named.length || named.includes('anton')) {
      return { handled: true };
    }
  }

  // ── Смена цены (Сауле) — чужие боты молчат ─────────────────────────────
  if (/(сниз|понизь|пониз|убав|уменьш).{0,20}цен/i.test(t) ||
    /цен.{0,20}(сниз|понизь|пониз|убав|уменьш|меня|измени|поменя)/i.test(t) ||
    /(менять|поменять|изменить|поменяй).{0,12}цен/i.test(t)) {
    if (triggeringBot === 'saule' && (!named.length || named.includes('saule') || named.includes('karina'))) {
      return { handled: false }; // роутер стартует price dialog
    }
    if (!named.length || named.includes('saule') || named.includes('karina')) {
      return { handled: true };
    }
  }

  // ── Цена / до скидки (Сауле, read-only) ─────────────────────────────────
  if (wantsPriceLookup(t)) {
    if (
      triggeringBot === 'saule' &&
      (!named.length || named.includes('saule') || named.includes('karina'))
    ) {
      return await answerPriceLookup(t, { chatId: opts?.chatId });
    }
    if (!named.length || named.includes('saule') || named.includes('karina')) {
      return { handled: true };
    }
  }

  // ── Остатки WB-складов (Антон, без FBS) ─────────────────────────────────
  if (wantsStock(t)) {
    if (triggeringBot === 'anton' && (!named.length || named.includes('anton'))) {
      return await answerStock(t);
    }
    if (named.includes('anton') && triggeringBot !== 'anton') {
      return { handled: true };
    }
  }

  return { handled: false };
}

/** Доп. факты в LLM, если QA не перехватил вопрос целиком. */
export async function teamQaFactsForAgent(
  agent: string,
  text: string,
  opts?: { chatId?: number },
): Promise<string> {
  try {
    if (agent === 'alina') {
      const snap = await fetchSheetPlan(false);
      if (!snap.ok) return '';
      const open = getOpenFromSnap(snap.offers || []).slice(0, 8)
        .map((o) => `${o.product_name}: ${o.slots_left} мест`)
        .join('; ');
      return `ФАКТЫ РАЗДАЧИ СЕГОДНЯ (${snap.deal_mode}): ${open || 'мест нет'}`;
    }
    if (agent === 'anton' && wantsStock(text)) {
      const qa = await answerStock(text);
      return qa.reply ? `ФАКТЫ ОСТАТКОВ:\n${qa.reply}` : '';
    }
    if (
      (agent === 'saule' || agent === 'karina') &&
      wantsPriceLookup(text)
    ) {
      const qa = await answerPriceLookup(text, { chatId: opts?.chatId });
      return qa.reply ? `ФАКТЫ ЦЕН WB (до/после скидки):\n${qa.reply}` : '';
    }
    if (
      (agent === 'saule' || agent === 'karina') &&
      wantsArticleLookup(text)
    ) {
      const qa = await answerArticleLookup(text, { chatId: opts?.chatId });
      return qa.reply
        ? `ФАКТЫ АРТИКУЛОВ (только nm из каталога, не выдумывай):\n${qa.reply}`
        : '';
    }
  } catch {
    return '';
  }
  return '';
}

export { wantsWbProductPhoto, wantsAlinaSheet, wantsStock };
