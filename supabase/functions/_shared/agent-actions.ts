/**
 * Действия агентов над кабинетами WB.
 * Правило: НИЧЕГО не меняем без явного «подтверждаю» от человека в чате.
 */

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  aminaAskCabinet,
  aminaAskProduct,
  aminaConfirmStart,
  aminaWaitingYes,
  pick,
} from "./agent-voice.ts";
import { scoreProductMatch } from "./agent-product-catalog.ts";
import { setChatFocus } from "./agent-chat-focus.ts";
import { getAdminClient } from "./supabase-admin.ts";

export type PendingStatus =
  | "awaiting_selection"
  | "awaiting_confirm"
  | "executing"
  | "done"
  | "cancelled"
  | "expired";

export type ActionType = "advert_start" | "advert_pause" | "fbs_stock" | string;

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
    items?: Array<{ id: number | string; name: string; status?: number }>;
    [key: string]: unknown;
  };
};

const STATUS_LABEL: Record<number, string> = {
  4: "готова",
  9: "активна",
  11: "пауза",
};

function admin(): SupabaseClient {
  return getAdminClient();
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

export const CABINET_ALIASES: Record<string, string[]> = {
  baza: ["baza", "база", "базы", "базу", "базе"],
  saai: [
    "saai",
    "сааи",
    "саи",
    "дуйшекеева",
    "дуйшокеева",
    "duishekeeva",
    "nely",
    "nelylook",
  ],
  zevina: [
    "zevina",
    "зевина",
    "зевину",
    "зевине",
    "уркунбаев",
    "urkunbaev",
    "ипуркунбаев",
  ],
  elium: [
    "elium",
    "элиум",
    "элиуме",
    "айзада",
    "аизада",
    "aizada",
    "уметалиева",
    "umetalieva",
    "уметалиев",
  ],
};

/** Убрать имена/алиасы кабинетов из текста (чтобы «элиум» не считался товаром). */
export function stripCabinetAliases(text: string): string {
  let t = String(text || "");
  const extras = [
    "zevina\\s*1",
    "zevina\\s*2",
    "зевина\\s*1",
    "зевина\\s*2",
    "zevina1",
    "zevina2",
  ];
  const all = [
    ...Object.values(CABINET_ALIASES).flat(),
    ...extras,
  ];
  for (const raw of all) {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(
      new RegExp(`(^|[\\s,.:;!?«»\"'])(${escaped})(?=$|[\\s,.:;!?«»\"'])`, "gi"),
      "$1",
    );
  }
  return t.replace(/\s+/g, " ").trim();
}

type CabListCache = { at: number; list: Array<{ id: string; name: string }> };
let cabinetsCache: CabListCache | null = null;
let cabinetsInflight: Promise<Array<{ id: string; name: string }>> | null = null;
const CABINETS_TTL_MS = 60_000;

export async function listCabinets(): Promise<Array<{ id: string; name: string }>> {
  if (cabinetsCache && Date.now() - cabinetsCache.at < CABINETS_TTL_MS) {
    return cabinetsCache.list;
  }
  if (cabinetsInflight) return cabinetsInflight;

  cabinetsInflight = (async () => {
    const db = admin();
    const { data } = await db
      .from("cabinets")
      .select("id, name, wb_token")
      .not("wb_token", "is", null)
      .order("name");
    const list = (data || [])
      .filter((c) => sanitizeWbToken(c.wb_token).length >= 50)
      .map((c) => ({ id: String(c.id), name: String(c.name) }));
    cabinetsCache = { at: Date.now(), list };
    return list;
  })();

  try {
    return await cabinetsInflight;
  } finally {
    cabinetsInflight = null;
  }
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

  // Алиасы (элиум / айзада / уркунбаев → конкретный кабинет)
  for (const [key, aliases] of Object.entries(CABINET_ALIASES)) {
    if (!aliases.some((a) => t.includes(normName(a)))) continue;
    let hit = cabinets.filter((c) =>
      normName(c.name).includes(key) || normName(c.name).startsWith(key)
    );
    // «уркунбаев» → Zevina 1 (не Zevina 2), если оба матчятся
    if (key === "zevina" && hit.length > 1) {
      const prefer1 = hit.filter((c) => /1|один/.test(c.name) || /zevina1/.test(normName(c.name)));
      // ИП Уркунбаев в команде = Zevina 1
      if (/уркунбаев|urkunbaev|ипуркунбаев/.test(t) && prefer1.length === 1) {
        hit = prefer1;
      }
    }
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

/** Вытащить товар из фразы про РК («запусти рк лапша белая база»). */
export function extractAdsProductHint(text: string): string {
  let t = stripCabinetAliases(text);
  t = t
    .replace(
      /\b(рк|реклам\w*|кампан\w*|аукцион\w*|запуст\w*|пауз\w*|пополни\w*|список|покажи|какие|статус|активн\w*|готов\w*|сегодня|нужно|надо|давай|пожалуйста|плиз|и|на|по|в|с)\b/gi,
      " ",
    )
    .replace(/[^\p{L}\p{N}\s\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

export function filterCampaignsByProduct(
  items: Array<{ id: number; name: string; status: number }>,
  hint: string,
): Array<{ id: number; name: string; status: number }> {
  const q = String(hint || "").trim();
  if (!q || q.length < 3 || !items.length) return items;
  const scored = items
    .map((i) => ({ i, score: scoreProductMatch(i.name, q) }))
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score || a.i.name.localeCompare(b.i.name, "ru"));
  if (!scored.length) return [];
  const best = scored[0].score;
  return scored.filter((x) => x.score >= best - 2).map((x) => x.i);
}

/** Активный pending в чате (не протухший). */
export async function getActivePending(chatId: number): Promise<PendingAction | null> {
  const db = admin();
  const { data } = await db
    .from("agent_pending_actions")
    .select(
      "id, chat_id, agent_key, action_type, status, cabinet_id, cabinet_name, payload, expires_at",
    )
    .eq("chat_id", chatId)
    .in("status", ["awaiting_selection", "awaiting_confirm"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PendingAction) || null;
}

export async function cancelOtherPending(db: SupabaseClient, chatId: number) {
  await db
    .from("agent_pending_actions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .in("status", ["awaiting_selection", "awaiting_confirm"]);
}

export function isConfirmText(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!]+$/g, "");
  return (
    /^(подтверждаю|подтвердить|да,? запускай|да,? паузь|да,? делай|согласен|ok confirm|confirm)$/i
      .test(t) ||
    /^(да|ага|угу|ок|ok|давай|запускай|запустить|поехали|делай)$/i.test(t) ||
    /^да[, ]+(запускай|запусти|давай|ок)$/i.test(t)
  );
}

export function isCancelText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(отмена|отменить|cancel|нет|не надо|стоп)$/i.test(t);
}

/** Выбор номеров: «все» / «1,3,5» / «1-3» / «запусти все» */
export function parseSelection(text: string, max: number): number[] | null {
  const t = text.trim().toLowerCase();
  if (/(^|\s)(все|всех|all)(\s|$)/i.test(t) && !/\d/.test(t)) {
    return Array.from({ length: max }, (_, i) => i + 1);
  }
  // вытащим только номера из фразы «запусти 1 и 3»
  const cleaned = t.replace(/[^\d,\s\-–—]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned || (!/^\d/.test(cleaned) && !cleaned.includes(","))) return null;
  const nums = new Set<number>();
  for (const part of cleaned.split(/[,;\s]+/)) {
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
  const t = text.toLowerCase().replace(/ё/g, "е");
  const aboutAds =
    t.includes("рк") ||
    t.includes("реклам") ||
    t.includes("кампан") ||
    t.includes("аукцион") ||
    t.includes("пополни");
  // «сегодня нужно по базе пополнить рк и запустить»
  const wantStart =
    /(запусти|запуск|запустить|включи|стартани|пополни)/i.test(t) &&
    (aboutAds || /(запусти|запуск).{0,20}(рк|реклам|кампан)/i.test(t) ||
      /(рк|реклам).{0,40}(запуст|пополни)/i.test(t));
  if (!aboutAds && !wantStart && !/(пауза|останови)/.test(t)) {
    return { kind: null };
  }
  if (/(покажи|список|какие|что с)/.test(t) && aboutAds && !wantStart) {
    return { kind: "list" };
  }
  if (/(пауза|поставь на паузу|останови|выключи|стопни)/.test(t) && !wantStart) {
    return { kind: "pause" };
  }
  if (wantStart || /(запусти|запуск|включи|стартани)/.test(t)) {
    return { kind: "start" };
  }
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

  // 0) Расписание автозапуска (после недавнего запуска или список/отмена)
  if (opts.agentKey === "amina") {
    const {
      wantsRememberDailyAds,
      wantsListAdSchedules,
      wantsCancelAdSchedule,
      getRecentDoneAdsAction,
      saveDailyAdSchedule,
      listActiveSchedules,
      cancelActiveSchedules,
    } = await import("./agent-ad-schedule.ts");

    if (wantsListAdSchedules(text)) {
      return {
        handled: true,
        agentKey: "amina",
        reply: await listActiveSchedules(opts.chatId),
      };
    }
    if (wantsCancelAdSchedule(text)) {
      return {
        handled: true,
        agentKey: "amina",
        reply: await cancelActiveSchedules(opts.chatId, text),
      };
    }
    if (wantsRememberDailyAds(text)) {
      const recent = await getRecentDoneAdsAction(opts.chatId);
      if (!recent) {
        return {
          handled: true,
          agentKey: "amina",
          reply:
            "Сначала запустим РК (выбор → «да»), потом напиши «запомни каждый день» — запомню время.",
        };
      }
      const saved = await saveDailyAdSchedule({
        chatId: opts.chatId,
        tgUserId: opts.tgUserId,
        actionType: recent.action_type,
        cabinetId: recent.cabinet_id,
        cabinetName: recent.cabinet_name,
        campaignIds: recent.campaign_ids,
        campaignNames: recent.campaign_names,
      });
      return { handled: true, agentKey: "amina", reply: saved.reply };
    }
  }

  // 1) Активный pending: отмена / выбор / подтверждение
  const pending = await getActivePending(opts.chatId);
  if (pending) {
    // FBS-диалог Антона обрабатывается отдельно (agent-fbs-stock)
    if (pending.action_type === "fbs_stock") {
      return { handled: false };
    }
    // Смена цены — agent-price-change
    if (pending.action_type === "price_change") {
      return { handled: false };
    }
    // Отвечает тот же агент, кто вёл диалог
    if (opts.agentKey !== pending.agent_key) {
      return { handled: false };
    }

    if (isCancelText(text)) {
      await db
        .from("agent_pending_actions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", pending.id);
      return {
        handled: true,
        reply: "Ок, отменила. Ничего не трогала.",
        agentKey: pending.agent_key,
      };
    }

    if (pending.status === "awaiting_selection") {
      const items = pending.payload.items || [];
      const sel = parseSelection(text, items.length);
      if (!sel) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply: "Какие РК? Номера (1,3,5), «все» или «отмена».",
        };
      }
      const selectedIds = sel.map((n) => items[n - 1].id).filter(Boolean).map(Number);
      const selectedNames = sel.map((n) => items[n - 1].name);
      await db
        .from("agent_pending_actions")
        .update({
          status: "awaiting_confirm",
          payload: { ...pending.payload, selectedIds },
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id);

      const verb = pending.action_type === "advert_start" ? "запустить" : "паузить";
      const cab = String(pending.cabinet_name || "кабинет");
      const head = pending.action_type === "advert_start"
        ? aminaConfirmStart(selectedIds.length, cab)
        : pick([
          `${cab}: пауза ${selectedIds.length} РК? Напиши «да»`,
          `Паузим ${selectedIds.length} в ${cab}? «да» / «отмена»`,
          `${selectedIds.length} РК · ${cab} на паузу. Подтверди «да»`,
        ]);
      return {
        handled: true,
        agentKey: pending.agent_key,
        reply: [
          head,
          ...selectedNames.slice(0, 12).map((n) => `• ${n}`),
          selectedNames.length > 12 ? `… +${selectedNames.length - 12}` : "",
          pick([
            "«да» — сделаю. «отмена» — стоп.",
            "Жду «да» или «отмена».",
            "Коротко: «да» / «отмена».",
          ]),
        ].filter(Boolean).join("\n"),
      };
    }

    if (pending.status === "awaiting_confirm") {
      if (!isConfirmText(text)) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply: aminaWaitingYes(),
        };
      }
      if (!ownerAllowed(opts.tgUserId)) {
        return {
          handled: true,
          agentKey: pending.agent_key,
          reply: "Подтверждать может только владелец (AGENT_OWNER_TG_IDS).",
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
        reply: `${aminaAskCabinet()}\nДоступны: ${names || "—"}\nПример: «покажи РК Baza»`,
      };
    }
    const productHint = extractAdsProductHint(text);
    let items = await listCampaigns(resolved.match.id);
    if (productHint.length >= 3) {
      const filtered = filterCampaignsByProduct(items, productHint);
      if (!filtered.length) {
        return {
          handled: true,
          agentKey: opts.agentKey,
          reply: [
            `${resolved.match.name}: по «${productHint}» РК не нашла.`,
            aminaAskProduct(),
            "",
            formatCampaignList(items.slice(0, 12), `Все РК · ${resolved.match.name}`),
          ].join("\n"),
        };
      }
      items = filtered;
    }
    await setChatFocus(opts.chatId, "amina", "ads_list", 12);
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: formatCampaignList(
        items,
        productHint.length >= 3
          ? `РК · ${resolved.match.name} · ${productHint}`
          : `РК · ${resolved.match.name}`,
      ),
    };
  }

  // start / pause → предложение
  const resolved = await resolveCabinet(text);
  if (!resolved.match) {
    const names = resolved.candidates.map((c) => `• ${c.name}`).join("\n");
    return {
      handled: true,
      agentKey: opts.agentKey,
      reply: `${aminaAskCabinet()}\n${names}\nНапиши, например: «запусти РК Baza»`,
    };
  }

  const wantStatus = intent.kind === "start" ? [11, 4] : [9];
  let items = await listCampaigns(resolved.match.id, wantStatus);
  const productHint = extractAdsProductHint(text);
  if (productHint.length >= 3 && items.length) {
    const filtered = filterCampaignsByProduct(items, productHint);
    if (!filtered.length) {
      return {
        handled: true,
        agentKey: opts.agentKey,
        reply: [
          `${resolved.match.name}: по «${productHint}» подходящих РК нет.`,
          aminaAskProduct(),
        ].join("\n"),
      };
    }
    items = filtered;
  }
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
        productHint: productHint || null,
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

  await setChatFocus(opts.chatId, "amina", "ads_dialog", 20);

  const verb = intent.kind === "start" ? "запуска" : "паузы";
  const topupNote = /пополни/i.test(text)
    ? "\nБаланс РК пополняется в ЛК WB — я запущу выбранные, если бюджета хватит."
    : "";
  const titleBit = productHint.length >= 3
    ? `${resolved.match.name} · ${productHint} · РК на ${verb}`
    : `${resolved.match.name} · РК на ${verb}`;
  return {
    handled: true,
    agentKey: opts.agentKey,
    reply: [
      formatCampaignList(items, titleBit),
      "",
      "Какие запускаем? Номера, «все» — или отмена.",
      topupNote.trim(),
    ].filter(Boolean).join("\n"),
  };
}

async function executePending(pending: PendingAction, tgUserId: number): Promise<string> {
  const db = admin();
  const ids = (pending.payload.selectedIds || []).map(Number).filter((n) => Number.isFinite(n));
  if (!ids.length || !pending.cabinet_id) {
    await db.from("agent_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    return "Нечего делать — список пуст.";
  }

  await db
    .from("agent_pending_actions")
    .update({
      status: "executing",
      confirmed_by_tg: tgUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  const { runAdvertIds } = await import("./agent-ad-schedule.ts");
  const verb = pending.action_type === "advert_start" ? "start" : "pause";
  const { ok, fail, cabinetName } = await runAdvertIds({
    cabinetId: pending.cabinet_id,
    campaignIds: ids,
    action: verb,
  });

  const budgetHint = fail.some((f) => /budget|бюджет|balance|баланс/i.test(f))
    ? "\nЕсли ошибка про бюджет — пополни РК в ЛК WB и скажи ещё раз."
    : "";

  const resultText = [
    `${pending.cabinet_name || cabinetName} · ${verb === "start" ? "запуск" : "пауза"}`,
    `Ок: ${ok.length}` + (fail.length ? ` · ошибки: ${fail.length}` : ""),
    fail.length ? fail.slice(0, 6).join("\n") : "",
    budgetHint.trim(),
    ok.length
      ? "Чтобы каждый день в это же время само — напиши: запомни каждый день"
      : "",
  ].filter(Boolean).join("\n");

  await db
    .from("agent_pending_actions")
    .update({
      status: "done",
      result_text: resultText,
      payload: {
        ...pending.payload,
        selectedIds: ids,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  return resultText;
}

/** Краткий каталог возможностей для промпта. */
export function actionsCapabilityBrief(): string {
  return [
    "ДОСТУП К ДЕЙСТВИЯМ:",
    "- Амина: список / запуск / пауза РК (можно с товаром: «рк лапша белая») → выбор → «да»; «запомни каждый день»",
    "- Сауле: цена → артикул → «до/после + цена» → «сохранила»; конкуренты: «арт 123 найди конкурента и сравни»",
    "- Антон: FBS/остатки по живым названиям товаров во всех кабинетах",
    "- Алина: фото/раздачи; если нет в таблице — ищет по каталогу WB",
    "Пока идёт диалог с одним агентом — остальные не встревают; смена имени сбрасывает чужой pending.",
    "Кабинеты: Baza, SAAI, Zevina 1, Zevina 2, Elium.",
  ].join("\n");
}
