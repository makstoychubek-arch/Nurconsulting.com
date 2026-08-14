// supabase/functions/telegram-router/index.ts
//
// Роутер команды Telegram-агентов NR Space.
// Один webhook (?bot=) оркестрирует цепочку: ответ → @пинг/план → следующий агент.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAgentWbContext,
  createWbContextCache,
  type AgentKey,
  type WbContextCache,
} from "../_shared/agent-wb-context.ts";
import {
  alinaRecentDialogs,
  alinaSelfbuyStatsText,
  handleAlinaClientMessage,
  isAlinaClientContext,
  isAlinaStatsQuestion,
  isBusinessOwnerMessage,
  logAlinaRawEvent,
  refreshAlinaFromSheet,
  tryAlinaOfferCommand,
} from "../_shared/alina-selfbuy.ts";
import { generateMuhaPhoto, wantsPhoto } from "../_shared/muha-photos.ts";
import { teamQaFactsForAgent, tryTeamSmartQa } from "../_shared/agent-qa.ts";
import {
  continueFbsStockDialog,
  handleFbsStockCallback,
  hasActiveFbsStockDialog,
  isFbsStockCallback,
  startFbsStockDialog,
  wantsFbsStock,
  type FbsStockReply,
} from "../_shared/agent-fbs-stock.ts";
import {
  continuePriceChangeDialog,
  hasActivePriceDialog,
  startPriceChangeDialog,
  wantsPriceChange,
} from "../_shared/agent-price-change.ts";
import {
  getChatFocus,
  isLikelyFollowUp,
  setChatFocus,
  sweepExpiredPendings,
  switchChatFocus,
} from "../_shared/agent-chat-focus.ts";
import { muhaPhotoBusy, muhaPhotoFail, muhaPhotoReady, pick } from "../_shared/agent-voice.ts";
import {
  AGENT_DISPLAY,
  buildTeamPlan,
  clampHops,
  detectNamedAgents,
  detectMentionedAgents,
  isDoneReply,
  nextPingFromReply,
  peerTalkBrief,
  teamBriefForPrompt,
} from "../_shared/agent-team.ts";
import {
  actionsCapabilityBrief,
  getActivePending,
  handleOwnerActionMessage,
  isCancelText,
  isConfirmText,
  parseSelection,
} from "../_shared/agent-actions.ts";
import {
  expandAdsActionCommand,
  tryFastCommand,
} from "../_shared/agent-fast-commands.ts";
import {
  AGENT_PROMPTS,
  isNameOnlyPing,
  liveNameReply,
  namePingAgent,
} from "../_shared/agent-personas.ts";
import {
  formatNewsFacts,
  openingDiversityHint,
  recentMarketplaceNews,
  wantsNewsDiscussion,
  wantsTeamBanter,
} from "../_shared/agent-collective.ts";

// ---------- Настройка ----------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const BOT_TOKENS: Record<string, string> = {
  karina: (Deno.env.get("KARINA_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim(),
  saule: (Deno.env.get("SAULE_BOT_TOKEN") || "").trim(),
  amina: (Deno.env.get("AMINA_BOT_TOKEN") || "").trim(),
  anton: (Deno.env.get("ANTON_BOT_TOKEN") || "").trim(),
  alina: (Deno.env.get("ALINA_BOT_TOKEN") || "").trim(),
  alina2: (Deno.env.get("ALINA_SECOND_BOT_TOKEN") || "").trim(),
  muha: (Deno.env.get("MUHA_BOT_TOKEN") || "").trim(),
};

const MAX_AGENT_HOPS = clampHops(Deno.env.get("AGENT_CHAT_MAX_HOPS"), 3);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Антидубль Telegram retries в рамках одного isolate
const recentUpdateIds = new Map<number, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

function rememberUpdate(updateId: number): boolean {
  const now = Date.now();
  if (recentUpdateIds.size > 500) {
    for (const [id, ts] of recentUpdateIds) {
      if (now - ts > DEDUP_TTL_MS) recentUpdateIds.delete(id);
    }
  }
  const prev = recentUpdateIds.get(updateId);
  if (prev && now - prev < DEDUP_TTL_MS) return false;
  recentUpdateIds.set(updateId, now);
  return true;
}

// deno-lint-ignore no-explicit-any
const edgeRuntime = (globalThis as any).EdgeRuntime as
  | { waitUntil?: (p: Promise<unknown>) => void }
  | undefined;

async function runWork(task: Promise<unknown>): Promise<void> {
  const guarded = task.catch((e) => console.error("[telegram-router] bg", e));
  // На Supabase Edge: отдаём 200 сразу, работа дожимается в waitUntil.
  // Без waitUntil — ждём, иначе isolate убьёт промис.
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(guarded);
    return;
  }
  await guarded;
}

async function sendTelegramMessage(
  botKey: string,
  chatId: number,
  text: string,
  replyToMessageId?: number,
  businessConnectionId?: string,
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> },
): Promise<boolean> {
  const token = BOT_TOKENS[botKey];
  if (!token) {
    console.error(`Нет токена для бота: ${botKey}`);
    return false;
  }
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 4000),
  };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
  if (businessConnectionId) payload.business_connection_id = businessConnectionId;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return true;
    const err = await res.text();
    console.error(`[telegram-router] sendMessage ${botKey} failed:`, err);
    if (replyToMessageId) {
      const retryPayload = { ...payload };
      delete retryPayload.reply_to_message_id;
      const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryPayload),
        signal: AbortSignal.timeout(15000),
      });
      if (!retry.ok) {
        console.error(`[telegram-router] sendMessage retry failed:`, await retry.text());
        return false;
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error(`[telegram-router] sendMessage ${botKey} exception:`, e);
    return false;
  }
}

/** Ответ Антона по FBS: сначала фото-таблица (если есть), потом текст/кнопки. */
async function sendAntonFbsReply(
  chatId: number,
  result: FbsStockReply,
  replyToMessageId?: number,
): Promise<void> {
  if (result.photos?.length) {
    for (const ph of result.photos) {
      await sendTelegramPhoto(
        "anton",
        chatId,
        {
          imageBytes: ph.bytes,
          mime: ph.mime || "image/png",
          filename: ph.filename || "fbs-sizes.png",
          caption: ph.caption,
        },
        replyToMessageId,
      );
    }
  }
  if (result.reply) {
    await sendTelegramMessage(
      "anton",
      chatId,
      result.reply,
      result.photos?.length ? undefined : replyToMessageId,
      undefined,
      result.replyMarkup,
    );
  }
}

async function answerTelegramCallback(
  botKey: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const token = BOT_TOKENS[botKey];
  if (!token || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text?.slice(0, 180),
        show_alert: false,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error(`[telegram-router] answerCallbackQuery ${botKey}`, e);
  }
}

/** Вебхук Антона с callback_query (кнопки FBS). */
async function ensureAntonWebhook(): Promise<Record<string, unknown>> {
  const token = BOT_TOKENS.anton;
  if (!token) return { ok: false, error: "ANTON_BOT_TOKEN missing" };
  const hookUrl = `${SUPABASE_URL}/functions/v1/telegram-router?bot=anton`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: hookUrl,
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: Boolean(data?.ok), hookUrl, data };
}

/** Включает business_message в webhook Алины (нужно для рабочего аккаунта). */
async function ensureAlinaBusinessWebhook(): Promise<Record<string, unknown>> {
  const token = BOT_TOKENS.alina;
  if (!token) return { ok: false, error: "ALINA_BOT_TOKEN missing" };
  const hookUrl =
    `${SUPABASE_URL}/functions/v1/telegram-router?bot=alina`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: hookUrl,
      allowed_updates: [
        "message",
        "business_message",
        "business_connection",
        "edited_business_message",
      ],
      drop_pending_updates: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: Boolean(data?.ok), hookUrl, data };
}

/** Диагностика: включён ли у Алины Secretary Mode (can_connect_to_business). */
async function alinaBusinessStatus(): Promise<Record<string, unknown>> {
  const token = BOT_TOKENS.alina;
  if (!token) return { ok: false, error: "ALINA_BOT_TOKEN missing" };
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = await meRes.json().catch(() => ({}));
  const result = me?.result || {};
  return {
    ok: Boolean(me?.ok),
    username: result.username || null,
    can_connect_to_business: Boolean(result.can_connect_to_business),
    can_join_groups: result.can_join_groups,
    can_read_all_group_messages: result.can_read_all_group_messages,
    hint: result.can_connect_to_business
      ? "Secretary Mode ON — можно добавлять в Чат-боты"
      : "Secretary Mode OFF — в @BotFather включи Mode Settings → Secretary Mode",
  };
}

async function sendTelegramPhoto(
  botKey: string,
  chatId: number,
  opts: {
    imageUrl?: string;
    imageBytes?: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  },
  replyToMessageId?: number,
  businessConnectionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = BOT_TOKENS[botKey];
  if (!token) return { ok: false, error: "no token" };

  // 1) Сначала байты (надёжно для Business + WB webp)
  if (opts.imageBytes?.length) {
    try {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append(
        "photo",
        new Blob([opts.imageBytes], { type: opts.mime || "image/webp" }),
        opts.filename || "product.webp",
      );
      if (opts.caption) form.append("caption", opts.caption.slice(0, 900));
      if (replyToMessageId) {
        form.append("reply_to_message_id", String(replyToMessageId));
      }
      if (businessConnectionId) {
        form.append("business_connection_id", businessConnectionId);
      }
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      const body = await res.text();
      if (res.ok) return { ok: true };
      console.error(`[telegram-router] sendPhoto bytes ${botKey}:`, body.slice(0, 400));
      // без reply_to — иногда мешает
      if (replyToMessageId) {
        const form2 = new FormData();
        form2.append("chat_id", String(chatId));
        form2.append(
          "photo",
          new Blob([opts.imageBytes], { type: opts.mime || "image/webp" }),
          opts.filename || "product.webp",
        );
        if (opts.caption) form2.append("caption", opts.caption.slice(0, 900));
        if (businessConnectionId) {
          form2.append("business_connection_id", businessConnectionId);
        }
        const retry = await fetch(
          `https://api.telegram.org/bot${token}/sendPhoto`,
          { method: "POST", body: form2, signal: AbortSignal.timeout(60000) },
        );
        const retryBody = await retry.text();
        if (retry.ok) return { ok: true };
        return { ok: false, error: retryBody.slice(0, 300) };
      }
      return { ok: false, error: body.slice(0, 300) };
    } catch (e) {
      console.error(`[telegram-router] sendPhoto bytes ${botKey}:`, e);
      return { ok: false, error: String(e) };
    }
  }

  // 2) Fallback: URL (часто падает на WB webp)
  if (opts.imageUrl) {
    try {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        photo: opts.imageUrl,
        caption: (opts.caption || "").slice(0, 900),
      };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      if (businessConnectionId) payload.business_connection_id = businessConnectionId;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      const body = await res.text();
      if (res.ok) return { ok: true };
      console.error(`[telegram-router] sendPhoto url ${botKey}:`, body.slice(0, 400));
      return { ok: false, error: body.slice(0, 300) };
    } catch (e) {
      console.error(`[telegram-router] sendPhoto url ${botKey}:`, e);
      return { ok: false, error: String(e) };
    }
  }
  return { ok: false, error: "no image" };
}

async function saveMessage(chatId: number, sender: string, text: string) {
  try {
    await supabase.from("agent_chat_history").insert({
      chat_id: chatId,
      sender: sender.slice(0, 80),
      text: text.slice(0, 4000),
    });
  } catch (e) {
    console.error("[telegram-router] saveMessage", e);
  }
}

async function loadRecentHistory(chatId: number, limit = 6) {
  const { data } = await supabase
    .from("agent_chat_history")
    .select("sender, text, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

function formatHistory(
  history: Array<{ sender: string; text: string }>,
): string {
  return history
    .map((h) => `${h.sender}: ${String(h.text || "").slice(0, 160)}`)
    .join("\n");
}

function normalizeBotKey(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "saule" || (t.startsWith("sau") && t.length <= 6 && /л|le|ле/.test(t))) {
    return "saule";
  }
  if (["karina", "amina", "anton", "alina", "alina2", "muha"].includes(t)) return t;
  return t;
}

/**
 * Кто говорит (токен отправителя) и какой webhook оркестрирует.
 * Карина часто без своего ?bot= на router — тогда оркестрирует Сауле,
 * а сообщение уходит токеном Карины (TELEGRAM_BOT_TOKEN).
 */
function resolveSpeakAndOrchestrator(
  plan: string[],
  triggeringBot: string | null,
): { speakAs: string; orchestrator: string } | null {
  let speakAs: string | null = null;
  for (const agent of plan) {
    if (BOT_TOKENS[agent]) {
      speakAs = agent;
      break;
    }
  }
  if (!speakAs) {
    for (const agent of ["saule", "amina", "anton", "alina", "muha"]) {
      if (BOT_TOKENS[agent]) {
        speakAs = agent;
        break;
      }
    }
  }
  if (!speakAs) return null;

  let orchestrator = speakAs;
  if (speakAs === "karina" && triggeringBot && triggeringBot !== "karina") {
    orchestrator = "saule"; // единственный дирижёр, чтобы не было 5 ответов
    if (!BOT_TOKENS.saule) {
      for (const agent of ["amina", "anton", "alina", "muha"]) {
        if (BOT_TOKENS[agent]) {
          orchestrator = agent;
          break;
        }
      }
    }
  }
  return { speakAs, orchestrator };
}

/** @deprecated alias for meta-commands */
function pickStarter(plan: string[], triggeringBot: string | null): string | null {
  return resolveSpeakAndOrchestrator(plan, triggeringBot)?.orchestrator ?? null;
}

/**
 * Выбор модели для OpenAI.
 * - modelOverride задан → он
 * - kind "fast" → AGENT_FAST_MODEL || gpt-4o-mini (для лёгких/структурированных сценариев)
 * - иначе → OPENAI_MODEL || gpt-4o (свободный team plan / hop-диалог)
 *
 * Сейчас structured-ветки (/sales, pending РК, FBS-кнопки) OpenAI не вызывают —
 * helper и override готовы, если позже туда добавят LLM.
 */
function resolveOpenAiModel(opts?: {
  modelOverride?: string;
  kind?: "fast" | "full";
}): string {
  const override = (opts?.modelOverride || "").trim();
  if (override) return override;
  if (opts?.kind === "fast") {
    return (Deno.env.get("AGENT_FAST_MODEL") || "gpt-4o-mini").trim() || "gpt-4o-mini";
  }
  return (Deno.env.get("OPENAI_MODEL") || "gpt-4o").trim() || "gpt-4o";
}

async function askOpenAI(opts: {
  systemPrompt: string;
  history: string;
  wbContext: string;
  userMessage: string;
  /** Если задан — используется вместо OPENAI_MODEL / gpt-4o */
  modelOverride?: string;
  /** "fast" → AGENT_FAST_MODEL || gpt-4o-mini; по умолчанию full (gpt-4o) */
  modelKind?: "fast" | "full";
}) {
  const model = resolveOpenAiModel({
    modelOverride: opts.modelOverride,
    kind: opts.modelKind,
  });
  try {
    console.log(`[telegram-router] openai model=${model} kind=${opts.modelKind || "full"}`);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: opts.systemPrompt },
          {
            role: "system",
            content: `ФАКТЫ WB (по всем кабинетам):\n${opts.wbContext || "нет данных"}`,
          },
          {
            role: "system",
            content: `Недавняя история чата (для контекста, не повторяй её):\n${opts.history || "—"}`,
          },
          { role: "user", content: opts.userMessage.slice(0, 2000) },
        ],
        temperature: 0.95,
        max_tokens: 360,
        presence_penalty: 0.7,
        frequency_penalty: 0.65,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[telegram-router] openai error", JSON.stringify(data).slice(0, 300));
      return "Не удалось получить ответ от модели. Попробуйте ещё раз.";
    }
    return data.choices?.[0]?.message?.content?.trim() || "Пустой ответ модели.";
  } catch (e) {
    console.error("[telegram-router] openai exception", e);
    return "Таймаут модели. Повторите коротко.";
  }
}

async function runAgentTurn(opts: {
  chatId: number;
  targetAgent: string;
  userMessage: string;
  rootTask: string;
  plan: string[];
  visited: Set<string>;
  wbCache: WbContextCache;
  fromAgent?: string | null;
  replyToMessageId?: number;
  hop: number;
}): Promise<void> {
  const {
    chatId,
    targetAgent,
    userMessage,
    rootTask,
    plan,
    visited,
    wbCache,
    fromAgent,
    replyToMessageId,
    hop,
  } = opts;

  if (!BOT_TOKENS[targetAgent]) return;
  if (hop >= MAX_AGENT_HOPS) return;
  if (visited.has(targetAgent)) return;
  visited.add(targetAgent);

  const lastHop = hop + 1 >= MAX_AGENT_HOPS;

  // Спец-ветки — без тяжёлого WB/LLM
  if (targetAgent === "alina" && !fromAgent && isAlinaStatsQuestion(rootTask)) {
    const reply = await alinaSelfbuyStatsText();
    await sendTelegramMessage("alina", chatId, reply, replyToMessageId);
    await saveMessage(chatId, "alina", reply);
    return;
  }

  if (
    targetAgent === "muha" &&
    !fromAgent &&
    wantsPhoto(rootTask) &&
    !/(главн\w*\s+фото|фото\s+(фонар|вырез|блузк|с\s*вб)|дай.*фото.*(фонар|вырез|блузк))/i
      .test(rootTask)
  ) {
    await sendTelegramMessage("muha", chatId, muhaPhotoBusy(), replyToMessageId);
    const photo = await generateMuhaPhoto(rootTask);
    if (!photo.ok) {
      const fail = muhaPhotoFail();
      await sendTelegramMessage("muha", chatId, fail);
      await saveMessage(chatId, "muha", fail);
      return;
    }
    const sent = await sendTelegramPhoto(
      "muha",
      chatId,
      {
        imageUrl: photo.imageUrl,
        imageBytes: photo.imageBytes,
        caption: pick([
          "Муха · фото для карточки",
          "Кадр под WB",
          "Черновик фото",
        ]),
      },
      replyToMessageId,
    );
    const note = sent.ok
      ? muhaPhotoReady()
      : "Файл Telegram не принял — кинь ещё раз.";
    await sendTelegramMessage("muha", chatId, note);
    await saveMessage(chatId, "muha", note);
    return;
  }

  // Параллельно: история + WB (standing tasks редко нужны — лениво)
  const historyP = loadRecentHistory(chatId);
  let wbContext = "";
  try {
    wbContext = await buildAgentWbContext(targetAgent as AgentKey, wbCache);
  } catch (e) {
    console.error("[telegram-router] wb context", e);
    wbContext = "Не удалось загрузить отчёты WB. Скажи об этом коротко.";
  }

  if (targetAgent === "alina") {
    try {
      wbContext += `\n\nCRM самовыкупы:\n${await alinaSelfbuyStatsText()}`;
    } catch (e) {
      console.error("[telegram-router] alina stats context", e);
    }
  }
  try {
    const qaFacts = await teamQaFactsForAgent(targetAgent, rootTask);
    if (qaFacts) wbContext += `\n\n${qaFacts}`;
  } catch (e) {
    console.error("[telegram-router] qa facts", e);
  }
  if (wantsNewsDiscussion(rootTask) || wantsTeamBanter(rootTask)) {
    try {
      const news = await recentMarketplaceNews(6);
      wbContext += `\n\n${formatNewsFacts(news)}`;
    } catch (e) {
      console.error("[telegram-router] news facts", e);
    }
  }

  const history = await historyP;
  const historyFmt = formatHistory(history);
  const systemPrompt =
    (AGENT_PROMPTS[targetAgent] || AGENT_PROMPTS.saule) +
    `\n\n${actionsCapabilityBrief()}` +
    `\n\n${teamBriefForPrompt(plan, rootTask)}` +
    (fromAgent
      ? `\n\n${peerTalkBrief(fromAgent, userMessage)}`
      : `\n\nВладелец написал в рабочий чат. Ответь как живой сотрудник: пойми смысл → факт/цифра или одно уточнение. Коротко. Выбери один из ФОРМАТОВ ОТВЕТА (не тот же, что в последних репликах истории).`) +
    `\n\n${openingDiversityHint(historyFmt)}` +
    `\n\nВарьируй формулировки и структуру. Не копируй шаблоны и не начинай два раза подряд одинаково.` +
    (lastHop
      ? `\n\nПоследний ход — никого не зови, закончи коротко (формат СТОП или ИТОГ).`
      : "");

  console.log(
    `[telegram-router] turn agent=${targetAgent} hop=${hop} from=${
      fromAgent || "human"
    } plan=${plan.join(">")} chat=${chatId}`,
  );

  // Свободный team plan / hop-диалог — качество рассуждения: full (gpt-4o)
  const reply = await askOpenAI({
    systemPrompt,
    history: historyFmt,
    wbContext,
    modelKind: "full",
    userMessage: fromAgent
      ? [
        `Вопрос владельца: ${rootTask}`,
        `${AGENT_DISPLAY[fromAgent] || fromAgent} в чате: ${userMessage}`,
        `Ты — ${AGENT_DISPLAY[targetAgent] || targetAgent}. Ответь коротко по делу.`,
      ].join("\n")
      : rootTask,
  });

  // Сначала в чат, потом история — быстрее для пользователя
  await sendTelegramMessage(targetAgent, chatId, reply, replyToMessageId);
  saveMessage(chatId, targetAgent, reply).catch(() => {});

  // Фокус на ответившем (особенно если задал вопрос) — чтобы другие не перебивали
  const asksFollowUp =
    /\?/.test(reply) ||
    /(какой|какая|какие|какой\s+артикул|модель|уточн|напиши|скажи|на\s+сколько)/i.test(
      reply,
    );
  if (asksFollowUp) {
    await setChatFocus(chatId, targetAgent, "asked_followup", 15);
  } else {
    await setChatFocus(chatId, targetAgent, "last_speaker", 8);
  }

  if (lastHop) return;
  if (isDoneReply(reply)) return;

  // Живой пинг (@ или по имени) — приоритет; иначе следующий из плана владельца
  let next = nextPingFromReply(reply, visited);
  const pinged = Boolean(next);
  if (!next && plan.length >= 2) {
    next = plan.find((a) => !visited.has(a) && BOT_TOKENS[a]) || null;
  }
  if (!next || !BOT_TOKENS[next]) return;

  // Передали коллеге — фокус на нём, чтобы реплика владельца не ушла «дефолтной» Карине
  await setChatFocus(chatId, next, `handoff_from_${targetAgent}`, 15);

  // Если сами не позвали, а идём по плану — пусть следующий «подхватит» коротко
  const handoffText = pinged
    ? reply
    : `${reply}\n\n(добавь коротко своё по зоне, без пересказа)`;

  await runAgentTurn({
    chatId,
    targetAgent: next,
    userMessage: handoffText,
    rootTask,
    plan,
    visited,
    wbCache,
    fromAgent: targetAgent,
    hop: hop + 1,
  });
}

serve(async (req) => {
  // Telegram должен получать 200, иначе ретраи → дубли
  const ok = () => new Response("ok", { status: 200 });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), {
      status: s,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    const triggeringBot = normalizeBotKey(url.searchParams.get("bot"));

    // Разовая настройка webhook Алины под Telegram Business
    if (req.method === "GET" && url.searchParams.get("ensure_alina_business") === "1") {
      return json(await ensureAlinaBusinessWebhook());
    }
    if (req.method === "GET" && url.searchParams.get("ensure_anton_webhook") === "1") {
      return json(await ensureAntonWebhook());
    }
    if (req.method === "GET" && url.searchParams.get("alina_business_status") === "1") {
      return json(await alinaBusinessStatus());
    }
    if (req.method === "GET" && url.searchParams.get("alina_dialogs") === "1") {
      return json(await alinaRecentDialogs(30));
    }
    if (req.method === "GET" && url.searchParams.get("alina_sync_sheet") === "1") {
      return json(await refreshAlinaFromSheet());
    }

    if (req.method !== "POST") return ok();

    // Без ?bot= все вебхуки ответили бы сразу — запрещаем
    if (!triggeringBot) {
      console.error("[telegram-router] missing ?bot=");
      return ok();
    }
    if (!BOT_TOKENS[triggeringBot] && triggeringBot !== "karina") {
      console.error(`[telegram-router] unknown/empty bot=${triggeringBot}`);
      return ok();
    }

    const update = await req.json();
    const updateId = Number(update?.update_id);
    if (Number.isFinite(updateId) && !rememberUpdate(updateId)) {
      console.log(`[telegram-router] dedup update_id=${updateId}`);
      return ok();
    }

    // ── Inline-кнопки FBS (Антон) ──────────────────────────────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = String(cq?.data || "");
      const chatId = Number(cq?.message?.chat?.id || cq?.from?.id || 0);
      const tgUserId = Number(cq?.from?.id || 0);
      if (!chatId) return ok();

      if (isFbsStockCallback(data)) {
        // Чужие боты не трогают кнопки логиста
        if (triggeringBot !== "anton") return ok();
        await runWork((async () => {
          await answerTelegramCallback("anton", String(cq.id || ""));
          const result = await handleFbsStockCallback({
            chatId,
            tgUserId,
            data,
          });
          if (result.reply || result.photos?.length) {
            await sendAntonFbsReply(
              chatId,
              result,
              Number(cq?.message?.message_id) || undefined,
            );
            if (result.reply) await saveMessage(chatId, "anton", result.reply);
          }
        })());
        return ok();
      }
      return ok();
    }

    // Подключение / отключение рабочего аккаунта к Алине
    if (update.business_connection && triggeringBot === "alina") {
      const bc = update.business_connection;
      console.log(
        `[telegram-router] business_connection id=${bc?.id} enabled=${bc?.is_enabled} user=${bc?.user?.id}`,
      );
      await logAlinaRawEvent(Number(bc?.user_chat_id || 0), "business_connection", {
        id: bc?.id,
        is_enabled: bc?.is_enabled,
        user_id: bc?.user?.id,
        username: bc?.user?.username,
        user_chat_id: bc?.user_chat_id,
        rights: bc?.rights || null,
      });
      if (bc?.is_enabled && bc?.user_chat_id && BOT_TOKENS.alina) {
        await sendTelegramMessage(
          "alina",
          Number(bc.user_chat_id),
          "Алина подключена к рабочему аккаунту.\n" +
            "Клиенты пишут тебе — я отвечу за тебя и соберу данные по раздачам.\n" +
            "В тимчате: /selfbuy",
        );
      }
      return ok();
    }

    // Обычное сообщение ИЛИ сообщение клиента на рабочий акк (Telegram Business)
    const isBusiness = Boolean(update.business_message);
    const message = update.business_message || update.message;
    if (!message) return ok();
    if (message.from?.is_bot) return ok();

    const photoSizes = Array.isArray(message.photo) ? message.photo : [];
    const largestPhoto = photoSizes.length
      ? photoSizes[photoSizes.length - 1]
      : null;
    const docImage = message.document?.mime_type?.startsWith?.("image/")
      ? message.document
      : null;
    const photoFileId = String(
      largestPhoto?.file_id || docImage?.file_id || "",
    ) || null;
    const hasPhoto = Boolean(photoFileId || message.sticker);
    const text = String(message.text || message.caption || "").trim();
    // Нужен текст или фото (скрины по ТЗ)
    if (!text && !hasPhoto) return ok();

    const businessConnectionId = isBusiness
      ? String(message.business_connection_id || "")
      : "";

    // Business: отвечаем только Алиной (клиентский поток)
    if (isBusiness && triggeringBot !== "alina") {
      return ok();
    }

    // Сообщения с рабочего аккаунта в чужом ЛС — не считаем заявкой клиента
    if (isBusiness && isBusinessOwnerMessage(message)) {
      await logAlinaRawEvent(Number(message.chat?.id || 0), "business_skip", {
        reason: "owner_message",
        from_id: message.from?.id,
        text: text.slice(0, 300),
        hasPhoto,
      });
      return ok();
    }

    const chatId = Number(message.chat.id);
    // протухшие focus/диалоги — чтобы Карина не цеплялась за старый sticky
    await sweepExpiredPendings(chatId).catch(() => {});
    const fullName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    // ── Быстрые команды без OpenAI ──────────────────────────────────────────
    {
      const isMetaCmd =
        /^\/?(help|ping|cabinets|помощь|команды|пинг|кабинеты)(@\w+)?(\s|$)/i
          .test(text.trim());
      const fast = await tryFastCommand(text, triggeringBot);

      if (fast.handled && fast.reply) {
        const replyAs = isMetaCmd
          ? (pickStarter(["saule"], triggeringBot) || triggeringBot)
          : (fast.agentKey || triggeringBot);

        if (triggeringBot === replyAs) {
          await runWork((async () => {
            await sendTelegramMessage(
              replyAs,
              chatId,
              fast.reply!,
              message.message_id,
            );
            saveMessage(chatId, message.from?.first_name ?? "user", text).catch(() => {});
            saveMessage(chatId, replyAs, fast.reply!).catch(() => {});
          })());
        }
        return ok();
      }

      // /ads start baza → не fast-reply, но нужен агент amina (ниже pending/actions)
      if (fast.agentKey && fast.agentKey !== triggeringBot && !isMetaCmd) {
        // другой webhook дойдёт до своего бота
      }
    }

    // ── FBS-диалог логиста (кнопки/уточнения) — другие боты молчат ──────────
    {
      const fbsActive = await hasActiveFbsStockDialog(chatId);
      if (fbsActive) {
        if (triggeringBot !== "anton") return ok();
        const cont = await continueFbsStockDialog({
          chatId,
          tgUserId: Number(message.from?.id),
          text,
        });
        if (cont.handled) {
          if (cont.reply || cont.photos?.length) {
            await runWork((async () => {
              await sendAntonFbsReply(chatId, cont, message.message_id);
              saveMessage(chatId, message.from?.first_name ?? "user", text).catch(() => {});
              if (cont.reply) saveMessage(chatId, "anton", cont.reply).catch(() => {});
            })());
          }
          return ok();
        }
      } else if (wantsFbsStock(text) && triggeringBot !== "anton") {
        // Пока Антон ещё не создал pending — остальные webhook'и уже молчат в QA
      }
    }

    // ── Смена цены (Сауле) — фокус, другие молчат ───────────────────────────
    {
      const priceActive = await hasActivePriceDialog(chatId);
      const namedPrice = [
        ...detectMentionedAgents(text),
        ...detectNamedAgents(text),
      ];
      const switchAway =
        priceActive &&
        namedPrice.length === 1 &&
        namedPrice[0] !== "saule" &&
        !wantsPriceChange(text);
      if (switchAway) {
        await switchChatFocus(chatId, namedPrice[0], "switch_from_price", 15);
      } else if ((priceActive || wantsPriceChange(text))) {
        if (triggeringBot !== "saule") return ok();
        const priceFn = priceActive ? continuePriceChangeDialog : startPriceChangeDialog;
        const priceRes = await priceFn({
          chatId,
          tgUserId: Number(message.from?.id),
          text,
        });
        if (priceRes.handled) {
          if (priceRes.reply) {
            // Синхронно: иначе isolate может оборвать waitUntil до sendMessage
            try {
              await sendTelegramMessage(
                "saule",
                chatId,
                priceRes.reply,
                message.message_id,
              );
              await saveMessage(chatId, message.from?.first_name ?? "user", text);
              await saveMessage(chatId, "saule", priceRes.reply);
            } catch (e) {
              console.error("[telegram-router] price reply", e);
            }
          }
          return ok();
        }
      }
    }

    // ── Фокус чата: пока говорим с одним — остальные не встревают ──────────
    {
      const namedNow = [
        ...detectMentionedAgents(text),
        ...detectNamedAgents(text),
      ];
      const uniqueNamed = [...new Set(namedNow)];
      const focusEarly = await getChatFocus(chatId);
      const pendingEarly = await getActivePending(chatId);
      const lockedEarly = pendingEarly?.agent_key || focusEarly?.agent_key || null;

      if (uniqueNamed.length === 1) {
        if (lockedEarly && uniqueNamed[0] !== lockedEarly) {
          // смена собеседника — сброс чужих диалогов (цена/FBS/РК)
          await switchChatFocus(chatId, uniqueNamed[0], "switch", 15);
        } else {
          await setChatFocus(chatId, uniqueNamed[0], "named", 15);
        }
      }

      const focus = await getChatFocus(chatId);
      const pendingAny = await getActivePending(chatId);
      const lockedAgent = pendingAny?.agent_key || focus?.agent_key || null;

      if (lockedAgent) {
        // Явно позвали другого — уже переключили выше; здесь только follow-up lock
        if (uniqueNamed.length === 1 && uniqueNamed[0] !== lockedAgent) {
          // no-op: switchChatFocus уже отработал
        } else if (
          !uniqueNamed.length ||
          uniqueNamed.includes(lockedAgent)
        ) {
          const followUp = isLikelyFollowUp(text) || Boolean(pendingAny);
          const resolvedLock = resolveSpeakAndOrchestrator(
            [lockedAgent],
            triggeringBot,
          );
          if (followUp || !uniqueNamed.length) {
            if (
              resolvedLock &&
              triggeringBot !== resolvedLock.orchestrator &&
              triggeringBot !== lockedAgent
            ) {
              return ok();
            }
            // только владелец фокуса отвечает — дальше plan принудительно
            if (
              resolvedLock &&
              (triggeringBot === resolvedLock.orchestrator ||
                triggeringBot === lockedAgent)
            ) {
              // обработаем ниже через plan=[lockedAgent], пометим через focus
            } else if (triggeringBot !== lockedAgent) {
              return ok();
            }
          }
        }
      }
    }

    // ── Действия с подтверждением (РК и т.п.) ───────────────────────────────
    {
      const pending = await getActivePending(chatId);
      if (pending?.action_type === "fbs_stock") {
        // уже обработано выше / ждём Антона
        if (triggeringBot !== "anton") return ok();
      } else {
        const actionText = expandAdsActionCommand(text) || text;
        const looksLikeAds =
          /(рк|реклам|кампан|\/ads|пополни|запуст|автозапу|запомни.*(день|время|рк)|отмени\s+авто|какие\s+авто)/i
            .test(actionText);
        const actionAgent = pending?.agent_key || (looksLikeAds ? "amina" : null);

        if (actionAgent === "amina" && triggeringBot !== "amina" &&
          (pending?.agent_key === "amina" || looksLikeAds)) {
          // чужие боты не лезут в диалог Амины по РК
          return ok();
        }

        if (actionAgent && triggeringBot === actionAgent) {
          const actionResult = await handleOwnerActionMessage({
            chatId,
            tgUserId: Number(message.from?.id),
            text: actionText,
            agentKey: actionAgent,
          });
          if (actionResult.handled && actionResult.reply) {
            await runWork((async () => {
              await sendTelegramMessage(
                actionAgent,
                chatId,
                actionResult.reply!,
                message.message_id,
              );
              saveMessage(chatId, message.from?.first_name ?? "user", text).catch(() => {});
              saveMessage(chatId, actionAgent, actionResult.reply!).catch(() => {});
            })());
            return ok();
          }
        } else if (pending && triggeringBot !== pending.agent_key) {
          const sticky =
            isConfirmText(text) ||
            isCancelText(text) ||
            parseSelection(text, 100) !== null;
          if (sticky) return ok();
        }
      }
    }

    // ── Команда оффера из тимчата («алина оффер открыт кэшбек 70 …») ───────
    if (triggeringBot === "alina" && !isBusiness) {
      const offerReply = await tryAlinaOfferCommand(text);
      if (offerReply) {
        await runWork((async () => {
          await sendTelegramMessage("alina", chatId, offerReply, message.message_id);
          saveMessage(chatId, "alina", offerReply).catch(() => {});
        })());
        return ok();
      }
    }

    // ── Алина CRM (ЛС / клиентский чат / Telegram Business рабочий акк) ─────
    if (
      (triggeringBot === "alina" || triggeringBot === "alina2") &&
      (isBusiness || isAlinaClientContext(message.chat)) &&
      !isAlinaStatsQuestion(text)
    ) {
      const replyBot = triggeringBot === "alina2" && BOT_TOKENS.alina2
        ? "alina2"
        : "alina";
      if (!BOT_TOKENS[replyBot]) return ok();

      const sourceAccount = isBusiness
        ? "business"
        : replyBot === "alina2"
        ? "second"
        : (Deno.env.get("ALINA_SOURCE_ACCOUNT") || "main");

      await runWork((async () => {
        if (isBusiness) {
          await logAlinaRawEvent(chatId, "business_in", {
            from_id: message.from?.id,
            username: message.from?.username,
            full_name: fullName || null,
            text,
            hasPhoto,
            business_connection_id: businessConnectionId || null,
            message_id: message.message_id,
          });
        }
        const { replies, photos } = await handleAlinaClientMessage({
          chatId,
          userId: Number(message.from?.id),
          username: message.from?.username,
          fullName: fullName || undefined,
          text: text || (hasPhoto ? "скрин" : ""),
          hasPhoto,
          photoFileId,
          botToken: BOT_TOKENS[replyBot] || BOT_TOKENS.alina || null,
          sourceAccount,
        });
        // Сначала фото товара (если есть), потом текст
        let photoSent = false;
        if (photos?.length) {
          for (const ph of photos) {
            const sentPhoto = await sendTelegramPhoto(
              replyBot,
              chatId,
              {
                imageUrl: ph.url,
                imageBytes: ph.bytes,
                mime: ph.mime,
                filename: ph.filename,
                caption: ph.caption,
              },
              message.message_id,
              businessConnectionId || undefined,
            );
            photoSent = photoSent || sentPhoto.ok;
            if (isBusiness) {
              await logAlinaRawEvent(chatId, "business_out_photo", {
                url: ph.url,
                caption: ph.caption,
                sent: sentPhoto.ok,
                error: sentPhoto.error || null,
                bytes: ph.bytes?.length || 0,
                business_connection_id: businessConnectionId || undefined,
                to_user: message.from?.id,
              });
            }
            if (!sentPhoto.ok && ph.caption) {
              // fallback текстом + ссылка, если файл не приняли
              const failText = ph.url
                ? `${ph.caption}\n${ph.url}`
                : `${ph.caption}\nНе смогла отправить файл, напишите ещё раз 🙌`;
              await sendTelegramMessage(
                replyBot,
                chatId,
                failText,
                message.message_id,
                businessConnectionId || undefined,
              );
            }
            if (ph.caption) {
              await saveMessage(
                chatId,
                replyBot,
                `[фото${sentPhoto.ok ? "" : " fail"}] ${ph.caption}`,
              );
            }
          }
        }
        for (let i = 0; i < replies.length; i++) {
          const reply = replies[i];
          const sent = await sendTelegramMessage(
            replyBot,
            chatId,
            reply,
            i === 0 && !photoSent ? message.message_id : undefined,
            businessConnectionId || undefined,
          );
          if (isBusiness) {
            await logAlinaRawEvent(chatId, "business_out", {
              text: reply,
              sent,
              business_connection_id: businessConnectionId || undefined,
              to_user: message.from?.id,
            });
          }
          await saveMessage(chatId, replyBot, reply);
        }
      })());
      return ok();
    }

    // Business-сообщения дальше в тим-роутер не пускаем
    if (isBusiness) {
      await logAlinaRawEvent(chatId, "business_skip", {
        reason: "not_alina_crm_path",
        triggeringBot,
        from_id: message.from?.id,
        text: text.slice(0, 500),
        business_connection_id: businessConnectionId || null,
      });
      return ok();
    }

    // ── Умные ответы в тимчате (таблица / фото WB / остатки) ───────────────
    {
      const qa = await tryTeamSmartQa(text, triggeringBot);
      if (qa.handled) {
        if (qa.deferFbsStock && triggeringBot === "anton") {
          await runWork((async () => {
            const fbs = await startFbsStockDialog({
              chatId,
              tgUserId: Number(message.from?.id),
              text,
            });
            if (fbs.reply || fbs.photos?.length) {
              await sendAntonFbsReply(chatId, fbs, message.message_id);
              if (fbs.reply) await saveMessage(chatId, "anton", fbs.reply);
            }
            saveMessage(chatId, message.from?.first_name ?? "user", text).catch(
              () => {},
            );
          })());
          return ok();
        }
        if (qa.reply || qa.photos?.length) {
          const speakAs = qa.agentKey && BOT_TOKENS[qa.agentKey]
            ? qa.agentKey
            : triggeringBot;
          if (triggeringBot === speakAs || triggeringBot === qa.agentKey) {
            await runWork((async () => {
              if (qa.photos?.length) {
                for (const ph of qa.photos) {
                  await sendTelegramPhoto(
                    speakAs,
                    chatId,
                    {
                      imageUrl: ph.url,
                      imageBytes: ph.bytes,
                      mime: ph.mime,
                      filename: ph.filename,
                      caption: ph.caption,
                    },
                    message.message_id,
                  );
                }
              }
              if (qa.reply) {
                await sendTelegramMessage(
                  speakAs,
                  chatId,
                  qa.reply,
                  qa.photos?.length ? undefined : message.message_id,
                  undefined,
                  qa.replyMarkup,
                );
                await saveMessage(chatId, speakAs, qa.reply);
              }
              saveMessage(chatId, message.from?.first_name ?? "user", text).catch(
                () => {},
              );
            })());
          }
        }
        // handled без reply = «проглотить», чтобы другие боты не дублировали
        return ok();
      }
    }

    // ── Живой отклик на «Карина» / «Сауле» без задачи (без пустого «да?») ───
    if (isNameOnlyPing(text)) {
      const pingAgent = namePingAgent(text);
      if (pingAgent) {
        const resolved = resolveSpeakAndOrchestrator([pingAgent], triggeringBot);
        if (resolved && triggeringBot === resolved.orchestrator) {
          await runWork((async () => {
            let fact = "";
            try {
              if (pingAgent === "alina") {
                const s = await alinaSelfbuyStatsText();
                fact = s.split("\n").slice(1, 3).join(" · ");
              } else if (pingAgent === "amina") {
                const ctx = await buildAgentWbContext("amina", createWbContextCache());
                const line = ctx.split("\n").find((l) => l.startsWith("▶ "));
                fact = line || "";
              } else if (pingAgent === "saule" || pingAgent === "karina" || pingAgent === "anton") {
                const ctx = await buildAgentWbContext(
                  pingAgent === "karina" ? "saule" : pingAgent as AgentKey,
                  createWbContextCache(),
                );
                const line = ctx.split("\n").find((l) => l.startsWith("▶ "));
                fact = line || "";
              }
            } catch { /* optional fact */ }
            const reply = liveNameReply(pingAgent, fact || undefined);
            await sendTelegramMessage(
              resolved.speakAs,
              chatId,
              reply,
              message.message_id,
            );
            saveMessage(chatId, message.from?.first_name ?? "user", text).catch(() => {});
            saveMessage(chatId, resolved.speakAs, reply).catch(() => {});
          })());
        }
        return ok();
      }
    }

    const focusEnd = await getChatFocus(chatId);
    const pendingEnd = await getActivePending(chatId);
    const stickyAgent = pendingEnd?.agent_key || focusEnd?.agent_key || null;
    const namedForPlan = [
      ...detectMentionedAgents(text),
      ...detectNamedAgents(text),
    ];
    let plan = buildTeamPlan(
      text,
      message.entities,
      wantsNewsDiscussion(text) || wantsTeamBanter(text)
        ? Math.max(MAX_AGENT_HOPS, 4)
        : MAX_AGENT_HOPS,
    );
    // Пока диалог с конкретным агентом — короткие реплики не уходят «дефолтной» Карине
    if (
      stickyAgent &&
      stickyAgent !== "karina" &&
      (!namedForPlan.length || namedForPlan.includes(stickyAgent)) &&
      (isLikelyFollowUp(text) || Boolean(pendingEnd) || plan[0] === "karina")
    ) {
      plan = [stickyAgent];
    }
    // Карина не оркестрирует чужой фокус, даже если plan по теме «общий»
    if (
      stickyAgent &&
      stickyAgent !== "karina" &&
      !namedForPlan.includes("karina") &&
      plan[0] === "karina" &&
      (Boolean(pendingEnd) || isLikelyFollowUp(text))
    ) {
      plan = [stickyAgent];
    }
    const resolved = resolveSpeakAndOrchestrator(plan, triggeringBot);
    if (!resolved) return ok();

    // Оркестрирует один webhook; говорит speakAs (Карина может говорить своим токеном)
    if (triggeringBot !== resolved.orchestrator) {
      console.log(
        `[telegram-router] skip bot=${triggeringBot} orch=${resolved.orchestrator} speak=${resolved.speakAs} plan=${plan.join(">")} chat=${chatId}`,
      );
      return ok();
    }

    await runWork((async () => {
      await saveMessage(chatId, message.from?.first_name ?? "user", text);
      if (resolved.speakAs) {
        await setChatFocus(chatId, resolved.speakAs, "speaking", 12);
      }
      await runAgentTurn({
        chatId,
        targetAgent: resolved.speakAs,
        userMessage: text,
        rootTask: text,
        plan,
        visited: new Set<string>(),
        wbCache: createWbContextCache(),
        replyToMessageId: message.message_id,
        hop: 0,
      });
    })());
    return ok();
  } catch (err) {
    console.error("[telegram-router] handler", err);
    return ok();
  }
});
