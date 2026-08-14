import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filterStopTokens,
  hasRuDayOrDdMm,
  hasRuToken,
  parseRuDayToken,
  ruBounded,
  yesterdayBishkek,
} from "./agent-ru-text.ts";

Deno.test("ruBounded / hasRuToken: кириллица", () => {
  assert(hasRuToken("продажи вчера", "вчера"));
  assert(hasRuToken("оффер закрыт", "оффер"));
  assert(!hasRuToken("проффесор", "оффер"));
  assert(ruBounded("айди").test("мой айди чата"));
});

Deno.test("filterStopTokens", () => {
  const stop = new Set(["рк", "запуск", "ads", "baza"]);
  assertEquals(
    filterStopTokens("ads запуск baza лапша белая", { exact: stop }),
    "лапша белая",
  );
  assertEquals(
    filterStopTokens("запусти рк", {
      exact: new Set(["рк"]),
      prefix: /^(запуст)/i,
    }),
    "",
  );
  assertEquals(
    filterStopTokens("фонарь 40 белый", {
      exact: new Set(),
      dropNumbers: true,
    }),
    "фонарь белый",
  );
});

Deno.test("parseRuDayToken / hasRuDayOrDdMm", () => {
  assert(hasRuDayOrDdMm("вчера"));
  assert(hasRuDayOrDdMm("12.07"));
  assert(!hasRuDayOrDdMm("просто текст"));
  assertEquals(parseRuDayToken("вчера"), yesterdayBishkek());
  assertEquals(parseRuDayToken("продажи 12.07").slice(5), "07-12");
});
