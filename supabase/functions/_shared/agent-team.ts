/**
 * Оркестрация команды агентов в тимчате:
 * план специалистов → ответы по делу → пинг коллеги → без циклов.
 */

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

  // «выкуп» внутри «самовыкуп» НЕ должен звать Сауле
  if (
    lower.includes("продаж") ||
    lower.includes("остатк") ||
    lower.includes("отмен") ||
    /(^|[^а-яё])цен(а|ы|у|е|ой|ам)?([^а-яё]|$)/.test(lower) ||
    (!selfbuy && /(^|[^а-яё])выкуп/.test(lower))
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
    lower.includes("отгруз")
  ) {
    found.push("anton");
  }
  if (selfbuy || lower.includes("продвиж")) {
    found.push("alina");
  }
  if (
    lower.includes("фотоворон") ||
    lower.includes("конверс") ||
    lower.includes("инфограф") ||
    lower.includes("креатив") ||
    (lower.includes("фото") && !selfbuy)
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

/** Следующий коллега строго по @username в ответе агента. */
export function nextPingFromReply(reply: string, exclude: Set<string>): string | null {
  for (const agent of detectMentionedAgents(reply)) {
    if (!exclude.has(agent)) return agent;
  }
  return null;
}

/** Агент явно закрыл свою часть без пинга. */
export function isDoneReply(reply: string): boolean {
  const t = reply.trim().toLowerCase();
  if (detectMentionedAgents(reply).length > 0) return false;
  return (
    /(^|\n)\s*готово\.?\s*$/i.test(t) ||
    t === "готово" ||
    t.endsWith("готово.") ||
    t.endsWith("готово")
  );
}

export function teamBriefForPrompt(plan: string[], rootTask: string): string {
  const labels: Record<string, string> = {
    saule: "Сауле (продажи)",
    amina: "Амина (реклама)",
    anton: "Антон (логистика)",
    alina: "Алина (самовыкупы)",
    muha: "Муха (фото)",
    karina: "Карина (координатор)",
  };
  const line = plan.map((a) => labels[a] || a).join(" → ");
  return [
    `Задача владельца (корень): ${rootTask.slice(0, 500)}`,
    `План команды: ${line}`,
    "Отвечай только своей зоной. Не повторяй чужие цифры дословно.",
    "Если следующий по плану нужен — в конце одна строка: @username — конкретная задача.",
    "Если твоя часть закрыта — закончи конкретным выводом без пустых «да?».",
  ].join("\n");
}

export function clampHops(raw: unknown, fallback = 3): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(5, Math.floor(n));
}
