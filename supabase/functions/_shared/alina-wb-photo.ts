// Главное фото карточки WB по nmId (публичный CDN basket-XX.wbbasket.ru).

const MAX_BASKET = 60;
const BASKET_PROBE_BATCH = 12;

async function probeBasketHost(vol: number, part: number, nm: number): Promise<number | null> {
  for (let start = 1; start <= MAX_BASKET; start += BASKET_PROBE_BATCH) {
    const batch = Array.from(
      { length: Math.min(BASKET_PROBE_BATCH, MAX_BASKET - start + 1) },
      (_, i) => start + i,
    );
    const results = await Promise.all(batch.map(async (b) => {
      const bStr = String(b).padStart(2, '0');
      const url =
        `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        return res.ok ? b : null;
      } catch {
        return null;
      }
    }));
    const found = results.find((r) => r != null);
    if (found != null) return found;
  }
  return null;
}

export type WbPhoto = {
  url: string;
  bytes: Uint8Array;
  mime: string;
  filename: string;
};

/** Скачать главное фото (байты) — Telegram Business часто не тянет webp по URL сам. */
export async function fetchWbMainPhoto(nmId: number | string): Promise<WbPhoto | null> {
  const nm = Number(nmId);
  if (!Number.isFinite(nm) || nm < 100000) return null;
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  const basket = await probeBasketHost(vol, part, nm);
  if (basket == null) return null;
  const bStr = String(basket).padStart(2, '0');
  const bases = [
    `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big`,
    `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/c246x328`,
    `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/tm`,
  ];
  for (const base of bases) {
    for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
      const url = `${base}/1.${ext}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length < 800) continue;
        const mime = ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
        return { url, bytes: buf, mime, filename: `wb-${nm}.${ext}` };
      } catch { /* next */ }
    }
  }
  return null;
}

/** URL первого big-фото (для логов / fallback). */
export async function getWbMainPhotoUrl(nmId: number | string): Promise<string | null> {
  const ph = await fetchWbMainPhoto(nmId);
  return ph?.url || null;
}

export type WbFilter = { name: string; value: string };

const BRAND_NAME_RE =
  /бренд|brand|производител|торговая\s*марка|vendor|поставщик|seller/i;

/** Приоритет характеристик для подсказки в поиске (бренд никогда). */
const FILTER_PRIORITY = [
  'цвет',
  'сезон',
  'состав',
  'материал',
  'фактура материала',
  'покрой',
  'вырез горловины',
  'пол',
  'особенности модели',
  'вид застежки',
  'декоративные элементы',
  'стиль',
  'коллекция',
  'рисунок',
  'узор',
];

async function resolveBasket(nm: number): Promise<{ basket: number; vol: number; part: number } | null> {
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  const basket = await probeBasketHost(vol, part, nm);
  if (basket == null) return null;
  return { basket, vol, part };
}

/** Характеристики карточки для фильтров поиска — без бренда и артикула. */
export async function fetchWbSearchFilters(nmId: number | string): Promise<WbFilter[]> {
  const nm = Number(nmId);
  if (!Number.isFinite(nm) || nm < 100000) return [];
  const loc = await resolveBasket(nm);
  if (!loc) return [];
  const bStr = String(loc.basket).padStart(2, '0');
  const url =
    `https://basket-${bStr}.wbbasket.ru/vol${loc.vol}/part${loc.part}/${nm}/info/ru/card.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const card = await res.json() as {
      options?: Array<{ name?: string; value?: string }>;
      selling?: { brand_name?: string };
    };
    const brand = String(card.selling?.brand_name || '').trim().toLowerCase();
    const out: WbFilter[] = [];
    const seen = new Set<string>();
    for (const o of card.options || []) {
      const name = String(o.name || '').trim();
      const value = String(o.value || '').trim();
      if (!name || !value) continue;
      if (BRAND_NAME_RE.test(name)) continue;
      if (brand && value.toLowerCase() === brand) continue;
      if (/\d{6,}/.test(value)) continue; // не светим артикулы
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, value });
    }
    out.sort((a, b) => {
      const ia = FILTER_PRIORITY.indexOf(a.name.toLowerCase());
      const ib = FILTER_PRIORITY.indexOf(b.name.toLowerCase());
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return out;
  } catch (e) {
    console.warn('[alina-wb-photo] card filters', e);
    return [];
  }
}

/** Клиент просит фото товара (много разговорных / с опечатками). */
export function wantsProductPhoto(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return false;

  // «фоту», «фотку», «фоткуу», «фотку плз», «photo pls»
  // \w* не ест кириллические окончания — [а-яё]*
  const photoWord =
    /(фото|фотк[а-яё]*|фоту|фотик|фоточк[а-яё]*|картинк[а-яё]*|изображен[а-яё]*|внешн[а-яё]*|вид[а-яё]*|photo|pic|picture)/i;

  if (/^(фото|фотк[а-яё]*|фоту|фотик|photo|pic)([!?.…]|\s|$)/i.test(t)) return true;
  if (/^(главн[а-яё]*|основн[а-яё]*)\s+(фото|фотк[а-яё]*|фоту)(?=$|[\s,.:;!?])/i.test(t)) {
    return true;
  }

  if (
    /(можно|можн|можешь|можете|скинь|скиньте|пришли|пришлите|покажи|покажите|дайте|дай|есть|нужно|надо|хочу|кинь|киньте|закинь|закиньте|скинька|плиз|плз|pls|please)/i
      .test(t) && photoWord.test(t)
  ) {
    return true;
  }

  if (
    /(главн[а-яё]*\s+фото|фото\s+главн|основн[а-яё]*\s+фото|фото\s+с\s*(вб|wildberries|карточки)|фото\s+товар)/i
      .test(t)
  ) {
    return true;
  }

  if (/(как\s+выгляд|покажи\s+как|что\s+за\s+вид)/i.test(t)) return true;

  if (photoWord.test(t) && /(товар|блузк|фонар|вырез|модель|арт)/i.test(t)) {
    return true;
  }

  return false;
}
