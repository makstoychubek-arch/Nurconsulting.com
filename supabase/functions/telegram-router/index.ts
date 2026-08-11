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
  alinaSelfbuyStatsText,
  handleAlinaClientMessage,
  isAlinaClientContext,
  isAlinaStatsQuestion,
} from "../_shared/alina-selfbuy.ts";
import { generateMuhaPhoto, wantsPhoto } from "../_shared/muha-photos.ts";
import {
  buildTeamPlan,
  clampHops,
  isDoneReply,
  nextPingFromReply,
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

const STYLE_RULES = `
Формат ответа (строго):
- Русский, деловой, сухо.
- 2–5 коротких строк. Без приветствий, без эмодзи, без «как дела».
- Структура: 1) факты/цифры по своей зоне 2) вывод 3) либо «Готово.» либо один @пинг.
- Не выдумывай цифры: только из блока «ФАКТЫ WB».
- Не повторяй то, что коллега уже сказал.
- Деньги в ₽, штуки явно.`;

const TEAM_PING_RULES = `
Коллеги (пинг только так):
@saulexxx_bot продажи | @aminaakd_bot реклама | @antonnnxx_bot логистика | @alinaaaxx_bot самовыкупы | @muxxxha_bot фото
- Максимум один @username в конце, с конкретной задачей.
- Не пингуй уже ответивших.
- Не зови всех подряд. Нет нужды в коллеге → «Готово.»`;

const AGENT_PROMPTS: Record<string, string> = {
  karina: `Ты Карина — координатор WB-команды. Сожми суть и делегируй узкое одному специалисту через @.
Действия (запуск РК и т.п.) — только через Амину и только после «подтверждаю» владельца.
${STYLE_RULES}
${TEAM_PING_RULES}
${actionsCapabilityBrief()}`,
  saule: `Ты Сауле — продажи WB (заказы/выкупы/отмены/топ/остатки/цена). Только своя зона.
Не запускаешь рекламу сама — зови @aminaakd_bot.
${STYLE_RULES}
${TEAM_PING_RULES}`,
  amina: `Ты Амина — реклама WB. Можешь готовить запуск/паузу РК, но НИКОГДА не утверждай, что уже изменила статус — только после слова владельца «подтверждаю» (это делает система).
Покажи список, спроси какие РК, жди подтверждения.
${STYLE_RULES}
${TEAM_PING_RULES}
${actionsCapabilityBrief()}`,
  anton: `Ты Антон — логистика/FBS (отгрузки, объёмы, риски склада). Только своя зона.
${STYLE_RULES}
${TEAM_PING_RULES}`,
  alina: `Ты Алина — самовыкупы/продвижение. В тимчате — статус CRM. Только своя зона.
${STYLE_RULES}
${TEAM_PING_RULES}`,
  muha: `Ты Муха — фото/контент карточки. Гипотезы по визуалу; фото — только по прямому запросу.
${STYLE_RULES}
${TEAM_PING_RULES}`,
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
): Promise<boolean> {
  const token = BOT_TOKENS[botKey];
  if (!token) {
    console.error(`Нет токена для бота: ${botKey}`);
    return false;
  }
  const body = { chat_id: chatId, text: text.slice(0, 4000) };
  const payload: Record<string, unknown> = { ...body };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

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
      const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

async function sendTelegramPhoto(
  botKey: string,
  chatId: number,
  opts: { imageUrl?: string; imageBytes?: Uint8Array; caption?: string },
  replyToMessageId?: number,
): Promise<boolean> {
  const token = BOT_TOKENS[botKey];
  if (!token) return false;

  try {
    if (opts.imageBytes) {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append(
        "photo",
        new Blob([opts.imageBytes], { type: "image/png" }),
        "muha.png",
      );
      if (opts.caption) form.append("caption", opts.caption.slice(0, 900));
      if (replyToMessageId) form.append("reply_to_message_id", String(replyToMessageId));
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        console.error(`[telegram-router] sendPhoto bytes ${botKey}:`, await res.text());
        return false;
      }
      return true;
    }

    if (opts.imageUrl) {
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        photo: opts.imageUrl,
        caption: (opts.caption || "").slice(0, 900),
      };
      if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        console.error(`[telegram-router] sendPhoto url ${botKey}:`, await res.text());
        return false;
      }
      return true;
    }
  } catch (e) {
    console.error(`[telegram-router] sendPhoto ${botKey}:`, e);
  }
  return false;
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

/** Первый исполнитель по плану; Карина без webhook на router пропускается. */
function pickStarter(plan: string[], triggeringBot: string | null): string | null {
  for (const agent of plan) {
    if (agent === "karina" && triggeringBot && triggeringBot !== "karina") continue;
    if (BOT_TOKENS[agent]) return agent;
  }
  // Только если план был «пустой/только Карина» — берём первого живого специалиста
  if (plan.length === 1 && plan[0] === "karina") {
    for (const agent of ["saule", "amina", "anton", "alina", "muha"]) {
      if (BOT_TOKENS[agent]) return agent;
    }
  }
  return null;
}

async function askOpenAI(opts: {
  systemPrompt: string;
  history: string;
  wbContext: string;
  userMessage: string;
}) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
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
        temperature: 0.15,
        max_tokens: 220,
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

  if (targetAgent === "muha" && !fromAgent && wantsPhoto(rootTask)) {
    await sendTelegramMessage("muha", chatId, "Генерирую фото, минуту…", replyToMessageId);
    const photo = await generateMuhaPhoto(rootTask);
    if (!photo.ok) {
      const fail =
        `Не смог сгенерировать фото: ${photo.error || "unknown"}. Опиши товар подробнее.`;
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
        caption: "Муха · фото для карточки",
      },
      replyToMessageId,
    );
    const note = sent
      ? "Фото готово. Если нужно иначе — уточни свет/ракурс/фон."
      : "Фото сгенерировал, но Telegram не принял файл. Попробуй ещё раз.";
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

  const history = await historyP;
  const systemPrompt =
    (AGENT_PROMPTS[targetAgent] || AGENT_PROMPTS.saule) +
    `\n\n${teamBriefForPrompt(plan, rootTask)}` +
    (fromAgent
      ? `\n\nТебе пишет коллега ${fromAgent}. Ответь по своей зоне на задачу владельца.`
      : "") +
    (lastHop
      ? `\n\nЭто последний ход цепочки — НЕ пингуй никого, закончи «Готово.»`
      : "");

  console.log(
    `[telegram-router] turn agent=${targetAgent} hop=${hop} from=${
      fromAgent || "human"
    } plan=${plan.join(">")} chat=${chatId}`,
  );

  const reply = await askOpenAI({
    systemPrompt,
    history: formatHistory(history),
    wbContext,
    userMessage: fromAgent
      ? `Задача владельца: ${rootTask}\n\nКоллега ${fromAgent} передал:\n${userMessage}`
      : rootTask,
  });

  // Сначала в чат, потом история — быстрее для пользователя
  await sendTelegramMessage(targetAgent, chatId, reply, replyToMessageId);
  saveMessage(chatId, targetAgent, reply).catch(() => {});

  if (lastHop) return;
  if (isDoneReply(reply)) return;

  let next = nextPingFromReply(reply, visited);
  if (!next && plan.length >= 2) {
    next = plan.find((a) => !visited.has(a) && BOT_TOKENS[a]) || null;
  }
  if (!next || !BOT_TOKENS[next]) return;

  await runAgentTurn({
    chatId,
    targetAgent: next,
    userMessage: reply,
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

  try {
    if (req.method !== "POST") return ok();

    const url = new URL(req.url);
    const triggeringBot = normalizeBotKey(url.searchParams.get("bot"));

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

    const message = update.message;
    if (!message?.text) return ok();
    if (message.from?.is_bot) return ok();

    const chatId = Number(message.chat.id);
    const text = String(message.text);
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

    // ── Действия с подтверждением (РК и т.п.) ───────────────────────────────
    {
      const pending = await getActivePending(chatId);
      const actionText = expandAdsActionCommand(text) || text;
      const actionAgent = pending?.agent_key ||
        (/(рк|реклам|кампан|\/ads)/i.test(actionText) ? "amina" : null);

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

    // ── Алина CRM (только люди, только клиентский контекст) ─────────────────
    if (
      (triggeringBot === "alina" || triggeringBot === "alina2") &&
      isAlinaClientContext(message.chat) &&
      !isAlinaStatsQuestion(text)
    ) {
      const replyBot = triggeringBot === "alina2" && BOT_TOKENS.alina2
        ? "alina2"
        : "alina";
      if (!BOT_TOKENS[replyBot]) return ok();

      const sourceAccount = replyBot === "alina2"
        ? "second"
        : (Deno.env.get("ALINA_SOURCE_ACCOUNT") || "main");

      await runWork((async () => {
        const reply = await handleAlinaClientMessage({
          chatId,
          userId: Number(message.from?.id),
          username: message.from?.username,
          fullName: fullName || undefined,
          text,
          sourceAccount,
        });
        await sendTelegramMessage(replyBot, chatId, reply, message.message_id);
        await saveMessage(chatId, replyBot, reply);
      })());
      return ok();
    }

    const plan = buildTeamPlan(text, message.entities, MAX_AGENT_HOPS);
    const targetAgent = pickStarter(plan, triggeringBot);

    if (!targetAgent) return ok();

    // Оркестрирует только стартовый бот
    if (triggeringBot !== targetAgent) {
      console.log(
        `[telegram-router] skip bot=${triggeringBot} starter=${targetAgent} plan=${plan.join(">")} chat=${chatId}`,
      );
      return ok();
    }

    await runWork((async () => {
      await saveMessage(chatId, message.from?.first_name ?? "user", text);
      await runAgentTurn({
        chatId,
        targetAgent,
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
