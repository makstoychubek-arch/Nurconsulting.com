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
});

Deno.test("expand ads start", () => {
  assertEquals(expandAdsActionCommand("/ads start базы"), "запусти рк базы");
  assertEquals(expandAdsActionCommand("/ads pause saai"), "поставь на паузу рк saai");
});

Deno.test("help ping", () => {
  assertEquals(parseFastCommand("/help")?.cmd, "help");
  assertEquals(parseFastCommand("команды")?.cmd, "help");
  assertEquals(parseFastCommand("/ping")?.cmd, "ping");
});
