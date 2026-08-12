// Алина · бартер / кэшбек с рабочего аккаунта (Telegram Business).
// Голос = менеджер аккаунта, не «бот Алина». ТЗ + ключ + скрины → таблица.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  MSG_APPROVED_CART,
  MSG_APPROVED_PRODUCT,
  MSG_ASK_BANK_BARTER,
  MSG_ASK_BANK_CASHBACK,
  MSG_ASK_PICKUP,
  MSG_ASK_REELS,
  MSG_ASK_REVIEW,
  MSG_CLOSED,
  MSG_CLOSED_FULL,
  MSG_NEED_TYPE,
  msgKey,
  msgOpenBarter,
  msgOpenCashback,
  TZ_CASHBACK,
  tzBarter,
} from './alina-templates.ts';

export type SelfbuyStatus =
  | 'new'
  | 'ask_type'
  | 'tz_sent'
  | 'key_sent'
  | 'wait_product'
  | 'wait_cart'
  | 'wait_order'
  | 'wait_bank'
  | 'wait_pickup'
  | 'wait_review'
  | 'wait_reels'
  | 'done'
  | 'closed'
  | 'paused';

export type DealType = 'cashback' | 'barter';

export type SelfbuyLead = {
  id: string;
  telegram_user_id: number;
  chat_id: number;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  order_received_at: string | null;
  review_planned_at: string | null;
  bank_details: string | null;
  status: SelfbuyStatus;
  source_account: string;
  sheet_row: number | null;
  notes?: string | null;
  deal_type?: DealType | null;
  keyword?: string | null;
  cashback_pct?: number | null;
  product_name?: string | null;
  order_price?: string | null;
  pickup_at?: string | null;
  review_note?: string | null;
  reels_url?: string | null;
  screens_done?: string | null;
  last_client_text?: string | null;
};

export type AlinaReply = { replies: string[] };

export type Campaign = {
  id: string;
  is_open: boolean;
  deal_type: 'cashback' | 'barter' | 'both';
  product_name: string | null;
  keyword: string | null;
  cashback_pct: number | null;
  slots_left: number | null;
  order_deadline: string | null;
  notes: string | null;
};

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

function r(...parts: string[]): AlinaReply {
  return { replies: parts.filter(Boolean) };
}

/** Чаты, где Алина ведёт клиентов (канал/группа/второй акк). */
export function getAlinaClientChatIds(): Set<number> {
  const raw = (Deno.env.get('ALINA_CLIENT_CHAT_IDS') || '').trim();
  const ids = new Set<number>();
  for (const p of raw.split(/[,\s]+/).filter(Boolean)) {
    const n = Number(p);
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

function getTeamChatIds(): Set<number> {
  const raw = (Deno.env.get('AGENT_TEAM_CHAT_IDS') || Deno.env.get('TELEGRAM_TEAM_CHAT_ID') || '').trim();
  const ids = new Set<number>();
  ids.add(-1004460164885);
  for (const p of raw.split(/[,\s]+/).filter(Boolean)) {
    const n = Number(p);
    if (Number.isFinite(n)) ids.add(n);
  }
  return ids;
}

export function isAlinaClientContext(chat: {
  id: number;
  type?: string;
}): boolean {
  const id = Number(chat.id);
  if (getTeamChatIds().has(id)) return false;
  if (chat.type === 'private') return true;
  return getAlinaClientChatIds().has(id);
}

/**
 * В business private-чате chat.id = клиент.
 * Сообщения с рабочего аккаунта (from.id !== chat.id) не обрабатываем как заявки.
 */
export function isBusinessOwnerMessage(message: {
  chat?: { id?: number; type?: string };
  from?: { id?: number };
}): boolean {
  const chatId = Number(message.chat?.id);
  const fromId = Number(message.from?.id);
  if (!Number.isFinite(chatId) || !Number.isFinite(fromId)) return false;
  if (message.chat?.type && message.chat.type !== 'private') return false;
  return fromId !== chatId;
}

export async function getCampaign(): Promise<Campaign | null> {
  const db = admin();
  const { data } = await db
    .from('alina_campaign')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Campaign) || null;
}

/** Команды оффера из тимчата: «алина оффер …» */
export async function tryAlinaOfferCommand(text: string): Promise<string | null> {
  const t = text.trim();
  if (!/^(алина\s+)?оффер\b/i.test(t) && !/^\/offer\b/i.test(t)) return null;

  const db = admin();
  const lower = t.toLowerCase();

  if (/\b(закр|закрыт|стоп|off|ended)\b/i.test(lower)) {
    await upsertCampaign(db, { is_open: false, slots_left: 0 });
    return 'Оффер закрыт. Клиентам: «на сегодня раздачи закончены».';
  }

  const patch: Record<string, unknown> = {
    is_open: true,
    updated_at: new Date().toISOString(),
  };

  if (/\bбартер\b/i.test(t) && /\bкэш\b|\bкеш\b|\bcashback\b/i.test(t)) {
    patch.deal_type = 'both';
  } else if (/\bбартер\b/i.test(t)) {
    patch.deal_type = 'barter';
  } else if (/\bкэш|\bкеш|cashback|самовыкуп/i.test(t)) {
    patch.deal_type = 'cashback';
  }

  const pct = t.match(/(\d{2,3})\s*%/);
  if (pct) patch.cashback_pct = Number(pct[1]);

  const slots = t.match(/слот(?:ы|ов)?\s*[:=]?\s*(\d+)/i) ||
    t.match(/мест(?:а|о)?\s*[:=]?\s*(\d+)/i);
  if (slots) patch.slots_left = Number(slots[1]);

  const key = t.match(/ключ\s*[:=]\s*[«"]?([^«»"\n]+)[»"]?/i);
  if (key) patch.keyword = key[1].trim();

  const product = t.match(/товар\s*[:=]\s*(.+?)(?:\s+ключ\s*[:=]|\s+слот|\s+мест|$)/i);
  if (product) patch.product_name = product[1].trim();

  const deadline = t.match(/срок\s*[:=]\s*(.+?)(?:\s+ключ\s*[:=]|\s+товар\s*[:=]|$)/i);
  if (deadline) patch.order_deadline = deadline[1].trim();

  if (/\bоткрыт|open|актуальн/i.test(lower)) patch.is_open = true;

  const camp = await upsertCampaign(db, patch);
  return [
    'Оффер обновлён:',
    `открыт: ${camp.is_open ? 'да' : 'нет'}`,
    `тип: ${camp.deal_type}`,
    `товар: ${camp.product_name || '—'}`,
    `ключ: ${camp.keyword || '—'}`,
    `кэшбек: ${camp.cashback_pct ?? '—'}%`,
    `мест: ${camp.slots_left ?? '—'}`,
    `срок: ${camp.order_deadline || '—'}`,
  ].join('\n');
}

async function upsertCampaign(
  db: SupabaseClient,
  patch: Record<string, unknown>,
): Promise<Campaign> {
  const existing = await getCampaign();
  if (existing?.id) {
    const { data, error } = await db
      .from('alina_campaign')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Campaign;
  }
  const { data, error } = await db
    .from('alina_campaign')
    .insert({ is_open: false, deal_type: 'cashback', cashback_pct: 70, slots_left: 0, ...patch })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function handleAlinaClientMessage(opts: {
  chatId: number;
  userId: number;
  username?: string;
  fullName?: string;
  text: string;
  hasPhoto?: boolean;
  sourceAccount?: string;
}): Promise<AlinaReply> {
  const db = admin();
  const source = opts.sourceAccount || 'main';
  const text = (opts.text || '').trim();
  const hasPhoto = Boolean(opts.hasPhoto);
  const camp = await getCampaign();

  let lead = await getOrCreateLead(db, opts, source);

  // Пауза
  if (/^(стоп|pause|пауза)$/i.test(text)) {
    await updateLead(db, lead.id, { status: 'paused', last_client_text: text });
    return r('Ок, на паузе. Напишите «продолжить», когда будете готовы 🙌');
  }
  if (/^(продолжить|start|старт)$/i.test(text) && lead.status === 'paused') {
    const next = resumeStatus(lead);
    await updateLead(db, lead.id, { status: next });
    return r(...resumeHints(lead, next, camp));
  }
  if (lead.status === 'paused') {
    return r('Диалог на паузе. Напишите «продолжить».');
  }

  // Запрос ТЗ / ключа в любой момент
  if (wantsTz(text)) {
    const deal = (lead.deal_type || resolveDealFromCampaign(camp) || 'cashback') as DealType;
    return r(...tzBundle(deal, camp, lead));
  }
  if (wantsKey(text)) {
    return await sendKeyFlow(db, lead, camp, text);
  }

  // Закрытый оффер для новых
  if (
    ['new', 'ask_type', 'closed'].includes(lead.status) &&
    !campaignAccepting(camp) &&
    !lead.deal_type
  ) {
    await updateLead(db, lead.id, {
      status: 'closed',
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
      full_name: opts.fullName || lead.full_name,
      username: opts.username || lead.username,
    });
    await logEvent(db, lead.id, opts.chatId, 'closed_no_slots', { text });
    return r(MSG_CLOSED);
  }

  // ── new: интерес ─────────────────────────────────────────────────────────
  if (lead.status === 'new' || lead.status === 'closed') {
    const typed = detectDealType(text) || resolveDealFromCampaign(camp);
    await updateLead(db, lead.id, {
      full_name: opts.fullName || lead.full_name,
      username: opts.username || lead.username,
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
      product_name: camp?.product_name || lead.product_name,
      cashback_pct: camp?.cashback_pct ?? lead.cashback_pct,
    });
    await logEvent(db, lead.id, opts.chatId, 'interest', { text, hasPhoto });

    if (!campaignAccepting(camp)) {
      await updateLead(db, lead.id, { status: 'closed' });
      return r(MSG_CLOSED);
    }

    if (camp && (camp.slots_left ?? 0) <= 0 && camp.is_open) {
      await updateLead(db, lead.id, { status: 'closed' });
      return r(MSG_CLOSED_FULL);
    }

    if (!typed && camp?.deal_type === 'both') {
      await updateLead(db, lead.id, { status: 'ask_type' });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_NEED_TYPE);
    }

    const deal = (typed || (camp?.deal_type === 'barter' ? 'barter' : 'cashback')) as DealType;
    return await openDeal(db, lead, camp, deal, text);
  }

  // ── ask_type ─────────────────────────────────────────────────────────────
  if (lead.status === 'ask_type') {
    const typed = detectDealType(text);
    if (!typed) return r(MSG_NEED_TYPE);
    return await openDeal(db, lead, camp, typed, text);
  }

  // ── tz_sent: ждём «ключ» или скрин/готовность ────────────────────────────
  if (lead.status === 'tz_sent') {
    if (wantsKey(text) || /готов|ознаком|прочитал|понял|ок\b|хорошо/i.test(text)) {
      return await sendKeyFlow(db, lead, camp, text);
    }
    if (hasPhoto) {
      await updateLead(db, lead.id, {
        status: 'wait_product',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT);
    }
    return r(
      'После ТЗ напишите «ключ» — вышлю запрос для поиска.\n' +
        'Или сразу пришлите скрин поиска с нашим товаром.',
    );
  }

  // ── key_sent / wait_product ──────────────────────────────────────────────
  if (lead.status === 'key_sent' || lead.status === 'wait_product') {
    if (wantsKey(text)) return await sendKeyFlow(db, lead, camp, text);
    if (hasPhoto || /скрин|нашла|нашёл|наш товар|это он|артикул/i.test(text)) {
      await updateLead(db, lead.id, {
        status: 'wait_cart',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT);
    }
    return r('Жду скрин: строка поиска (наш ключ) + наш товар в выдаче 🙌');
  }

  // ── wait_cart ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_cart') {
    if (hasPhoto || /корзин|конкурент|избранн/i.test(text)) {
      await updateLead(db, lead.id, {
        status: 'wait_order',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'cart'),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_cart', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_CART);
    }
    return r('Нужен скрин корзины: наш товар + 2–3 конкурента и бренд в избранном ❤️');
  }

  // ── wait_order ───────────────────────────────────────────────────────────
  if (lead.status === 'wait_order') {
    if (hasPhoto || /заказ|оформил|выкуп|пвз|доставк/i.test(text)) {
      await updateLead(db, lead.id, {
        status: 'wait_bank',
        order_received_at: text.slice(0, 300) || new Date().toISOString().slice(0, 10),
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'order'),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_order', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      const bankMsg = lead.deal_type === 'barter' ? MSG_ASK_BANK_BARTER : MSG_ASK_BANK_CASHBACK;
      return r(bankMsg);
    }
    return r('После оформления пришлите скрин заказа: цена, город/ПВЗ, дата получения.');
  }

  // ── wait_bank ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_bank') {
    if (hasPhoto && text.length < 8) {
      return r('Реквизиты текстом: телефон + ФИО + банк (СБП).');
    }
    if (text.length < 10 && !looksLikeBank(text)) {
      return r('Нужны реквизиты: номер телефона + ФИО + банк (СБП).');
    }
    await updateLead(db, lead.id, {
      bank_details: text.slice(0, 1000),
      status: 'wait_pickup',
      last_client_text: text,
    });
    await logEvent(db, lead.id, opts.chatId, 'bank_done', { text });
    await syncLeadToSheet(db, lead.id);
    return r('Реквизиты приняла ✅', MSG_ASK_PICKUP);
  }

  // ── wait_pickup ──────────────────────────────────────────────────────────
  if (lead.status === 'wait_pickup') {
    if (hasPhoto || /забрал|получил|пвз|сегодня|завтра|\d{1,2}[./]/i.test(text)) {
      await updateLead(db, lead.id, {
        pickup_at: text.slice(0, 200) || new Date().toISOString().slice(0, 10),
        status: 'wait_review',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'pickup'),
      });
      await logEvent(db, lead.id, opts.chatId, 'pickup', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_ASK_REVIEW);
    }
    return r('Как заберёте — напишите дату/скрин с ПВЗ.');
  }

  // ── wait_review ──────────────────────────────────────────────────────────
  if (lead.status === 'wait_review') {
    if (hasPhoto || /отзыв|текст|звёзд|звезд|соглас/i.test(text)) {
      const next = lead.deal_type === 'barter' ? 'wait_reels' : 'done';
      await updateLead(db, lead.id, {
        review_note: text.slice(0, 2000) || '[фото отзыва]',
        review_planned_at: new Date().toISOString().slice(0, 10),
        status: next,
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'review'),
      });
      await logEvent(db, lead.id, opts.chatId, 'review', { text, hasPhoto });
      await syncLeadToSheet(db, lead.id);
      if (next === 'wait_reels') return r('Отзыв на согласовании/принят 👍', MSG_ASK_REELS);
      return r(
        'Супер, зафиксировала ✅ Кэшбек — через 16 дней после получения при выполнении всех условий (отзыв, фото, разрезанные ШК).',
      );
    }
    return r(MSG_ASK_REVIEW);
  }

  // ── wait_reels (бартер) ──────────────────────────────────────────────────
  if (lead.status === 'wait_reels') {
    const url = text.match(/https?:\/\/\S+/i)?.[0];
    if (url || /рилс|reels|instagram|статистик/i.test(text) || hasPhoto) {
      await updateLead(db, lead.id, {
        reels_url: url || text.slice(0, 500),
        status: 'done',
        last_client_text: text || '[фото]',
      });
      await logEvent(db, lead.id, opts.chatId, 'reels', { text, hasPhoto, url });
      await syncLeadToSheet(db, lead.id);
      return r(
        'Рилс/статистику приняла ✅ Спасибо! Если нужно дополнить отзыв или сторис — напишите.',
      );
    }
    return r(MSG_ASK_REELS);
  }

  if (lead.status === 'done') {
    if (/^реквизит/i.test(text)) {
      const details = text.replace(/^реквизит[аы]?\s*:?\s*/i, '').trim();
      if (details.length < 8) {
        return r('Пришлите: телефон + ФИО + банк после слова «реквизиты:».');
      }
      await updateLead(db, lead.id, { bank_details: details.slice(0, 1000), last_client_text: text });
      await syncLeadToSheet(db, lead.id);
      return r('Реквизиты обновила ✅');
    }
    if (wantsTz(text)) {
      const deal = (lead.deal_type || 'cashback') as DealType;
      return r(...tzBundle(deal, camp, lead));
    }
    await updateLead(db, lead.id, {
      notes: `${lead.notes || ''}\n[+ ${text.slice(0, 200)}]`.trim(),
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
    });
    return r('Все этапы по вам уже в работе. Если нужно ТЗ/ключ/реквизиты — напишите.');
  }

  // fallback
  await updateLead(db, lead.id, { status: 'new', last_client_text: text });
  return r(campaignAccepting(camp) ? MSG_NEED_TYPE : MSG_CLOSED);
}

async function openDeal(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  deal: DealType,
  text: string,
): Promise<AlinaReply> {
  const pct = camp?.cashback_pct ?? 70;
  await updateLead(db, lead.id, {
    deal_type: deal,
    status: 'tz_sent',
    cashback_pct: deal === 'cashback' ? pct : null,
    product_name: camp?.product_name || lead.product_name,
    keyword: camp?.keyword || lead.keyword,
    last_client_text: text,
  });
  if (camp?.id && (camp.slots_left ?? 0) > 0) {
    await db
      .from('alina_campaign')
      .update({
        slots_left: Math.max(0, (camp.slots_left || 1) - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', camp.id);
  }
  await logEvent(db, lead.id, lead.chat_id, 'tz_sent', { deal });
  await syncLeadToSheet(db, lead.id);

  const intro = deal === 'barter'
    ? msgOpenBarter(camp?.product_name, camp?.order_deadline)
    : msgOpenCashback(pct, camp?.product_name);
  return r(intro, deal === 'barter' ? tzBarter(camp?.order_deadline) : TZ_CASHBACK);
}

async function sendKeyFlow(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  text: string,
): Promise<AlinaReply> {
  const keyword = (camp?.keyword || lead.keyword || Deno.env.get('ALINA_OFFER_KEYWORD') || '').trim();
  if (!keyword) {
    return r(
      'Ключ сейчас уточняю у команды — через пару минут пришлю. Можно пока ещё раз глянуть ТЗ (напишите «тз»).',
    );
  }
  await updateLead(db, lead.id, {
    keyword,
    status: lead.status === 'tz_sent' || lead.status === 'new' || lead.status === 'ask_type'
      ? 'key_sent'
      : lead.status === 'key_sent'
      ? 'key_sent'
      : lead.status,
    last_client_text: text,
  });
  await logEvent(db, lead.id, lead.chat_id, 'key_sent', { keyword });
  await syncLeadToSheet(db, lead.id);
  return r(msgKey(keyword));
}

function tzBundle(deal: DealType, camp: Campaign | null, lead: SelfbuyLead): string[] {
  if (deal === 'barter') {
    return [
      'ТЗ ещё раз 👇',
      tzBarter(camp?.order_deadline || null),
    ];
  }
  const pct = lead.cashback_pct || camp?.cashback_pct || 70;
  return [
    `ТЗ по кэшбеку ${pct}% ещё раз 👇`,
    TZ_CASHBACK,
  ];
}

function campaignAccepting(camp: Campaign | null): boolean {
  if (!camp) {
    // env fallback
    const open = (Deno.env.get('ALINA_OFFER_OPEN') || '').trim();
    return open === '1' || /^true|yes|open$/i.test(open);
  }
  return Boolean(camp.is_open) && (camp.slots_left == null || camp.slots_left > 0);
}

function resolveDealFromCampaign(camp: Campaign | null): DealType | null {
  if (!camp) {
    const t = (Deno.env.get('ALINA_OFFER_TYPE') || 'cashback').toLowerCase();
    if (t === 'barter') return 'barter';
    if (t === 'both') return null;
    return 'cashback';
  }
  if (camp.deal_type === 'both') return null;
  if (camp.deal_type === 'barter') return 'barter';
  return 'cashback';
}

function detectDealType(text: string): DealType | null {
  const t = text.toLowerCase();
  if (/бартер|блогер|рилс|reels|интеграц/i.test(t)) return 'barter';
  if (/кэш|кеш|cashback|самовыкуп|отзыв.*выкуп|выкуп.*отзыв|раздач/i.test(t)) {
    return 'cashback';
  }
  return null;
}

function wantsTz(text: string): boolean {
  return /^(тз|tz|инструкц|условия|ознаком)/i.test(text) ||
    /\b(пришли|скинь|ещё раз|еще раз).{0,20}(тз|инструкц)/i.test(text);
}

function wantsKey(text: string): boolean {
  return /^(ключ|ключев|запрос)\b/i.test(text) ||
    /\b(дай|пришли|скинь|нужен).{0,15}ключ/i.test(text) ||
    /ключево(е|й)\s+(слово|запрос)/i.test(text);
}

function looksLikeBank(text: string): boolean {
  return /(\+?\d[\d\s\-()]{8,}|\d{10,})/.test(text) &&
    /(фио|банк|сбп|тинькоф|сбер|альфа|втб|озон)/i.test(text);
}

function appendScreen(prev: string | null | undefined, name: string): string {
  const parts = String(prev || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.includes(name)) parts.push(name);
  return parts.join(',');
}

function resumeStatus(lead: SelfbuyLead): SelfbuyStatus {
  if (!lead.deal_type) return 'ask_type';
  if (!lead.keyword && lead.status !== 'tz_sent') return 'tz_sent';
  if (!lead.bank_details) {
    if ((lead.screens_done || '').includes('order')) return 'wait_bank';
    if ((lead.screens_done || '').includes('cart')) return 'wait_order';
    if ((lead.screens_done || '').includes('product')) return 'wait_cart';
    if (lead.keyword) return 'key_sent';
    return 'tz_sent';
  }
  if (!lead.pickup_at) return 'wait_pickup';
  if (!lead.review_note) return 'wait_review';
  if (lead.deal_type === 'barter' && !lead.reels_url) return 'wait_reels';
  return 'done';
}

function resumeHints(
  lead: SelfbuyLead,
  status: SelfbuyStatus,
  camp: Campaign | null,
): string[] {
  switch (status) {
    case 'ask_type':
      return [MSG_NEED_TYPE];
    case 'tz_sent':
      return tzBundle((lead.deal_type || 'cashback') as DealType, camp, lead);
    case 'key_sent':
    case 'wait_product':
      return ['Продолжаем: скрин поиска с ключом и нашим товаром.'];
    case 'wait_cart':
      return [MSG_APPROVED_PRODUCT];
    case 'wait_order':
      return [MSG_APPROVED_CART];
    case 'wait_bank':
      return [lead.deal_type === 'barter' ? MSG_ASK_BANK_BARTER : MSG_ASK_BANK_CASHBACK];
    case 'wait_pickup':
      return [MSG_ASK_PICKUP];
    case 'wait_review':
      return [MSG_ASK_REVIEW];
    case 'wait_reels':
      return [MSG_ASK_REELS];
    default:
      return ['Продолжаем 🙌'];
  }
}

async function getOrCreateLead(
  db: SupabaseClient,
  opts: {
    chatId: number;
    userId: number;
    username?: string;
    fullName?: string;
  },
  source: string,
): Promise<SelfbuyLead> {
  const { data: existing } = await db
    .from('alina_selfbuy_leads')
    .select('*')
    .eq('telegram_user_id', opts.userId)
    .eq('chat_id', opts.chatId)
    .maybeSingle();
  if (existing) return existing as SelfbuyLead;

  const { data: created, error } = await db
    .from('alina_selfbuy_leads')
    .insert({
      telegram_user_id: opts.userId,
      chat_id: opts.chatId,
      username: opts.username || null,
      full_name: opts.fullName || null,
      status: 'new',
      source_account: source,
    })
    .select('*')
    .single();
  if (error) throw new Error(`alina lead insert: ${error.message}`);
  return created as SelfbuyLead;
}

async function updateLead(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await db
    .from('alina_selfbuy_leads')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`alina lead update: ${error.message}`);
}

async function logEvent(
  db: SupabaseClient,
  leadId: string | null,
  chatId: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  await db.from('alina_selfbuy_events').insert({
    lead_id: leadId,
    chat_id: chatId,
    event_type: eventType,
    payload,
  });
}

export async function logAlinaRawEvent(
  chatId: number,
  eventType: string,
  payload: Record<string, unknown>,
  leadId?: string | null,
) {
  try {
    await logEvent(admin(), leadId || null, chatId, eventType, payload);
  } catch (e) {
    console.error('[alina-selfbuy] log raw', e);
  }
}

export async function alinaRecentDialogs(limit = 20): Promise<Record<string, unknown>> {
  const db = admin();
  const camp = await getCampaign();
  const { data: leads, error: le } = await db
    .from('alina_selfbuy_leads')
    .select(
      'id, telegram_user_id, chat_id, username, full_name, status, deal_type, source_account, keyword, cashback_pct, product_name, order_received_at, pickup_at, bank_details, review_note, reels_url, screens_done, last_client_text, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (le) return { ok: false, error: le.message };

  const ids = (leads || []).map((l) => l.id);
  let events: unknown[] = [];
  if (ids.length) {
    const { data: ev } = await db
      .from('alina_selfbuy_events')
      .select('id, lead_id, chat_id, event_type, payload, created_at')
      .in('lead_id', ids)
      .order('created_at', { ascending: true })
      .limit(500);
    events = ev || [];
  }

  const { data: raw } = await db
    .from('alina_selfbuy_events')
    .select('id, lead_id, chat_id, event_type, payload, created_at')
    .in('event_type', [
      'business_connection',
      'business_in',
      'business_out',
      'business_skip',
    ])
    .order('created_at', { ascending: false })
    .limit(50);

  return { ok: true, campaign: camp, leads: leads || [], events, recent_business: raw || [] };
}

export async function alinaSelfbuyStatsText(): Promise<string> {
  const db = admin();
  const camp = await getCampaign();
  const { data, error } = await db
    .from('alina_selfbuy_leads')
    .select('status, source_account, deal_type, created_at');
  if (error) return `Не удалось прочитать таблицу: ${error.message}`;
  const rows = data || [];
  const total = rows.length;
  const done = rows.filter((r) => r.status === 'done').length;
  const inProgress = rows.filter((r) =>
    !['done', 'closed', 'paused'].includes(String(r.status))
  ).length;
  const cashback = rows.filter((r) => r.deal_type === 'cashback').length;
  const barter = rows.filter((r) => r.deal_type === 'barter').length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => String(r.created_at).slice(0, 10) === today).length;

  return [
    'Алина · бартер / кэшбек',
    `Оффер: ${camp?.is_open ? 'открыт' : 'закрыт'} · ${camp?.deal_type || '—'} · мест ${camp?.slots_left ?? '—'}`,
    `Товар: ${camp?.product_name || '—'}`,
    `Ключ: ${camp?.keyword || '—'}`,
    `Всего заявок: ${total} (в работе ${inProgress}, готово ${done})`,
    `кэшбек: ${cashback} · бартер: ${barter} · сегодня: ${todayCount}`,
    'Команда: алина оффер открыт кэшбек 70 слоты:5 ключ: … товар: …',
    'Закрыть: алина оффер закрыт',
  ].join('\n');
}

export function isAlinaStatsQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (/^(алина\s+)?оффер\b/i.test(text) || /^\/offer\b/i.test(text)) return false;
  const asksCount = t.includes('сколько') || t.includes('статус') || t.includes('итог');
  if (!asksCount) return false;
  return (
    t.includes('самовыкуп') ||
    t.includes('лид') ||
    t.includes('кэш') ||
    t.includes('кеш') ||
    t.includes('бартер') ||
    (t.includes('клиент') && (t.includes('алин') || t.includes('выкуп'))) ||
    (t.includes('алин') && t.includes('статус'))
  );
}

// ── Google Sheets ───────────────────────────────────────────────────────────

async function syncLeadToSheet(db: SupabaseClient, leadId: string) {
  const sheetId = (Deno.env.get('ALINA_SHEET_ID') || '').trim();
  const saJson = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '').trim();
  if (!sheetId || !saJson) {
    console.log('[alina-selfbuy] sheets skip: no ALINA_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON');
    return;
  }

  const { data: lead } = await db.from('alina_selfbuy_leads').select('*').eq('id', leadId)
    .maybeSingle();
  if (!lead) return;

  try {
    const token = await googleAccessToken(saJson);
    // вид | TG | username | имя | статус | ключ | заказ | забор | отзыв | реквизиты | кэш% | рилс | chat
    const values = [[
      lead.deal_type || '',
      String(lead.telegram_user_id),
      lead.username || '',
      lead.full_name || '',
      lead.status,
      lead.keyword || '',
      lead.order_received_at || '',
      lead.pickup_at || '',
      lead.review_note || '',
      lead.bank_details || '',
      lead.cashback_pct != null ? String(lead.cashback_pct) : '',
      lead.reels_url || '',
      String(lead.chat_id),
      lead.product_name || '',
      lead.screens_done || '',
      lead.updated_at || lead.created_at,
    ]];

    if (lead.sheet_row) {
      const range = `Sheet1!A${lead.sheet_row}:P${lead.sheet_row}`;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${
          encodeURIComponent(range)
        }?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        },
      );
      if (!res.ok) console.error('[alina-selfbuy] sheet update', await res.text());
      return;
    }

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      },
    );
    const body = await res.json();
    if (!res.ok) {
      console.error('[alina-selfbuy] sheet append', JSON.stringify(body).slice(0, 300));
      return;
    }
    const updated = String(body?.updates?.updatedRange || '');
    const m = updated.match(/![A-Z]+(\d+)/);
    if (m) {
      await db.from('alina_selfbuy_leads').update({ sheet_row: Number(m[1]) }).eq('id', leadId);
    }
  } catch (e) {
    console.error('[alina-selfbuy] sheet sync', e);
  }
}

async function googleAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64url = (bytes: Uint8Array) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = await importPkcs8(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`google token: ${JSON.stringify(data).slice(0, 200)}`);
  return data.access_token as string;
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}
