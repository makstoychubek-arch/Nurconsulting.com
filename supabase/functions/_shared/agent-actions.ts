/**
 * Действия агентов над кабинетами WB.
 * Правило: НИЧЕГО не меняем без явного «подтверждаю» от человека в чате.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PendingStatus =
  | "awaiting_selection"
  | "awaiting_confirm"
  | "executing"
  | "done"
  | "cancelled"
  | "expired";

export type ActionType = "advert_start" | "advert_pause";

export type PendingAction = {
  id: string;
  chat_id: number;
  agent_key: string;
  action_type: ActionType;
  status: PendingStatus;
  cabinet_id: string | null;
  cabinet_name: string | null;
  payload: {
    campaignIds?: number[];
    selectedIds?: number[];
    items?: Array<{ id: number; name: string; status: number }>;
  };
};

const STATUS_LABEL: Record<number, string> = {
  4: "готова",
  9: "активна",
  11: "пауза",
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

function sanitizeWbToken(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^\uFEFF/, "").replace(/\s+/g, "").trim();
}

/** Нормализация для матчинга «Базы» → baza */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "")
    .trim();
}

const CABINET_ALIASES: Record<string, string[]> = {
  baza: ["baza", "база", "базы", "базу", "базе"],
  saai: ["saai", "сааи", "саи"],
  zevina: ["zevina", "зевина", "зевину", "зевине"],
  elium: ["elium", "элиум"],
};

export async function listCabinets(): Promise<Array<{ id: string; name: string }>> {
  const db = admin();
  const { data } = await db
    .from("cabinets")
    .select("id, name, wb_token")
    .not("wb_token", "is", null)
    .order("name");
  return (data || [])
    .filter((c) => sanitizeWbToken(c.wb_token).length >= 50)
    .map((c) => ({ id: String(c.id), name: String(c.name) }));
}

/** Найти кабинет по фразе. Если неоднозначно — candidates. */
export async function resolveCabinet(text: string): Promise<{
  match?: { id: string; name: string };
  candidates: Array<{ id: string; name: string }>;
}> {
  const cabinets = await listCabinets();
  const t = normName(text);
  if (!t) return { candidates: cabinets };

  // Прямое вхождение имени кабинета
  const direct = cabinets.filter((c) => {
    const n = normName(c.name);
    return t.includes(n) || n.includes(t);
  });
  if (direct.length === 1) return { match: direct[0], candidates: direct };
  if (direct.length > 1) return { candidates: direct };

  // Алиасы
  for (const [key, aliases] of Object.entries(CABINET_ALIASES)) {
    if (!aliases.some((a) => t.includes(normName(a)))) continue;
    const hit = cabinets.filter((c) => normName(c.name).includes(key) || normName(c.name).startsWith(key));
    if (hit.length === 1) return { match: hit[0], candidates: hit };
    if (hit.length > 1) return { candidates: hit };
  }

  // Нечётко: любое слово из текста похоже на имя
  const words = text.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length >= 3);
  const fuzzy = cabinets.filter((c) => {
    const n = normName(c.name);
    return words.some((w) => n.includes(normName(w)) || normName(w).includes(n));
  });
  if (fuzzy.length === 1) return { match: fuzzy[0], candidates: fuzzy };
  return { candidates: fuzzy.length ? fuzzy : cabinets };
}

export async function listCampaigns(
  cabinetId: string,
  statuses: number[] = [4, 9, 11],
): Promise<Array<{ id: number; name: string; status: number }>> {
  const db = admin();
  const { data } = await db
    .from("advertising_campaigns")
    .select("campaign_id, campaign_name, status")
    .eq("cabinet_id", cabinetId)
    .in("status", statuses)
    .order("status")
    .order("campaign_name")
    .limit(80);
  return (data || []).map((r) => ({
    id: Number(r.campaign_id),
    name: String(r.campaign_name || r.campaign_id),
    status: Number(r.status),
  }));
}

export function formatCampaignList(
  items: Array<{ id: number; name: string; status: number }>,
  title: string,
): string {
  if (!items.length) return `${title}\nКампаний нет.`;
  const lines = items.map((c, i) => {
    const st = STATUS_LABEL[c.status] || String(c.status);
    return `${i + 1}. [${st}] ${c.name} · id ${c.id}`;
  });
  return [`${title} (${items.length})`, ...lines].join("\n");
}

/** Активный pending в чате (не протухший). */
export async function getActivePending(chatId: number): Promise<PendingAction | null> {
  const db = admin();
  const { data } = await db
    .from("agent_pending_actions")
    .select("*")
    .eq("chat_id", chatId)
    .in("status", ["awaiting_selection", "awaiting_confirm"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PendingAction) || null;
}

async function cancelOtherPending(db: SupabaseClient, chatId: number) {
  await db
    .from("agent_pending_actions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .in("status", ["awaiting_selection", "awaiting_confirm"]);
}

export function isConfirmText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(подтверждаю|подтвердить|да,? запускай|да,? паузь|да,? делай|согласен|ok confirm|confirm)$/i.test(t) ||
    t === "да" ||
    t === "ок" ||
    t === "ok";
}

export function isCancelText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(отмена|отменить|cancel|нет|не надо|стоп)$/i.test(t);
}

/** Выбор номеров: «все» / «1,3,5» / «1-3» */
export function parseSelection(text: string, max: number): number[] | null {
  const t = text.trim().toLowerCase();
  if (/^(все|всех|all)$/i.test(t)) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  if (!/^\d/.test(t) && !t.includes(",")) return null;
  const nums = new Set<number>();
  for (const part of t.split(/[,;\s]+/)) {
    if (!part) continue;
    const range = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      let a = Number(range[1]);
      let b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b && i <= max; i++) if (i >= 1) nums.add(i);
      continue;
    }
    const n = Number(part);
    if (Number.isFinite(n) && n >= 1 && n <= max) nums.add(n);
  }
  return nums.size ? [...nums].sort((a, b) => a - b) : null;
}

export function detectAdvertIntent(text: string): {
  kind: "start" | "pause" | "list" | null;
} {
  const t = text.toLowerCase();
  const aboutAds =
    t.includes("рк") ||
    t.includes("реклам") ||
    t.includes("кампан") ||
    t.includes("аукцион");
  if (!aboutAds && !/(запуск|запусти|пауза|останови)/.test(t)) {
    return { kind: null };
  }
  if (/(покажи|список|какие|что с)/.test(t) && aboutAds) return { kind: "list" };
  if (/(пауза|поставь на паузу|останови|выключи|стопни)/.test(t)) return { kind: "pause" };
  if (/(запусти|запуск|включи|стартани)/.test(t)) return { kind: "start" };
  if (aboutAds && /(статус|рк)/.test(t)) return { kind: "list" };
  return { kind: null };
}

function ownerAllowed(tgUserId: number): boolean {
  const raw = (Deno.env.get("AGENT_OWNER_TG_IDS") || "").trim();
  if (!raw) return true; // пока не задано — подтверждающий = любой в тимчате, но фраза обязательна
  const ids = new Set(
    raw.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)),
  );
  return ids.has(tgUserId);
}

export async function handleOwnerActionMessage(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
  agentKey: string;
}): Promise<{ handled: boolean; reply?: string; agentKey?: string }> {
  const db = admin();
  const text = opts.text.trim();

  // 1) Активный pending: отмена / выбор / подтверждение
  const pending = await getActivePending(opts.chatId);
  if (pending) {
    // Отвечает тот же агент, кто вёл диалог
    if (opts.agentKey !== pending.agent_key) {
      return { handled: false };
    }

    if (isCancelText(text)) {
      await db
        .from("agent_pending_actions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", pending.id);
      return { handled: true, reply: "Отменила. Ничего не меняла.", agentKey: pending.agent_key };
    }

    if (pending.status === "awaiting_selection") {
      const items = pending.payload.items || [];
      const sel = parseSelection(text, items.length);
      if (!sel) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply:
            "Напиши номера РК через запятую (например 1,3,5), «все» или «отмена».\n" +
            "Без подтверждения ничего не запущу.",
        };
      }
      const selectedIds = sel.map((n) => items[n - 1].id).filter(Boolean);
      const selectedNames = sel.map((n) => items[n - 1].name);
      await db
        .from("agent_pending_actions")
        .update({
          status: "awaiting_confirm",
          payload: { ...pending.payload, selectedIds },
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id);

      const verb = pending.action_type === "advert_start" ? "ЗАПУСТИТЬ" : "поставить на ПАУЗУ";
      return {
        handled: true,
        agentKey: pending.agent_key,
        reply: [
          `К ${verb}: ${selectedIds.length} РК · ${pending.cabinet_name}`,
          ...selectedNames.slice(0, 15).map((n, i) => `• ${n}`),
          selectedNames.length > 15 ? `… и ещё ${selectedNames.length - 15}` : "",
          "",
          "Чтобы выполнить — напиши: подтверждаю",
          "Чтобы отменить — отмена",
          "Без этого слова я ничего не сделаю.",
        ].filter(Boolean).join("\n"),
      };
    }

    if (pending.status === "awaiting_confirm") {
      if (!isConfirmText(text)) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply: "Жду точное «подтверждаю» или «отмена». Пока ничего не делаю.",
        };
      }
      if (!ownerAllowed(opts.tgUserId)) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply: "Подтверждать действия может только владелец (AGENT_OWNER_TG_IDS).",
        };
      }
      const result = await executePending(pending, opts.tgUserId);
      return { handled: true, reply: result, agentKey: pending.agent_key };
    }
  }

  // 2) Новый интент
  const intent = detectAdvertIntent(text);
  if (!intent.kind) return { handled: false };

  // Список — сразу, без confirm
  if (intent.kind === "list") {
    const resolved = await resolveCabinet(text);
    if (!resolved.match) {
      const names = resolved.candidates.map((c) => c.name).join(", ");
      return {
        handled: true,
        agentKey: opts.agentKey,
        reply: `Уточни кабинет. Доступны: ${names || "—"}\nПример: «покажи РК Baza»`,
      };
    }
    const items = await listCampaigns(resolved.match.id);
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: formatCampaignList(items, `РК · ${resolved.match.name}`),
    };
  }

  // start / pause → предложение
  const resolved = await resolveCabinet(text);
  if (!resolved.match) {
    const names = resolved.candidates.map((c) => `• ${c.name}`).join("\n");
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: `Какой кабинет?\n${names}\nНапиши, например: «запусти РК Baza»`,
    };
  }

  const wantStatus = intent.kind === "start" ? [11, 4] : [9];
  const items = await listCampaigns(resolved.match.id, wantStatus);
  if (!items.length) {
    const label = intent.kind === "start" ? "на паузе/готовых" : "активных";
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: `В «${resolved.match.name}» нет ${label} РК для этого действия.`,
    };
  }

  await cancelOtherPending(db, opts.chatId);
  const actionType: ActionType = intent.kind === "start" ? "advert_start" : "advert_pause";
  const { data: created, error } = await db
    .from("agent_pending_actions")
    .insert({
      chat_id: opts.chatId,
      agent_key: opts.agentKey,
      action_type: actionType,
      status: "awaiting_selection",
      cabinet_id: resolved.match.id,
      cabinet_name: resolved.match.name,
      proposed_by_tg: opts.tgUserId,
      payload: {
        campaignIds: items.map((i) => i.id),
        items,
      },
    })
    .select("*")
    .single();

  if (error || !created) {
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: `Не смогла создать черновик действия: ${error?.message || "unknown"}`,
    };
  }

  const verb = intent.kind === "start" ? "запуска" : "паузы";
  return {
    handled: true,
    agentKey: opts.agentKey,
    reply: [
      formatCampaignList(items, `${resolved.match.name} · РК для ${verb}`),
      "",
      "Какие именно? Напиши номера (1,3,5), диапазон (1-4) или «все».",
      "Потом отдельно попрошу слово «подтверждаю».",
      "Без подтверждения ничего не изменю.",
    ].join("\n"),
  };
}

async function executePending(pending: PendingAction, tgUserId: number): Promise<string> {
  const db = admin();
  const ids = pending.payload.selectedIds || [];
  if (!ids.length || !pending.cabinet_id) {
    await db.from("agent_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    return "Нечего выполнять — список пуст. Отменила.";
  }

  await db
    .from("agent_pending_actions")
    .update({
      status: "executing",
      confirmed_by_tg: tgUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  const { data: cab } = await db
    .from("cabinets")
    .select("wb_token, name")
    .eq("id", pending.cabinet_id)
    .maybeSingle();
  const token = sanitizeWbToken(cab?.wb_token);
  if (!token) {
    await db.from("agent_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    return "Нет WB-токена у кабинета. Ничего не сделала.";
  }

  const verb = pending.action_type === "advert_start" ? "start" : "pause";
  const newStatus = verb === "start" ? 9 : 11;
  const ok: number[] = [];
  const fail: string[] = [];

  for (const advertId of ids.slice(0, 40)) {
    try {
      const url = `https://advert-api.wildberries.ru/adv/v0/${verb}?id=${advertId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: token },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        fail.push(`${advertId}: ${res.status} ${t.slice(0, 80)}`);
      } else {
        ok.push(advertId);
        await db
          .from("advertising_campaigns")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("cabinet_id", pending.cabinet_id)
          .eq("campaign_id", advertId);
      }
    } catch (e) {
      fail.push(`${advertId}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  const resultText = [
    `${pending.cabinet_name} · ${verb === "start" ? "запуск" : "пауза"}`,
    `Успешно: ${ok.length}`,
    fail.length ? `Ошибки: ${fail.length}` : "",
    fail.length ? fail.slice(0, 8).join("\n") : "",
  ].filter(Boolean).join("\n");

  await db
    .from("agent_pending_actions")
    .update({
      status: "done",
      result_text: resultText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  return resultText;
}

/** Краткий каталог возможностей для промпта. */
export function actionsCapabilityBrief(): string {
  return [
    "ДОСТУП К ДЕЙСТВИЯМ (только после «подтверждаю» от человека):",
    "- список РК кабинета",
    "- запуск РК (пауза/готовые → активные)",
    "- пауза РК (активные → пауза)",
    "Процесс: список → человек выбирает номера → «подтверждаю».",
    "Без слова «подтверждаю» ничего не меняй и не обещай, что уже сделала.",
    "Кабинеты: Baza, SAAI, Zevina 1, Zevina 2 (и др. из базы).",
  ].join("\n");
}
