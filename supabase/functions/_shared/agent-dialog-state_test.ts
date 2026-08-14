import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isFbsDialogPending,
  isPriceDialogPending,
  lockedAgentFromState,
  uniqueNamedAgents,
  type ChatDialogState,
} from "./agent-dialog-state.ts";
import type { PendingAction } from "./agent-actions.ts";

Deno.test("uniqueNamedAgents dedups mentions + names", () => {
  const out = uniqueNamedAgents(
    "Сауле и @saule",
    () => ["saule"],
    () => ["saule"],
  );
  assertEquals(out, ["saule"]);
});

Deno.test("lockedAgentFromState prefers pending over focus", () => {
  const state: ChatDialogState = {
    focus: {
      chat_id: 1,
      agent_key: "karina",
      expires_at: new Date().toISOString(),
    },
    pending: {
      id: "x",
      chat_id: 1,
      agent_key: "saule",
      action_type: "price_change",
      status: "awaiting_selection",
      cabinet_id: null,
      cabinet_name: null,
      payload: {},
    } as PendingAction,
  };
  assertEquals(lockedAgentFromState(state), "saule");
});

Deno.test("isFbsDialogPending / isPriceDialogPending", () => {
  assertEquals(isFbsDialogPending(null), false);
  assertEquals(
    isFbsDialogPending({
      id: "1",
      chat_id: 1,
      agent_key: "anton",
      action_type: "fbs_stock",
      status: "awaiting_selection",
      cabinet_id: null,
      cabinet_name: null,
      payload: {},
    } as PendingAction),
    true,
  );
  assertEquals(
    isPriceDialogPending({
      id: "1",
      chat_id: 1,
      agent_key: "saule",
      action_type: "price_change",
      status: "awaiting_confirm",
      cabinet_id: null,
      cabinet_name: null,
      payload: {},
    } as PendingAction),
    true,
  );
});
