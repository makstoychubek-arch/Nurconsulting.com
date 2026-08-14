/**
 * Фокус тимчата: пока общаемся с одним агентом — остальные молчат.
 * Хранится в agent_pending_actions (action_type=chat_focus, status=executing),
 * чтобы не требовать отдельную DDL при деплое.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_TTL_MIN = 12;
export const CHAT_FOCUS_ACTION = 'chat_focus';

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export type ChatFocus = {
  chat_id: number;
  agent_key: string;
  reason?: string | null;
  expires_at: string;
};

export async function getChatFocus(chatId: number): Promise<ChatFocus | null> {
  const db = admin();
  const { data } = await db
    .from('agent_pending_actions')
    .select('chat_id, agent_key, expires_at, payload')
    .eq('chat_id', chatId)
    .eq('action_type', CHAT_FOCUS_ACTION)
    .eq('status', 'executing')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const reason = (data.payload as { reason?: string } | null)?.reason || null;
  return {
    chat_id: Number(data.chat_id),
    agent_key: String(data.agent_key),
    reason,
    expires_at: String(data.expires_at),
  };
}

export async function setChatFocus(
  chatId: number,
  agentKey: string,
  reason = 'dialog',
  ttlMin = DEFAULT_TTL_MIN,
): Promise<void> {
  if (!agentKey || !chatId) return;
  const db = admin();
  const expires = new Date(Date.now() + Math.max(2, ttlMin) * 60_000).toISOString();
  const now = new Date().toISOString();

  // одна активная focus-строка на чат
  const { data: existing } = await db
    .from('agent_pending_actions')
    .select('id')
    .eq('chat_id', chatId)
    .eq('action_type', CHAT_FOCUS_ACTION)
    .eq('status', 'executing')
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await db
      .from('agent_pending_actions')
      .update({
        agent_key: agentKey,
        payload: { reason },
        expires_at: expires,
        updated_at: now,
      })
      .eq('id', existing.id);
    return;
  }

  await db.from('agent_pending_actions').insert({
    chat_id: chatId,
    agent_key: agentKey,
    action_type: CHAT_FOCUS_ACTION,
    status: 'executing',
    payload: { reason },
    expires_at: expires,
    created_at: now,
    updated_at: now,
  });
}

export async function clearChatFocus(chatId: number): Promise<void> {
  const db = admin();
  await db
    .from('agent_pending_actions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId)
    .eq('action_type', CHAT_FOCUS_ACTION)
    .eq('status', 'executing');
}

/** Протухшие focus/pending → cancelled (чтобы не копить executing). */
export async function sweepExpiredPendings(chatId?: number): Promise<void> {
  const db = admin();
  const now = new Date().toISOString();
  let q = db
    .from('agent_pending_actions')
    .update({ status: 'expired', updated_at: now })
    .lt('expires_at', now)
    .in('status', ['awaiting_selection', 'awaiting_confirm', 'executing']);
  if (chatId) q = q.eq('chat_id', chatId);
  await q;
}

/**
 * Смена собеседника: фокус на нового агента + сброс чужих диалогов
 * (цена / FBS / РК), чтобы не залипать на старом pending.
 */
export async function switchChatFocus(
  chatId: number,
  agentKey: string,
  reason = 'switch',
  ttlMin = DEFAULT_TTL_MIN,
): Promise<void> {
  if (!agentKey || !chatId) return;
  const db = admin();
  const now = new Date().toISOString();
  await db
    .from('agent_pending_actions')
    .update({ status: 'cancelled', updated_at: now })
    .eq('chat_id', chatId)
    .neq('agent_key', agentKey)
    .neq('action_type', CHAT_FOCUS_ACTION)
    .in('status', ['awaiting_selection', 'awaiting_confirm']);
  await setChatFocus(chatId, agentKey, reason, ttlMin);
}

/** Короткая реплика-продолжение диалога (товар / число / да-нет), не новая тема. */
export function isLikelyFollowUp(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || t.length > 80) return false;
  if (/^(отмена|отменить|cancel|стоп|нет|не надо)$/i.test(t)) return true;
  if (/^(да|ага|угу|ок|ok|хорошо|давай)$/i.test(t)) return true;
  if (
    /^\d[\d\s]{0,8}$/.test(t.replace(/\s/g, '')) ||
    /^на\s+\d[\d\s]{0,8}\s*(₽|руб|р\.?)?$/i.test(t) ||
    /^(до|после)(\s+скидк[аиу])?\s+\d{3,7}/i.test(t)
  ) {
    return true;
  }
  if (
    /(блузк|лапш|водолазк|гольф|фонар|вырез|укороч|костюм|пиджак|жакет|жилет|^жл|бомбер|кимоно|плать|рубашк|кардиган|свитер|худи|юбк|двойк|спорт|велюр|комбинезон|оверсайз|фуфайк|черн|чёрн|бел|беж|бордо|графит|коричнев|темн|изумруд|хаки|пудр|молочн|кофе)/i
      .test(t)
  ) {
    return true;
  }
  if (/^\d{6,12}$/.test(t.replace(/\s/g, ''))) return true;
  return false;
}
