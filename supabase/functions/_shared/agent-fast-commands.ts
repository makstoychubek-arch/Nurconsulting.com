/**
 * Быстрые команды без OpenAI — меньше нагрузки и быстрее ответ.
 * Поддержка: /cmd и короткие фразы.
 */

import {
  formatCampaignList,
  listCabinets,
  listCampaigns,
  resolveCabinet,
} from "./agent-actions.ts";
import { alinaSelfbuyStatsText } from "./alina-selfbuy.ts";
import {
  buildAgentWbContext,
  createWbContextCache,
  type AgentKey,
} from "./agent-wb-context.ts";
import { selfSkillsReply } from "./agent-self-skills.ts";

export type FastCommandResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
};

const HELP = [
  "Быстрые команды (без ИИ, ответ сразу):",
  "",
  "/help — этот список",
  "/cabinets — кабинеты",
  "/sales [кабинет] — продажи сегодня/вчера",
  "/ads [кабинет] — список РК",
  "/ads start [кабинет] — подготовка запуска РК",
  "/ads pause [кабинет] — подготовка паузы РК",
  "/fbs — FBS кратко",
  "/selfbuy — самовыкупы",
  "/ping — жив ли бот",
  "",
  "Действия РК: список → номера → подтверждаю",
  "Примеры: продажи baza | рк saai | запусти рк базы",
].join("\n");

function stripBotMention(text: string): string {
  return text.replace(/@\w+/g, " ").replace(/\s+/g, " ").trim();
}

/** Нормализует /sales baza → { cmd, arg } */
export function parseFastCommand(raw: string): { cmd: string; arg: string } | null {
  const text = stripBotMention(raw);
  if (!text) return null;

  function normalizeAdsCmd(cmd: string, arg: string): { cmd: string; arg: string } {
    if (cmd !== "ads" && cmd !== "рк" && cmd !== "реклама" && cmd !== "кампании") {
      return { cmd, arg };
    }
    const rest = arg.trim();
    if (/^(start|запуск|запусти)\b/i.test(rest)) {
      return {
        cmd: "ads_start",
        arg: rest.replace(/^(start|запуск|запусти)\s*/i, "").trim(),
      };
    }
    if (/^(pause|пауза)\b/i.test(rest)) {
      return {
        cmd: "ads_pause",
        arg: rest.replace(/^(pause|пауза)\s*/i, "").trim(),
      };
    }
    return { cmd: "ads", arg: rest };
  }

  // /command args
  const slash = text.match(/^\/([a-zA-Zа-яА-ЯёЁ_]+)(?:@\w+)?\s*(.*)$/u);
  if (slash) {
    const cmd = slash[1].toLowerCase();
    const arg = (slash[2] || "").trim();
    const aliases: Record<string, string> = {
      помощь: "help",
      команды: "help",
      продажи: "sales",
      заказы: "sales",
      рк: "ads",
      реклама: "ads",
      кампании: "ads",
      фбс: "fbs",
      самовыкуп: "selfbuy",
      самовыкупы: "selfbuy",
      кабинеты: "cabinets",
      пинг: "ping",
    };
    const mapped = aliases[cmd] || cmd;
    return normalizeAdsCmd(mapped, arg);
  }

  const lower = text.toLowerCase();

  if (/^(помощь|команды|help)$/i.test(lower)) return { cmd: "help", arg: "" };
  if (/^(пинг|ping|жив|статус бота)$/i.test(lower)) return { cmd: "ping", arg: "" };
  if (/^(кабинеты|cabinets)$/i.test(lower)) return { cmd: "cabinets", arg: "" };

  // продажи [кабинет]
  let m = lower.match(/^(продажи|sales|заказы)\s*(.*)$/i);
  if (m) return { cmd: "sales", arg: (m[2] || "").trim() };

  // рк / реклама / ads
  m = lower.match(/^(рк|реклама|ads|кампании)\s*(.*)$/i);
  if (m) {
    return normalizeAdsCmd("ads", (m[2] || "").trim());
  }

  // Только голое «fbs»/«фбс»/«отгрузки» → дальше в FBS-диалог остатков.
  // «fbs остатки», «фбс база» НЕ fast-команда (иначе уходит в заказы fbs_daily).
  if (/^(fbs|фбс|отгрузки?)$/i.test(lower)) {
    return { cmd: "fbs", arg: "" };
  }

  if (/^(самовыкуп|selfbuy|выкупы клиент)/i.test(lower)) {
    return { cmd: "selfbuy", arg: "" };
  }

  return null;
}

function agentForCmd(cmd: string): string {
  switch (cmd) {
    case "ads":
    case "ads_start":
    case "ads_pause":
      return "amina";
    case "fbs":
      return "anton";
    case "selfbuy":
      return "alina";
    case "sales":
      return "saule";
    default:
      return "saule";
  }
}

async function salesBrief(arg: string): Promise<string> {
  const { sauleSalesLead } = await import("./agent-voice.ts");
  const ctx = await buildAgentWbContext("saule" as AgentKey, createWbContextCache());
  if (!arg) {
    // Ужимаем до первых ~25 строк
    return sauleSalesLead() + "\n" + ctx.split("\n").slice(0, 28).join("\n");
  }
  const resolved = await resolveCabinet(arg);
  if (!resolved.match) {
    const names = (await listCabinets()).map((c) => c.name).join(", ");
    return `Уточни кабинет. Доступны: ${names}`;
  }
  const name = resolved.match.name;
  const lines = ctx.split("\n");
  const out: string[] = [sauleSalesLead(name)];
  let take = false;
  for (const line of lines) {
    if (line.startsWith("▶ ")) {
      take = line.toLowerCase().includes(name.toLowerCase());
    }
    if (take) out.push(line);
  }
  if (out.length === 1) return `${name}: нет блока продаж в кэше. Попробуй /sales без кабинета.`;
  return out.join("\n");
}

async function adsBrief(arg: string): Promise<string> {
  const resolved = await resolveCabinet(arg || " ");
  if (!arg || !resolved.match) {
    if (!arg) {
      const cabs = await listCabinets();
      const parts: string[] = ["Амина · РК по кабинетам"];
      for (const c of cabs.slice(0, 6)) {
        const items = await listCampaigns(c.id);
        const active = items.filter((i) => i.status === 9).length;
        const pause = items.filter((i) => i.status === 11).length;
        const ready = items.filter((i) => i.status === 4).length;
        parts.push(`▶ ${c.name}: актив ${active}, пауза ${pause}, готовы ${ready}`);
      }
      parts.push("", "Детали: /ads baza");
      return parts.join("\n");
    }
    const names = resolved.candidates.map((c) => c.name).join(", ");
    return `Уточни кабинет. Доступны: ${names}`;
  }
  const items = await listCampaigns(resolved.match.id);
  return formatCampaignList(items, `Амина · РК · ${resolved.match.name}`);
}

async function fbsBrief(): Promise<string> {
  const ctx = await buildAgentWbContext("anton" as AgentKey, createWbContextCache());
  const idx = ctx.indexOf("=== FBS ===");
  const block = idx >= 0 ? ctx.slice(idx).split("\n").slice(0, 24).join("\n") : ctx.split("\n").slice(0, 20).join("\n");
  return "Антон · FBS\n" + block;
}

export async function tryFastCommand(
  text: string,
  triggeringBot: string,
): Promise<FastCommandResult> {
  const parsed = parseFastCommand(text);
  if (!parsed) return { handled: false };

  const { cmd, arg } = parsed;
  const agentKey = agentForCmd(cmd);

  // help/ping/cabinets — любой бот, кто получил апдейт как starter; отвечаем от triggeringBot если он в плане
  if (cmd === "help" || cmd === "команды" || cmd === "помощь") {
    return { handled: true, agentKey: "saule", reply: HELP };
  }
  if (cmd === "ping") {
    return {
      handled: true,
      agentKey: "saule",
      reply: `ok · ${new Date().toISOString().slice(11, 19)} UTC`,
    };
  }
  if (cmd === "cabinets" || cmd === "кабинеты") {
    const cabs = await listCabinets();
    return {
      handled: true,
      agentKey: "saule",
      reply: "Кабинеты:\n" + cabs.map((c) => `• ${c.name}`).join("\n"),
    };
  }

  // Команды специалиста — чужие webhook молчат сразу (не гоняют весь pipeline)
  if (triggeringBot !== agentKey) {
    return { handled: true, agentKey };
  }

  try {
    if (cmd === "sales" || cmd === "продажи") {
      return { handled: true, agentKey: "saule", reply: await salesBrief(arg) };
    }
    if (cmd === "ads" || cmd === "рк") {
      return { handled: true, agentKey: "amina", reply: await adsBrief(arg) };
    }
    if (cmd === "ads_start") {
      // Передаём в action-слой через «запусти рк …»
      return { handled: false, agentKey: "amina" };
    }
    if (cmd === "ads_pause") {
      return { handled: false, agentKey: "amina" };
    }
    if (cmd === "fbs") {
      // Реальные остатки FBS (склады/размеры) — через agent-fbs-stock, не brief заказов
      return { handled: false, agentKey: "anton" };
    }
    if (cmd === "selfbuy" || cmd === "самовыкуп") {
      return { handled: true, agentKey: "alina", reply: await alinaSelfbuyStatsText() };
    }
  } catch (e) {
    return {
      handled: true,
      agentKey,
      reply: `Ошибка команды: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { handled: false };
}

/** Для /ads start baza → текст интента в action handler */
export function expandAdsActionCommand(text: string): string | null {
  const parsed = parseFastCommand(text);
  if (!parsed) return null;
  if (parsed.cmd === "ads_start") {
    return `запусти рк ${parsed.arg || ""}`.trim();
  }
  if (parsed.cmd === "ads_pause") {
    return `поставь на паузу рк ${parsed.arg || ""}`.trim();
  }
  return null;
}
