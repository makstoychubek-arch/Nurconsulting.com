/**
 * Фокус тимчата: пока общаемся с одним агентом — остальные молчат.
 * Хранится в agent_pending_actions (action_type=chat_focus, status=executing),
 * чтобы не требовать отдельную DDL при деплое.
 *
 * lastProduct / awaitQa живут в отдельной строке chat_sticky — иначе
 * setChatFocus(qa_reply) гонкой затирает товар после rememberLastProduct.
 */

import { getAdminClient } from './supabase-admin.ts';

const DEFAULT_TTL_MIN = 12;
export const CHAT_FOCUS_ACTION = 'chat_focus';
/** Товар + уточняющий QA — отдельно от фокуса агента (без гонок). */
export const CHAT_STICKY_ACTION = 'chat_sticky';

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

/** Уточнение после «Какой товар?» (артикул/цена/остаток). */
export type AwaitQaFocus = {
  kind: 'article' | 'price' | 'stock';
  mode?: 'before' | 'after' | 'both' | null;
  cabinetName?: string | null;
};

export type ChatFocus = {
  chat_id: number;
  agent_key: string;
  reason?: string | null;
  expires_at: string;
  lastProduct?: LastProductFocus | null;
  awaitQa?: AwaitQaFocus | null;
};

type FocusPayload = {
  reason?: string;
  /** legacy: раньше lastProduct жил здесь */
  lastProduct?: LastProductFocus | null;
};

type StickyPayload = {
  lastProduct?: LastProductFocus | null;
  awaitQa?: AwaitQaFocus | null;
};

function readLastProduct(payload: unknown): LastProductFocus | null {
  const p = (payload as { lastProduct?: LastProductFocus | null } | null)?.lastProduct;
  if (!p || typeof p !== 'object') return null;
  const nmId = p.nmId == null ? null : Number(p.nmId);
  const vendorCode = String(p.vendorCode || p.title || (nmId ? String(nmId) : ''))
    .trim();
  if (!vendorCode && !(nmId && nmId >= 100000)) return null;
  return {
    vendorCode: vendorCode || String(nmId),
    title: p.title ?? null,
    nmId: nmId == null || !Number.isFinite(nmId) ? null : nmId,
    cabinetId: p.cabinetId ?? null,
    cabinetName: p.cabinetName ?? null,
    price: p.price == null ? null : Number(p.price),
    discountedPrice: p.discountedPrice == null ? null : Number(p.discountedPrice),
    discountPct: p.discountPct == null ? null : Number(p.discountPct),
  };
}

function readAwaitQa(payload: unknown): AwaitQaFocus | null {
  const a = (payload as StickyPayload | null)?.awaitQa;
  if (!a || typeof a !== 'object') return null;
  if (a.kind !== 'article' && a.kind !== 'price' && a.kind !== 'stock') return null;
  return {
    kind: a.kind,
    mode: a.mode ?? null,
    cabinetName: a.cabinetName ?? null,
  };
}

async function loadStickyRow(chatId: number): Promise<{
  id: string;
  payload: StickyPayload;
  expires_at: string;
} | null> {
  const db = admin();
  const { data } = await db
    .from('agent_pending_actions')
    .select('id, payload, expires_at')
    .eq('chat_id', chatId)
    .eq('action_type', CHAT_STICKY_ACTION)
    .eq('status', 'executing')
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: String(data.id),
    payload: (data.payload || {}) as StickyPayload,
    expires_at: String(data.expires_at),
  };
}

async function upsertSticky(
  chatId: number,
  agentKey: string,
  patch: StickyPayload,
  ttlMin: number,
): Promise<void> {
  if (!chatId) return;
  const db = admin();
  const expires = new Date(Date.now() + Math.max(2, ttlMin) * 60_000).toISOString();
  const now = new Date().toISOString();
  const existing = await loadStickyRow(chatId);
  const prev = existing?.payload || {};
  const next: StickyPayload = { ...prev };

  if ('lastProduct' in patch) {
    if (patch.lastProduct) next.lastProduct = patch.lastProduct;
    else delete next.lastProduct;
  }
  if ('awaitQa' in patch) {
    if (patch.awaitQa) next.awaitQa = patch.awaitQa;
    else delete next.awaitQa;
  }

  if (existing?.id) {
    const { error } = await db
      .from('agent_pending_actions')
      .update({
        agent_key: agentKey || 'saule',
        payload: next,
        expires_at: expires,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) console.error('[chat-focus] sticky update', error.message);
    return;
  }

  const { error } = await db.from('agent_pending_actions').insert({
    chat_id: chatId,
    agent_key: agentKey || 'saule',
    action_type: CHAT_STICKY_ACTION,
    status: 'executing',
    payload: next,
    expires_at: expires,
    created_at: now,
    updated_at: now,
  });
  if (error) console.error('[chat-focus] sticky insert', error.message);
}

export async function getChatFocus(chatId: number): Promise<ChatFocus | null> {
  const db = admin();
  const nowIso = new Date().toISOString();
  const [focusRes, sticky] = await Promise.all([
    db
      .from('agent_pending_actions')
      .select('chat_id, agent_key, expires_at, payload')
      .eq('chat_id', chatId)
      .eq('action_type', CHAT_FOCUS_ACTION)
      .eq('status', 'executing')
      .gt('expires_at', nowIso)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadStickyRow(chatId),
  ]);

  const data = focusRes.data;
  const stickyProduct = readLastProduct(sticky?.payload);
  const legacyProduct = data ? readLastProduct(data.payload) : null;
  const lastProduct = stickyProduct || legacyProduct;
  const awaitQa = readAwaitQa(sticky?.payload);

  if (!data && !lastProduct && !awaitQa) return null;

  const payload = (data?.payload || {}) as FocusPayload;
  return {
    chat_id: Number(data?.chat_id || chatId),
    agent_key: String(data?.agent_key || 'saule'),
    reason: payload?.reason || null,
    expires_at: String(data?.expires_at || sticky?.expires_at || nowIso),
    lastProduct,
    awaitQa,
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

  // фокус агента без lastProduct — товар только в chat_sticky
  const payload: FocusPayload = { reason };

  if (existing?.id) {
    const { error } = await db
      .from('agent_pending_actions')
      .update({
        agent_key: agentKey,
        payload,
        expires_at: expires,
        updated_at: now,
      })
      .eq('id', existing.id);
    if (error) console.error('[chat-focus] focus update', error.message);
  } else {
    const { error } = await db.from('agent_pending_actions').insert({
      chat_id: chatId,
      agent_key: agentKey,
      action_type: CHAT_FOCUS_ACTION,
      status: 'executing',
      payload,
      expires_at: expires,
      created_at: now,
      updated_at: now,
    });
    if (error) console.error('[chat-focus] focus insert', error.message);
  }

  if (opts && 'lastProduct' in opts && opts.lastProduct) {
    await rememberLastProduct(chatId, agentKey, opts.lastProduct, ttlMin);
  }
}

/** Запомнить товар/цены (отдельная строка — не затирается qa_reply focus). */
export async function rememberLastProduct(
  chatId: number,
  agentKey: string,
  product: LastProductFocus,
  ttlMin = 20,
): Promise<void> {
  if (!chatId) return;
  const nmId = product?.nmId != null ? Number(product.nmId) : null;
  const vendorCode = String(
    product?.vendorCode || product?.title || (nmId ? String(nmId) : ''),
  ).trim();
  if (!vendorCode && !(nmId && nmId >= 100000)) return;
  await upsertSticky(chatId, agentKey, {
    lastProduct: {
      ...product,
      vendorCode: vendorCode || String(nmId),
      nmId,
    },
  }, ttlMin);
}

/** Ждём уточнение товара после «Какой товар?». */
export async function setAwaitQa(
  chatId: number,
  agentKey: string,
  awaitQa: AwaitQaFocus,
  ttlMin = 15,
): Promise<void> {
  if (!chatId || !awaitQa?.kind) return;
  await upsertSticky(chatId, agentKey, { awaitQa }, ttlMin);
}

export async function clearAwaitQa(chatId: number, agentKey = 'saule'): Promise<void> {
  if (!chatId) return;
  await upsertSticky(chatId, agentKey, { awaitQa: null }, 20);
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
  const { error } = await q;
  if (error) console.error('[chat-focus] sweep', error.message);
}

/**
 * Смена собеседника: фокус на нового агента + сброс чужих диалогов.
 * chat_sticky (товар) не трогаем.
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
    .neq('action_type', CHAT_STICKY_ACTION)
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
    /^без\s*скидк/i.test(t) ||
    /конкурент/i.test(t) ||
    /^(как|кк)\s+цен/i.test(t) ||
    /предлагаешь|посоветуешь|рекомендуешь|что\s+делать|что\s+с\s+ценой|вердикт/i
      .test(t)
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
