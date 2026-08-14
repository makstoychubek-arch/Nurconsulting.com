/**
 * Регрессии: JS \\b / \\w* ломают кириллицу — ключевые матчеры должны жить без них.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { wantsProductPhoto } from "./alina-wb-photo.ts";
import { wantsSummaryReflow } from "./agent-summary.ts";
import { detectTopicalAgents } from "./agent-team.ts";
import { isAlinaStatsQuestion } from "./alina-selfbuy.ts";

Deno.test("главное фото: topical + photo want", () => {
  assert(wantsProductPhoto("главное фото"));
  assert(wantsProductPhoto("фотки"));
  const topical = detectTopicalAgents("дай главное фото фонарь белый");
  assert(topical.includes("alina"));
});

Deno.test("summary reflow: дай сводную", () => {
  assert(wantsSummaryReflow("дай сводную"));
  assert(wantsSummaryReflow("покажи таблицу"));
});

Deno.test("alina stats: оффер не считается статистикой", () => {
  assertEquals(isAlinaStatsQuestion("алина оффер закрыт"), false);
  assertEquals(isAlinaStatsQuestion("сколько самовыкупов"), true);
});
