import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fuzzyHasAnyToken,
  fuzzyIncludesAny,
  fuzzyMatchBags,
  fuzzyMatchCommand,
  levenshtein,
  normalizeBotText,
} from "./agent-fuzzy.ts";

Deno.test("normalizeBotText", () => {
  assertEquals(normalizeBotText("  Что  умеешь? @SauleBot "), "что умеешь");
  assertEquals(normalizeBotText("Ёлка"), "елка");
});

Deno.test("levenshtein typos", () => {
  assert(levenshtein("сводка", "сволка") <= 2);
  assert(levenshtein("остатки", "остаки") <= 2);
  assertEquals(levenshtein("ping", "ping"), 0);
});

Deno.test("fuzzyMatchCommand", () => {
  assertEquals(fuzzyMatchCommand("сволка", ["сводка", "пульс"]), "сводка");
  assertEquals(fuzzyMatchCommand("остаки", ["остатки", "stock"]), "остатки");
  assertEquals(fuzzyMatchCommand("xyz", ["sales", "ads"]), null);
});

Deno.test("fuzzyIncludesAny skills slang", () => {
  assert(fuzzyIncludesAny("чо умееш", ["что умеешь", "чо умеешь"]));
  assert(fuzzyIncludesAny("твои скилы", ["скилы", "скиллы"]));
});

Deno.test("fuzzyHasAnyToken / bags for free phrasing", () => {
  assert(fuzzyHasAnyToken("кинь инвайт плиз", ["инвайт", "ссылка"]));
  assert(fuzzyMatchBags("нужна ссылка в кабинет", [
    ["ссылка", "линк"],
    ["кабинет", "приглашение"],
  ]));
  assert(!fuzzyMatchBags("продажи вчера", [["ссылка"], ["кабинет"]]));
});
