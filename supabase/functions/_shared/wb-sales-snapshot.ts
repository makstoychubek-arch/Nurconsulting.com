// Снимок продаж по кабинету за один день (WB Statistics API, flag=1).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidWbToken, sanitizeWbToken } from "./wb-cabinet-tokens.ts";

const STATS_API = "https://statistics-api.wildberries.ru";

export type SalesTotals = {
  ordersCount: number;
  ordersSum: number;
  buyoutCount: number;
  buyoutSum: number;
};

export type CabinetSalesSnapshot = {
  name: string;
  totals: SalesTotals;
  error?: string;
};

export async function fetchAllCabinetSales(
  admin: ReturnType<typeof createClient>,
  date: string,
  onlyCabinet?: string,
): Promise<CabinetSalesSnapshot[]> {
  const { data: cabinets, error } = await admin
    .from("cabinets")
    .select("name, wb_token")
    .not("wb_token", "is", null)
    .gt("wb_token", "")
    .order("name");
  if (error) throw new Error(error.message);

  const out: CabinetSalesSnapshot[] = [];
  for (const cab of cabinets || []) {
    if (onlyCabinet && !cab.name.toLowerCase().includes(onlyCabinet.toLowerCase())) {
      continue;
    }
    const token = sanitizeWbToken(cab.wb_token);
    if (!isValidWbToken(token)) continue;
    try {
      const totals = await fetchSalesTotals(token, date);
      out.push({ name: cab.name, totals });
    } catch (e) {
      out.push({
        name: cab.name,
        totals: emptyTotals(),
        error: String(e).slice(0, 120),
      });
    }
  }
  return out;
}

/**
 * Заказы + выкупы за день. Ошибки эндпоинтов независимы:
 * один упал — второй всё равно учитываем (как в daily-sales-report).
 */
export async function fetchSalesTotals(token: string, date: string): Promise<SalesTotals> {
  const ordersUrl = `${STATS_API}/api/v1/supplier/orders?dateFrom=${date}&flag=1`;
  const salesUrl = `${STATS_API}/api/v1/supplier/sales?dateFrom=${date}&flag=1`;

  const [ordersRes, salesRes] = await Promise.all([
    wbGetArraySafe(ordersUrl, token),
    wbGetArraySafe(salesUrl, token),
  ]);

  // Оба эндпоинта упали — это реальная «нет данных»
  if (ordersRes.error && salesRes.error) {
    throw new Error(`WB orders+sales: ${ordersRes.error}; ${salesRes.error}`);
  }

  return aggregateTotals(ordersRes.data || [], salesRes.data || []);
}

/** С ретраем на 429/5xx. */
async function wbGetArraySafe(
  url: string,
  token: string,
): Promise<{ data: unknown[]; error?: string }> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: token },
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastErr = `WB ${res.status}`;
        await sleep(800 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        return { data: [], error: `WB ${res.status}: ${text.slice(0, 80)}` };
      }
      const data = JSON.parse(text);
      return { data: Array.isArray(data) ? data : [] };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await sleep(600 * (attempt + 1));
    }
  }
  return { data: [], error: lastErr || "WB fetch failed" };
}

// deno-lint-ignore no-explicit-any
function aggregateTotals(orders: any[], sales: any[]): SalesTotals {
  let ordersCount = 0;
  let ordersSum = 0;
  let buyoutCount = 0;
  let buyoutSum = 0;

  for (const o of orders || []) {
    if (o?.isCancel) continue;
    ordersCount++;
    const v = Number(o?.priceWithDisc ?? o?.totalPrice ?? 0);
    ordersSum += Number.isFinite(v) ? v : 0;
  }

  for (const s of sales || []) {
    const saleId = String(s?.saleID || "");
    if (saleId && !saleId.startsWith("S")) continue;
    buyoutCount++;
    const v = Number(s?.priceWithDisc ?? s?.forPay ?? 0);
    buyoutSum += Number.isFinite(v) ? v : 0;
  }

  return { ordersCount, ordersSum, buyoutCount, buyoutSum };
}

function emptyTotals(): SalesTotals {
  return { ordersCount: 0, ordersSum: 0, buyoutCount: 0, buyoutSum: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/\u00A0/g, " ");
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
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

/** Парсит запрос продаж. В группе «Продажи» достаточно даты: «12.07», «12.07 Baza». */
export function parseSalesQuery(
  text: string,
  relaxed = false,
): { date: string; cabinet?: string } | null {
  const raw = text.replace(/@\w+/g, " ").trim();
  const lower = raw.toLowerCase().replace(/ё/g, "е");

  // без \b — кириллица
  const hasSalesWord = /(продаж|заказ|выкуп|отч[её]?т|sales)/i.test(lower);
  const hasDateToken =
    /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/.test(raw) ||
    /(вчера|позавчера|сегодня)/i.test(lower);

  if (!relaxed && !hasSalesWord && !hasDateToken) return null;

  let date = "";
  if (/позавчера/i.test(lower)) date = daysAgoBishkek(2);
  else if (/вчера/i.test(lower)) date = yesterdayBishkek();
  else if (/сегодня/i.test(lower)) date = todayBishkek();
  else {
    const m = raw.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (m) {
      const day = m[1].padStart(2, "0");
      const month = m[2].padStart(2, "0");
      const year = m[3]
        ? (m[3].length === 2 ? `20${m[3]}` : m[3])
        : String(new Date().getFullYear());
      date = `${year}-${month}-${day}`;
    }
  }
  if (!date) {
    if (
      hasSalesWord ||
      (relaxed && /(baza|zevina|saai|elium|база|зевина|элиум)/i.test(lower))
    ) {
      date = yesterdayBishkek();
    } else {
      return null;
    }
  }

  let cabinet: string | undefined;
  const tailCab = raw.match(
    /\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s+([a-zA-Zа-яА-ЯёЁ0-9._-]{2,30})\s*$/,
  );
  if (tailCab) cabinet = tailCab[1];
  if (!cabinet) {
    const cabMatch = lower.match(/(?:^|[\s,.:;!?/\\|])(?:кабинет|cabinet)\s+([a-zа-яё0-9._-]{2,40})(?:$|[\s,.:;!?/\\|])/i) ||
      lower.match(/(?:^|[\s,.:;!?/\\|])(baza|zevina|saai|elium|сааи|база|зевина|элиум)(?:$|[\s,.:;!?/\\|])/i);
    if (cabMatch) cabinet = cabMatch[1];
  }

  return { date, cabinet };
}

export function formatSalesReply(
  date: string,
  snapshots: CabinetSalesSnapshot[],
): string {
  const pretty = prettyDate(date);
  if (!snapshots.length) {
    return `📊 <b>Продажи · ${pretty}</b>\n\nНет кабинетов с токеном WB.`;
  }

  const lines: string[] = [`📊 <b>Продажи · ${pretty}</b>`, ""];
  let tOc = 0;
  let tOs = 0;
  let tBc = 0;
  let tBs = 0;

  for (const s of snapshots) {
    if (s.error) {
      lines.push(`<b>${esc(s.name)}</b> — ошибка: ${esc(s.error)}`);
      continue;
    }
    const { ordersCount, ordersSum, buyoutCount, buyoutSum } = s.totals;
    if (ordersCount === 0 && buyoutCount === 0) {
      lines.push(`<b>${esc(s.name)}</b> — нет заказов/выкупов`);
      continue;
    }
    tOc += ordersCount;
    tOs += ordersSum;
    tBc += buyoutCount;
    tBs += buyoutSum;
    lines.push(
      `<b>${esc(s.name)}</b>`,
      `🛒 ${ordersCount} шт · ${fmtNum(ordersSum)} сом`,
      `✅ ${buyoutCount} шт · ${fmtNum(buyoutSum)} сом`,
      "",
    );
  }

  if (snapshots.filter((s) => !s.error).length > 1 && (tOc > 0 || tBc > 0)) {
    lines.push(
      `<b>Итого</b>`,
      `🛒 ${tOc} шт · ${fmtNum(tOs)} сом`,
      `✅ ${tBc} шт · ${fmtNum(tBs)} сом`,
    );
  }

  return lines.join("\n").trimEnd();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function salesHelpText(): string {
  return [
    "📊 <b>Продажи по дню</b>",
    "",
    "Примеры:",
    "• <code>@бот 12.07</code>",
    "• <code>@бот 12.07 Baza</code>",
    "• <code>@бот продажи вчера</code>",
  ].join("\n");
}
