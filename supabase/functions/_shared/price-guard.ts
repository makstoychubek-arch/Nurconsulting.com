// Защита смены цен: оценка снижения относительно ТЕКУЩИХ цен WB (берём на сервере, а не из запроса клиента),
// код подтверждения для крупных снижений и текст уведомлений. Чистая логика, без обращений к сети.

export type PriceItem = { nmID: number; price: number; discount?: number };
export type CurrentPrice = { price: number; discount: number; discounted: number };

/** Снижение цены со скидкой больше этой доли по любому артикулу требует подтверждения. */
export const DROP_LIMIT = 0.2;
/** Или массовое снижение: столько артикулов (и больше) с падением больше MASS_DROP. */
export const MASS_COUNT = 10;
export const MASS_DROP = 0.1;
export const CODE_TTL_MIN = 10;
export const MAX_ATTEMPTS = 5;

export type Assessment = {
  count: number;
  maxDrop: number; // 0..1, наибольшее снижение цены со скидкой
  massDrops: number; // сколько артикулов упало больше MASS_DROP
  unknown: number; // артикулы, по которым текущую цену узнать не удалось
  needConfirm: boolean;
  lines: Array<{ nmID: number; from: number | null; to: number; pct: number | null }>;
};

const discounted = (price: number, discount: number) => Math.round(price * (1 - discount / 100));

export function assessPriceChange(items: PriceItem[], current: Record<number, CurrentPrice | undefined>): Assessment {
  const lines: Assessment['lines'] = [];
  let maxDrop = 0, massDrops = 0, unknown = 0;
  for (const it of items) {
    const cur = current[it.nmID];
    const disc = it.discount ?? cur?.discount ?? 0;
    const to = discounted(it.price, disc);
    if (!cur || !(cur.discounted > 0)) { unknown++; lines.push({ nmID: it.nmID, from: null, to, pct: null }); continue; }
    const pct = (to - cur.discounted) / cur.discounted; // отрицательное = снижение
    const drop = Math.max(0, -pct);
    if (drop > maxDrop) maxDrop = drop;
    if (drop > MASS_DROP) massDrops++;
    lines.push({ nmID: it.nmID, from: cur.discounted, to, pct });
  }
  // Не смогли узнать текущую цену: считаем рискованным (лучше лишний код, чем пропущенное падение)
  const needConfirm = unknown > 0 || maxDrop > DROP_LIMIT || massDrops >= MASS_COUNT;
  return { count: items.length, maxDrop, massDrops, unknown, needConfirm, lines };
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Подпись списка цен: код подходит только к тем же товарам и тем же новым ценам. */
export async function itemsHash(items: PriceItem[]): Promise<string> {
  const norm = [...items].sort((a, b) => a.nmID - b.nmID).map((i) => `${i.nmID}:${i.price}:${i.discount ?? ''}`).join('|');
  return await sha256Hex(norm);
}

/** Шестизначный код из криптографического генератора. */
export function makeCode(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1_000_000).padStart(6, '0');
}

export const codeHash = (code: string, id: string, hash: string) => sha256Hex(`${code}|${id}|${hash}`);

export function fmtPct(p: number | null): string {
  return p == null ? '?' : (p > 0 ? '+' : '') + (p * 100).toFixed(1).replace('.', ',') + '%';
}

export function summaryText(a: Assessment): string {
  const known = a.lines.filter((l) => l.pct != null) as Array<{ pct: number }>;
  const worst = known.length ? Math.min(...known.map((l) => l.pct)) : null;
  const best = known.length ? Math.max(...known.map((l) => l.pct)) : null;
  return `${a.count} артикулов, изменение цены со скидкой от ${fmtPct(worst)} до ${fmtPct(best)}` + (a.unknown ? `, у ${a.unknown} текущая цена неизвестна` : '');
}
