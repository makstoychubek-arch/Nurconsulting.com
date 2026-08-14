import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseAgentTextToSnapshot,
  wantsSummaryReflow,
} from "./agent-summary.ts";

Deno.test("wantsSummaryReflow short phrases", () => {
  assertEquals(wantsSummaryReflow("сводная"), true);
  assertEquals(wantsSummaryReflow("Сводную"), true);
  assertEquals(wantsSummaryReflow("дай в сводную"), true);
  assertEquals(wantsSummaryReflow("дай эти данные в сводную"), true);
  assertEquals(wantsSummaryReflow("в таблицу"), true);
  assertEquals(wantsSummaryReflow("сводная по размерам база fbs"), false);
  assertEquals(wantsSummaryReflow("сколько продаж"), false);
});

Deno.test("parse competitors reply to snapshot", () => {
  const text = [
    "Сауле · конкуренты",
    "Наш: Elium · Жилетка",
    "",
    "Прямые (топ-2):",
    "1) Rival · Жилетка беж",
    "   арт. 555555555 · 3000 ₽ · ★4.8 · 400 отз.",
    "2) Other · Жилет укороч",
    "   арт. 666666666 · 3200 ₽ · ★4.5 · 100 отз.",
  ].join("\n");
  const snap = parseAgentTextToSnapshot(text, "saule");
  assert(snap);
  assertEquals(snap!.columns[0], "Арт");
  assert(snap!.rows.length >= 2);
  assertEquals(snap!.rows[0][0], "555555555");
});

Deno.test("parse bullet reply to snapshot", () => {
  const text = [
    "Сауле · продажи",
    "• База: заказы 12",
    "• Elium: заказы 8",
    "• SAAI: заказы 3",
  ].join("\n");
  const snap = parseAgentTextToSnapshot(text, "saule");
  assert(snap);
  assert(snap!.rows.length >= 3);
});
