import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractNmId,
  formatCompetitorReply,
  pickTopFromSearch,
  scoreDirectCompetitor,
  suggestPriceAction,
  wantsCompetitorAnalysis,
  wantsStickyProductRef,
  type PublicProduct,
} from "./agent-competitors.ts";

const ours: PublicProduct = {
  nmId: 111111111,
  name: "Жилетка укороченная бежевая",
  brand: "Elium",
  subject: "Жилеты",
  subjectId: 100,
  vendorCode: "жл беж",
  priceAfter: 3500,
  priceBefore: 5000,
  rating: 4.6,
  feedbacks: 120,
  supplier: "Мы",
  source: "cabinet",
};

Deno.test("wantsCompetitorAnalysis phrases", () => {
  assertEquals(wantsCompetitorAnalysis("771499220 найди прямого конкурента и сравни"), true);
  assertEquals(wantsCompetitorAnalysis("Сауле, конкуренты по жилетке"), true);
  assertEquals(wantsCompetitorAnalysis("сравни артикул 1234567 с выдачей"), true);
  assertEquals(wantsCompetitorAnalysis("кк цена у конкурентов этого товара"), true);
  assertEquals(wantsCompetitorAnalysis("А конкуренты?"), true);
  assertEquals(wantsCompetitorAnalysis("где топ 3 по выдаче"), true);
  assertEquals(wantsCompetitorAnalysis("сравни"), true);
  assertEquals(wantsCompetitorAnalysis("топ 3"), true);
  assertEquals(wantsCompetitorAnalysis("сколько продаж вчера"), false);
  assertEquals(wantsCompetitorAnalysis("артикул дай на лапшу бел"), false);
});

Deno.test("wantsStickyProductRef", () => {
  assert(wantsStickyProductRef("кк цена у конкурентов этого товара"));
  assert(wantsStickyProductRef("сравни по этому артикулу"));
  assert(wantsStickyProductRef("А конкуренты?"));
  assert(wantsStickyProductRef("топ 3"));
  assert(wantsStickyProductRef("где топ 3 конкурента по выдаче?"));
  assert(wantsStickyProductRef("сравни"));
  assert(wantsStickyProductRef("по выдаче"));
  assertEquals(wantsStickyProductRef("конкуренты лапша белая"), false);
});

Deno.test("extractNmId", () => {
  assertEquals(extractNmId("арт 771499220 сравни"), 771499220);
  assertEquals(extractNmId("нет числа"), null);
});

Deno.test("scoreDirectCompetitor prefers same niche other brand", () => {
  const good: PublicProduct = {
    ...ours,
    nmId: 222222222,
    brand: "OtherBrand",
    name: "Жилетка укороченная беж",
    priceAfter: 3400,
    subjectId: 100,
  };
  const sameBrand: PublicProduct = {
    ...good,
    nmId: 333333333,
    brand: "Elium",
  };
  const far: PublicProduct = {
    ...good,
    nmId: 444444444,
    name: "Сковорода антипригарная",
    subjectId: 999,
    priceAfter: 900,
  };
  assert(scoreDirectCompetitor(ours, good) > scoreDirectCompetitor(ours, sameBrand));
  assert(scoreDirectCompetitor(ours, good) > scoreDirectCompetitor(ours, far));
  assertEquals(scoreDirectCompetitor(ours, ours) < 0, true);
});

Deno.test("pickTopFromSearch takes first other brands in order", () => {
  const pool: PublicProduct[] = [
    ours,
    { ...ours, nmId: 200000001, brand: "A", name: "жл 1", priceAfter: 3000 },
    { ...ours, nmId: 200000002, brand: "B", name: "жл 2", priceAfter: 3100 },
    { ...ours, nmId: 200000003, brand: "Elium", name: "наш же", priceAfter: 3200 },
    { ...ours, nmId: 200000004, brand: "C", name: "жл 3", priceAfter: 3300 },
  ];
  const top = pickTopFromSearch(ours, pool, 3);
  assertEquals(top.map((t) => t.nmId), [200000001, 200000002, 200000004]);
});

Deno.test("suggestPriceAction raise/lower/hold", () => {
  const hold = suggestPriceAction(1519, [1754, 1568, 864]);
  assertEquals(hold.action, "hold");

  const raise = suggestPriceAction(1200, [1754, 1568, 1600]);
  assertEquals(raise.action, "raise");
  assert(raise.target != null && raise.target > 1200);

  const lower = suggestPriceAction(2200, [1754, 1568, 1600]);
  assertEquals(lower.action, "lower");
  assert(lower.target != null && lower.target < 2200);
});

Deno.test("formatCompetitorReply includes recommendation", () => {
  const top: PublicProduct = {
    ...ours,
    nmId: 555555555,
    brand: "Rival",
    name: "Жилетка бежевая укороч",
    priceAfter: 3000,
    rating: 4.8,
    feedbacks: 400,
  };
  const text = formatCompetitorReply(ours, [top], "жилеты укороченная бежевая");
  assert(text.includes("Сауле · сводка"));
  assert(text.includes("Рекомендация"));
  assert(text.includes("Топ-1 по выдаче"));
  assert(text.includes("555555555"));
  assert(/ПОДНЯТЬ|ОПУСТИТЬ|ДЕРЖАТЬ/.test(text));
});
