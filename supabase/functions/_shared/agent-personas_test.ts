import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  agentPromptForTurn,
  AGENT_PROMPTS,
  AGENT_ROLE_CARDS,
} from "./agent-personas.ts";
import { nextPingFromReply, isDoneReply } from "./agent-team.ts";

Deno.test("hop prompt намного короче lead", () => {
  const lead = agentPromptForTurn("saule", "lead");
  const hop = agentPromptForTurn("saule", "hop");
  assert(hop.length < lead.length);
  assert(hop.length < lead.length * 0.55);
  assert(!hop.includes("ФОРМАТЫ"));
  assert(lead.includes("ФОРМАТЫ") || lead.includes("СРАЗУ ЦИФРА"));
});

Deno.test("AGENT_PROMPTS совместим с lead", () => {
  for (const key of Object.keys(AGENT_ROLE_CARDS)) {
    assertEquals(AGENT_PROMPTS[key], agentPromptForTurn(key, "lead"));
  }
});

Deno.test("nextPingFromReply только адресная форма имени", () => {
  assertEquals(
    nextPingFromReply("как сказала Сауле — тут слабо", new Set()),
    null,
  );
  assertEquals(
    nextPingFromReply("Антон, глянь остаток", new Set()),
    "anton",
  );
  assertEquals(
    nextPingFromReply("ок @aminaakd_bot", new Set()),
    "amina",
  );
});

Deno.test("isDoneReply не блокируется прозой с именем", () => {
  assertEquals(isDoneReply("По Сауле цифры ок.\nГотово."), true);
  assertEquals(isDoneReply("Антон, глянь\nГотово."), false);
});
