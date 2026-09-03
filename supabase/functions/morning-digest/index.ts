// Утренний «светофор» в группу «Продажи» — 09:00 Бишкек.
// Сравнение заказов вчера vs позавчера + статус РК и баланса.
// Важно: не писать «нет данных WB», если упал только один эндпоинт / rate-limit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getTelegramChatId,
  getTelegramToken,
  isTelegramConfigured,
  telegramConfigError,
} from "../_shared/telegram-routing.ts";
import {
  fetchSalesTotals,
  prettyDate,
  yesterdayBishkek,
  fmtNum,
} from "../_shared/wb-sales-snapshot.ts";
import {
  CABINET_TOKEN_SELECT,
  isValidWbToken,
  pickCabinetToken,
  sanitizeWbToken,
} from "../_shared/wb-cabinet-tokens.ts";
import { isServiceAuthorized } from "../_shared/service-auth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nr-setup-key",
};
const ADV_API = "https://advert-api.wildberries.ru";
const LOW_BAL = Number(Deno.env.get("AD_LOW_BALANCE_THRESHOLD")) || 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId("sales");
  if (!isTelegramConfigured("sales")) {
    return json({ error: telegramConfigError("sales") }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
  const yesterday = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ? body.date
    : yesterdayBishkek();
  const eventType = `morning_digest_${yesterday}`;
  if (!body?.force) {
    const { data: dupes } = await admin
      .from("notification_log")
      .select("id")
      .eq("event_type", eventType)
      .limit(1);
    if (dupes?.length) {
      return json({ ok: true, skipped: "already_sent", date: yesterday });
    }
  }
  // Позавчера относительно выбранного yesterday
  const dayBeforeFixed = shiftIsoDate(yesterday, -1);
  const pretty = prettyDate(yesterday);

  const { data: rawCabinets, error: cabErr } = await admin
    .from("cabinets")
    .select(CABINET_TOKEN_SELECT)
    .not("wb_token", "is", null)
    .gt("wb_token", "")
    .order("name");
  if (cabErr) return json({ error: cabErr.message }, 500);

  const cabinets = (rawCabinets || []).filter((c) => {
    const name = String(c.name || "").trim();
    if (!name || name.length < 2) return false;
    // мусорные тестовые кабинеты
    if (name === "ыы" || name.length <= 2) return false;
    return isValidWbToken(sanitizeWbToken(c.wb_token));
  });

  const lines: string[] = [`🌄 <b>NR · ${pretty}</b>`, ""];
  const debug: Array<Record<string, unknown>> = [];

  for (const cab of cabinets) {
    const salesToken = pickCabinetToken(cab, "default");
    const promoToken = pickCabinetToken(cab, "promotion");
    if (!isValidWbToken(salesToken)) continue;

    let yOrders = 0;
    let yBuyouts = 0;
    let ySum = 0;
    let dOrders = 0;
    let fetchError: string | null = null;

    try {
      const yt = await fetchSalesTotals(salesToken, yesterday);
      yOrders = yt.ordersCount;
      yBuyouts = yt.buyoutCount;
      ySum = yt.ordersSum;
      await sleep(700);
      const dt = await fetchSalesTotals(salesToken, dayBeforeFixed);
      dOrders = dt.ordersCount;
    } catch (e) {
      fetchError = String(e).slice(0, 120);
      console.warn(`[morning-digest] ${cab.name}:`, fetchError);
    }

    await sleep(500);

    const { data: camps } = await admin
      .from("advertising_campaigns")
      .select("status")
      .eq("cabinet_id", cab.id);
    const active = (camps || []).filter((c) => Number(c.status) === 9).length;
    const total = (camps || []).filter((c) =>
      [4, 9, 11].includes(Number(c.status))
    ).length;

    let balStr = "";
    if (isValidWbToken(promoToken)) {
      try {
        const bRes = await fetch(`${ADV_API}/adv/v1/balance`, {
          headers: { Authorization: promoToken },
          signal: AbortSignal.timeout(12000),
        });
        if (bRes.ok) {
          const bData = await bRes.json();
          const bal = Number(bData?.balance ?? 0);
          if (Number.isFinite(bal) && bal <= LOW_BAL) {
            balStr = ` · ⚠ ${Math.round(bal)} ₽`;
          }
        }
      } catch { /* skip */ }
    }

    if (fetchError && yOrders === 0 && yBuyouts === 0) {
      // Реальная ошибка обоих эндпоинтов — но не ври «нет данных», если 0 заказов ок
      lines.push(
        `🟠 <b>${esc(String(cab.name))}</b> — WB временно не ответил (${esc(fetchError.slice(0, 60))})`,
      );
      debug.push({ cabinet: cab.name, error: fetchError });
      continue;
    }

    const pct = dOrders > 0
      ? Math.round(((yOrders - dOrders) / dOrders) * 100)
      : (yOrders > 0 ? 100 : 0);
    const icon = pct >= 5 ? "🟢" : pct <= -5 ? "🔴" : "🟡";
    const pctStr = dOrders > 0 ? ` (${pct >= 0 ? "+" : ""}${pct}%)` : "";

    lines.push(
      `${icon} <b>${esc(String(cab.name))}</b> · заказы ${yOrders}${pctStr}` +
        ` · выкупы ${yBuyouts} · ${fmtNum(ySum)} сом · РК ${active}/${total}${balStr}`,
    );
    debug.push({
      cabinet: cab.name,
      yOrders,
      yBuyouts,
      dOrders,
      pct,
    });
  }

  lines.push("", "<i>07:00 — полный отчёт с артикулами</i>");

  const text = lines.join("\n");
  const sent = await sendTg(tgToken, tgChatId, text);
  const { data: anyCab } = await admin.from("cabinets").select("id").limit(1)
    .maybeSingle();
  if (sent && anyCab?.id) {
    await admin.from("notification_log").insert({
      cabinet_id: anyCab.id,
      event_type: eventType,
      message_text: text.slice(0, 500),
    });
  }
  return json({ ok: sent, date: yesterday, dayBefore: dayBeforeFixed, sent, debug });
});

function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const shifted = new Date(utcNoon + deltaDays * 86400000);
  return `${shifted.getUTCFullYear()}-${
    String(shifted.getUTCMonth() + 1).padStart(2, "0")
  }-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

async function sendTg(token: string, chatId: string, text: string): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.warn("[morning-digest] tg", res.status, await res.text());
  }
  return res.ok;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
