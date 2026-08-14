/**
 * Review moderation stubs — keep telegram-webhook deployable.
 * Full moderation UI can be restored later; AB/sales paths must not crash on import.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const REVIEW_BATCH_SIZE = 5;

export function moderationKeyboard(_id: string): unknown {
  return { inline_keyboard: [] };
}

export function footerPending(_x: string): string {
  return '⏳ на модерации';
}
export function footerEditing(): string {
  return '✏️ редактирование';
}
export function footerPublished(): string {
  return '✅ опубликовано';
}
export function footerRejected(): string {
  return '❌ отклонено';
}

export function isModerationPanelMessage(_msg: unknown): boolean {
  return false;
}

export async function findEditingByMessage(
  _admin: SupabaseClient,
  _chatId: string,
  _msgId: number,
): Promise<{ id: string } | null> {
  return null;
}

export async function applyEditedReply(
  _admin: SupabaseClient,
  _id: string,
  _text: string,
  _userId: number,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'модерация отзывов временно недоступна' };
}

export async function approveAndPublish(
  _admin: SupabaseClient,
  _id: string,
  _userId: number,
  _userName: string,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'модерация отзывов временно недоступна' };
}

export async function approveAllPending(
  _admin: SupabaseClient,
  _userId: number,
  _userName: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  return { ok: false, error: 'модерация отзывов временно недоступна' };
}

export async function rejectReview(
  _admin: SupabaseClient,
  _id: string,
  _userId: number,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'модерация отзывов временно недоступна' };
}

export async function startEditing(
  _admin: SupabaseClient,
  _id: string,
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'модерация отзывов временно недоступна' };
}

export async function loadReviewLog(
  _admin: SupabaseClient,
  _id: string,
): Promise<Record<string, unknown> | null> {
  return null;
}

export async function upsertModerationPanel(
  _admin: SupabaseClient,
  _token: string,
  _chatId: string,
  _messageIdOrPayload?: unknown,
  _payload?: unknown,
): Promise<void> {}

export async function upsertReviewCardFromLog(
  ..._args: unknown[]
): Promise<number | null> {
  return null;
}
