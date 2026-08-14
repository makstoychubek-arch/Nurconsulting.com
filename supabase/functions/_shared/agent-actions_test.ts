import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectAdvertIntent,
  extractAdsProductHint,
  filterCampaignsByProduct,
  isCancelText,
  isConfirmText,
  normName,
  parseSelection,
} from "./agent-actions.ts";

Deno.test("intent: запусти рк базы", () => {
  assertEquals(detectAdvertIntent("запусти рк кабинета базы").kind, "start");
});

Deno.test("intent: простой текст пополнить и запустить", () => {
  assertEquals(
    detectAdvertIntent("сегодня нужно по базе пополнить рк и запустить").kind,
    "start",
  );
  assert(isConfirmText("давай"));
  assert(isConfirmText("запускай"));
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

Deno.test("ads product hint + campaign filter", () => {
  assert(
    extractAdsProductHint("запусти рк база лапша белая").toLowerCase().includes("лапша"),
  );
  assertEquals(
    extractAdsProductHint("/ads запуск baza").toLowerCase().replace(/\s+/g, ""),
    "",
  );
  assert(
    !extractAdsProductHint("/ads запуск лапша белая").toLowerCase().includes("запуск"),
  );
  const items = [
    { id: 1, name: "Блузка-лапша-белый", status: 11 },
    { id: 2, name: "Блузка_фонарь_черный", status: 11 },
    { id: 3, name: "жл-темносиний", status: 11 },
  ];
  const hit = filterCampaignsByProduct(items, "лапша белая");
  assertEquals(hit.length, 1);
  assertEquals(hit[0].id, 1);
  const vest = filterCampaignsByProduct(items, "жилетка темно синяя");
  assertEquals(vest.length, 1);
  assertEquals(vest[0].id, 3);
});

Deno.test("normName база", () => {
  assertEquals(normName("Базы"), "базы");
  assert(normName("Baza").includes("baza"));
});
