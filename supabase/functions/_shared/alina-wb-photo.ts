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

/** Клиент просит фото товара (много разговорных / с опечатками). */
export function wantsProductPhoto(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return false;

  // «фоту», «фотку», «фоткуу», «фотку плз», «photo pls»
  const photoWord =
    /(фото|фотк\w*|фоту|фотик|фоточк\w*|картинк\w*|изображен\w*|внешн\w*|вид\w*|photo|pic|picture)/i;

  if (/^(фото|фотк\w*|фоту|фотик|photo|pic)([!?.…]|\s|$)/i.test(t)) return true;
  if (/^(главн\w*|основн\w*)\s+(фото|фотк\w*|фоту)\b/i.test(t)) return true;

  if (
    /(можно|можн|можешь|можете|скинь|скиньте|пришли|пришлите|покажи|покажите|дайте|дай|есть|нужно|надо|хочу|кинь|киньте|закинь|закиньте|скинька|плиз|плз|pls|please)/i
      .test(t) && photoWord.test(t)
  ) {
    return true;
  }

  if (
    /(главн\w*\s+фото|фото\s+главн|основн\w*\s+фото|фото\s+с\s*(вб|wildberries|карточки)|фото\s+товар)/i
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
