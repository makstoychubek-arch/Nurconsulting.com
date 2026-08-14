/**
 * Быстрые команды без OpenAI — меньше нагрузки и быстрее ответ.
 * Поддержка: /cmd, короткие фразы, опечатки, wow-команды смены.
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
import {
  fuzzyMatchCommand,
  normalizeBotText,
} from "./agent-fuzzy.ts";
import {
  findPlanningProducts,
  formatCostReply,
  planningCatalogBrief,
} from "./agent-planning-catalog.ts";

export type FastCommandResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
};

function stripBotMention(text: string): string {
  return text.replace(/@\w+/g, " ").replace(/\s+/g, " ").trim();
}

const CMD_ALIASES: Record<string, string> = {
  помощь: "help",
  команды: "help",
  skills: "help",
  чтоумеешь: "help",
  зона: "help",
  ктоя: "whoami",
  whoami: "whoami",
  продажи: "sales",
  заказы: "sales",
  рк: "ads",
  реклама: "ads",
  кампании: "ads",
  drr: "ads",
  дrr: "ads",
  дрр: "ads",
  фбс: "fbs",
  остатки: "stock",
  stock: "stock",
  склад: "stock",
  склады: "stock",
  себес: "cost",
  себестоимость: "cost",
  cost: "cost",
  самовыкуп: "selfbuy",
  самовыкупы: "selfbuy",
  кабинеты: "cabinets",
  cabs: "cabinets",
  пинг: "ping",
  pulse: "pulse",
  пульс: "pulse",
  сводка: "pulse",
  брифинг: "pulse",
  сегодня: "pulse",
  standup: "pulse",
  срочно: "urgent",
  urgent: "urgent",
  горит: "urgent",
  триаж: "urgent",
  разбор: "discuss",
  почему: "discuss",
  просадка: "discuss",
  почемупродаж: "discuss",
};

const FUZZY_CMD_BANK = [
  ...Object.keys(CMD_ALIASES),
  "help",
  "ping",
  "sales",
  "ads",
  "fbs",
  "selfbuy",
  "cabinets",
  "pulse",
  "urgent",
  "stock",
  "whoami",
  "cost",
  "discuss",
] as const;

function mapCmd(raw: string): string {
  const c = normalizeBotText(raw);
  if (CMD_ALIASES[c]) return CMD_ALIASES[c];
  const hit = fuzzyMatchCommand(c, FUZZY_CMD_BANK);
  if (hit && CMD_ALIASES[hit]) return CMD_ALIASES[hit];
  if (hit && ["help", "ping", "sales", "ads", "fbs", "selfbuy", "cabinets", "pulse", "urgent", "stock", "whoami", "cost", "discuss"].includes(hit)) {
    return hit;
  }
  return c;
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
    const mapped = mapCmd(slash[1]);
    const arg = (slash[2] || "").trim();
    return normalizeAdsCmd(mapped, arg);
  }

  const lower = normalizeBotText(text);
  const parts = lower.split(" ");
  const head = parts[0] || "";
  const rest = parts.slice(1).join(" ").trim();

  // Точные короткие
  if (/^(помощь|команды|help|skills|чтоумеешь|зона)$/i.test(lower)) {
    return { cmd: "help", arg: "" };
  }
  if (/^(пинг|ping|жив|статус бота)$/i.test(lower)) return { cmd: "ping", arg: "" };
  if (/^(кабинеты|cabinets|cabs)$/i.test(lower)) return { cmd: "cabinets", arg: "" };
  if (/^(ктоя|whoami|кто ты)$/i.test(lower)) return { cmd: "whoami", arg: "" };

  // Wow: pulse / urgent / stock (fuzzy head)
  // «сегодня» → pulse только голое (иначе «сегодня заказы» уйдёт в NL)
  const mappedHead = mapCmd(head);
  if (
    mappedHead === "pulse" &&
    (head !== "сегодня" || !rest) &&
    parts.length <= 2
  ) {
    return { cmd: "pulse", arg: "" };
  }
  if (mappedHead === "urgent" && parts.length <= 2) {
    return { cmd: "urgent", arg: "" };
  }
  if (mappedHead === "stock") {
    return { cmd: "stock", arg: rest };
  }
  if (mappedHead === "whoami") return { cmd: "whoami", arg: "" };
  if (mappedHead === "cost") {
    return { cmd: "cost", arg: rest };
  }
  if (mappedHead === "discuss" && parts.length <= 4) {
    return { cmd: "discuss", arg: rest };
  }

  // продажи [кабинет]
  let m = lower.match(/^(продажи|sales|заказы)\s*(.*)$/i);
  if (m) return { cmd: "sales", arg: (m[2] || "").trim() };
  if (mappedHead === "sales") return { cmd: "sales", arg: rest };

  // рк / реклама / ads / drr
  m = lower.match(/^(рк|реклама|ads|кампании|drr|дрр)\s*(.*)$/i);
  if (m) {
    return normalizeAdsCmd("ads", (m[2] || "").trim());
  }
  if (mappedHead === "ads") return normalizeAdsCmd("ads", rest);

  // Только голое «fbs»/«фбс»/«отгрузки» → дальше в FBS-диалог остатков.
  if (/^(fbs|фбс|отгрузки?)$/i.test(lower) || (mappedHead === "fbs" && !rest)) {
    return { cmd: "fbs", arg: "" };
  }

  if (/^(самовыкуп|selfbuy|выкупы клиент)/i.test(lower) || mappedHead === "selfbuy") {
    return { cmd: "selfbuy", arg: "" };
  }

  // Fuzzy single-token commands (опечатки: сволка→сводка, остаки→остатки)
  if (parts.length === 1 && mappedHead && mappedHead !== head) {
    if (["help", "ping", "cabinets", "pulse", "urgent", "stock", "whoami", "sales", "ads", "fbs", "selfbuy"].includes(mappedHead)) {
      return { cmd: mappedHead, arg: "" };
    }
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
    case "stock":
      return "anton";
    case "selfbuy":
      return "alina";
    case "sales":
      return "saule";
    case "cost":
      return "saule";
    case "discuss":
      return "saule";
    case "pulse":
    case "urgent":
      return "karina";
    case "whoami":
    case "help":
      return "karina";
    default:
      return "saule";
  }
}

async function salesBrief(arg: string): Promise<string> {
  const { sauleSalesLead } = await import("./agent-voice.ts");
  const ctx = await buildAgentWbContext("saule" as AgentKey, createWbContextCache());
  if (!arg) {
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
      parts.push("", "Детали: /ads baza · ДРР: смотри активные, режь мусор после «да»");
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
  const block = idx >= 0
    ? ctx.slice(idx).split("\n").slice(0, 24).join("\n")
    : ctx.split("\n").slice(0, 20).join("\n");
  return "Антон · FBS\n" + block;
}

/** Утренний пульс — заменяет обход ассистента по чатам. */
async function pulseBrief(): Promise<string> {
  const [sales, ads, fbs] = await Promise.all([
    salesBrief("").then((s) => s.split("\n").slice(0, 10).join("\n")).catch((e) =>
      `продажи: ${e instanceof Error ? e.message : String(e)}`
    ),
    adsBrief("").then((s) => s.split("\n").slice(0, 9).join("\n")).catch((e) =>
      `реклама: ${e instanceof Error ? e.message : String(e)}`
    ),
    fbsBrief().then((s) => s.split("\n").slice(0, 8).join("\n")).catch((e) =>
      `fbs: ${e instanceof Error ? e.message : String(e)}`
    ),
  ]);
  return [
    "⚡ Пульс смены · вместо утреннего ассистента",
    "",
    "— Продажи (Сауле) —",
    sales,
    "",
    "— Реклама (Амина) —",
    ads,
    "",
    "— FBS (Антон) —",
    fbs,
    "",
    "Дальше: /срочно · /sales · /ads · /остатки · /selfbuy · «что умеешь» у любого бота",
  ].join("\n");
}

function urgentBrief(): string {
  return [
    "🚨 Срочный триаж · что проверить до обеда",
    "",
    "1. Штрафы / блокировки → канал штрафов или Карина",
    "2. ДРР в космосе / мёртвый CTR → /ads или Амина",
    "3. Остатки на нуле / срывы FBS → /остатки или Антон",
    "4. Неотвеченные отзывы / раздачи → /selfbuy или Алина",
    "5. Цены / карточки сломались → /sales или Сауле",
    "",
    "Напиши одной фразой что горит — направлю к нужному боту.",
    "Мутации только после твоего «да».",
  ].join("\n");
}

const FAST_HINT =
  "\n\nБыстрые: /pulse · /разбор · /срочно · /cabinets · /sales · /ads · /остатки · /selfbuy · /ping · «что умеешь»";

export type FastCommandOpts = {
  /** ЛС: пульс/срочно отвечает этот бот. Группа: только Карина. */
  privateChat?: boolean;
};

export async function tryFastCommand(
  text: string,
  triggeringBot: string,
  opts: FastCommandOpts = {},
): Promise<FastCommandResult> {
  const parsed = parseFastCommand(text);
  if (!parsed) return { handled: false };

  const { cmd, arg } = parsed;
  const agentKey = agentForCmd(cmd);
  const privateChat = opts.privateChat === true;

  if (cmd === "help" || cmd === "команды" || cmd === "помощь") {
    const who = triggeringBot || "karina";
    return {
      handled: true,
      agentKey: who,
      reply: selfSkillsReply(who) + FAST_HINT,
    };
  }

  if (cmd === "whoami") {
    const who = triggeringBot || "karina";
    return {
      handled: true,
      agentKey: who,
      reply: selfSkillsReply(who),
    };
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

  // Пульс / срочно — в группе только Карина; в ЛС — бот, которому написали
  if (cmd === "pulse") {
    const speaker = privateChat ? (triggeringBot || "karina") : "karina";
    if (triggeringBot !== speaker) {
      return { handled: true, agentKey: speaker };
    }
    try {
      const reply = await pulseBrief();
      return { handled: true, agentKey: speaker, reply };
    } catch (e) {
      return {
        handled: true,
        agentKey: speaker,
        reply: `Пульс не собрался: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  if (cmd === "urgent") {
    const speaker = privateChat ? (triggeringBot || "karina") : "karina";
    if (triggeringBot !== speaker) {
      return { handled: true, agentKey: speaker };
    }
    return { handled: true, agentKey: speaker, reply: urgentBrief() };
  }

  if (cmd === "cost") {
    // В группе — Сауле; в ЛС — бот, которому написали
    const speaker = privateChat ? (triggeringBot || "saule") : "saule";
    if (triggeringBot !== speaker) {
      return { handled: true, agentKey: speaker };
    }
    const q = (arg || "").trim();
    const reply = !q
      ? planningCatalogBrief(10)
      : formatCostReply(findPlanningProducts(q, { max: 6, minScore: 4 }));
    return { handled: true, agentKey: speaker, reply };
  }

  // /разбор /почему — не отвечаем тут: уходим в LLM-обсуждение Сауле→Амина→Антон
  if (cmd === "discuss") {
    if (triggeringBot !== "saule") {
      return { handled: true, agentKey: "saule" };
    }
    return { handled: false, agentKey: "saule" };
  }

  // Команды специалиста — чужие webhook молчат сразу
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
      return { handled: false, agentKey: "amina" };
    }
    if (cmd === "ads_pause") {
      return { handled: false, agentKey: "amina" };
    }
    if (cmd === "fbs" || cmd === "stock") {
      // Реальные остатки — через agent-fbs-stock
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
