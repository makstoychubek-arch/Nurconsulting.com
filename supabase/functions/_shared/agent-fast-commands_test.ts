import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { expandAdsActionCommand, parseFastCommand } from "./agent-fast-commands.ts";

Deno.test("parse /sales baza", () => {
  assertEquals(parseFastCommand("/sales baza"), { cmd: "sales", arg: "baza" });
  assertEquals(parseFastCommand("продажи baza")?.cmd, "sales");
});

Deno.test("parse ads commands", () => {
  assertEquals(parseFastCommand("/ads saai")?.cmd, "ads");
  assertEquals(parseFastCommand("рк baza")?.cmd, "ads");
  assertEquals(parseFastCommand("/ads start baza"), { cmd: "ads_start", arg: "baza" });
  assertEquals(parseFastCommand("/drr")?.cmd, "drr");
  assertEquals(parseFastCommand("дрр вчера")?.cmd, "drr");
});

Deno.test("expand ads start", () => {
  assertEquals(expandAdsActionCommand("/ads start базы"), "запусти рк базы");
  assertEquals(expandAdsActionCommand("/ads pause saai"), "поставь на паузу рк saai");
  assertEquals(expandAdsActionCommand("/ads запуск baza"), "запусти рк baza");
  assertEquals(expandAdsActionCommand("/ads пауза saai"), "поставь на паузу рк saai");
  assertEquals(parseFastCommand("/ads запуск baza")?.cmd, "ads_start");
  assertEquals(parseFastCommand("/ads пауза saai")?.cmd, "ads_pause");
});

Deno.test("help ping", () => {
  assertEquals(parseFastCommand("/help")?.cmd, "help");
  assertEquals(parseFastCommand("команды")?.cmd, "help");
  assertEquals(parseFastCommand("/ping")?.cmd, "ping");
});

Deno.test("wow pulse urgent stock", () => {
  assertEquals(parseFastCommand("/pulse")?.cmd, "pulse");
  assertEquals(parseFastCommand("сводка")?.cmd, "pulse");
  assertEquals(parseFastCommand("сегодня")?.cmd, "pulse");
  assertEquals(parseFastCommand("сегодня заказы"), null); // не перехватываем NL
  assertEquals(parseFastCommand("/срочно")?.cmd, "urgent");
  assertEquals(parseFastCommand("urgent")?.cmd, "urgent");
  assertEquals(parseFastCommand("/остатки")?.cmd, "stock");
  assertEquals(parseFastCommand("остатки")?.cmd, "stock");
  assertEquals(parseFastCommand("/whoami")?.cmd, "whoami");
  assertEquals(parseFastCommand("/себес кимоно")?.cmd, "cost");
  assertEquals(parseFastCommand("/себес кимоно")?.arg, "кимоно");
  assertEquals(parseFastCommand("/разбор")?.cmd, "discuss");
  assertEquals(parseFastCommand("/почему")?.cmd, "discuss");
});

Deno.test("fuzzy typos on wow cmds", () => {
  assertEquals(parseFastCommand("сволка")?.cmd, "pulse");
  assertEquals(parseFastCommand("остаки")?.cmd, "stock");
});
