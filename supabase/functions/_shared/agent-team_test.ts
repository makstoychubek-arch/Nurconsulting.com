import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildTeamPlan,
  clampHops,
  detectMentionedAgents,
  detectNamedAgents,
  detectTopicalAgents,
  isDoneReply,
  nextPingFromReply,
} from "./agent-team.ts";

Deno.test("самовыкуп не зовёт Сауле по подстроке выкуп", () => {
  const topics = detectTopicalAgents("сколько самовыкупов сегодня?");
  assertEquals(topics.includes("saule"), false);
  assertEquals(topics.includes("alina"), true);
});

Deno.test("продажи + реклама → план из двух", () => {
  const plan = buildTeamPlan("разберите продажи и рекламу", undefined, 3);
  assertEquals(plan[0], "saule");
  assert(plan.includes("amina"));
});

Deno.test("пинг по @username и по имени", () => {
  const mentioned = detectMentionedAgents("смотри @aminaakd_bot ставку");
  assertEquals(mentioned, ["amina"]);
  const next = nextPingFromReply("ок @saulexxx_bot глянь", new Set(["amina"]));
  assertEquals(next, "saule");
  const blocked = nextPingFromReply("ок @saulexxx_bot", new Set(["saule"]));
  assertEquals(blocked, null);
  assertEquals(
    nextPingFromReply("Антон, глянь остаток по фбс", new Set(["saule"])),
    "anton",
  );
  assertEquals(detectNamedAgents("Амине глянь рк"), ["amina"]);
  assertEquals(detectNamedAgents("Алине скинь"), ["alina"]);
  assertEquals(
    nextPingFromReply("Амина, глянь ставки", new Set(["saule"])),
    "amina",
  );
  assertEquals(
    nextPingFromReply("Амине, глянь ставки", new Set(["saule"])),
    "amina",
  );
});

Deno.test("Готово без пинга останавливает цепочку", () => {
  assertEquals(isDoneReply("Факты такие.\nГотово."), true);
  assertEquals(isDoneReply("Готово"), true);
  assertEquals(isDoneReply("Нужен @aminaakd_bot\nГотово."), false);
  assertEquals(isDoneReply("Антон, глянь остаток"), false);
  assertEquals(isDoneReply("цифры выше\nпока так"), true);
  assertEquals(isDoneReply("норм"), true);
});

Deno.test("clampHops защищает от NaN", () => {
  assertEquals(clampHops("abc", 3), 3);
  assertEquals(clampHops(0, 3), 3);
  assertEquals(clampHops(9, 3), 5);
  assertEquals(clampHops(2, 3), 2);
});

Deno.test("имя Муха ловится без ложных слов", () => {
  const plan = buildTeamPlan("Муха, нужен визуал карточки", undefined, 3);
  assert(plan.includes("muha"));
});
