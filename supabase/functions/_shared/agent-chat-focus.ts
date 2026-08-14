/**
 * Фокус тимчата: пока общаемся с одним агентом — остальные молчат.
 * Хранится в agent_pending_actions (action_type=chat_focus, status=executing),
 * чтобы не требовать отдельную DDL при деплое.
 */

import { getAdminClient } from './supabase-admin.ts';

const DEFAULT_TTL_MIN = 12;
export const CHAT_FOCUS_ACTION = 'chat_focus';

function admin() {
  return getAdminClient();
}

/** Последний товар с ценами — для follow-up «а до скидки?» без названия. */
export type LastProductFocus = {
  vendorCode: string;
  title?: string | null;
  nmId?: number | null;
  cabinetId?: string | null;
  cabinetName?: string | null;
  price?: number | null;
  discountedPrice?: number | null;
  discountPct?: number | null;
};

export type ChatFocus = {
  chat_id: number;
  agent_key: string;
  reason?: string | null;
  expires_at: string;
  lastProduct?: LastProductFocus | null;
};

type FocusPayload = {
  reason?: string;
  lastProduct?: LastProductFocus | null;
};

function readLastProduct(payload: unknown): LastProductFocus | null {
  const p = (payload as FocusPayload | null)?.lastProduct;
  if (!p || typeof p !== 'object') return null;
  const vendorCode = String(p.vendorCode || '').trim();
  if (!vendorCode) return null;
  return {
    vendorCode,
    title: p.title ?? null,
    nmId: p.nmId == null ? null : Number(p.nmId),
    cabinetId: p.cabinetId ?? null,
    cabinetName: p.cabinetName ?? null,
    price: p.price == null ? null : Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
    discountPct: p.discountPct == null ? null : Number(p.discountPct),
  };
}

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
  const payload = data.payload as FocusPayload | null;
  const reason = payload?.reason || null;
  return {
    chat_id: Number(data.chat_id),
    agent_key: String(data.agent_key),
    reason,
    expires_at: String(data.expires_at),
    lastProduct: readLastProduct(payload),
  };
}

export async function setChatFocus(
  chatId: number,
  agentKey: string,
  reason = 'dialog',
  ttlMin = DEFAULT_TTL_MIN,
  opts?: { lastProduct?: LastProductFocus | null },
): Promise<void> {
  if (!agentKey || !chatId) return;
  const db = admin();
  const expires = new Date(Date.now() + Math.max(2, ttlMin) * 60_000).toISOString();
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from('agent_pending_actions')
    .select('id, payload')
    .eq('chat_id', chatId)
    .eq('action_type', CHAT_FOCUS_ACTION)
    .eq('status', 'executing')
    .limit(1)
    .maybeSingle();

  const prevProduct = readLastProduct(existing?.payload);
  const lastProduct = opts && 'lastProduct' in opts
    ? opts.lastProduct
    : prevProduct;
  const payload: FocusPayload = {
    reason,
    ...(lastProduct ? { lastProduct } : {}),
  };

  if (existing?.id) {
    await db
      .from('agent_pending_actions')
      .update({
        agent_key: agentKey,
        payload,
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
    payload,
    expires_at: expires,
    created_at: now,
    updated_at: now,
  });
}

/** Запомнить товар/цены в фокусе чата (не сбрасывая агента). */
export async function rememberLastProduct(
  chatId: number,
  agentKey: string,
  product: LastProductFocus,
  ttlMin = 20,
): Promise<void> {
  if (!chatId || !product?.vendorCode) return;
  await setChatFocus(chatId, agentKey, 'last_product', ttlMin, {
    lastProduct: product,
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

const lastSweepByChat = new Map<number, number>();

/** Протухшие focus/pending → expired (throttle 60с/чат). */
export async function sweepExpiredPendings(chatId?: number): Promise<void> {
  if (chatId) {
    const prev = lastSweepByChat.get(chatId) || 0;
    if (Date.now() - prev < 60_000) return;
    lastSweepByChat.set(chatId, Date.now());
  }
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
 * Смена собеседника: фокус на нового агента + сброс чужих диалогов.
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

/** Короткая реплика-продолжение диалога (товар / число / да-нет). */
export function isLikelyFollowUp(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || t.length > 80) return false;
  if (/^(отмена|отменить|cancel|стоп|нет|не надо)$/i.test(t)) return true;
  if (/^(да|ага|угу|ок|ok|хорошо|давай)$/i.test(t)) return true;
  if (
    /^\d[\d\s]{0,8}$/.test(t.replace(/\s/g, '')) ||
    /^на\s+\d[\d\s]{0,8}\s*(₽|руб|р\.?)?$/i.test(t) ||
    /^(до|после)(\s+скидк[аиу])?\s+\d{3,7}/i.test(t) ||
    /^(а\s+)?до\s*скидк/i.test(t) ||
    /^(старая|полная|базовая)\s*цен/i.test(t) ||
    /^без\s*скидк/i.test(t)
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
  if (/сводн|в\s+сводн|эти\s+данн.*(таблиц|сводн)|дай.*(таблиц|сводн)/i.test(t)) {
    return true;
  }
  return false;
}
