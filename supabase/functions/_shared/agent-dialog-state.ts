/**
 * Снимок диалога чата: focus + pending одним Promise.all.
 * Отдельный модуль — без циклических импортов focus ↔ actions.
 */

import { getChatFocus, type ChatFocus } from './agent-chat-focus.ts';
import { getActivePending, type PendingAction } from './agent-actions.ts';

export type ChatDialogState = {
  focus: ChatFocus | null;
  pending: PendingAction | null;
};

export async function getChatDialogState(chatId: number): Promise<ChatDialogState> {
  const [focus, pending] = await Promise.all([
    getChatFocus(chatId),
    getActivePending(chatId),
  ]);
  return { focus, pending };
}

/** Имена из @mention + «Сауле/Антон…» — один раз на сообщение. */
export function uniqueNamedAgents(
  text: string,
  detectMentioned: (t: string) => string[],
  detectNamed: (t: string) => string[],
): string[] {
  return [...new Set([...detectMentioned(text), ...detectNamed(text)])];
}

export function lockedAgentFromState(state: ChatDialogState): string | null {
  return state.pending?.agent_key || state.focus?.agent_key || null;
}

export function isFbsDialogPending(pending: PendingAction | null): boolean {
  return Boolean(
    pending &&
      pending.agent_key === 'anton' &&
      pending.action_type === 'fbs_stock',
  );
}

export function isPriceDialogPending(pending: PendingAction | null): boolean {
  return Boolean(
    pending &&
      pending.agent_key === 'saule' &&
      pending.action_type === 'price_change',
  );
}
