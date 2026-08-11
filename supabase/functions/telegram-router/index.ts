// supabase/functions/telegram-router/index.ts
//
// Роутер для команды Telegram-агентов NR Space.
// Принимает вебхуки от ЛЮБОГО из ботов (Карина, Сауле, Амина, Антон, Алина, Муха),
// определяет, кто должен ответить, дёргает OpenAI с нужной ролью,
// при необходимости обращается к wb-proxy за данными WB API,
// и отправляет ответ ОТ ИМЕНИ нужного бота его собственным токеном.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildAgentWbContext,
  type AgentKey,
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
  nextPingFromReply,
  teamBriefForPrompt,
} from "../_shared/agent-team.ts";

// ---------- Настройка ----------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const BOT_TOKENS: Record<string, string> = {
  // Карина: отдельный токен или текущий TELEGRAM_BOT_TOKEN проекта
  karina: (Deno.env.get("KARINA_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim(),
  saule: (Deno.env.get("SAULE_BOT_TOKEN") || "").trim(),
  amina: (Deno.env.get("AMINA_BOT_TOKEN") || "").trim(),
  anton: (Deno.env.get("ANTON_BOT_TOKEN") || "").trim(),
  alina: (Deno.env.get("ALINA_BOT_TOKEN") || "").trim(),
  // Второй аккаунт Алины (клиентский) — опционально
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
${STYLE_RULES}
${TEAM_PING_RULES}`,

  saule: `Ты Сауле — продажи WB (заказы/выкупы/отмены/топ/остатки/цена). Только своя зона.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  amina: `Ты Амина — реклама WB (кампании active/pause, ставки). Только своя зона. Ничего не меняешь сама.
${STYLE_RULES}
${TEAM_PING_RULES}`,

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

/** Сколько ходов подряд в одной задаче (человек не пишет). */
const MAX_AGENT_HOPS = Number(Deno.env.get("AGENT_CHAT_MAX_HOPS") || "3");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendTelegramMessage(
  botKey: string,
  chatId: number,
  text: string,
  replyToMessageId?: number,
) {
  const token = BOT_TOKENS[botKey];
  if (!token) {
    console.error(`Нет токена для бота: ${botKey}`);
    return;
  }
  // Без HTML: ответы LLM часто ломают parse_mode и сообщение молча не уходит.
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 4000),
  };
  if (replyToMessageId) payload.reply_to_message_id = replyToMessageId;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[telegram-router] sendMessage ${botKey} failed:`, err);
    // Повтор без reply, если reply_to отклонён
    if (replyToMessageId) {
      const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
      });
      if (!retry.ok) {
        console.error(`[telegram-router] sendMessage retry failed:`, await retry.text());
      }
    }
  }
}

async function sendTelegramPhoto(
  botKey: string,
  chatId: number,
  opts: { imageUrl?: string; imageBytes?: Uint8Array; caption?: string },
  replyToMessageId?: number,
) {
  const token = BOT_TOKENS[botKey];
  if (!token) {
    console.error(`Нет токена для бота: ${botKey}`);
    return false;
  }

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
    });
    if (!res.ok) {
      console.error(`[telegram-router] sendPhoto url ${botKey}:`, await res.text());
      return false;
    }
    return true;
  }
  return false;
}

async function saveMessage(chatId: number, sender: string, text: string) {
  await supabase.from("agent_chat_history").insert({
    chat_id: chatId,
    sender,
    text,
  });
}

async function loadRecentHistory(chatId: number, limit = 15) {
  const { data } = await supabase
    .from("agent_chat_history")
    .select("sender, text, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

async function loadStandingTasks(agentKey: string) {
  const { data } = await supabase
    .from("agent_standing_tasks")
    .select("task_description")
    .eq("agent_type", agentKey)
    .eq("is_active", true);
  return (data ?? []).map((r) => r.task_description);
}

/** Нормализация ?bot= (ASCII-ключи; старый mixed sau+кириллица → saule). */
function normalizeBotKey(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "saule" || (t.startsWith("sau") && t.length <= 6 && /л|le|ле/.test(t))) {
    return "saule";
  }
  if (["karina", "amina", "anton", "alina", "alina2", "muha"].includes(t)) return t;
  return t;
}

/** Первый исполнитель по плану; если Карины нет на router — следующий с токеном. */
function pickStarter(plan: string[], triggeringBot: string | null): string | null {
  for (const agent of plan) {
    if (agent === "karina" && triggeringBot && triggeringBot !== "karina") continue;
    if (BOT_TOKENS[agent]) return agent;
  }
  // fallback: любой специалист с токеном из плана не нужен — первый доступный
  for (const agent of ["saule", "amina", "anton", "alina", "muha"]) {
    if (BOT_TOKENS[agent]) return agent;
  }
  return null;
}

async function askOpenAI(opts: {
  systemPrompt: string;
  history: string;
  wbContext: string;
  userMessage: string;
}) {
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
        { role: "system", content: `ФАКТЫ WB (по всем кабинетам):\n${opts.wbContext}` },
        {
          role: "system",
          content: `Недавняя история чата (для контекста, не повторяй её):\n${opts.history || "—"}`,
        },
        { role: "user", content: opts.userMessage },
      ],
      temperature: 0.2,
      max_tokens: 350,
    }),
    signal: AbortSignal.timeout(55000),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[telegram-router] openai error", JSON.stringify(data).slice(0, 300));
    return "Не удалось получить ответ от модели. Попробуйте ещё раз.";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "Пустой ответ модели.";
}

/**
 * Один ход + цепочка.
 * Telegram не доставляет bot→bot, поэтому следующего зовём сами.
 * Защиты: visited (нет циклов), план команды, только @username-пинг.
 */
async function runAgentTurn(opts: {
  chatId: number;
  targetAgent: string;
  userMessage: string;
  rootTask: string;
  plan: string[];
  visited: Set<string>;
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
    fromAgent,
    replyToMessageId,
    hop,
  } = opts;

  if (!BOT_TOKENS[targetAgent]) {
    console.error(`[telegram-router] no token for target=${targetAgent}`);
    return;
  }
  if (hop >= MAX_AGENT_HOPS) {
    console.log(`[telegram-router] stop chain hop=${hop} chat=${chatId}`);
    return;
  }
  if (visited.has(targetAgent)) {
    console.log(`[telegram-router] skip visited=${targetAgent} chat=${chatId}`);
    return;
  }
  visited.add(targetAgent);

  const history = await loadRecentHistory(chatId);
  const standingTasks = await loadStandingTasks(targetAgent);
  const historyText = history
    .map((h: { sender: string; text: string }) => `${h.sender}: ${h.text}`)
    .join("\n");

  let wbContext = "";
  try {
    wbContext = await buildAgentWbContext(targetAgent as AgentKey);
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

  const lastHop = hop + 1 >= MAX_AGENT_HOPS;
  const systemPrompt =
    AGENT_PROMPTS[targetAgent] +
    `\n\n${teamBriefForPrompt(plan, rootTask)}` +
    (standingTasks.length
      ? `\n\nПостоянные задачи от владельца:\n- ${standingTasks.join("\n- ")}`
      : "") +
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

  // Спец-ветки (только от человека, без цепочки)
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

  const reply = await askOpenAI({
    systemPrompt,
    history: historyText,
    wbContext,
    userMessage: fromAgent
      ? `Задача владельца: ${rootTask}\n\nКоллега ${fromAgent} передал:\n${userMessage}`
      : rootTask,
  });

  await sendTelegramMessage(targetAgent, chatId, reply, replyToMessageId);
  await saveMessage(chatId, targetAgent, reply);

  if (lastHop) return;

  // 1) Явный @пинг в ответе (не посещённый)
  let next = nextPingFromReply(reply, visited);

  // 2) Иначе следующий из плана команды (надёжно, даже если LLM забыл @)
  if (!next) {
    next = plan.find((a) => !visited.has(a) && BOT_TOKENS[a]) || null;
    // Автопродолжение по плану — только если в корневой задаче явно >1 специалист/тема
    if (next && plan.length < 2) next = null;
  }

  if (!next || !BOT_TOKENS[next]) return;

  await new Promise((r) => setTimeout(r, 600));
  await runAgentTurn({
    chatId,
    targetAgent: next,
    userMessage: reply,
    rootTask,
    plan,
    visited,
    fromAgent: targetAgent,
    hop: hop + 1,
  });
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const triggeringBot = normalizeBotKey(url.searchParams.get("bot")); // 'saule' | 'amina' | ...

    const update = await req.json();
    const message = update.message;
    if (!message || !message.text) {
      return new Response("ok", { status: 200 });
    }

    const chatId = message.chat.id;
    const text: string = message.text;
    const fromBot = Boolean(message.from?.is_bot);

    // Сообщения ботов в Telegram другим ботам не приходят.
    // Цепочку коллег запускаем сами внутри runAgentTurn после ответа.
    if (fromBot) {
      return new Response("ok", { status: 200 });
    }

    const fullName = [message.from?.first_name, message.from?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    // ── Алина · клиентский чат/ЛС: скрипт самовыкупов → таблица ─────────────
    if (
      (triggeringBot === "alina" || triggeringBot === "alina2") &&
      isAlinaClientContext(message.chat) &&
      !isAlinaStatsQuestion(text)
    ) {
      const replyBot = triggeringBot === "alina2" && BOT_TOKENS.alina2
        ? "alina2"
        : "alina";
      if (!BOT_TOKENS[replyBot]) {
        console.error(`[telegram-router] no token for ${replyBot}`);
        return new Response("ok", { status: 200 });
      }
      const sourceAccount = replyBot === "alina2"
        ? "second"
        : (Deno.env.get("ALINA_SOURCE_ACCOUNT") || "main");
      console.log(
        `[telegram-router] alina-crm bot=${replyBot} chat=${chatId} user=${message.from?.id}`,
      );
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
      return new Response("ok", { status: 200 });
    }

    const plan = buildTeamPlan(text, message.entities, MAX_AGENT_HOPS);
    const targetAgent = pickStarter(plan, triggeringBot);

    if (!targetAgent) {
      console.error("[telegram-router] no starter agent", plan);
      return new Response("ok", { status: 200 });
    }

    // Оркестрирует один webhook (первый по плану) — остальных вызывает сам.
    if (triggeringBot && triggeringBot !== targetAgent) {
      console.log(
        `[telegram-router] skip bot=${triggeringBot} starter=${targetAgent} plan=${plan.join(">")} chat=${chatId}`,
      );
      return new Response("ok", { status: 200 });
    }

    await saveMessage(chatId, message.from?.first_name ?? "user", text);

    await runAgentTurn({
      chatId,
      targetAgent,
      userMessage: text,
      rootTask: text,
      plan,
      visited: new Set<string>(),
      replyToMessageId: message.message_id,
      hop: 0,
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
