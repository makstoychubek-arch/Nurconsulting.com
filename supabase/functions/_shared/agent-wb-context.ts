// Краткая сводка WB по всем кабинетам для Telegram-агентов.
// Цель: коротко, цифры, без простыней. Кэш на один запрос цепочки.

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdminClient } from "./supabase-admin.ts";

const STATS_API = "https://statistics-api.wildberries.ru";

export type AgentKey = "karina" | "saule" | "amina" | "anton" | "alina" | "muha";

/** Переиспользуемый кэш внутри одной цепочки агентов. */
export type WbContextCache = {
  salesBlock?: string[];
  adsLines?: string[];
  fbsLines?: string[];
  byAgent: Map<string, string>;
};

export function createWbContextCache(): WbContextCache {
  return { byAgent: new Map() };
}

/** Isolate-кэш между запросами — сильно ускоряет hop-chain и повторные /sales /fbs. */
function globalWbTtlMs(): number {
  try {
    const n = Number(Deno.env.get("WB_CONTEXT_TTL_MS") || "90000");
    return Number.isFinite(n) && n > 0 ? n : 90000;
  } catch {
    return 90000;
  }
}

function wbCacheDisabled(): boolean {
  try {
    const v = (Deno.env.get("DISABLE_WB_CONTEXT_CACHE") || "").trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
    // TTL=0 — явный выключатель без отдельного флага
    const n = Number(Deno.env.get("WB_CONTEXT_TTL_MS") || "90000");
    return Number.isFinite(n) && n <= 0;
  } catch {
    return false;
  }
}

/** Ключ: agent (+ готовый текст брифа). TTL 90с — hop-chain укладывается в окно. */
const globalWbByAgent = new Map<string, { ts: number; text: string }>();
let globalShared: {
  ts: number;
  salesBlock?: string[];
  adsLines?: string[];
  fbsLines?: string[];
} | null = null;

/** In-flight dedup: параллельные вызовы одного ключа ждут один Promise (без double-fetch). */
const inflightByAgent = new Map<string, Promise<string>>();
const inflightShared = new Map<string, Promise<string[]>>();

async function getSharedBlock(
  kind: "sales" | "ads" | "fbs",
  bag: WbContextCache,
  loader: () => Promise<string[]>,
): Promise<string[]> {
  const cached =
    kind === "sales" ? bag.salesBlock : kind === "ads" ? bag.adsLines : bag.fbsLines;
  if (cached) {
    console.log(`[agent-wb-context] cache hit request kind=${kind}`);
    return cached;
  }

  if (!wbCacheDisabled() && globalShared && Date.now() - globalShared.ts < globalWbTtlMs()) {
    const fromGlobal =
      kind === "sales"
        ? globalShared.salesBlock
        : kind === "ads"
        ? globalShared.adsLines
        : globalShared.fbsLines;
    if (fromGlobal) {
      console.log(`[agent-wb-context] cache hit isolate kind=${kind}`);
      if (kind === "sales") bag.salesBlock = fromGlobal;
      else if (kind === "ads") bag.adsLines = fromGlobal;
      else bag.fbsLines = fromGlobal;
      return fromGlobal;
    }
  }

  const waiting = inflightShared.get(kind);
  if (waiting) {
    console.log(`[agent-wb-context] cache wait inflight kind=${kind}`);
    const lines = await waiting;
    if (kind === "sales") bag.salesBlock = lines;
    else if (kind === "ads") bag.adsLines = lines;
    else bag.fbsLines = lines;
    return lines;
  }

  const p = loader();
  inflightShared.set(kind, p);
  try {
    const lines = await p;
    if (kind === "sales") bag.salesBlock = lines;
    else if (kind === "ads") bag.adsLines = lines;
    else bag.fbsLines = lines;
    // публикуем блок сразу — другие агенты не ждут конца всего build
    if (!wbCacheDisabled()) {
      const ts = Date.now();
      globalShared = {
        ts: globalShared?.ts && Date.now() - globalShared.ts < globalWbTtlMs()
          ? globalShared.ts
          : ts,
        salesBlock: kind === "sales" ? lines : (bag.salesBlock ?? globalShared?.salesBlock),
        adsLines: kind === "ads" ? lines : (bag.adsLines ?? globalShared?.adsLines),
        fbsLines: kind === "fbs" ? lines : (bag.fbsLines ?? globalShared?.fbsLines),
      };
      // refresh ts on any block update
      globalShared.ts = ts;
    }
    return lines;
  } finally {
    inflightShared.delete(kind);
  }
}

function sanitizeWbToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^\uFEFF/, "").replace(/\s+/g, "").trim();
}

function yesterdayBishkek(): string {
  const now = new Date(Date.now() + 6 * 3600 * 1000);
  now.setUTCDate(now.getUTCDate() - 1);
  return now.toISOString().slice(0, 10);
}

function todayBishkek(): string {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU").replace(/\u00A0/g, " ");
}

async function wbGetArray(url: string, token: string): Promise<unknown[]> {
  const res = await fetch(url, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

type DayTotals = {
  ordersCount: number;
  ordersSum: number;
  buyoutsCount: number;
  buyoutsSum: number;
  cancels: number;
  topArticles: Array<{ article: string; qty: number; sum: number }>;
};

// deno-lint-ignore no-explicit-any
function summarizeDay(orders: any[], sales: any[]): DayTotals {
  const byArt = new Map<string, { qty: number; sum: number }>();
  let ordersCount = 0;
  let ordersSum = 0;
  let cancels = 0;
  for (const o of orders || []) {
    if (o?.isCancel) {
      cancels++;
      continue;
    }
    ordersCount++;
    const sum = Number(o?.priceWithDisc ?? o?.totalPrice ?? 0);
    ordersSum += Number.isFinite(sum) ? sum : 0;
    const art = String(o?.supplierArticle || o?.nmId || "?").trim();
    const cur = byArt.get(art) || { qty: 0, sum: 0 };
    cur.qty += 1;
    cur.sum += Number.isFinite(sum) ? sum : 0;
    byArt.set(art, cur);
  }
  let buyoutsCount = 0;
  let buyoutsSum = 0;
  for (const s of sales || []) {
    const saleId = String(s?.saleID || "");
    if (saleId && !saleId.startsWith("S")) continue;
    buyoutsCount++;
    const v = Number(s?.priceWithDisc ?? s?.forPay ?? 0);
    buyoutsSum += Number.isFinite(v) ? v : 0;
  }
  const topArticles = [...byArt.entries()]
    .map(([article, v]) => ({ article, qty: v.qty, sum: v.sum }))
    .sort((a, b) => b.qty - a.qty || b.sum - a.sum)
    .slice(0, 5);
  return { ordersCount, ordersSum, buyoutsCount, buyoutsSum, cancels, topArticles };
}

async function fetchCabinetDay(token: string, date: string): Promise<DayTotals> {
  const [orders, sales] = await Promise.all([
    wbGetArray(`${STATS_API}/api/v1/supplier/orders?dateFrom=${date}&flag=1`, token).catch(() => []),
    wbGetArray(`${STATS_API}/api/v1/supplier/sales?dateFrom=${date}&flag=1`, token).catch(() => []),
  ]);
  return summarizeDay(orders, sales);
}

/** Параллельно, но не больше `limit` одновременно. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function adminClient(): SupabaseClient {
  return getAdminClient();
}

async function loadSalesBlock(
  supabase: SupabaseClient,
  yDay: string,
  tDay: string,
): Promise<string[]> {
  const { data: cabinets } = await supabase
    .from("cabinets")
    .select("id, name, wb_token")
    .not("wb_token", "is", null)
    .gt("wb_token", "")
    .order("name");

  const list = (cabinets || []).filter((c) => sanitizeWbToken(c.wb_token).length >= 50);
  if (!list.length) return ["Кабинетов с WB-токеном нет."];

  return await mapPool(list, 3, async (cab) => {
    const token = sanitizeWbToken(cab.wb_token);
    try {
      const [y, t] = await Promise.all([
        fetchCabinetDay(token, yDay),
        fetchCabinetDay(token, tDay),
      ]);
      return [
        `▶ ${cab.name}`,
        `  вчера: заказы ${y.ordersCount} шт / ${fmt(y.ordersSum)} ₽; выкупы ${y.buyoutsCount} шт / ${fmt(y.buyoutsSum)} ₽; отмены ${y.cancels}`,
        `  сегодня: заказы ${t.ordersCount} шт / ${fmt(t.ordersSum)} ₽; выкупы ${t.buyoutsCount} шт / ${fmt(t.buyoutsSum)} ₽`,
        y.topArticles.length
          ? `  топ вчера: ${y.topArticles.map((a) => `${a.article} ${a.qty}шт`).join("; ")}`
          : "  топ вчера: нет заказов",
      ].join("\n");
    } catch (e) {
      return `▶ ${cab.name}: ошибка WB (${String(e).slice(0, 80)})`;
    }
  });
}

/** Собирает текстовый бриф под роль агента по всем кабинетам. */
export async function buildAgentWbContext(
  agent: AgentKey,
  cache?: WbContextCache,
): Promise<string> {
  // 1) request-local (один hop-chain / один wbCache)
  if (cache?.byAgent.has(agent)) {
    console.log(`[agent-wb-context] cache hit request agent=${agent}`);
    return cache.byAgent.get(agent)!;
  }

  const now = Date.now();
  const ttl = globalWbTtlMs();
  const disabled = wbCacheDisabled();

  // 2) isolate TTL-кэш (между запросами в том же Deno isolate)
  if (!disabled) {
    const gHit = globalWbByAgent.get(agent);
    if (gHit && now - gHit.ts < ttl) {
      console.log(
        `[agent-wb-context] cache hit isolate agent=${agent} ageMs=${now - gHit.ts}`,
      );
      cache?.byAgent.set(agent, gHit.text);
      return gHit.text;
    }
  }

  // 3) parallel same-key → один fetch
  const waiting = inflightByAgent.get(agent);
  if (waiting) {
    console.log(`[agent-wb-context] cache wait inflight agent=${agent}`);
    const text = await waiting;
    cache?.byAgent.set(agent, text);
    return text;
  }

  const buildP = (async () => {
    const supabase = adminClient();
    const yDay = yesterdayBishkek();
    const tDay = todayBishkek();
    const bag = cache ?? createWbContextCache();

    // Подтягиваем shared-блоки из isolate-кэша (без повторных WB/DB)
    if (!disabled && globalShared && Date.now() - globalShared.ts < ttl) {
      bag.salesBlock ??= globalShared.salesBlock;
      bag.adsLines ??= globalShared.adsLines;
      bag.fbsLines ??= globalShared.fbsLines;
    }

    const lines: string[] = [
      `Дата: сегодня ${pretty(tDay)}, вчера ${pretty(yDay)} (Бишкек).`,
      `Агент: ${agent}. Ниже факты из WB — опирайся только на них.`,
    ];

    const needsSales =
      agent === "saule" ||
      agent === "karina" ||
      agent === "alina" ||
      agent === "muha" ||
      agent === "anton";
    const needsAds = agent === "amina" || agent === "karina";
    const needsFbs = agent === "anton" || agent === "karina" || agent === "saule";

    // параллельно: sales (WB) + ads/fbs (DB) — wall time ≈ max, не sum
    await Promise.all([
      needsSales
        ? getSharedBlock("sales", bag, () => loadSalesBlock(supabase, yDay, tDay))
        : Promise.resolve(null),
      needsAds
        ? getSharedBlock("ads", bag, () => loadAdsBrief(supabase))
        : Promise.resolve(null),
      needsFbs
        ? getSharedBlock("fbs", bag, () => loadFbsBrief(supabase, yDay, tDay))
        : Promise.resolve(null),
    ]);

    if (agent === "saule" || agent === "karina" || agent === "alina") {
      lines.push("", "=== ПРОДАЖИ / ЗАКАЗЫ ===", ...(bag.salesBlock || []));
    }

    if (needsAds) {
      lines.push("", "=== РЕКЛАМА ===", ...(bag.adsLines || []));
    }

    if (needsFbs) {
      lines.push("", "=== FBS ===", ...(bag.fbsLines || []));
    }

    if (agent === "muha" || agent === "alina") {
      if (!bag.salesBlock) {
        await getSharedBlock("sales", bag, () => loadSalesBlock(supabase, yDay, tDay));
      }
      lines.push(
        "",
        "=== КОНТЕНТ / ПРОДВИЖЕНИЕ ===",
        "Отдельного API фотоворонки нет — используй топ артикулы из продаж и давай гипотезы по контенту/продвижению кратко.",
        ...(bag.salesBlock || []).slice(0, 6),
      );
    }

    const text = lines.join("\n");
    const clipped = text.length > 7000 ? text.slice(0, 7000) + "\n…(обрезано)" : text;
    bag.byAgent.set(agent, clipped);
    if (!disabled) {
      const ts = Date.now();
      globalWbByAgent.set(agent, { ts, text: clipped });
      globalShared = {
        ts,
        salesBlock: bag.salesBlock,
        adsLines: bag.adsLines,
        fbsLines: bag.fbsLines,
      };
    }
    return clipped;
  })();

  inflightByAgent.set(agent, buildP);
  try {
    return await buildP;
  } finally {
    inflightByAgent.delete(agent);
  }
}

// deno-lint-ignore no-explicit-any
async function loadAdsBrief(supabase: any): Promise<string[]> {
  const [{ data: activeRows }, { data: pauseRows }] = await Promise.all([
    supabase
      .from("advertising_campaigns")
      .select("campaign_id, campaign_name, status, cabinets!inner(name)")
      .eq("status", 9)
      .limit(100),
    supabase
      .from("advertising_campaigns")
      .select("campaign_id, status, cabinets!inner(name)")
      .eq("status", 11)
      .limit(200),
  ]);

  if (!activeRows?.length && !pauseRows?.length) {
    return ["Кампаний в базе нет / не синхронизированы."];
  }

  const byCab = new Map<string, { active: number; pause: number; total: number; names: string[] }>();
  const touch = (cab: string) => {
    const cur = byCab.get(cab) || { active: 0, pause: 0, total: 0, names: [] };
    byCab.set(cab, cur);
    return cur;
  };
  for (const row of activeRows || []) {
    const cab = String(row.cabinets?.name || "?");
    const cur = touch(cab);
    cur.active++;
    cur.total++;
    if (cur.names.length < 5) cur.names.push(String(row.campaign_name || row.campaign_id));
  }
  for (const row of pauseRows || []) {
    const cab = String(row.cabinets?.name || "?");
    const cur = touch(cab);
    cur.pause++;
    cur.total++;
  }

  const out: string[] = [];
  for (const [cab, v] of [...byCab.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push(
      `▶ ${cab}: активных ${v.active}, пауза ${v.pause}, в выборке ${v.total}` +
        (v.names.length ? `; активные: ${v.names.join(", ")}` : ""),
    );
  }
  out.push("Статус 9 = активна, 11 = пауза (как в WB).");
  return out;
}

// deno-lint-ignore no-explicit-any
async function loadFbsBrief(supabase: any, yDay: string, tDay: string): Promise<string[]> {
  const { data } = await supabase
    .from("fbs_daily_orders")
    .select("report_date, cabinet, product_name, size, qty")
    .in("report_date", [yDay, tDay])
    .limit(200);

  if (!data?.length) {
    return [
      `FBS за ${pretty(yDay)} / ${pretty(tDay)}: записей нет (или кабинет не активен в fbs_active_cabinets).`,
    ];
  }

  const byKey = new Map<string, number>();
  for (const r of data) {
    const key = `${r.report_date}|${r.cabinet}|${r.product_name || "?"}`;
    byKey.set(key, (byKey.get(key) || 0) + Number(r.qty || 1));
  }
  const lines = [...byKey.entries()]
    .map(([k, qty]) => {
      const [date, cab, name] = k.split("|");
      return `${pretty(date)} · ${cab}: ${name} — ${qty} шт`;
    })
    .slice(0, 30);
  return lines.length ? lines : ["Нет агрегатов FBS."];
}
