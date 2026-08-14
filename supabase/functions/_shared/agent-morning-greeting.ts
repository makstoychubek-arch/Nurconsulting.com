/**
 * Утреннее приветствие команды:
 * ротация стартера → погода (open-meteo) → LLM-старт → hop-реакции коллег.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bishkekNowParts } from "./agent-ad-schedule.ts";
import { AGENT_PROMPTS } from "./agent-personas.ts";
import {
  AGENT_DISPLAY,
  clampHops,
  isDoneReply,
  nextPingFromReply,
  peerTalkBrief,
} from "./agent-team.ts";
import { COLLECTIVE_CHAT_RULES, openingDiversityHint } from "./agent-collective.ts";

export type MorningGreetingRow = {
  id: string;
  chat_id: number;
  is_active: boolean;
  rotation_order: string[];
  last_started_agent: string | null;
  last_run_on: string | null;
  run_hour: number;
  run_minute: number;
  timezone: string;
  weather_locations: string[];
};

export type WeatherBrief = {
  ok: boolean;
  lines: string[];
  error?: string;
};

const DEFAULT_ROTATION = [
  "karina",
  "saule",
  "amina",
  "anton",
  "alina",
  "muha",
] as const;

const WMO_RU: Record<number, string> = {
  0: "ясно",
  1: "преимущественно ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "туман",
  51: "морось",
  53: "морось",
  55: "морось",
  61: "дождь",
  63: "дождь",
  65: "сильный дождь",
  71: "снег",
  73: "снег",
  75: "снег",
  80: "ливень",
  81: "ливень",
  82: "сильный ливень",
  95: "гроза",
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export function morningMaxHops(): number {
  return clampHops(Deno.env.get("MORNING_GREETING_MAX_HOPS"), 3);
}

/** Следующий стартер по кругу (после последнего → первый). */
export function nextAgentInRotation(
  order: string[] | null | undefined,
  lastStarted: string | null | undefined,
): string {
  const list = (order?.length ? order : [...DEFAULT_ROTATION])
    .map((a) => String(a || "").trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return "karina";
  if (!lastStarted) return list[0];
  const last = String(lastStarted).trim().toLowerCase();
  const idx = list.indexOf(last);
  if (idx < 0) return list[0];
  return list[(idx + 1) % list.length];
}

/** План утренней цепочки: стартер + до maxHops-1 коллег из rotation. */
export function buildMorningPlan(
  starter: string,
  order: string[] | null | undefined,
  maxHops: number,
): string[] {
  const list = (order?.length ? order : [...DEFAULT_ROTATION])
    .map((a) => String(a || "").trim().toLowerCase())
    .filter(Boolean);
  const start = String(starter).trim().toLowerCase() || list[0] || "karina";
  const responders = list.filter((a) => a !== start).slice(0, Math.max(0, maxHops - 1));
  return [start, ...responders];
}

/** Жёсткий стоп hop-цепочки утреннего приветствия. */
export function shouldStopMorningHop(opts: {
  hop: number;
  maxHops: number;
  visited: Set<string>;
  targetAgent: string;
  reply?: string;
}): boolean {
  if (opts.hop + 1 >= opts.maxHops) return true;
  if (opts.visited.has(opts.targetAgent)) return true;
  if (opts.reply && isDoneReply(opts.reply) && !nextPingFromReply(opts.reply, opts.visited)) {
    return true;
  }
  return false;
}

type Geo = { lat: number; lon: number; name: string };
const geoCache = new Map<string, Geo | null>();

async function geocodeCity(
  city: string,
  fetchFn: typeof fetch,
): Promise<Geo | null> {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  if (geoCache.has(key)) return geoCache.get(key)!;
  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${
        encodeURIComponent(city)
      }&count=1&language=ru&format=json`;
    const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      geoCache.set(key, null);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const hit = Array.isArray(data?.results) ? data.results[0] : null;
    if (!hit) {
      geoCache.set(key, null);
      return null;
    }
    const geo = {
      lat: Number(hit.latitude),
      lon: Number(hit.longitude),
      name: String(hit.name || city),
    };
    if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lon)) {
      geoCache.set(key, null);
      return null;
    }
    geoCache.set(key, geo);
    return geo;
  } catch {
    geoCache.set(key, null);
    return null;
  }
}

/** Погода на сегодня. При ошибке — ok:false, greeting всё равно идёт. */
export async function fetchWeatherBrief(
  locations: string[],
  fetchFn: typeof fetch = fetch,
): Promise<WeatherBrief> {
  const cities = (locations?.length ? locations : ["Bishkek"])
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .slice(0, 4);
  const lines: string[] = [];
  let anyOk = false;
  for (const city of cities) {
    try {
      const geo = await geocodeCity(city, fetchFn);
      if (!geo) continue;
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBishkek&forecast_days=1`;
      const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const code = Number(data?.daily?.weather_code?.[0]);
      const tmax = Number(data?.daily?.temperature_2m_max?.[0]);
      const tmin = Number(data?.daily?.temperature_2m_min?.[0]);
      if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) continue;
      const desc = WMO_RU[code] || "без уточнения";
      lines.push(
        `${geo.name}: ${desc}, ${Math.round(tmin)}…${Math.round(tmax)}°C`,
      );
      anyOk = true;
    } catch {
      /* город пропускаем */
    }
  }
  if (!anyOk) {
    return { ok: false, lines: [], error: "weather unavailable" };
  }
  return { ok: true, lines };
}

export async function dueMorningGreetingsNow(opts?: {
  force?: boolean;
  chatId?: number;
}): Promise<MorningGreetingRow[]> {
  const db = admin();
  const { hour, minute, date } = bishkekNowParts();
  let q = db.from("agent_morning_greetings").select("*").eq("is_active", true);
  if (opts?.chatId) q = q.eq("chat_id", opts.chatId);
  const { data, error } = await q;
  if (error) {
    console.error("[agent-morning-greeting] due select", error.message);
    return [];
  }
  const rows = (data || []) as MorningGreetingRow[];
  return rows.filter((r) => {
    if (!opts?.force && r.last_run_on === date) return false;
    if (opts?.force) return true;
    const t = Number(r.run_hour) * 60 + Number(r.run_minute);
    const now = hour * 60 + minute;
    const diff = now - t;
    return diff >= 0 && diff < 5;
  });
}

/** Обновить last_* только после успешной отправки стартера. */
export async function markMorningGreetingRan(opts: {
  id: string;
  agent: string;
  date: string;
}): Promise<void> {
  const db = admin();
  await db
    .from("agent_morning_greetings")
    .update({
      last_started_agent: opts.agent,
      last_run_on: opts.date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.id);
}

function botTokens(): Record<string, string> {
  return {
    karina: (Deno.env.get("KARINA_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN") || "")
      .trim(),
    saule: (Deno.env.get("SAULE_BOT_TOKEN") || "").trim(),
    amina: (Deno.env.get("AMINA_BOT_TOKEN") || "").trim(),
    anton: (Deno.env.get("ANTON_BOT_TOKEN") || "").trim(),
    alina: (Deno.env.get("ALINA_BOT_TOKEN") || "").trim(),
    muha: (Deno.env.get("MUHA_BOT_TOKEN") || "").trim(),
  };
}

async function saveMessage(chatId: number, sender: string, text: string) {
  const db = admin();
  await db.from("agent_chat_history").insert({
    chat_id: chatId,
    sender: sender.slice(0, 80),
    text: text.slice(0, 4000),
  });
}

async function loadRecentHistory(chatId: number, limit = 8) {
  const db = admin();
  const { data } = await db
    .from("agent_chat_history")
    .select("sender, text, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse() as Array<{ sender: string; text: string }>;
}

function formatHistory(history: Array<{ sender: string; text: string }>): string {
  return history
    .map((h) => `${h.sender}: ${String(h.text || "").slice(0, 160)}`)
    .join("\n");
}

async function sendAsAgent(
  agent: string,
  chatId: number,
  text: string,
): Promise<boolean> {
  const token = botTokens()[agent];
  if (!token) {
    console.error(`[agent-morning-greeting] no token for ${agent}`);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(
        `[agent-morning-greeting] send ${agent}`,
        (await res.text()).slice(0, 200),
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[agent-morning-greeting] send ${agent}`, e);
    return false;
  }
}

async function askOpenAiMini(opts: {
  systemPrompt: string;
  userMessage: string;
  history?: string;
}): Promise<string> {
  const key = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) return "Доброе утро, команда. Хорошего рабочего дня.";
  const model = (Deno.env.get("AGENT_FAST_MODEL") || "gpt-4o-mini").trim() ||
    "gpt-4o-mini";
  try {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: opts.systemPrompt },
    ];
    if (opts.history) {
      messages.push({
        role: "system",
        content: `Недавняя история чата:\n${opts.history}`,
      });
    }
    messages.push({ role: "user", content: opts.userMessage.slice(0, 1500) });
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.85,
        max_tokens: 160,
        presence_penalty: 0.4,
        frequency_penalty: 0.4,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[agent-morning-greeting] openai", JSON.stringify(data).slice(0, 240));
      return "Доброе утро. Погнали аккуратно и по делу сегодня.";
    }
    return data.choices?.[0]?.message?.content?.trim() ||
      "Доброе утро, команда.";
  } catch (e) {
    console.error("[agent-morning-greeting] openai ex", e);
    return "Доброе утро. Хорошего дня всем.";
  }
}

export function morningStarterSystem(agent: string, weatherLines: string[]): string {
  const persona = AGENT_PROMPTS[agent] || AGENT_PROMPTS.karina;
  const weatherBlock = weatherLines.length
    ? `Погода сегодня:\n${weatherLines.map((l) => `• ${l}`).join("\n")}`
    : "Погоды нет — не упоминай температуру и не выдумывай её.";
  return [
    persona,
    "",
    COLLECTIVE_CHAT_RULES,
    "Сейчас ТЫ начинаешь утреннее приветствие команды в рабочем Telegram.",
    "Напиши 1–3 коротких строки: приветствие + (если есть) погода своими словами + короткий позитивный настрой на день.",
    "Можно мягко кивнуть коллеге по имени, чтобы подхватили — но не обязательно.",
    "ЗАПРЕЩЕНО: любые цифры продаж/заказов/остатков/РК, выдуманные отчёты, канцелярит, «я ИИ».",
    "Варьируй формулировку — не одно и то же «Доброе утро, команда» каждый день.",
    weatherBlock,
  ].join("\n");
}

export function morningReplySystem(
  agent: string,
  plan: string[],
  lastHop: boolean,
  historyText = "",
): string {
  const persona = AGENT_PROMPTS[agent] || AGENT_PROMPTS.saule;
  const others = plan
    .filter((a) => a !== agent)
    .map((a) => AGENT_DISPLAY[a] || a)
    .join(", ");
  return [
    persona,
    "",
    COLLECTIVE_CHAT_RULES,
    "Сейчас утреннее приветствие команды. Ответь КОРОТКО (1 строка), в своём стиле,",
    "не повторяй то, что уже сказали коллеги (см. историю выше).",
    openingDiversityHint(historyText),
    "Никаких выдуманных цифр заказов/продаж/остатков. Общий тон дня — ок («сегодня разберём заказы»), без цифр.",
    others ? `В теме ещё могут быть: ${others}.` : "",
    lastHop
      ? "Последний ход утренней цепочки — никого не зови, закончи одной репликой."
      : "Если хочешь — можно коротко обратиться к коллеге по имени, иначе просто закончи.",
  ].filter(Boolean).join("\n");
}

/** Сгенерировать стартовое сообщение (без отправки) — для preview/тестов. */
export async function generateMorningStarter(opts: {
  agent: string;
  weather: WeatherBrief;
}): Promise<string> {
  return await askOpenAiMini({
    systemPrompt: morningStarterSystem(opts.agent, opts.weather.lines),
    userMessage:
      "Напиши утреннее приветствие для команды прямо сейчас. Коротко, по-человечески.",
  });
}

async function runMorningPeerTurn(opts: {
  chatId: number;
  targetAgent: string;
  fromAgent: string;
  peerMessage: string;
  plan: string[];
  visited: Set<string>;
  hop: number;
  maxHops: number;
}): Promise<string[]> {
  const out: string[] = [];
  const {
    chatId,
    targetAgent,
    fromAgent,
    peerMessage,
    plan,
    visited,
    hop,
    maxHops,
  } = opts;

  if (!botTokens()[targetAgent]) return out;
  if (hop >= maxHops) return out;
  if (visited.has(targetAgent)) return out;
  visited.add(targetAgent);

  const lastHop = hop + 1 >= maxHops;
  const history = await loadRecentHistory(chatId, 10);
  const historyFmt = formatHistory(history);
  const reply = await askOpenAiMini({
    systemPrompt: morningReplySystem(targetAgent, plan, lastHop, historyFmt) +
      `\n\n${peerTalkBrief(fromAgent, peerMessage)}`,
    history: historyFmt,
    userMessage: [
      "Утреннее приветствие команды.",
      `${AGENT_DISPLAY[fromAgent] || fromAgent}: ${peerMessage}`,
      `Ты — ${AGENT_DISPLAY[targetAgent] || targetAgent}. Одна короткая реплика.`,
    ].join("\n"),
  });

  const sent = await sendAsAgent(targetAgent, chatId, reply);
  if (sent) {
    await saveMessage(chatId, targetAgent, reply).catch(() => {});
    out.push(`${targetAgent}: ${reply}`);
  }

  if (shouldStopMorningHop({ hop, maxHops, visited, targetAgent, reply })) {
    return out;
  }

  let next = nextPingFromReply(reply, visited);
  const pinged = Boolean(next);
  if (!next) {
    next = plan.find((a) => !visited.has(a) && botTokens()[a]) || null;
  }
  if (!next || !botTokens()[next]) return out;

  const handoff = pinged
    ? reply
    : `${reply}\n\n(добавь коротко своё утреннее, без пересказа)`;

  await new Promise((r) => setTimeout(r, 800 + Math.floor(Math.random() * 1400)));

  const more = await runMorningPeerTurn({
    chatId,
    targetAgent: next,
    fromAgent: targetAgent,
    peerMessage: handoff,
    plan,
    visited,
    hop: hop + 1,
    maxHops,
  });
  return out.concat(more);
}

export type MorningRunResult = {
  chatId: number;
  starter: string;
  weatherOk: boolean;
  weatherLines: string[];
  starterText?: string;
  hops: string[];
  skipped?: string;
  error?: string;
};

/** Полный цикл: погода → старт → mark → hops. */
export async function runMorningGreetingForRow(
  row: MorningGreetingRow,
  opts?: { dryRun?: boolean },
): Promise<MorningRunResult> {
  const maxHops = morningMaxHops();
  const starter = nextAgentInRotation(row.rotation_order, row.last_started_agent);
  const plan = buildMorningPlan(starter, row.rotation_order, maxHops);
  const { date } = bishkekNowParts();

  if (!botTokens()[starter]) {
    return {
      chatId: row.chat_id,
      starter,
      weatherOk: false,
      weatherLines: [],
      hops: [],
      error: `no token for starter ${starter}`,
    };
  }

  const weather = await fetchWeatherBrief(row.weather_locations || ["Bishkek"]);
  const starterText = await generateMorningStarter({ agent: starter, weather });

  if (opts?.dryRun) {
    return {
      chatId: row.chat_id,
      starter,
      weatherOk: weather.ok,
      weatherLines: weather.lines,
      starterText,
      hops: [],
      skipped: "dryRun",
    };
  }

  const sent = await sendAsAgent(starter, Number(row.chat_id), starterText);
  if (!sent) {
    return {
      chatId: row.chat_id,
      starter,
      weatherOk: weather.ok,
      weatherLines: weather.lines,
      starterText,
      hops: [],
      error: "starter send failed",
    };
  }

  await saveMessage(Number(row.chat_id), starter, starterText).catch(() => {});
  // Успешная отправка стартера → фиксируем день (даже если hop дальше упадёт)
  await markMorningGreetingRan({ id: row.id, agent: starter, date });

  const visited = new Set<string>([starter]);
  const firstResponder = plan.find((a) => a !== starter && botTokens()[a]);
  const hops: string[] = [`${starter}: ${starterText}`];
  if (firstResponder && maxHops > 1) {
    const peer = await runMorningPeerTurn({
      chatId: Number(row.chat_id),
      targetAgent: firstResponder,
      fromAgent: starter,
      peerMessage: starterText,
      plan,
      visited,
      hop: 1,
      maxHops,
    });
    hops.push(...peer);
  }

  return {
    chatId: row.chat_id,
    starter,
    weatherOk: weather.ok,
    weatherLines: weather.lines,
    starterText,
    hops,
  };
}
