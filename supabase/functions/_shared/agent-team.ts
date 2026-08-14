/**
 * Оркестрация команды агентов в тимчате:
 * план специалистов → ответы по делу → пинг коллеги → без циклов.
 */

import { collectivePeerStyle, wantsNewsDiscussion, newsDiscussionPlan, wantsTeamBanter } from "./agent-collective.ts";

export const BOT_USERNAMES: Record<string, string> = {
  saule: "saulexxx_bot",
  amina: "aminaakd_bot",
  anton: "antonnnxx_bot",
  alina: "alinaaaxx_bot",
  muha: "muxxxha_bot",
  karina: "",
};

/** Только @username — надёжный пинг без ложных срабатываний по имени. */
export function detectMentionedAgents(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
    if (!username) continue;
    // граница после username, чтобы не ловить префиксы
    const re = new RegExp(`@${username.toLowerCase()}(?![a-z0-9_])`, "i");
    if (re.test(lower)) found.push(agent);
  }
  return found;
}

/** Имена без @ (для сообщений человека). */
export function detectNamedAgents(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (/саул[еэ]/.test(lower)) found.push("saule");
  if (lower.includes("амина")) found.push("amina");
  if (lower.includes("антон")) found.push("anton");
  if (lower.includes("алина")) found.push("alina");
  // \b плохо работает с кириллицей в JS — явные формы
  if (/(^|[^а-яё])мух[ауеы]([^а-яё]|$)/i.test(lower)) found.push("muha");
  if (lower.includes("карина")) found.push("karina");
  return found;
}

/** Темы → специалисты (только от человека). */
export function detectTopicalAgents(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const selfbuy = lower.includes("самовыкуп");

  if (wantsNewsDiscussion(text)) {
    return newsDiscussionPlan(text);
  }
  if (wantsTeamBanter(text)) {
    return ["karina", "saule", "amina", "anton"].slice(0, 4);
  }

  const sheetGiveaway =
    lower.includes("раздач") ||
    lower.includes("самовыкуп") ||
    (lower.includes("таблиц") && /(выкуп|кэш|кеш|бартер|раздач)/i.test(lower));
  const wbCardPhoto =
    /главн\w*\s+фото|фото\s+(фонар|вырез|блузк|товар|с\s*вб)/i.test(lower) ||
    (/(дай|скинь|пришли|покажи).{0,16}фото/i.test(lower) &&
      /(фонар|вырез|блузк|бел|черн)/i.test(lower));

  // «выкуп» внутри «самовыкуп» / таблица раздач → Алина, не Сауле
  const priceChange =
    /(сниз|понизь|пониз|убав|уменьш).{0,20}цен/i.test(lower) ||
    /цен.{0,20}(сниз|понизь|пониз|убав|уменьш|меня|измени|поменя)/i.test(lower) ||
    /(менять|поменять|изменить|поменяй).{0,12}цен/i.test(lower);
  if (
    lower.includes("продаж") ||
    lower.includes("отмен") ||
    priceChange ||
    /(^|[^а-яё])цен(а|ы|у|е|ой|ам)?([^а-яё]|$)/.test(lower) ||
    (!selfbuy && !sheetGiveaway && /(^|[^а-яё])выкуп/.test(lower))
  ) {
    found.push("saule");
  }
  if (
    lower.includes("реклам") ||
    lower.includes("cpc") ||
    lower.includes("ставк") ||
    lower.includes("ркл") ||
    lower.includes("аукцион") ||
    /(^|[^а-яё])рк([^а-яё]|$)/.test(lower) ||
    (lower.includes("запусти") && lower.includes("кампан"))
  ) {
    found.push("amina");
  }
  if (
    lower.includes("логист") ||
    lower.includes("поставк") ||
    lower.includes("кластер") ||
    lower.includes("fbs") ||
    lower.includes("склад") ||
    lower.includes("отгруз") ||
    lower.includes("остатк") ||
    lower.includes("остаток")
  ) {
    found.push("anton");
  }
  if (selfbuy || lower.includes("продвиж") || sheetGiveaway || wbCardPhoto) {
    found.push("alina");
  }
  if (
    lower.includes("фотоворон") ||
    lower.includes("конверс") ||
    lower.includes("инфограф") ||
    lower.includes("креатив") ||
    (lower.includes("фото") && !selfbuy && !wbCardPhoto && !sheetGiveaway)
  ) {
    found.push("muha");
  }
  return found;
}

function uniquePreserve(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * План команды по сообщению человека.
 * Порядок: явные @ → имена → темы. Максимум maxAgents.
 */
export function buildTeamPlan(
  text: string,
  // deno-lint-ignore no-explicit-any
  entities?: any[],
  maxAgents = 3,
): string[] {
  const cap = Number.isFinite(maxAgents) && maxAgents > 0 ? Math.floor(maxAgents) : 3;
  const fromEntities: string[] = [];
  for (const ent of entities || []) {
    if (ent?.type === "mention" && typeof ent.offset === "number" && typeof ent.length === "number") {
      // Telegram offset — UTF-16 code units (как в JS string)
      const mention = text.slice(ent.offset, ent.offset + ent.length).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && mention === `@${username.toLowerCase()}`) fromEntities.push(agent);
      }
    }
    if (ent?.type === "text_mention" && ent?.user?.username) {
      const u = String(ent.user.username).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && u === username.toLowerCase()) fromEntities.push(agent);
      }
    }
  }

  const plan = uniquePreserve([
    ...fromEntities,
    ...detectMentionedAgents(text),
    ...detectNamedAgents(text),
    ...detectTopicalAgents(text),
  ]).slice(0, cap);

  if (plan.length === 0) return ["karina"];
  return plan;
}

export const AGENT_DISPLAY: Record<string, string> = {
  saule: "Сауле",
  amina: "Амина",
  anton: "Антон",
  alina: "Алина",
  muha: "Муха",
  karina: "Карина",
};

/** Следующий коллега: @username или живое обращение по имени. */
export function nextPingFromReply(reply: string, exclude: Set<string>): string | null {
  for (const agent of detectMentionedAgents(reply)) {
    if (!exclude.has(agent)) return agent;
  }
  // «Антон, глянь остаток» / «Сауле смотри выкупы»
  for (const agent of detectNamedAgents(reply)) {
    if (!exclude.has(agent)) return agent;
  }
  return null;
}

/** Агент явно закрыл свою часть без пинга. */
export function isDoneReply(reply: string): boolean {
  const t = reply.trim().toLowerCase();
  if (detectMentionedAgents(reply).length > 0) return false;
  if (detectNamedAgents(reply).length > 0) return false;
  return (
    /(^|\n)\s*готово\.?\s*$/i.test(t) ||
    t === "готово" ||
    t.endsWith("готово.") ||
    t.endsWith("готово")
  );
}

export function teamBriefForPrompt(plan: string[], rootTask: string): string {
  const line = plan.map((a) => AGENT_DISPLAY[a] || a).join(", ");
  const news = wantsNewsDiscussion(rootTask);
  return [
    `Вопрос владельца: ${rootTask.slice(0, 500)}`,
    plan.length > 1
      ? `В теме ещё могут ответить: ${line}. Это рабочий чат — можно коротко перекинуться с коллегой.`
      : `Твоя зона. Ответь коротко по делу.`,
    news
      ? "Тема новостей: обсудите как смена — Карина задаёт тон, остальные дают взгляд из своей зоны, без эха."
      : "",
    "Правила общения в команде:",
    "- Пиши как в Telegram с коллегами: 1–4 коротких строки, без отчётов и без «коллега передал».",
    "- Свой кусок — своими словами и цифрами из ФАКТОВ. Не копируй чужой текст.",
    "- Можно мягко не согласиться по делу — это нормально для живой смены.",
    "- Нужен другой специалист — обратись живо: «Антон, глянь остаток по…» или @username + суть.",
    "- Не устраивай цепочку ради цепочки. Не нужен следующий — просто закончи.",
  ].filter(Boolean).join("\n");
}

/** Промпт, когда отвечает на реплику коллеги в чате. */
export function peerTalkBrief(fromAgent: string, peerMessage: string): string {
  const name = AGENT_DISPLAY[fromAgent] || fromAgent;
  const style = collectivePeerStyle();
  return [
    `${name} только что написала/написал в чат:`,
    `«${peerMessage.slice(0, 700)}»`,
    "Ответь как живой коллега в том же чате: коротко, по своей зоне.",
    style,
    "Не начинай с «Спасибо» / «Принято» / «Коллега передал» / «Ок, понял» / «Полностью согласен». Сразу по делу.",
    "Не копируй текст коллеги. Не поддакивай без своего куска. Чередуй формат ответа.",
    "Если всё ясно и тебе добавить нечего — одна короткая реплика и стоп (без пинга дальше).",
  ].join("\n");
}

export function clampHops(raw: unknown, fallback = 3): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(5, Math.floor(n));
}
