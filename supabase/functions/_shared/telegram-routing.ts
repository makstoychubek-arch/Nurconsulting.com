/** Telegram routing (v2) — incoming + outgoing.
 *
 * Каналы:
 *   ads        — реклама / РК (не в общем чате)
 *   penalties  — штрафы WB
 *   fbs        — FBS-заказы (все кабинеты, один чат)
 *   team       — общий командный чат (сводки, приветствия)
 *   triggers   — триггеры / алерты, новости WB / Ozon
 *   default    — fallback
 *
 * Env (рекомендуется, иначе — захардкоженные чаты):
 *   TELEGRAM_CHAT_ADS
 *   TELEGRAM_CHAT_PENALTIES
 *   TELEGRAM_CHAT_FBS
 *   TELEGRAM_CHAT_TEAM
 *   TELEGRAM_CHAT_TRIGGERS
 *   TELEGRAM_CHAT_DEFAULT
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_TOKEN_ADS / TELEGRAM_BOT_TOKEN_PENALTIES
 */

export type TelegramChannel = "ads" | "penalties" | "fbs" | "team" | "triggers" | "default";

const HARDCODED_CHAT_IDS: Record<TelegramChannel, string> = {
  ads: "-1003621864099",
  penalties: "-1003907884000",
  fbs: "-1003648461675",
  team: "-1004460164885",
  triggers: "-1003683512450",
  default: "-1003621864099",
};

function envChat(name: string, fallback: string): string {
  const v = Deno.env.get(name)?.trim();
  return v && v.length > 0 ? v : fallback;
}

export function getTelegramChatId(channel: TelegramChannel): string {
  switch (channel) {
    case "ads":
      return envChat("TELEGRAM_CHAT_ADS", HARDCODED_CHAT_IDS.ads);
    case "penalties":
      return envChat("TELEGRAM_CHAT_PENALTIES", HARDCODED_CHAT_IDS.penalties);
    case "fbs":
      return envChat("TELEGRAM_CHAT_FBS", HARDCODED_CHAT_IDS.fbs);
    case "team":
      return envChat("TELEGRAM_CHAT_TEAM", HARDCODED_CHAT_IDS.team);
    case "triggers":
      return envChat("TELEGRAM_CHAT_TRIGGERS", HARDCODED_CHAT_IDS.triggers);
    default:
      return envChat("TELEGRAM_CHAT_DEFAULT", HARDCODED_CHAT_IDS.default);
  }
}

/** Resolve incoming Telegram chat_id → channel. */
export function resolveIncomingChatChannel(chatId: number | string): TelegramChannel {
  const id = String(chatId);
  if (id === getTelegramChatId("ads")) return "ads";
  if (id === getTelegramChatId("penalties")) return "penalties";
  if (id === getTelegramChatId("fbs")) return "fbs";
  if (id === getTelegramChatId("team")) return "team";
  if (id === getTelegramChatId("triggers")) return "triggers";
  return "default";
}

export function getTelegramToken(channel: TelegramChannel): string | undefined {
  const specific =
    channel === "ads"
      ? Deno.env.get("TELEGRAM_BOT_TOKEN_ADS")
      : channel === "penalties"
        ? Deno.env.get("TELEGRAM_BOT_TOKEN_PENALTIES")
        : undefined;
  return specific?.trim() || Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
}

export async function sendTelegramToChannel(
  channel: TelegramChannel,
  text: string,
  extra?: Record<string, unknown>,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = getTelegramToken(channel);
  const chatId = getTelegramChatId(channel);
  if (!token) return { ok: false, skipped: true, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!chatId) return { ok: false, skipped: true, error: `chat_id for ${channel} not set` };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...extra,
    }),
  });
  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}
