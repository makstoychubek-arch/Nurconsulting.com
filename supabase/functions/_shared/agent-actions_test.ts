import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectAdvertIntent,
  isCancelText,
  isConfirmText,
  normName,
  parseSelection,
} from "./agent-actions.ts";

Deno.test("intent: запусти рк базы", () => {
  assertEquals(detectAdvertIntent("запусти рк кабинета базы").kind, "start");
});

Deno.test("intent: пауза рекламы", () => {
  assertEquals(detectAdvertIntent("поставь на паузу рекламу SAAI").kind, "pause");
});

Deno.test("intent: список", () => {
  assertEquals(detectAdvertIntent("покажи РК Baza").kind, "list");
});

Deno.test("confirm / cancel", () => {
  assert(isConfirmText("подтверждаю"));
  assert(isConfirmText("да"));
  assert(isCancelText("отмена"));
  assertEquals(isConfirmText("запусти"), false);
});

Deno.test("parseSelection", () => {
  assertEquals(parseSelection("все", 5), [1, 2, 3, 4, 5]);
  assertEquals(parseSelection("1,3,5", 5), [1, 3, 5]);
  assertEquals(parseSelection("2-4", 5), [2, 3, 4]);
  assertEquals(parseSelection("привет", 5), null);
});

Deno.test("normName база", () => {
  assertEquals(normName("Базы"), "базы");
  assert(normName("Baza").includes("baza"));
});
