import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseSalesQuery } from "./wb-sales-snapshot.ts";

Deno.test("parseSalesQuery: вчера без \\b", () => {
  const q = parseSalesQuery("вчера");
  assert(q);
  assertEquals(typeof q!.date, "string");
  assert(q!.date.length === 10);
});

Deno.test("parseSalesQuery: продажи / заказ / выкуп", () => {
  assert(parseSalesQuery("продажи"));
  assert(parseSalesQuery("заказы база"));
  assert(parseSalesQuery("выкупы вчера"));
});

Deno.test("parseSalesQuery: кабинет кириллицей", () => {
  const q = parseSalesQuery("продажи вчера база");
  assert(q);
  assertEquals(q!.cabinet?.toLowerCase(), "база");
});

Deno.test("parseSalesQuery: дата dd.mm", () => {
  const q = parseSalesQuery("продажи 12.07");
  assert(q);
  assert(q!.date.includes("-07-12") || q!.date.endsWith("-07-12"));
});
