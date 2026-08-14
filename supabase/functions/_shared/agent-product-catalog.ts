/**
 * Общий каталог артикулов для всех ботов:
 * скоринг названий/vendorCode + поиск по rnp_articles и WB Prices API.
 * Кэш WB-списков ~90с на isolate, чтобы Сауле/Антон/QA видели одни и те же артикулы.
 */

import { listCabinets, stripCabinetAliases } from './agent-actions.ts';
import { sanitizeWbToken } from './wb-cabinet-tokens.ts';
import { getAdminClient } from './supabase-admin.ts';

const PRICES_API = 'https://discounts-prices-api.wildberries.ru';
const WB_TTL_MS = (() => {
  try {
    return Math.max(
      15_000,
      Number(Deno.env.get('AGENT_PRODUCT_CATALOG_TTL_MS') || 90_000) || 90_000,
    );
  } catch {
    return 90_000;
  }
})();

export type CatalogHit = {
  cabinetId: string;
  cabinetName: string;
  nmId: number;
  title: string;
  vendorCode: string;
  score: number;
  source: 'rnp' | 'wb_prices' | 'sheet';
  price?: number;
  discountedPrice?: number;
  discountPct?: number;
};

type WbGood = {
  nmId: number;
  vendorCode: string;
  price: number;
  discountedPrice: number;
  discountPct: number;
};

type WbCabCache = {
  at: number;
  goods: WbGood[];
};

const wbCache = new Map<string, WbCabCache>();
const wbInflight = new Map<string, Promise<WbGood[]>>();

function admin() {
  return getAdminClient();
}

export function normProduct(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function discountPct(price: number, discounted: number): number {
  if (!price || price <= 0) return 0;
  return Math.max(0, Math.min(99, Math.round((1 - discounted / price) * 100)));
}

/**
 * Единый скоринг: query владельца ↔ vendorCode / название карточки.
 * Понимает «жл»=жилетка, темносиний, укороченный и т.п.
 */
export function scoreProductMatch(haystack: string, query: string): number {
  const vRaw = normProduct(haystack);
  const v = vRaw.replace(/ /g, '');
  const qRaw = normProduct(stripCabinetAliases(query));
  const q = qRaw.replace(/ /g, '');
  if (!v || !q) return 0;
  let score = 0;

  // qRe — что сказал человек; vRe — как может быть в vendorCode / названии
  const types: Array<[RegExp, RegExp, number]> = [
    [/жилетк?|жилет/, /(?:жилет|^жл(?=[а-я\-]|$)|(^|[^а-я])жл([^а-я]|$))/, 7],
    [/(^|[^а-я])жл([^а-я]|$)/, /(?:жилет|^жл|жл)/, 7],
    [/лапш|водолазк|гольф/, /лапш|водолазк|гольф/, 6],
    [/фонар/, /фонар/, 6],
    [/вырез|v\s*вырез|v\-вырез/, /вырез/, 6],
    [/блузк?/, /блуз/, 3],
    [/укороч|crop|кроп/, /укороч|crop|кроп|укороч\.?пидж/, 6],
    [/костюм/, /костюм|кост|двойка|костнов/, 4],
    [/костнов/, /костнов|костюм|жакет/, 5],
    [/двойк/, /двойк|костюм/, 5],
    [/пиджак|жакет|пидж/, /пиджак|жакет|пидж/, 4],
    [/бомбер/, /бомбер/, 6],
    [/кимоно/, /кимоно/, 6],
    [/плать/, /плать/, 5],
    [/(лиза|рыбк|парижанк)/, /(лиза|рыбк|парижанк)/, 5],
    [/рубашк/, /рубашк/, 5],
    [/клетк|полоск|елочк|ёлочк/, /клетк|полоск|елочк|ёлочк/, 4],
    [/куртк|фуфайк|ветровк/, /куртк|фуфайк|ветровк/, 5],
    [/брюч|брюк/, /брюч|брюк/, 3],
    [/юбк/, /юбк/, 5],
    [/кардиган/, /кардиган/, 6],
    [/свитер|свитшот|худи/, /свитер|свитшот|худи/, 5],
    [/топ(?![а-я])|майк/, /топ|майк/, 4],
    [/комбинезон|комбез/, /комбинезон|комбез/, 6],
    [/пальто|полупальто|тренч|плащ/, /пальто|полупальто|тренч|плащ/, 5],
    [/спорт|велюр|originals|sport\s*rich/, /спорт|велюр|originals|sport/, 4],
    [/оверсайз|oversiz/, /оверсайз|oversiz|over/, 4],
    [/поло(?![а-я])/, /поло/, 5],
    [/джинс/, /джинс/, 4],
  ];
  for (const [qRe, vRe, pts] of types) {
    if (qRe.test(qRaw) && vRe.test(vRaw)) score += pts;
  }

  const colors: Array<[RegExp, RegExp, number]> = [
    [/бел/, /бел/, 4],
    [/(черн|чёрн)/, /черн/, 4],
    [/беж|песочн|camel|кэмел/, /беж|песочн|camel|кэмел/, 4],
    [/коричнев|корич|шоколад|мокко|шоко|капучин|темншок|кофе/, /коричнев|корич|шоколад|мокко|шоко|капучин|темншок|кофе/, 4],
    [/графит|сер(ый|ая|ое|ые)?|светлосер/, /графит|сер|граф|светлосер/, 3],
    [/бордо|marsala|марсал/, /бордо|бардо|марсал/, 4],
    [/электрик/, /электрик/, 4],
    [/(темно\s*син|тёмно\s*син|темносин|тсинь?|тёмносин|т\-?син)/, /темносин|темно\s*син|тсин|темнсин|т\-?син/, 5],
    [/(^|[^а-я])син(ий|яя|ее|ю|им)?([^а-я]|$)/, /(син|тсин)/, 3],
    [/голуб/, /голуб/, 4],
    [/розов|пудр|фукци/, /розов|пудр|фукци/, 4],
    [/зелен|изумруд|ментол|хак+и|оливк|мятн|мята/, /зелен|изумруд|ментол|хак+и|оливк|мятн/, 4],
    [/желт|горчиц|лимон/, /желт|горчиц|лимон/, 4],
    [/фиолет|лилов|сирен/, /фиолет|лилов|сирен/, 4],
    [/айвори|кремов|молочн/, /айвори|кремов|молочн/, 4],
    [/красн|алый|scarlet|терракот|оранж|корал/, /красн|алый|терракот|оранж|корал/, 4],
    [/индиго|navy/, /индиго|navy|темносин/, 4],
  ];
  let colorAsked = false;
  let colorHit = false;
  for (const [qRe, vRe, pts] of colors) {
    if (!qRe.test(qRaw)) continue;
    colorAsked = true;
    if (vRe.test(vRaw)) {
      score += pts;
      colorHit = true;
    }
  }
  if (colorAsked && !colorHit) score -= 3;

  const qTokens = qRaw.split(' ').filter((t) => t.length >= 3);
  const vTokens = new Set(vRaw.split(' ').filter((t) => t.length >= 3));
  for (const t of qTokens) {
    if (v.includes(t) || [...vTokens].some((vt) => vt.includes(t) || t.includes(vt))) {
      score += 1;
    }
  }

  const nm = qRaw.match(/\b(\d{6,12})\b/);
  if (nm && (v.includes(nm[1]) || haystack.includes(nm[1]))) score += 20;

  return score;
}

/** @deprecated alias — старые импорты */
export const scorePriceProduct = scoreProductMatch;

function topCluster(hits: CatalogHit[], max = 8, gap = 1): CatalogHit[] {
  if (!hits.length) return [];
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'));
  const best = hits[0].score;
  return hits.filter((h) => h.score >= best - gap).slice(0, max);
}

async function loadWbGoods(cabinetId: string, tokenRaw: string): Promise<WbGood[]> {
  const cached = wbCache.get(cabinetId);
  if (cached && Date.now() - cached.at < WB_TTL_MS) return cached.goods;

  const inflight = wbInflight.get(cabinetId);
  if (inflight) return inflight;

  const job = (async () => {
    const token = sanitizeWbToken(tokenRaw);
    const goods: WbGood[] = [];
    if (!token) return goods;
    for (let offset = 0; offset < 1000; offset += 100) {
      const url = `${PRICES_API}/api/v2/list/goods/filter?limit=100&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) break;
      const body = await res.json() as {
        data?: {
          listGoods?: Array<{
            nmID?: number;
            vendorCode?: string;
            sizes?: Array<{ price?: number; discountedPrice?: number }>;
          }>;
        };
      };
      const chunk = body?.data?.listGoods || [];
      if (!chunk.length) break;
      for (const g of chunk) {
        const nmId = Number(g.nmID || 0);
        const vendorCode = String(g.vendorCode || '');
        const size = (g.sizes || [])[0] || {};
        const price = Number(size.price || 0);
        const discountedPrice = Number(size.discountedPrice || price);
        if (!nmId || !price) continue;
        goods.push({
          nmId,
          vendorCode,
          price,
          discountedPrice,
          discountPct: discountPct(price, discountedPrice),
        });
      }
      if (chunk.length < 100) break;
      // пауза только между страницами (не после последней)
      await new Promise((r) => setTimeout(r, 40));
    }
    wbCache.set(cabinetId, { at: Date.now(), goods });
    return goods;
  })();

  wbInflight.set(cabinetId, job);
  try {
    return await job;
  } finally {
    wbInflight.delete(cabinetId);
  }
}

async function findFromRnp(
  query: string,
  preferCabinetId: string | null | undefined,
  cabinets: Array<{ id: string; name: string }>,
): Promise<CatalogHit[]> {
  const db = admin();
  const byId = new Map(cabinets.map((c) => [c.id, c.name]));
  let q = db.from('rnp_articles').select('cabinet_id, nm_id, name').limit(1500);
  if (preferCabinetId) q = q.eq('cabinet_id', preferCabinetId);
  const { data } = await q;
  const out: CatalogHit[] = [];
  for (const row of data || []) {
    const name = String(row.name || '');
    const score = scoreProductMatch(name, query);
    if (score < 4) continue;
    const nmId = Number(row.nm_id);
    const cabinetId = String(row.cabinet_id);
    if (!Number.isFinite(nmId) || !cabinetId) continue;
    out.push({
      cabinetId,
      cabinetName: byId.get(cabinetId) || cabinetId,
      nmId,
      title: name,
      vendorCode: name,
      score,
      source: 'rnp',
    });
  }
  return out;
}

async function findFromWb(
  query: string,
  preferCabinetId: string | null | undefined,
  cabinets: Array<{ id: string; name: string }>,
): Promise<CatalogHit[]> {
  const db = admin();
  const list = preferCabinetId
    ? cabinets.filter((c) => c.id === preferCabinetId)
    : cabinets;
  const out: CatalogHit[] = [];
  const nmOnly = normProduct(query).replace(/ /g, '').match(/^(\d{6,12})$/);

  const ids = list.map((c) => c.id);
  if (!ids.length) return out;
  const { data: tokenRows } = await db
    .from('cabinets')
    .select('id, name, wb_token')
    .in('id', ids);
  const withToken = (tokenRows || []).filter((r) => r.wb_token);

  await Promise.all(withToken.map(async (data) => {
    try {
      const goods = await loadWbGoods(String(data.id), String(data.wb_token));
      for (const g of goods) {
        let score = scoreProductMatch(g.vendorCode, query);
        if (nmOnly && g.nmId === Number(nmOnly[1])) score = Math.max(score, 20);
        if (score < 4 && !nmOnly) continue;
        if (nmOnly && g.nmId !== Number(nmOnly[1])) continue;
        out.push({
          cabinetId: String(data.id),
          cabinetName: String(data.name),
          nmId: g.nmId,
          title: g.vendorCode,
          vendorCode: g.vendorCode,
          score,
          source: 'wb_prices',
          price: g.price,
          discountedPrice: g.discountedPrice,
          discountPct: g.discountPct,
        });
      }
    } catch (e) {
      console.error('[product-catalog] wb', data.name, e);
    }
  }));
  return out;
}

/**
 * Поиск артикула по всем (или одному) кабинетам.
 * sources: rnp + wb_prices по умолчанию.
 */
export async function findCatalogProducts(
  query: string,
  opts?: {
    cabinetId?: string | null;
    sources?: Array<'rnp' | 'wb_prices'>;
    minScore?: number;
    max?: number;
  },
): Promise<CatalogHit[]> {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const sources = opts?.sources || ['rnp', 'wb_prices'];
  const prefer = opts?.cabinetId || null;
  const cabinets = await listCabinets();

  const jobs: Promise<CatalogHit[]>[] = [];
  if (sources.includes('rnp')) jobs.push(findFromRnp(q, prefer, cabinets));
  if (sources.includes('wb_prices')) jobs.push(findFromWb(q, prefer, cabinets));
  const parts = (await Promise.all(jobs)).flat();

  // дедуп по cabinet+nm, берём лучший score / предпочитаем wb_prices (есть цены)
  const best = new Map<string, CatalogHit>();
  for (const h of parts) {
    const key = `${h.cabinetId}:${h.nmId}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, h);
      continue;
    }
    if (h.score > prev.score) best.set(key, h);
    else if (h.score === prev.score && h.source === 'wb_prices') best.set(key, h);
  }

  let hits = [...best.values()];
  const min = opts?.minScore ?? 4;
  hits = hits.filter((h) => h.score >= min);
  return topCluster(hits, opts?.max ?? 8, 1);
}

/** Короткий человеческий ярлык артикула. */
export function humanProductLabel(hit: CatalogHit): string {
  const name = hit.vendorCode || hit.title || String(hit.nmId);
  return `${hit.cabinetName} · ${name}`;
}
