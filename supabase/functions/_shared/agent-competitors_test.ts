import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractNmId,
  formatCompetitorReply,
  scoreDirectCompetitor,
  wantsCompetitorAnalysis,
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
  assertEquals(wantsCompetitorAnalysis("сколько продаж вчера"), false);
  assertEquals(wantsCompetitorAnalysis("артикул дай на лапшу бел"), false);
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

Deno.test("formatCompetitorReply includes verdict", () => {
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
  assert(text.includes("Сауле · конкуренты"));
  assert(text.includes("Вердикт"));
  assert(text.includes("555555555"));
});
