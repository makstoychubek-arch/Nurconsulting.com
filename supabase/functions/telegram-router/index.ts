// supabase/functions/telegram-router/index.ts
//
// Роутер для команды Telegram-агентов NR Space.
// Принимает вебхуки от ЛЮБОГО из ботов (Карина, Сауле, Амина, Антон, Алина, Муха),
// определяет, кто должен ответить, дёргает OpenAI с нужной ролью,
// при необходимости обращается к wb-proxy за данными WB API,
// и отправляет ответ ОТ ИМЕНИ нужного бота его собственным токеном.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  muha: (Deno.env.get("MUHA_BOT_TOKEN") || "").trim(),
};

const AGENT_PROMPTS: Record<string, string> = {
  karina: `Ты Карина — главный координатор команды продавца на Wildberries/Ozon.
Ты принимаешь общие вопросы владельца бизнеса и либо отвечаешь сама (используя
данные из WB API), либо кратко делегируешь конкретному агенту, называя его по
имени. Отвечай по-русски, кратко, по делу, без воды.`,

  saule: `Ты Сауле — агент по продажам. Анализируешь цены, остатки, динамику
продаж по данным WB API. Предлагаешь конкретные действия (поднять/снизить
цену, довезти остатки), но НИКОГДА не выполняешь их сама — только предлагаешь
и ждёшь подтверждения от владельца.`,

  amina: `Ты Амина — менеджер по рекламе. Анализируешь CPC-кампании, расход
бюджета, эффективность. Предлагаешь корректировки бюджета, но не меняешь их
без явного подтверждения владельца.`,

  anton: `Ты Антон — менеджер по логистике. Следишь за поставками, кластерами,
сроками отгрузок и остатками на складах. Предупреждаешь о рисках (задержки,
нехватка коробов и т.д.).`,

  alina: `Ты Алина — менеджер по продвижению (самовыкупы, продвижение карточек).
Даёшь рекомендации по стратегии продвижения на основе текущих показателей.`,

  muha: `Ты Муха — менеджер по фотоворонке. Анализируешь конверсию карточек,
качество фото/контента, даёшь рекомендации по улучшению визуала.`,
};

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

function detectTargetAgent(
  text: string,
  // deno-lint-ignore no-explicit-any
  entities?: any[],
): string {
  const lower = text.toLowerCase();

  // 1) Явный @username / text_mention
  for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
    if (!username) continue;
    if (lower.includes(`@${username.toLowerCase()}`)) return agent;
  }
  for (const ent of entities || []) {
    if (ent?.type === "mention") {
      const mention = text.slice(ent.offset, ent.offset + ent.length).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && mention === `@${username.toLowerCase()}`) return agent;
      }
    }
    if (ent?.type === "text_mention" && ent?.user?.username) {
      const u = String(ent.user.username).toLowerCase();
      for (const [agent, username] of Object.entries(BOT_USERNAMES)) {
        if (username && u === username.toLowerCase()) return agent;
      }
    }
  }

  // 2) Имя агента (Сауле/Саулэ — разные буквы е/э)
  if (/саул[еэ]/.test(lower)) return "saule";
  if (lower.includes("амина")) return "amina";
  if (lower.includes("антон")) return "anton";
  if (lower.includes("алина")) return "alina";
  if (lower.includes("муха") || lower.includes("муху")) return "muha";
  if (lower.includes("карина")) return "karina";

  // 3) Тема (осторожно — только явные маркеры)
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
  if (lower.includes("фотоворон") || lower.includes("конверс")) return "muha";

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
  if (["karina", "amina", "anton", "alina", "muha"].includes(t)) return t;
  return t;
}

async function fetchWbData(cabinet: string, endpoint: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wb-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ cabinet, endpoint }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function askOpenAI(systemPrompt: string, history: string, userMessage: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: `Недавняя история чата:\n${history}` },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Не удалось получить ответ.";
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
    const fromBot = message.from?.is_bot;

    if (fromBot) {
      return new Response("ok", { status: 200 });
    }

    const targetAgent = detectTargetAgent(text, message.entities);

    // Отвечает только бот, чей ?bot= совпал с целевым агентом.
    // Иначе 5 вебхуков дублировали бы один и тот же ответ.
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

    if (!BOT_TOKENS[targetAgent]) {
      console.error(`[telegram-router] no token for target=${targetAgent}`);
      return new Response("ok", { status: 200 });
    }

    console.log(
      `[telegram-router] handle bot=${triggeringBot} target=${targetAgent} chat=${chatId} text=${
        text.slice(0, 80)
      }`,
    );

    await saveMessage(chatId, message.from?.first_name ?? "user", text);

    const history = await loadRecentHistory(chatId);
    const standingTasks = await loadStandingTasks(targetAgent);

    const historyText = history
      .map((h: { sender: string; text: string }) => `${h.sender}: ${h.text}`)
      .join("\n");

    const systemPrompt =
      AGENT_PROMPTS[targetAgent] +
      (standingTasks.length
        ? `\n\nТвои постоянные задачи от владельца:\n- ${standingTasks.join("\n- ")}`
        : "");

    const reply = await askOpenAI(systemPrompt, historyText, text);

    await sendTelegramMessage(targetAgent, chatId, reply, message.message_id);
    await saveMessage(chatId, targetAgent, reply);

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
