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
- Русский язык, деловой тон.
- 3–7 коротких строк максимум. Без воды, без приветствий «как дела», без эмодзи-спама.
- Сначала факты и цифры по кабинетам, потом 1–2 действия (как предложение, не делай сама).
- Если данных нет — так и скажи одной строкой.
- Не выдумывай цифры: только из блока «ФАКТЫ WB».
- Деньги в ₽, штуки явно.`;

/** Как агенты зовут коллег в тимчате (чтобы вебхук следующего сработал). */
const TEAM_PING_RULES = `
Команда в одном чате (общаетесь между собой по делу):
- Сауле @saulexxx_bot — продажи/остатки/цены
- Амина @aminaakd_bot — реклама
- Антон @antonnnxx_bot — логистика/FBS
- Алина @alinaaaxx_bot — самовыкупы/продвижение
- Муха @muxxxha_bot — фото/контент
Правила пинга:
- Если нужен коллега — в конце одной строкой: «@username — короткий вопрос/задача».
- Максимум ОДИН пинг коллеге за сообщение. Не пингуй всех подряд.
- Не пингуй того, кто только что писал тебе, если ответ уже полный.
- Если по своей зоне всё сказано и коллега не нужен — без @, закончи выводом.
- Не болтайте: только факты, риски, следующий шаг.`;

const AGENT_PROMPTS: Record<string, string> = {
  karina: `Ты Карина — координатор команды WB/Ozon (Сауле=продажи, Амина=реклама, Антон=логистика, Алина=продвижение, Муха=фотоворонка).
Отвечаешь по общим вопросам сама по цифрам; узкие темы — коротко делегируй коллеге через @username.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  saule: `Ты Сауле — продажи WB. Смотришь заказы/выкупы/отмены/топ артикулы по всем кабинетам.
Предлагаешь действия (цена, остатки, фокус артикула), но не выполняешь их сама.
Если нужна реклама/логистика/фото/самовыкупы — пингуй коллегу @username.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  amina: `Ты Амина — реклама WB. Смотришь активные/пауза кампании по кабинетам.
Предлагаешь корректировки, не меняешь ничего без подтверждения.
Если нужны продажи/логистика — пингуй коллегу.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  anton: `Ты Антон — логистика/FBS. Смотришь FBS-заказы и объёмы по кабинетам, риски отгрузок.
Если нужны продажи/реклама — пингуй коллегу.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  alina: `Ты Алина — самовыкупы и продвижение. В командном чате отвечаешь по статусу клиентов/самовыкупов из CRM.
С клиентами работаешь по скрипту (дата заказа → дата отзыва → реквизиты) — это уже в системе.
Опирайся на факты WB и статистику самовыкупов, если она есть в сообщении.
Если нужны продажи/фото — пингуй коллегу.
${STYLE_RULES}
${TEAM_PING_RULES}`,

  muha: `Ты Муха — фотоворонка/контент. Генерируешь фото карточек по запросу; без запроса фото даёшь короткие гипотезы по визуалу.
Если нужны продажи/артикулы — пингуй Сауле.
${STYLE_RULES}
${TEAM_PING_RULES}`,
};

/** Сколько раз подряд агенты могут отвечать друг другу без человека. */
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

const BOT_USERNAMES: Record<string, string> = {
  saule: "saulexxx_bot",
  amina: "aminaakd_bot",
  anton: "antonnnxx_bot",
  alina: "alinaaaxx_bot",
  muha: "muxxxha_bot",
  karina: "", // задать, когда будет webhook на router
};

/** Явный адресат: @username или имя. Без тематических эвристик. */
function detectExplicitTarget(
  text: string,
  // deno-lint-ignore no-explicit-any
  entities?: any[],
  excludeAgent?: string | null,
): string | null {
  const lower = text.toLowerCase();
  const candidates: string[] = [];

  for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
    if (!username) continue;
    if (lower.includes(`@${username.toLowerCase()}`)) candidates.push(agent);
  }
  for (const ent of entities || []) {
    if (ent?.type === "mention") {
      const mention = text.slice(ent.offset, ent.offset + ent.length).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && mention === `@${username.toLowerCase()}`) candidates.push(agent);
      }
    }
    if (ent?.type === "text_mention" && ent?.user?.username) {
      const u = String(ent.user.username).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && u === username.toLowerCase()) candidates.push(agent);
      }
    }
  }

  // Имя без @: «Сауле, глянь…»
  if (/саул[еэ]/.test(lower)) candidates.push("saule");
  if (lower.includes("амина")) candidates.push("amina");
  if (lower.includes("антон")) candidates.push("anton");
  if (lower.includes("алина")) candidates.push("alina");
  if (/\bмуха\b|\bмуху\b/.test(lower)) candidates.push("muha");
  if (lower.includes("карина")) candidates.push("karina");

  for (const c of candidates) {
    if (excludeAgent && c === excludeAgent) continue;
    return c;
  }
  return null;
}

function detectTargetAgent(
  text: string,
  // deno-lint-ignore no-explicit-any
  entities?: any[],
  opts?: { strict?: boolean; excludeAgent?: string | null },
): string {
  const strict = opts?.strict === true;
  const explicit = detectExplicitTarget(text, entities, opts?.excludeAgent);
  if (explicit) return explicit;
  if (strict) return ""; // бот→бот: только явный пинг

  const lower = text.toLowerCase();

  // Тема (только от человека)
  if (lower.includes("продаж") || lower.includes("остатк") || lower.includes("цен")) {
    return "saule";
  }
  if (lower.includes("реклам") || lower.includes("cpc") || lower.includes("ставк")) {
    return "amina";
  }
  if (lower.includes("логист") || lower.includes("поставк") || lower.includes("кластер")) {
    return "anton";
  }
  if (lower.includes("продвиж") || lower.includes("самовыкуп")) return "alina";
  if (lower.includes("фотоворон") || lower.includes("конверс") || lower.includes("фото")) {
    return "muha";
  }

  return "karina";
}

/** Нормализация ?bot= (ASCII-ключи; старый mixed sau+кириллица → saule). */
function normalizeBotKey(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  // "saule" (latin) или "sauле" (sau + кириллические ле)
  if (t === "saule" || (t.startsWith("sau") && t.length <= 6 && /л|le|ле/.test(t))) {
    return "saule";
  }
  if (["karina", "amina", "anton", "alina", "alina2", "muha"].includes(t)) return t;
  return t;
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
 * Один ход агента + при необходимости цепочка к коллеге.
 * Важно: в Telegram боты НЕ получают сообщения других ботов,
 * поэтому пинг @коллеге обрабатываем здесь же, не через webhook.
 */
async function runAgentTurn(opts: {
  chatId: number;
  targetAgent: string;
  userMessage: string;
  fromAgent?: string | null;
  replyToMessageId?: number;
  hop: number;
}): Promise<void> {
  const { chatId, targetAgent, userMessage, fromAgent, replyToMessageId, hop } = opts;

  if (!BOT_TOKENS[targetAgent]) {
    console.error(`[telegram-router] no token for target=${targetAgent}`);
    return;
  }
  if (hop >= MAX_AGENT_HOPS) {
    console.log(`[telegram-router] stop chain hop=${hop} chat=${chatId}`);
    return;
  }
  if (fromAgent && fromAgent === targetAgent) return;

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

  const systemPrompt =
    AGENT_PROMPTS[targetAgent] +
    (standingTasks.length
      ? `\n\nПостоянные задачи от владельца:\n- ${standingTasks.join("\n- ")}`
      : "") +
    (fromAgent
      ? `\n\nСейчас тебе пишет коллега ${fromAgent}. Ответь по делу. Пингуй следующего коллегу только если без него нельзя закрыть задачу.`
      : `\n\nЕсли задача требует другого специалиста — в конце пингани одного коллегу через @username.`);

  console.log(
    `[telegram-router] turn agent=${targetAgent} hop=${hop} from=${fromAgent || "human"} chat=${chatId}`,
  );

  // Спец-ветки
  if (targetAgent === "alina" && !fromAgent && isAlinaStatsQuestion(userMessage)) {
    const reply = await alinaSelfbuyStatsText();
    await sendTelegramMessage("alina", chatId, reply, replyToMessageId);
    await saveMessage(chatId, "alina", reply);
    return;
  }

  if (targetAgent === "muha" && !fromAgent && wantsPhoto(userMessage)) {
    await sendTelegramMessage("muha", chatId, "Генерирую фото, минуту…", replyToMessageId);
    const photo = await generateMuhaPhoto(userMessage);
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
      ? `[сообщение от коллеги ${fromAgent}]\n${userMessage}`
      : userMessage,
  });

  await sendTelegramMessage(targetAgent, chatId, reply, replyToMessageId);
  await saveMessage(chatId, targetAgent, reply);

  // Цепочка: если в ответе пинг коллеги — вызываем его сами (Telegram бот→бот не доставляет).
  const next = detectExplicitTarget(reply, undefined, targetAgent);
  if (next && next !== targetAgent && BOT_TOKENS[next] && hop + 1 < MAX_AGENT_HOPS) {
    // Небольшая пауза, чтобы в чате порядок сообщений был читаемым
    await new Promise((r) => setTimeout(r, 700));
    await runAgentTurn({
      chatId,
      targetAgent: next,
      userMessage: reply,
      fromAgent: targetAgent,
      hop: hop + 1,
    });
  }
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

    const targetAgent = detectTargetAgent(text, message.entities);

    // Отвечает только бот, чей ?bot= совпал с целевым агентом.
    // (Дальше цепочку коллег крутит уже этот бот через runAgentTurn.)
    if (triggeringBot && triggeringBot !== targetAgent) {
      console.log(
        `[telegram-router] skip bot=${triggeringBot} target=${targetAgent} chat=${chatId}`,
      );
      return new Response("ok", { status: 200 });
    }

    // Если цель — Карина, а её webhook ещё не на router — специалисты молчат.
    if (targetAgent === "karina" && triggeringBot && triggeringBot !== "karina") {
      return new Response("ok", { status: 200 });
    }

    if (!targetAgent || !BOT_TOKENS[targetAgent]) {
      console.error(`[telegram-router] no token for target=${targetAgent}`);
      return new Response("ok", { status: 200 });
    }

    await saveMessage(chatId, message.from?.first_name ?? "user", text);

    await runAgentTurn({
      chatId,
      targetAgent,
      userMessage: text,
      replyToMessageId: message.message_id,
      hop: 0,
    });

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
