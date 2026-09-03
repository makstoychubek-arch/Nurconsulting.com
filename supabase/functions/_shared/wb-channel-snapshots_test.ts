import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatAdsReply,
  formatDrrBrief,
  parseAdsQuery,
} from "./wb-ads-snapshot.ts";
import { parsePenaltiesQuery, formatPenaltiesReply, pickSalesReport, aggregatePenaltyRows } from "./wb-penalties-snapshot.ts";
import { yesterdayBishkek } from "./agent-ru-text.ts";

Deno.test("parseAdsQuery day from вчера", () => {
  const q = parseAdsQuery("реклама вчера");
  assert(q);
  assertEquals(q!.mode, "day");
  assertEquals(q!.date, yesterdayBishkek());
});

Deno.test("parseAdsQuery cabinet hint", () => {
  const q = parseAdsQuery("реклама вчера база");
  assert(q);
  assertEquals(q!.cabinet?.toLowerCase(), "база");
});

Deno.test("parseAdsQuery help only → null", () => {
  assertEquals(parseAdsQuery("помощь"), null);
  assertEquals(parseAdsQuery("help"), null);
});

Deno.test("formatAdsReply shows CTR/DRR", () => {
  const text = formatAdsReply("2026-08-13", [
    { name: "Baza", spend: 1000, views: 200, clicks: 10, orders: 2, sumPrice: 5000 },
  ]);
  assert(text.includes("CTR"));
  assert(text.includes("ДРР"));
  assert(text.includes("Baza"));
});

Deno.test("formatDrrBrief hot empty", () => {
  const text = formatDrrBrief({
    date: "2026-08-13",
    threshold: 25,
    hot: [],
    cabTotals: [{ name: "Baza", spend: 100, views: 0, clicks: 0, orders: 0, sumPrice: 1000 }],
  });
  assert(text.includes("ДРР"));
  assert(text.includes("Горячих РК"));
});

Deno.test("parsePenaltiesQuery + format", () => {
  const q = parsePenaltiesQuery("штрафы вчера");
  assert(q);
  assertEquals(q!.date, yesterdayBishkek());
  const text = formatPenaltiesReply(q!.date, [{ name: "Baza", total: 1500 }], "alert");
  assert(text.includes("1500") || text.includes("1"));
  assert(text.includes("@alert"));
});

Deno.test("parsePenaltiesQuery help → null", () => {
  assertEquals(parsePenaltiesQuery("помощь"), null);
});

Deno.test("parsePenaltiesQuery cabinet", () => {
  const q = parsePenaltiesQuery("штрафы база");
  assert(q);
  assertEquals(q!.cabinet?.toLowerCase(), "база");
});

Deno.test("pickSalesReport: covering week wins, else last closed", () => {
  const reports = [
    { reportId: 1, dateFrom: "2026-08-17", dateTo: "2026-08-23" },
    { reportId: 2, dateFrom: "2026-08-24", dateTo: "2026-08-30" },
  ];
  assertEquals(pickSalesReport(reports, "2026-08-26")?.reportId, 2);
  assertEquals(pickSalesReport(reports, "2026-09-02")?.reportId, 2);
  assertEquals(pickSalesReport(reports, "2026-08-10"), null);
});

Deno.test("aggregatePenaltyRows: Штраф МП from bonusTypeName", () => {
  const rows = aggregatePenaltyRows([
    { penalty: 1884.35, bonusTypeName: "Штраф МП. Невыполненный заказ", docTypeName: "" },
    { penalty: 51.08, bonusTypeName: "Платное хранение возвратов на ПВЗ более 3 дней" },
    { penalty: 0, deduction: 100, bonusTypeName: "ВБ.Продвижение" },
  ]);
  assertEquals(rows.length, 2);
  assertEquals(Math.round(rows[0].amount), 1884);
  assert(rows[0].reason.includes("Штраф МП"));
});
