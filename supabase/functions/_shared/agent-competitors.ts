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

/** «конкурент / сравни артикул / найди прямого» */
export function wantsCompetitorAnalysis(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (/конкурент/.test(t)) return true;
  if (/сравни(ть|м)?/.test(t) && /(арт|nm\b|\d{6,12}|карточ|товар|выдач|ниш)/i.test(t)) {
    return true;
  }
  if (/анализ/.test(t) && /(конкурент|ниш|выдач)/i.test(t)) return true;
  if (/найди/.test(t) && /(конкурент|похож|аналог)/i.test(t)) return true;
  if (/(похож|аналог)\w*/.test(t) && /(арт|nm\b|\d{6,12}|сравни)/i.test(t)) return true;
  return false;
}

export function extractNmId(text: string): number | null {
  const m = String(text || '').match(/\b(\d{6,12})\b/);
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
): string {
  const link = (nm: number) => `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;
  const head = [
    `Сауле · конкуренты`,
    `Наш: ${ours.brand ? ours.brand + ' · ' : ''}${ours.name || ours.vendorCode || ours.nmId}`,
    `арт. ${ours.nmId} · ${fmtMoney(ours.priceAfter)}${
      ours.priceBefore && ours.priceBefore > ours.priceAfter
        ? ` (до ${fmtMoney(ours.priceBefore)})`
        : ''
    }${ours.rating ? ` · ★${ours.rating}` : ''}${
      ours.feedbacks ? ` · ${ours.feedbacks} отз.` : ''
    }`,
    queryUsed ? `поиск: «${queryUsed}»` : '',
  ].filter(Boolean);

  if (!competitors.length) {
    return [
      ...head,
      '',
      'Прямых в выдаче не нашла (или WB временно режет поиск).',
      'Кинь другой nm или уточни модель/цвет — перекопаю.',
    ].join('\n');
  }

  const lines: string[] = [...head, '', `Прямые (топ-${competitors.length}):`];
  competitors.forEach((c, i) => {
    lines.push(
      `${i + 1}) ${c.brand || '—'} · ${c.name.slice(0, 70)}`,
      `   арт. ${c.nmId} · ${fmtMoney(c.priceAfter)}${
        c.rating ? ` · ★${c.rating}` : ''
      }${c.feedbacks ? ` · ${c.feedbacks} отз.` : ''}`,
      `   ${link(c.nmId)}`,
    );
  });

  const top = competitors[0];
  lines.push(
    '',
    'Сравнение с №1:',
    compareLine('цена', fmtMoney(ours.priceAfter), fmtMoney(top.priceAfter)),
    compareLine(
      'рейтинг',
      ours.rating ? `★${ours.rating}` : '—',
      top.rating ? `★${top.rating}` : '—',
    ),
    compareLine(
      'отзывы',
      ours.feedbacks ? String(ours.feedbacks) : '—',
      top.feedbacks ? String(top.feedbacks) : '—',
    ),
    '',
    `Вердикт: ${verdict(ours, top)}`,
  );
  return lines.join('\n');
}

async function resolveOurs(
  text: string,
  nmHint: number | null,
): Promise<{ ours: PublicProduct | null; queryHint: string; error?: string }> {
  let nm = nmHint;
  let queryHint = '';

  if (!nm) {
    // товарной фразой из наших кабинетов
    const cleaned = text
      .replace(
        /конкурент[а-яa-z]*|сравни[а-яa-z]*|найди|анализ[а-яa-z]*|прям[а-яa-z]*|артикул|арт\.?|похож[а-яa-z]*|аналог[а-яa-z]*|\bnm\b/gi,
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

  if (!nm) {
    return {
      ours: null,
      queryHint,
      error: 'Нужен артикул (nm) или название из наших кабинетов — например «211195995 сравни с конкурентами».',
    };
  }

  const meta = await fetchBasketMeta(nm);
  let ours: PublicProduct = {
    nmId: nm,
    name: meta?.name || '',
    brand: meta?.brand || '',
    subject: meta?.subject || '',
    subjectId: 0,
    vendorCode: meta?.vendorCode || '',
    priceAfter: 0,
    priceBefore: 0,
    rating: 0,
    feedbacks: 0,
    supplier: '',
    source: 'basket',
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
): Promise<CompetitorCompareResult> {
  const nmHint = extractNmId(text);
  const resolved = await resolveOurs(text, nmHint);
  if (!resolved.ours) {
    return {
      ok: false,
      error: resolved.error,
      competitors: [],
      reply: resolved.error || 'Не смогла разобрать артикул',
    };
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
  const query = buildSearchQuery(meta, resolved.queryHint || text);
  const pool = await searchWbCatalog(query);
  // если пусто — упростить запрос до subject + 2 слова
  let usedQuery = query;
  let items = pool;
  if (!items.length && ours.subject) {
    usedQuery = `${ours.subject} ${norm(ours.name).split(' ').slice(0, 2).join(' ')}`.trim();
    items = await searchWbCatalog(usedQuery);
  }
  if (!items.length && ours.name) {
    usedQuery = ours.name.slice(0, 80);
    items = await searchWbCatalog(usedQuery);
  }

  // проставить subjectId нашему из пула если нашли себя
  const self = items.find((p) => p.nmId === ours.nmId);
  if (self?.subjectId) ours.subjectId = self.subjectId;

  const competitors = pickDirectCompetitors(ours, items, 5);
  const reply = formatCompetitorReply(ours, competitors, usedQuery);
  return {
    ok: true,
    ours,
    competitors,
    queryUsed: usedQuery,
    reply,
  };
}
