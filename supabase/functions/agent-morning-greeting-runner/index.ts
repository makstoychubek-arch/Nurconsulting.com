/**
 * Cron: каждые 5 мин. Утреннее приветствие команды (agent_morning_greetings).
 *
 * body.test → ping
 * body.preview → сгенерировать без отправки (нужен chat_id или берёт due)
 * body.force → игнорировать last_run_on / окно времени
 */
import { isServiceAuthorized } from "../_shared/service-auth.ts";
import { bishkekNowParts } from "../_shared/agent-ad-schedule.ts";
import {
  dueMorningGreetingsNow,
  runMorningGreetingForRow,
  type MorningGreetingRow,
} from "../_shared/agent-morning-greeting.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-nr-setup-key",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force || body?.test || body?.preview))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const now = bishkekNowParts();
  if (body?.test) {
    return json({
      ok: true,
      bishkek: now,
      message: "agent-morning-greeting-runner alive",
    });
  }

  const force = Boolean(body?.force);
  const preview = Boolean(body?.preview);
  const chatId = body?.chat_id != null ? Number(body.chat_id) : undefined;

  let rows: MorningGreetingRow[] = [];
  if (chatId && (force || preview)) {
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data } = await db
      .from("agent_morning_greetings")
      .select("*")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (data) rows = [data as MorningGreetingRow];
  } else {
    rows = await dueMorningGreetingsNow({ force, chatId });
  }

  const results = [];
  for (const row of rows) {
    try {
      const r = await runMorningGreetingForRow(row, { dryRun: preview });
      results.push(r);
    } catch (e) {
      console.error("[agent-morning-greeting-runner] row", row.id, e);
      results.push({
        chatId: row.chat_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({
    ok: true,
    bishkek: now,
    preview,
    force,
    due: rows.length,
    results,
  });
});
