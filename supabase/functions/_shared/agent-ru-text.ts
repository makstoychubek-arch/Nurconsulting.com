/**
 * Общие хелперы для русского текста в ботах.
 * JS \b / \w не работают с кириллицей — границы и токены здесь.
 */

/** Символы по краям «слова» (кириллица-safe вместо \b). */
export const RU_EDGE = String.raw`[\s,.:;!?/\\|«»"'…]`;

/** RegExp: слово/альтернативы с Unicode-границами. */
export function ruBounded(inner: string, flags = "i"): RegExp {
  return new RegExp(`(?:^|${RU_EDGE})(?:${inner})(?=$|${RU_EDGE})`, flags);
}

/** Есть ли токен (альтернативы через |) на границе слова. */
export function hasRuToken(text: string, inner: string): boolean {
  return ruBounded(inner).test(String(text || ""));
}

export type StopTokenOpts = {
  exact?: ReadonlySet<string>;
  prefix?: RegExp;
  minLen?: number;
  /** Отбрасывать чистые числа (включая 12.5). */
  dropNumbers?: boolean;
};

/**
 * Разбить на токены и выкинуть стоп-слова / префиксы.
 * Списки стопов остаются у вызывающего — здесь только форма цикла.
 */
export function filterStopTokens(text: string, opts: StopTokenOpts = {}): string {
  const minLen = opts.minLen ?? 2;
  const exact = opts.exact;
  const prefix = opts.prefix;
  const dropNumbers = opts.dropNumbers === true;
  return String(text || "")
    .split(/\s+/)
    .filter((w) => w.length >= minLen)
    .filter((w) => {
      if (dropNumbers && /^\d+([.,]\d+)?$/.test(w)) return false;
      const low = w.toLowerCase().replace(/ё/g, "е");
      if (exact?.has(low)) return false;
      if (prefix?.test(low)) return false;
      return true;
    })
    .join(" ")
    .trim();
}

/** Календарная дата в Бишкеке (YYYY-MM-DD). */
export function todayBishkek(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bishkek" });
}

export function yesterdayBishkek(): string {
  return daysAgoBishkek(1);
}

/** N календарных дней назад по Бишкеку (не UTC-сдвиг). */
export function daysAgoBishkek(days: number): string {
  const today = todayBishkek(); // YYYY-MM-DD
  const [y, m, d] = today.split("-").map(Number);
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(utcNoon - days * 86400000);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Есть ли относительная дата или dd.mm[.yy] в тексте. */
export function hasRuDayOrDdMm(text: string): boolean {
  const t = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (/(вчера|позавчера|сегодня)/i.test(t)) return true;
  return /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/.test(text);
}

/**
 * Распарсить день: позавчера / вчера / сегодня / dd.mm[.yy] → YYYY-MM-DD (Бишкек).
 * Без относительного слова и без даты → null.
 */
export function parseRuDayToken(text: string): string | null {
  const raw = String(text || "").replace(/@\w+/g, " ").trim();
  const lower = raw.toLowerCase().replace(/ё/g, "е");
  if (/позавчера/i.test(lower)) return daysAgoBishkek(2);
  if (/вчера/i.test(lower)) return yesterdayBishkek();
  if (/сегодня/i.test(lower)) return todayBishkek();
  const m = raw.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  const year = m[3]
    ? (m[3].length === 2 ? `20${m[3]}` : m[3])
    : String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}
