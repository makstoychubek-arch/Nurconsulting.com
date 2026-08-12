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

/** URL первого (главного) big-фото карточки или null. */
export async function getWbMainPhotoUrl(nmId: number | string): Promise<string | null> {
  const nm = Number(nmId);
  if (!Number.isFinite(nm) || nm < 100000) return null;
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  const basket = await probeBasketHost(vol, part, nm);
  if (basket == null) return null;
  const bStr = String(basket).padStart(2, '0');
  const base =
    `https://basket-${bStr}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big`;
  // главное почти всегда 1.webp; пробуем jpg на всякий
  for (const ext of ['webp', 'jpg', 'png']) {
    const url = `${base}/1.${ext}`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return url;
    } catch { /* next */ }
  }
  // fallback без HEAD — Telegram сам скачает
  return `${base}/1.webp`;
}

export function wantsProductPhoto(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /^(фото|фотку|фотки|photo)\b/i.test(t) ||
    /(можно|можешь|скинь|пришли|покажи|дайте|дай|есть)\s+.{0,20}(фото|фотк|photo)/i
      .test(t) ||
    /(фото|фотк|photo).{0,20}(товар|блузк|фонар|вырез|как\s+выгляд)/i.test(t) ||
    /как\s+выглядит/i.test(t)
  );
}
