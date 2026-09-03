import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatAdsReply,
  formatDrrBrief,
  parseAdsQuery,
} from "./wb-ads-snapshot.ts";
import { parsePenaltiesQuery, formatPenaltiesReply, formatPenaltyCaption, pickSalesReport, parseSalesReportsList, aggregatePenaltyRows, PENALTY_DETAIL_FIELDS } from "./wb-penalties-snapshot.ts";
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

Deno.test("pickSalesReport: exact daily wins over weekly, else last closed", () => {
  const reports = [
    { reportId: "1", dateFrom: "2026-08-17", dateTo: "2026-08-23" },
    { reportId: "2", dateFrom: "2026-08-24", dateTo: "2026-08-30" },
    { reportId: "25009236420260902", dateFrom: "2026-09-02", dateTo: "2026-09-02" },
  ];
  assertEquals(pickSalesReport(reports, "2026-08-26")?.reportId, "2");
  assertEquals(pickSalesReport(reports, "2026-09-02")?.reportId, "25009236420260902");
  assertEquals(pickSalesReport(reports, "2026-08-10"), null);
});

Deno.test("parseSalesReportsList keeps daily reportId as string", () => {
  const parsed = parseSalesReportsList(
    '[{"reportId":25009236420260902,"dateFrom":"2026-09-02","dateTo":"2026-09-02","period":"daily","penaltySum":0}]',
  );
  assertEquals(parsed[0]?.reportId, "25009236420260902");
  assertEquals(parsed[0]?.dateFrom, "2026-09-02");
  assertEquals(parsed[0]?.period, "daily");
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

Deno.test("PENALTY_DETAIL_FIELDS is a slim WB payload", () => {
  assert(PENALTY_DETAIL_FIELDS.includes("penalty"));
  assert(PENALTY_DETAIL_FIELDS.includes("bonusTypeName"));
  assert(PENALTY_DETAIL_FIELDS.includes("sellerOperName"));
  assert(PENALTY_DETAIL_FIELDS.includes("rrdId"));
  assertEquals(PENALTY_DETAIL_FIELDS.length, 6);
});

Deno.test("formatPenaltyCaption: сторож + сравнение с прошлым днём", () => {
  const text = formatPenaltyCaption({
    cabinetName: "Zevina 1",
    date: "2026-08-10",
    rows: [{ reason: "Отчет об утилизированном товаре", amount: 971 }],
    prevDate: "2026-08-09",
    prevTotal: 0,
    prevItems: 1,
    alertUser: "maraWuW",
    watchdogThreshold: 500,
  });
  assert(text.includes("Zevina 1"));
  assert(text.includes("10.08.2026"));
  assert(text.includes("971"));
  assert(text.includes("Сторож"));
  assert(text.includes("09.08.2026"));
  assert(text.includes("@maraWuW"));
  assert(text.includes("нужно разобраться"));
});
