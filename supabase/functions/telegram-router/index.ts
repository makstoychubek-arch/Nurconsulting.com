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
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      parse_mode: "HTML",
    }),
  });
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

function detectTargetAgent(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("сауле") || lower.includes("продаж")) return "saule";
  if (lower.includes("амина") || lower.includes("реклам")) return "amina";
  if (lower.includes("антон") || lower.includes("логист")) return "anton";
  if (lower.includes("алина") || lower.includes("продвиж")) return "alina";
  if (lower.includes("муха") || lower.includes("фото")) return "muha";
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

    const targetAgent = detectTargetAgent(text);

    // Отвечает только бот, чей ?bot= совпал с целевым агентом.
    // Иначе 5 вебхуков дублировали бы один и тот же ответ.
    if (triggeringBot && triggeringBot !== targetAgent) {
      return new Response("ok", { status: 200 });
    }

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
