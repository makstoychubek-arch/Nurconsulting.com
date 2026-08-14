import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatAdsReply,
  formatDrrBrief,
  parseAdsQuery,
} from "./wb-ads-snapshot.ts";
import { parsePenaltiesQuery, formatPenaltiesReply } from "./wb-penalties-snapshot.ts";
import { yesterdayBishkek } from "./agent-ru-text.ts";

Deno.test("parseAdsQuery day from вчера", () => {
  const q = parseAdsQuery("реклама вчера");
  assert(q);
  assertEquals(q!.mode, "day");
  assertEquals(q!.date, yesterdayBishkek());
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
