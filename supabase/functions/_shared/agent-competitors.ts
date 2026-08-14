/**
 * Анализ прямых конкурентов на WB по артикулу (nm).
 *
 * Источники (публичные витринные эндпоинты, не Seller API):
 *  1) basket-*.wbbasket.ru/.../card.json — название/бренд/предмет
 *  2) search.wb.ru exactmatch — выдача по запросу (цена/рейтинг/отзывы)
 *  3) при нашем nm — цена из каталога кабинетов (prices API)
 *
 * Команда (естественный язык):
 *  «123456789 найди прямого конкурента и сравни»
 *  «Сауле, конкуренты по жилетке беж элиум»
 */

import { findCatalogProducts, scoreProductMatch } from './agent-product-catalog.ts';

export type PublicProduct = {
  nmId: number;
  name: string;
  brand: string;
  subject: string;
  subjectId: number;
  vendorCode: string;
  priceAfter: number;
  priceBefore: number;
  rating: number;
  feedbacks: number;
  supplier: string;
  source: 'search' | 'basket' | 'cabinet';
};

export type CompetitorCompareResult = {
  ok: boolean;
  error?: string;
  ours?: PublicProduct;
  competitors: PublicProduct[];
  queryUsed?: string;
  reply: string;
  /** для «сводная» follow-up */
  summaryRows?: string[][];
  summaryTitle?: string;
};

const DEST = '-1257786';
const SEARCH_URLS = [
  'https://search.wb.ru/exactmatch/ru/common/v7/search',
  'https://search.wb.ru/exactmatch/ru/common/v14/search',
  'https://u-search.wb.ru/exactmatch/ru/common/v18/search',
];

const searchCache = new Map<string, { at: number; items: PublicProduct[] }>();
const SEARCH_TTL_MS = 120_000;
const cardCache = new Map<number, { at: number; meta: BasketMeta | null }>();
const CARD_TTL_MS = 300_000;

type BasketMeta = {
  nmId: number;
  imtId: number;
  name: string;
  brand: string;
  subject: string;
  vendorCode: string;
  description: string;
};

function uaHeaders(): HeadersInit {
  return {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Origin: 'https://www.wildberries.ru',
    Referer: 'https://www.wildberries.ru/',
  };
}

function fmtMoney(n: number): string {
  if (!n || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** «конкурент / сравни / как цена у конкурентов / кк цена…» */
export function wantsCompetitorAnalysis(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (/конкурент/.test(t)) return true;
  if (/сравни(ть|м)?/.test(t) && /(арт|nm\b|\d{6,12}|карточ|товар|выдач|ниш)/i.test(t)) {
    return true;
  }
  if (/анализ/.test(t) && /(конкурент|ниш|выдач)/i.test(t)) return true;
  if (/найди/.test(t) && /(конкурент|похож|аналог)/i.test(t)) return true;
  if (/(похож|аналог)[а-яё]*/.test(t) && /(арт|nm\b|\d{6,12}|сравни)/i.test(t)) return true;
  // «смотрите также» / похожие с карточки
  if (/смотрит[её]\s*такж|похож(ие|ий)\s*(товар|карточ)/i.test(t)) return true;
  return false;
}

/** Фраза про «этот» товар — брать sticky nm, не искать слово «товар». */
export function wantsStickyProductRef(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return /(этого|эта|этот|эту|него|неё|нее|той|тот)\s+(товар|артикул|арт|карточ|модель|блуз|позиц)/i
    .test(t) ||
    /(по\s+нему|по\s+ней|по\s+этому|у\s+него|у\s+неё)/i.test(t) ||
    /конкурент.{0,40}(этого|него|неё)/i.test(t);
}

export function extractNmId(text: string): number | null {
  const m = String(text || "").match(/(?:^|[^\d])(\d{6,12})(?:[^\d]|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 100000 ? n : null;
}

async function probeBasketHost(vol: number, part: number, nm: number): Promise<number | null> {
  for (let start = 1; start <= 40; start += 8) {
    const batch = Array.from(
      { length: Math.min(8, 40 - start + 1) },
      (_, i) => start + i,
    );
    const hits = await Promise.all(batch.map(async (b) => {
      const bStr = String(b).padStart(2, '0');
      const url =
        `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
      try {
        const res = await fetch(url, {
          headers: uaHeaders(),
          signal: AbortSignal.timeout(4000),
        });
        return res.ok ? b : null;
      } catch {
        return null;
      }
    }));
    const found = hits.find((x) => x != null);
    if (found != null) return found;
  }
  return null;
}

export async function fetchBasketMeta(nmId: number): Promise<BasketMeta | null> {
  const cached = cardCache.get(nmId);
  if (cached && Date.now() - cached.at < CARD_TTL_MS) return cached.meta;

  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  const basket = await probeBasketHost(vol, part, nmId);
  if (basket == null) {
    cardCache.set(nmId, { at: Date.now(), meta: null });
    return null;
  }
  const bStr = String(basket).padStart(2, '0');
  const url =
    `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
  try {
    const res = await fetch(url, {
      headers: uaHeaders(),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      cardCache.set(nmId, { at: Date.now(), meta: null });
      return null;
    }
    const data = await res.json() as {
      imt_id?: number;
      nm_id?: number;
      imt_name?: string;
      subj_name?: string;
      vendor_code?: string;
      description?: string;
      selling?: { brand_name?: string };
    };
    const meta: BasketMeta = {
      nmId: Number(data.nm_id || nmId),
      imtId: Number(data.imt_id || 0),
      name: String(data.imt_name || '').trim(),
      brand: String(data.selling?.brand_name || '').trim(),
      subject: String(data.subj_name || '').trim(),
      vendorCode: String(data.vendor_code || '').trim(),
      description: String(data.description || '').trim().slice(0, 400),
    };
    cardCache.set(nmId, { at: Date.now(), meta });
    return meta;
  } catch (e) {
    console.error('[competitors] basket', nmId, e);
    cardCache.set(nmId, { at: Date.now(), meta: null });
    return null;
  }
}

function parseSearchProduct(raw: Record<string, unknown>): PublicProduct | null {
  const nmId = Number(raw.id || raw.nmId || 0);
  if (!Number.isFinite(nmId) || nmId < 100000) return null;
  const sizes = Array.isArray(raw.sizes) ? raw.sizes as Array<Record<string, unknown>> : [];
  const size0 = (sizes[0] || {}) as Record<string, unknown>;
  const priceObj = (size0.price || raw.price || {}) as Record<string, unknown>;
  let priceAfter = Number(priceObj.product || 0) / 100;
  let priceBefore = Number(priceObj.basic || 0) / 100;
  // legacy fields (kopecks)
  if (!priceAfter && raw.salePriceU) priceAfter = Number(raw.salePriceU) / 100;
  if (!priceBefore && raw.priceU) priceBefore = Number(raw.priceU) / 100;
  if (!priceBefore) priceBefore = priceAfter;

  return {
    nmId,
    name: String(raw.name || '').trim(),
    brand: String(raw.brand || '').trim(),
    subject: '',
    subjectId: Number(raw.subjectId || 0),
    vendorCode: '',
    priceAfter,
    priceBefore,
    rating: Number(raw.reviewRating || raw.rating || 0),
    feedbacks: Number(raw.feedbacks || 0),
    supplier: String(raw.supplier || '').trim(),
    source: 'search',
  };
}

/** Карточка(и) с витрины card.wb.ru — цена/рейтинг как на сайте. */
export async function fetchCardProducts(nmIds: number[]): Promise<PublicProduct[]> {
  const ids = [...new Set(nmIds.map(Number).filter((n) => n >= 100000))].slice(0, 20);
  if (!ids.length) return [];
  const url =
    `https://card.wb.ru/cards/v4/detail?appType=1&curr=rub&dest=${DEST}&nm=${ids.join(';')}`;
  try {
    const res = await fetch(url, {
      headers: uaHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const body = await res.json() as { products?: Array<Record<string, unknown>> };
    const out: PublicProduct[] = [];
    for (const raw of body.products || []) {
      const p = parseSearchProduct(raw);
      if (p) out.push({ ...p, source: 'basket' });
    }
    return out;
  } catch (e) {
    console.error('[competitors] card.detail', e);
    return [];
  }
}

/**
 * Блок «Смотрите также» / визуально похожие с карточки.
 * WB visual API: query=<nm>&resultset=catalog.
 */
export async function fetchSeeAlsoProducts(nmId: number): Promise<PublicProduct[]> {
  if (!nmId || nmId < 100000) return [];
  const urls = [
    `https://recom.wb.ru/visual/ru/common/v5/search?appType=1&curr=rub&dest=${DEST}&spp=30&query=${nmId}&resultset=catalog`,
    `https://recom.wb.ru/visual/ru/common/v5/search?appType=1&curr=rub&dest=${DEST}&spp=30&query=${nmId}&resultset=catalog&lang=ru`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: uaHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const body = await res.json() as {
        data?: { products?: Array<Record<string, unknown>> };
        products?: Array<Record<string, unknown>>;
      };
      const raw = body?.data?.products || body?.products || [];
      const items = raw.map(parseSearchProduct).filter(Boolean) as PublicProduct[];
      if (items.length) return items;
    } catch (e) {
      console.error('[competitors] see-also', e);
    }
  }
  return [];
}

/**
 * Рекомендация цены по топ-конкурентам:
 * медиана «честного» коридора (без демпинга далеко ниже нашей).
 */
export function suggestPriceAction(
  ourPrice: number,
  competitorPrices: number[],
): {
  action: 'raise' | 'lower' | 'hold';
  target: number | null;
  mid: number | null;
  reason: string;
} {
  const ours = Number(ourPrice) || 0;
  const prices = competitorPrices
    .map(Number)
    .filter((p) => Number.isFinite(p) && p >= 100)
    .sort((a, b) => a - b);
  if (!ours || prices.length === 0) {
    return { action: 'hold', target: null, mid: null, reason: 'мало цен для сравнения' };
  }

  // коридор относительно нашей: отсекаем явный демпинг / премиум-выбросы
  const band = prices.filter((p) => p >= ours * 0.55 && p <= ours * 1.7);
  const use = band.length >= 2 ? band : prices;
  const mid = use[Math.floor((use.length - 1) / 2)];
  const round10 = (n: number) => Math.round(n / 10) * 10;
  const diffPct = (ours - mid) / mid;

  if (diffPct > 0.06) {
    return {
      action: 'lower',
      target: round10(mid),
      mid: round10(mid),
      reason: `мы дороже медианы топ‑конкурентов (~${fmtMoney(mid)})`,
    };
  }
  if (diffPct < -0.06) {
    return {
      action: 'raise',
      target: round10(mid),
      mid: round10(mid),
      reason: `мы дешевле медианы топ‑конкурентов (~${fmtMoney(mid)})`,
    };
  }
  return {
    action: 'hold',
    target: round10(ours),
    mid: round10(mid),
    reason: `цена в рынке топ‑конкурентов (медиана ~${fmtMoney(mid)})`,
  };
}

async function searchWbCatalog(query: string, page = 1): Promise<PublicProduct[]> {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const cacheKey = `${norm(q)}|${page}`;
  const hit = searchCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.items;

  const params = new URLSearchParams({
    appType: '1',
    curr: 'rub',
    dest: DEST,
    lang: 'ru',
    page: String(page),
    query: q,
    resultset: 'catalog',
    sort: 'popular',
    spp: '30',
    suppressSpellcheck: 'false',
  });

  for (const base of SEARCH_URLS) {
    try {
      const res = await fetch(`${base}?${params}`, {
        headers: uaHeaders(),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const body = await res.json() as {
        data?: { products?: Array<Record<string, unknown>> };
        products?: Array<Record<string, unknown>>;
      };
      const raw = body?.data?.products || body?.products || [];
      const items = raw.map(parseSearchProduct).filter(Boolean) as PublicProduct[];
      if (items.length) {
        searchCache.set(cacheKey, { at: Date.now(), items });
        return items;
      }
    } catch (e) {
      console.error('[competitors] search', base, e);
    }
  }
  return [];
}

/** Цена нашего nm из кабинетов (если это наш товар). */
async function enrichFromCabinet(nmId: number, base: PublicProduct): Promise<PublicProduct> {
  try {
    const hits = await findCatalogProducts(String(nmId), {
      sources: ['wb_prices', 'rnp'],
      minScore: 4,
      max: 3,
    });
    const hit = hits.find((h) => h.nmId === nmId) || hits[0];
    if (!hit) return base;
    return {
      ...base,
      name: base.name || hit.vendorCode || hit.title || base.name,
      vendorCode: hit.vendorCode || base.vendorCode,
      priceAfter: hit.discountedPrice || base.priceAfter,
      priceBefore: hit.price || base.priceBefore || hit.discountedPrice || 0,
      source: hit.discountedPrice ? 'cabinet' : base.source,
    };
  } catch {
    return base;
  }
}

function buildSearchQuery(meta: BasketMeta, hint = ''): string {
  const parts: string[] = [];
  const name = meta.name.replace(/\s+/g, ' ').trim();
  // убрать бренд из названия, чтобы искать категорию, не «наши» карточки
  let cleaned = name;
  if (meta.brand) {
    cleaned = cleaned.replace(new RegExp(meta.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (meta.subject) parts.push(meta.subject);
  // 3–5 значимых слов из названия
  const tokens = norm(cleaned).split(' ').filter((t) => t.length >= 3).slice(0, 5);
  if (tokens.length) parts.push(tokens.join(' '));
  else if (cleaned) parts.push(cleaned);
  if (hint) {
    const h = hint.replace(/\d{6,12}/g, ' ').replace(
      /конкурент[а-яa-z]*|сравни[а-яa-z]*|найди|анализ[а-яa-z]*|прям[а-яa-z]*|артикул|арт\.?|похож[а-яa-z]*|аналог[а-яa-z]*|\bnm\b/gi,
      ' ',
    );
    const ht = norm(h).split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t)).slice(0, 4);
    if (ht.length) parts.push(ht.join(' '));
  }
  return [...new Set(parts.join(' ').split(/\s+/))].join(' ').trim().slice(0, 120);
}

/**
 * Скоринг «прямого» конкурента: другая марка, близкая категория/название, цена в коридоре.
 */
export function scoreDirectCompetitor(ours: PublicProduct, cand: PublicProduct): number {
  if (!cand?.nmId || cand.nmId === ours.nmId) return -100;
  let score = 0;

  const nameScore = scoreProductMatch(cand.name, ours.name);
  score += Math.min(12, nameScore);

  if (ours.subjectId && cand.subjectId && ours.subjectId === cand.subjectId) score += 10;
  if (ours.subject) {
    const subjHit = scoreProductMatch(cand.name, ours.subject);
    if (subjHit >= 4) score += 4;
  }

  const sameBrand =
    ours.brand && cand.brand && norm(ours.brand) === norm(cand.brand);
  if (sameBrand) score -= 8; // тот же бренд — не «прямой конкурент»
  else if (cand.brand) score += 2;

  if (ours.priceAfter > 0 && cand.priceAfter > 0) {
    const ratio = cand.priceAfter / ours.priceAfter;
    if (ratio >= 0.7 && ratio <= 1.35) score += 6;
    else if (ratio >= 0.5 && ratio <= 1.8) score += 3;
    else if (ratio < 0.35 || ratio > 2.5) score -= 4;
  }

  if (cand.feedbacks >= 50) score += 1;
  if (cand.rating >= 4.5) score += 1;

  return score;
}

function pickDirectCompetitors(
  ours: PublicProduct,
  pool: PublicProduct[],
  limit = 5,
): PublicProduct[] {
  const scored = pool
    .map((c) => ({ c, score: scoreDirectCompetitor(ours, c) }))
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score || b.c.feedbacks - a.c.feedbacks);

  const seen = new Set<number>([ours.nmId]);
  const out: PublicProduct[] = [];
  for (const { c } of scored) {
    if (seen.has(c.nmId)) continue;
    seen.add(c.nmId);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

function compareLine(label: string, ours: string, theirs: string): string {
  return `• ${label}: мы ${ours} · они ${theirs}`;
}

function verdict(ours: PublicProduct, top: PublicProduct): string {
  const bits: string[] = [];
  if (ours.priceAfter && top.priceAfter) {
    const d = Math.round(ours.priceAfter - top.priceAfter);
    if (Math.abs(d) < 50) bits.push('цена почти как у прямого');
    else if (d > 0) bits.push(`мы дороже на ${fmtMoney(d)}`);
    else bits.push(`мы дешевле на ${fmtMoney(-d)}`);
  }
  if (ours.rating && top.rating) {
    if (ours.rating + 0.15 < top.rating) bits.push('рейтинг ниже');
    else if (ours.rating > top.rating + 0.15) bits.push('рейтинг выше');
  }
  if (ours.feedbacks != null && top.feedbacks != null) {
    if (top.feedbacks > ours.feedbacks * 2 && top.feedbacks > 100) {
      bits.push('у них заметно больше отзывов');
    } else if (ours.feedbacks > top.feedbacks * 2 && ours.feedbacks > 100) {
      bits.push('у нас больше отзывов');
    }
  }
  return bits.length ? bits.join('; ') : 'смотреть по цене и отзывам ниже';
}

export function formatCompetitorReply(
  ours: PublicProduct,
  competitors: PublicProduct[],
  queryUsed: string,
  opts?: { sourceLabel?: string },
): string {
  const link = (nm: number) => `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;
  const top = competitors.slice(0, 3);
  const head = [
    `Сауле · сводка по конкурентам`,
    `Наш: ${ours.brand ? ours.brand + ' · ' : ''}${ours.name || ours.vendorCode || ours.nmId}`,
    `арт. ${ours.nmId} · ${fmtMoney(ours.priceAfter)}${
      ours.priceBefore && ours.priceBefore > ours.priceAfter
        ? ` (до ${fmtMoney(ours.priceBefore)})`
        : ''
    }${ours.rating ? ` · ★${ours.rating}` : ''}${
      ours.feedbacks ? ` · ${ours.feedbacks} отз.` : ''
    }`,
    `карточка: ${link(ours.nmId)}`,
    opts?.sourceLabel
      ? opts.sourceLabel
      : (queryUsed ? `поиск: «${queryUsed}»` : ''),
  ].filter(Boolean);

  if (!top.length) {
    return [
      ...head,
      '',
      'Прямых в «Смотрите также» / выдаче не нашла (WB режет витрину).',
      'Кинь nm или уточни модель — перекопаю.',
    ].join('\n');
  }

  const lines: string[] = [...head, '', `Топ-${top.length} конкурента (как «Смотрите также»):`];
  top.forEach((c, i) => {
    lines.push(
      `${i + 1}) ${c.brand || '—'} · ${(c.name || '').slice(0, 70)}`,
      `   арт. ${c.nmId} · ${fmtMoney(c.priceAfter)}${
        c.rating ? ` · ★${c.rating}` : ''
      }${c.feedbacks ? ` · ${c.feedbacks} отз.` : ''}`,
      `   ${link(c.nmId)}`,
    );
  });

  const advice = suggestPriceAction(
    ours.priceAfter,
    top.map((c) => c.priceAfter),
  );
  const actionRu = advice.action === 'raise'
    ? 'ПОДНЯТЬ'
    : advice.action === 'lower'
    ? 'ОПУСТИТЬ'
    : 'ДЕРЖАТЬ';

  lines.push(
    '',
    'Сводка:',
    `• наши: ${fmtMoney(ours.priceAfter)}`,
    `• конкуренты: ${top.map((c) => fmtMoney(c.priceAfter)).join(' · ')}`,
    advice.mid ? `• медиана рынка: ${fmtMoney(advice.mid)}` : '',
    '',
    `Рекомендация: ${actionRu}${
      advice.target && advice.action !== 'hold'
        ? ` → ориентир ${fmtMoney(advice.target)}`
        : ''
    }`,
    `(${advice.reason})`,
  );

  const first = top[0];
  lines.push(
    '',
    'Сравнение с №1:',
    compareLine('цена', fmtMoney(ours.priceAfter), fmtMoney(first.priceAfter)),
    compareLine(
      'рейтинг',
      ours.rating ? `★${ours.rating}` : '—',
      first.rating ? `★${first.rating}` : '—',
    ),
    compareLine(
      'отзывы',
      ours.feedbacks ? String(ours.feedbacks) : '—',
      first.feedbacks ? String(first.feedbacks) : '—',
    ),
    `Вердикт vs №1: ${verdict(ours, first)}`,
  );
  return lines.join('\n');
}

async function resolveOurs(
  text: string,
  nmHint: number | null,
  opts?: { stickyNmId?: number | null; stickyQuery?: string | null },
): Promise<{ ours: PublicProduct | null; queryHint: string; error?: string }> {
  let nm = nmHint;
  let queryHint = '';
  const preferSticky = wantsStickyProductRef(text) &&
    opts?.stickyNmId &&
    Number(opts.stickyNmId) >= 100000;

  if (preferSticky) {
    nm = Number(opts!.stickyNmId);
    queryHint = String(opts?.stickyQuery || '');
  }

  if (!nm) {
    // товарной фразой из наших кабинетов
    const cleaned = text
      .replace(
        /конкурент[а-яa-z]*|сравни[а-яa-z]*|найди|анализ[а-яa-z]*|прям[а-яa-z]*|артикул|арт\.?|похож[а-яa-z]*|аналог[а-яa-z]*|\bnm\b|смотрите\s*также|(как|кк|скок[оа])\s*цен[аыуе]*|цен[аыуе]*\s*у|этого|эту|этот|эта|него|неё|нее|товар[аыу]?|карточк[аиу]|сводн[а-я]*|отч[её]т/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();
    queryHint = cleaned;
    if (cleaned.length >= 3) {
      const hits = await findCatalogProducts(cleaned, { max: 5, minScore: 5 });
      if (hits[0]) nm = hits[0].nmId;
    }
  }

  // follow-up без названия: взять последний товар из фокуса чата
  if (!nm && opts?.stickyNmId && Number(opts.stickyNmId) >= 100000) {
    nm = Number(opts.stickyNmId);
    if (!queryHint && opts.stickyQuery) queryHint = String(opts.stickyQuery);
  }

  if (!nm) {
    return {
      ours: null,
      queryHint,
      error:
        'Нужен nm или название — или сначала спроси артикул товара, потом «как цена у конкурентов». Пример: «лапша белая сравни с конкурентами».',
    };
  }

  // витринная карточка WB (цена как на сайте)
  const cards = await fetchCardProducts([nm]);
  const card = cards.find((c) => c.nmId === nm) || cards[0] || null;
  const meta = await fetchBasketMeta(nm);

  let ours: PublicProduct = {
    nmId: nm,
    name: card?.name || meta?.name || '',
    brand: card?.brand || meta?.brand || '',
    subject: meta?.subject || '',
    subjectId: card?.subjectId || 0,
    vendorCode: meta?.vendorCode || '',
    priceAfter: card?.priceAfter || 0,
    priceBefore: card?.priceBefore || 0,
    rating: card?.rating || 0,
    feedbacks: card?.feedbacks || 0,
    supplier: card?.supplier || '',
    source: card ? 'basket' : 'basket',
  };
  ours = await enrichFromCabinet(nm, ours);

  // добрать цену/рейтинг из поиска по nm или названию
  if (!ours.priceAfter || !ours.rating) {
    const q = ours.name || String(nm);
    const pool = await searchWbCatalog(q);
    const self = pool.find((p) => p.nmId === nm);
    if (self) {
      ours = {
        ...ours,
        name: ours.name || self.name,
        brand: ours.brand || self.brand,
        subjectId: ours.subjectId || self.subjectId,
        priceAfter: ours.priceAfter || self.priceAfter,
        priceBefore: ours.priceBefore || self.priceBefore,
        rating: ours.rating || self.rating,
        feedbacks: ours.feedbacks || self.feedbacks,
        supplier: ours.supplier || self.supplier,
        source: ours.priceAfter ? ours.source : 'search',
      };
    }
  }

  if (!ours.name && !ours.vendorCode) {
    return {
      ours: null,
      queryHint,
      error: `По арт. ${nm} карточку на WB не открыла. Проверь nm или кинь название.`,
    };
  }

  return { ours, queryHint };
}

/**
 * Главный вход: найти прямых конкурентов и сравнить.
 */
export async function analyzeDirectCompetitors(
  text: string,
  opts?: { chatId?: number },
): Promise<CompetitorCompareResult> {
  const nmHint = extractNmId(text);
  let stickyNmId: number | null = null;
  let stickyQuery: string | null = null;
  if (opts?.chatId && !nmHint) {
    try {
      const { getChatFocus } = await import('./agent-chat-focus.ts');
      const focus = await getChatFocus(opts.chatId);
      const lp = focus?.lastProduct;
      if (lp?.nmId && Number(lp.nmId) >= 100000) {
        stickyNmId = Number(lp.nmId);
        stickyQuery = String(lp.vendorCode || lp.title || '');
      }
    } catch {
      // ignore sticky miss
    }
  }
  const resolved = await resolveOurs(text, nmHint, {
    stickyNmId,
    stickyQuery,
  });
  if (!resolved.ours) {
    return {
      ok: false,
      error: resolved.error,
      competitors: [],
      reply: resolved.error || 'Не смогла разобрать артикул',
    };
  }

  // запомнить наш товар для follow-up
  if (opts?.chatId && resolved.ours.nmId) {
    try {
      const { rememberLastProduct } = await import('./agent-chat-focus.ts');
      await rememberLastProduct(opts.chatId, 'saule', {
        vendorCode: resolved.ours.vendorCode || resolved.ours.name ||
          String(resolved.ours.nmId),
        title: resolved.ours.name,
        nmId: resolved.ours.nmId,
        price: resolved.ours.priceBefore || null,
        discountedPrice: resolved.ours.priceAfter || null,
      });
    } catch {
      // ignore
    }
  }

  const ours = resolved.ours;
  const meta: BasketMeta = {
    nmId: ours.nmId,
    imtId: 0,
    name: ours.name,
    brand: ours.brand,
    subject: ours.subject,
    vendorCode: ours.vendorCode,
    description: '',
  };

  // 1) «Смотрите также» / visual similar с карточки
  let usedQuery = '';
  let sourceLabel = '';
  let items = await fetchSeeAlsoProducts(ours.nmId);
  if (items.length) {
    sourceLabel = 'источник: блок «Смотрите также» / похожие на карточке';
    usedQuery = `see-also:${ours.nmId}`;
  }

  // 2) fallback — поиск по названию карточки
  if (!items.length) {
    const query = buildSearchQuery(meta, resolved.queryHint || text);
    usedQuery = query;
    items = await searchWbCatalog(query);
    if (!items.length && ours.subject) {
      usedQuery = `${ours.subject} ${norm(ours.name).split(' ').slice(0, 2).join(' ')}`
        .trim();
      items = await searchWbCatalog(usedQuery);
    }
    if (!items.length && ours.name) {
      usedQuery = ours.name.slice(0, 80);
      items = await searchWbCatalog(usedQuery);
    }
    if (items.length) {
      sourceLabel = `источник: выдача WB · «${usedQuery}»`;
    }
  }

  // проставить subjectId нашему из пула если нашли себя
  const self = items.find((p) => p.nmId === ours.nmId);
  if (self?.subjectId) ours.subjectId = self.subjectId;

  // топ-3 прямых (как первые в «Смотрите также»)
  let competitors = pickDirectCompetitors(ours, items, 3);

  // если скоринг отсёк слишком жёстко — взять первые чужие бренды из пула
  if (!competitors.length && items.length) {
    const seen = new Set<number>([ours.nmId]);
    competitors = [];
    for (const c of items) {
      if (seen.has(c.nmId)) continue;
      if (ours.brand && c.brand && norm(ours.brand) === norm(c.brand)) continue;
      seen.add(c.nmId);
      competitors.push(c);
      if (competitors.length >= 3) break;
    }
  }

  // добрать актуальные цены топ-3 с card.wb.ru
  if (competitors.length) {
    const fresh = await fetchCardProducts(competitors.map((c) => c.nmId));
    if (fresh.length) {
      const byId = new Map(fresh.map((p) => [p.nmId, p]));
      competitors = competitors.map((c) => {
        const f = byId.get(c.nmId);
        if (!f) return c;
        return {
          ...c,
          name: f.name || c.name,
          brand: f.brand || c.brand,
          priceAfter: f.priceAfter || c.priceAfter,
          priceBefore: f.priceBefore || c.priceBefore,
          rating: f.rating || c.rating,
          feedbacks: f.feedbacks || c.feedbacks,
          source: f.priceAfter ? 'basket' : c.source,
        };
      });
    }
  }

  const reply = formatCompetitorReply(ours, competitors, usedQuery, {
    sourceLabel,
  });
  const summaryRows = [
    [
      String(ours.nmId),
      `${ours.brand ? ours.brand + ' · ' : ''}${ours.name}`.slice(0, 60),
      ours.priceAfter ? String(Math.round(ours.priceAfter)) : '—',
      ours.rating ? String(ours.rating) : '—',
      ours.feedbacks ? String(ours.feedbacks) : '—',
      'мы',
    ],
    ...competitors.map((c) => [
      String(c.nmId),
      `${c.brand ? c.brand + ' · ' : ''}${c.name}`.slice(0, 60),
      c.priceAfter ? String(Math.round(c.priceAfter)) : '—',
      c.rating ? String(c.rating) : '—',
      c.feedbacks ? String(c.feedbacks) : '—',
      'конкурент',
    ]),
  ];
  return {
    ok: true,
    ours,
    competitors,
    queryUsed: usedQuery,
    reply,
    summaryTitle: `Конкуренты · ${ours.nmId}`,
    summaryRows,
  };
}
