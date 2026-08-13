// Алина · бартер / кэшбек с рабочего аккаунта (Telegram Business).
// Голос = менеджер аккаунта, не «бот Алина». ТЗ + ключ + скрины → таблица.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  MSG_APPROVED_CART,
  MSG_APPROVED_PRODUCT,
  MSG_ASK_AD_AGAIN,
  MSG_ASK_BANK_BARTER,
  MSG_ASK_BANK_CASHBACK,
  MSG_ASK_FILTERS,
  MSG_ASK_PICKUP,
  MSG_ASK_REELS,
  MSG_ASK_REVIEW,
  MSG_CLOSED,
  MSG_CLOSED_FULL,
  MSG_GOT_IG,
  MSG_NEED_TYPE,
  msgAskAd,
  msgFiltersBatch,
  msgKey,
  msgOpenHuman,
  TZ_CASHBACK,
  tzBarter,
} from './alina-templates.ts';
import {
  extractSheetId,
  fetchSheetPlan,
  getOpenProductChoices,
  matchOfferFromText,
  syncCampaignFromSheet,
  type SheetPlanOffer,
} from './alina-sheet-plan.ts';
import {
  analyzeAlinaScreenshot,
  downloadTelegramFile,
  visionBlocks,
  visionRejectReply,
  type ScreenStage,
  type VisionResult,
} from './alina-vision.ts';
import { alinaBrain, shouldUseBrain } from './alina-brain.ts';
import {
  fetchWbMainPhoto,
  fetchWbSearchFilters,
  wantsProductPhoto,
  type WbFilter,
} from './alina-wb-photo.ts';

export type SelfbuyStatus =
  | 'new'
  | 'ask_ad'
  | 'ask_type'
  | 'ask_filters'
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

export type AlinaReply = {
  replies: string[];
  /** Главные фото с WB — router шлёт sendPhoto в этот же чат (лучше bytes) */
  photos?: {
    url?: string;
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  }[];
};

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
  article?: string | null;
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

function rPhoto(
  photo: {
    url?: string;
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
  },
  caption: string,
  ...extra: string[]
): AlinaReply {
  return {
    // текст только если фото не уйдёт — router добавит fallback
    replies: extra.filter(Boolean),
    photos: [{ ...photo, caption }],
  };
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

/** Подтянуть план раздач из Google Sheet → alina_campaign. */
export async function refreshAlinaFromSheet(): Promise<Record<string, unknown>> {
  try {
    const db = admin();
    const snap = await syncCampaignFromSheet(
      (patch) => upsertCampaign(db, patch),
      db,
    );
    const camp = await getCampaign();
    return { ...snap, campaign: camp };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Перед ответом клиенту — освежить слоты из таблицы (кэш 45с). */
async function ensureCampaignFresh(): Promise<Campaign | null> {
  try {
    const db = admin();
    await syncCampaignFromSheet((patch) => upsertCampaign(db, patch), db);
  } catch (e) {
    console.error('[alina-selfbuy] sheet refresh', e);
  }
  return await getCampaign();
}

/**
 * Привязать/включить таблицу кабинета:
 *   алина таблица elium https://docs.google.com/spreadsheets/d/...
 *   алина кабинет elium
 */
export async function tryAlinaSheetCommand(text: string): Promise<string | null> {
  const t = text.trim();
  if (!/^(алина\s+)?(таблица|кабинет|sheet)\b/i.test(t) && !/^\/sheet\b/i.test(t)) {
    return null;
  }

  const db = admin();
  const sheetId = extractSheetId(t);
  const cabMatch = t.match(
    /(?:таблица|кабинет|sheet)\s+([a-zA-Zа-яА-Я0-9_-]+)/i,
  );
  let cabinetKey = cabMatch?.[1]?.toLowerCase() || '';
  if (cabinetKey === 'таблица' || cabinetKey === 'sheet') cabinetKey = '';
  // если «алина таблица https://...» без ключа
  if (!cabinetKey || cabinetKey.startsWith('http') || cabinetKey.length > 40) {
    cabinetKey = (Deno.env.get('ALINA_CABINET_KEY') || 'active').toLowerCase();
  }
  // русские имена → ключи
  const cabMap: Record<string, string> = {
    элиум: 'elium',
    elium: 'elium',
    база: 'baza',
    baza: 'baza',
    saai: 'saai',
    сааи: 'saai',
    zevina: 'zevina',
    зевина: 'zevina',
    зевина1: 'zevina1',
    зевина2: 'zevina2',
  };
  cabinetKey = cabMap[cabinetKey] || cabinetKey;

  if (/^(алина\s+)?кабинет\b/i.test(t) && !sheetId) {
    // переключить активный кабинет
    const { data: row } = await db
      .from('alina_cabinet_sheets')
      .select('*')
      .eq('cabinet_key', cabinetKey)
      .maybeSingle();
    if (!row) {
      const { data: all } = await db.from('alina_cabinet_sheets').select('cabinet_key, cabinet_name, is_active');
      const list = (all || []).map((r: { cabinet_key: string; is_active: boolean }) =>
        `${r.cabinet_key}${r.is_active ? ' ✅' : ''}`
      ).join(', ') || '—';
      return `Кабинет «${cabinetKey}» не найден.\nИзвестные: ${list}\nПример: алина таблица elium <ссылка>`;
    }
    await db.from('alina_cabinet_sheets').update({ is_active: false }).neq('cabinet_key', '');
    await db.from('alina_cabinet_sheets').update({
      is_active: true,
      updated_at: new Date().toISOString(),
    }).eq('cabinet_key', cabinetKey);
    await upsertCampaign(db, {
      sheet_id: row.sheet_id,
      cabinet_key: cabinetKey,
      is_open: false,
    });
    const snap = await refreshAlinaFromSheet();
    return [
      `Активный кабинет: ${cabinetKey}`,
      `Таблица: ${row.sheet_id}`,
      snap.ok
        ? `План: ${snap.active && (snap.active as { is_open?: boolean }).is_open ? 'открыт' : 'закрыт / нет мест сегодня'}`
        : `Sheet: ${snap.error || 'ок'}`,
    ].join('\n');
  }

  if (!sheetId) {
    return 'Пришлите ссылку: алина таблица elium https://docs.google.com/spreadsheets/d/…';
  }

  // выключить другие, включить этот
  await db.from('alina_cabinet_sheets').update({ is_active: false }).neq('cabinet_key', '__none__');
  const { error } = await db.from('alina_cabinet_sheets').upsert({
    cabinet_key: cabinetKey,
    cabinet_name: cabinetKey,
    sheet_id: sheetId,
    is_active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'cabinet_key' });
  if (error) return `Не удалось сохранить таблицу: ${error.message}`;

  await upsertCampaign(db, {
    sheet_id: sheetId,
    cabinet_key: cabinetKey,
  });

  const snap = await refreshAlinaFromSheet();
  const knowledge = String(snap.knowledge || '').split('\n').slice(0, 12).join('\n');
  return [
    `Таблица кабинета «${cabinetKey}» подключена.`,
    `ID: ${sheetId}`,
    snap.ok ? 'План прочитан ✅' : `Внимание: ${snap.error || 'не прочиталось'}`,
    knowledge,
  ].filter(Boolean).join('\n');
}

/** Команды оффера из тимчата: «алина оффер …» */
export async function tryAlinaOfferCommand(text: string): Promise<string | null> {
  const sheetCmd = await tryAlinaSheetCommand(text);
  if (sheetCmd) return sheetCmd;

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
  photoFileId?: string | null;
  botToken?: string | null;
  sourceAccount?: string;
}): Promise<AlinaReply> {
  const db = admin();
  const source = opts.sourceAccount || 'main';
  const text = (opts.text || '').trim();
  const hasPhoto = Boolean(opts.hasPhoto);
  // «База в голове» = актуальный план из Google таблицы
  const camp = await ensureCampaignFresh();

  let lead = await getOrCreateLead(db, opts, source);

  // Старые/зависшие статусы → снова уточняем объявление
  if (
    (lead.status === 'ask_type' || String(lead.status) === 'ask_order') &&
    !lead.deal_type
  ) {
    await updateLead(db, lead.id, { status: 'ask_ad' });
    lead = { ...lead, status: 'ask_ad' };
  }

  const expectArticle =
    camp?.article ||
    (camp?.notes || '').match(/article:(\d{6,})/i)?.[1] ||
    (lead.notes || '').match(/арт\s*(\d{6,})/i)?.[1] ||
    null;

  const readScreen = async (stage: ScreenStage): Promise<VisionResult | null> => {
    if (!hasPhoto || !opts.photoFileId || !opts.botToken) return null;
    const file = await downloadTelegramFile(opts.botToken, opts.photoFileId);
    if (!file) return null;
    return await analyzeAlinaScreenshot({
      imageBytes: file.bytes,
      mime: file.mime,
      stage,
      expectKeyword: lead.keyword || camp?.keyword,
      expectProduct: lead.product_name || camp?.product_name,
      expectArticle,
    });
  };

  const runBrain = async () => {
    const choices = await getOpenProductChoices();
    return {
      brain: await alinaBrain({
        text,
        hasPhoto,
        status: lead.status,
        dealType: lead.deal_type,
        productName: lead.product_name || camp?.product_name,
        keyword: lead.keyword || camp?.keyword,
        openProducts: choices.map((o) => o.product_name || '').filter(Boolean),
        campaignOpen: campaignAccepting(camp),
        slotsLeft: camp?.slots_left,
        cashbackPct: lead.cashback_pct ?? camp?.cashback_pct ?? 70,
        orderDeadline: camp?.order_deadline,
        knowledge: camp?.notes || null,
      }),
      choices,
    };
  };

  const applyBrainPick = async (
    productName: string | null,
    choices: SheetPlanOffer[],
    dealHint?: 'cashback' | 'barter' | null,
  ): Promise<AlinaReply | null> => {
    if (!productName) return null;
    const hit = choices.find((o) =>
      (o.product_name || '').toLowerCase() === productName.toLowerCase()
    ) || matchOfferFromText(choices, productName).offer;
    if (!hit) return null;
    if (dealHint) {
      await updateLead(db, lead.id, { deal_type: dealHint });
      lead = { ...lead, deal_type: dealHint };
    }
    return await startDealFromOffer(db, lead, camp, hit, text);
  };

  // Тест: одна англ. фраза — сброс ТОЛЬКО этого чата (ваш лид + события)
  if (/^resetme$/i.test(text.replace(/\s+/g, ''))) {
    await resetMyAlinaChat(db, {
      userId: opts.userId,
      chatId: opts.chatId,
      leadId: lead.id,
    });
    return r('Сбросила ваш диалог ✅ Пишите заново как новый клиент');
  }

  // Фото товара с WB (по контексту диалога / названию в сообщении)
  if (wantsProductPhoto(text)) {
    const photoReply = await handleProductPhotoRequest(db, lead, camp, text);
    if (photoReply) return photoReply;
  }

  // Не находят после ключа → фильтры с карточки (без бренда)
  if (
    lead.status === 'ask_filters' ||
    ((lead.status === 'key_sent' || lead.status === 'wait_product' ||
      lead.status === 'tz_sent') &&
      (cantFindProduct(text) || awaitingFiltersYes(lead, text)))
  ) {
    const filt = await handleCantFindFilters(db, lead, camp, text);
    if (filt) return filt;
  }

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
    ['new', 'ask_ad', 'ask_type', 'closed'].includes(lead.status) &&
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

  // ── new / closed: приветствие → уточнить объявление ─────────────────────
  if (lead.status === 'new' || lead.status === 'closed') {
    await updateLead(db, lead.id, {
      full_name: opts.fullName || lead.full_name,
      username: opts.username || lead.username,
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
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

    const choices = await getOpenProductChoices();
    const matched = await resolveAdChoice(text, hasPhoto, readScreen, choices);

    if (matched.offer) {
      return await startDealFromOffer(db, lead, camp, matched.offer, text);
    }
    if (matched.ambiguous.length === 1) {
      return await startDealFromOffer(db, lead, camp, matched.ambiguous[0], text);
    }
    if (choices.length === 1 && !isBareGreeting(text) && (detectDealType(text) || hasPhoto)) {
      return await startDealFromOffer(db, lead, camp, choices[0], text);
    }

    // Мозг: вопросы / «какие доступны» / свободный текст
    if (
      shouldUseBrain({
        text,
        status: 'ask_ad',
        hasPhoto,
        matchedProduct: Boolean(matched.offer),
      })
    ) {
      const { brain } = await runBrain();
      if (brain.via === 'ai') {
        if (brain.action === 'pick_product') {
          const started = await applyBrainPick(brain.product_name, choices, brain.deal_type);
          if (started) return started;
        }
        if (brain.action === 'close') {
          await updateLead(db, lead.id, { status: 'closed' });
          return r(brain.reply || MSG_CLOSED);
        }
        if (brain.action === 'send_tz' || brain.action === 'send_key') {
          // ещё нет товара — сначала спросим объявление, но ответим по делу
          await updateLead(db, lead.id, { status: 'ask_ad' });
          return r(
            brain.reply || msgAskAd(choices.map((o) => o.product_name || '').filter(Boolean)),
          );
        }
        if (brain.action === 'reply_only' && brain.reply) {
          await updateLead(db, lead.id, { status: 'ask_ad' });
          await logEvent(db, lead.id, opts.chatId, 'ask_ad_brain', { text, brain });
          return r(brain.reply);
        }
      }
    }

    await updateLead(db, lead.id, { status: 'ask_ad' });
    await logEvent(db, lead.id, opts.chatId, 'ask_ad', { text, hasPhoto });
    const names = (matched.ambiguous.length ? matched.ambiguous : choices)
      .map((o) => o.product_name)
      .filter(Boolean) as string[];
    return r(msgAskAd(names.length ? names : choices.map((o) => o.product_name || '').filter(Boolean)));
  }

  // ── ask_ad: ждём название / цвет / скрин объявления ─────────────────────
  if (lead.status === 'ask_ad') {
    const choices = await getOpenProductChoices();
    if (!choices.length || !campaignAccepting(camp)) {
      await updateLead(db, lead.id, { status: 'closed', last_client_text: text });
      return r(MSG_CLOSED);
    }
    const matched = await resolveAdChoice(text, hasPhoto, readScreen, choices);
    if (matched.offer) {
      return await startDealFromOffer(db, lead, camp, matched.offer, text);
    }
    if (matched.ambiguous.length === 1) {
      return await startDealFromOffer(db, lead, camp, matched.ambiguous[0], text);
    }
    if (matched.ambiguous.length > 1) {
      const names = matched.ambiguous.map((o) => o.product_name).filter(Boolean) as string[];
      // мозг может уточнить мягче
      if (shouldUseBrain({ text, status: 'ask_ad', hasPhoto, matchedProduct: false })) {
        const { brain } = await runBrain();
        if (brain.action === 'pick_product') {
          const started = await applyBrainPick(brain.product_name, choices, brain.deal_type);
          if (started) return started;
        }
        if (brain.reply) {
          return r(brain.reply);
        }
      }
      return r(
        `Уточните цвет/модель 🙌\n` + names.map((n) => `• ${n}`).join('\n'),
      );
    }
    if (choices.length === 1 && /^(да|ага|угу|yes|ок|окей|верно|оно)\b/i.test(text)) {
      return await startDealFromOffer(db, lead, camp, choices[0], text);
    }

    if (shouldUseBrain({ text, status: 'ask_ad', hasPhoto, matchedProduct: false })) {
      const { brain } = await runBrain();
      if (brain.via === 'ai') {
        if (brain.action === 'pick_product') {
          const started = await applyBrainPick(brain.product_name, choices, brain.deal_type);
          if (started) return started;
        }
        if (brain.action === 'send_tz' && choices.length === 1) {
          return await startDealFromOffer(db, lead, camp, choices[0], text);
        }
        if (brain.reply) {
          await updateLead(db, lead.id, {
            last_client_text: text || (hasPhoto ? '[фото]' : ''),
          });
          await logEvent(db, lead.id, opts.chatId, 'ask_ad_brain', { text, brain });
          return r(brain.reply);
        }
      }
    }

    await updateLead(db, lead.id, { last_client_text: text || (hasPhoto ? '[фото]' : '') });
    return r(
      MSG_ASK_AD_AGAIN,
      choices.map((o) => `• ${o.product_name}`).filter((s) => s.length > 2).join('\n'),
    );
  }

  // ── ask_type (редко) ─────────────────────────────────────────────────────
  if (lead.status === 'ask_type') {
    const typed = detectDealType(text);
    if (!typed) {
      return await openDeal(db, lead, camp, 'cashback', text);
    }
    return await openDeal(db, lead, camp, typed, text);
  }

  // ── tz_sent: ключ сразу или скрин ────────────────────────────────────────
  if (lead.status === 'tz_sent') {
    if (wantsKey(text) || /готов|ознаком|прочитал|понял|ок\b|хорошо|давай|дальше/i.test(text)) {
      return await sendKeyFlow(db, lead, camp, text);
    }
    if (hasPhoto) {
      const vision = await readScreen('product');
      if (visionBlocks(vision)) {
        return r(visionRejectReply(vision!, 'На скрине не вижу наш товар/ключ. Пришлите поиск с ключом сверху и наш товар 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_cart',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT);
    }
    return await sendKeyFlow(db, lead, camp, text || 'ключ');
  }

  // ── mid-flow FAQ через мозг (не ломает скрины/реквизиты) ───────────────
  const midFlow = [
    'key_sent',
    'wait_product',
    'wait_cart',
    'wait_order',
    'wait_bank',
    'wait_pickup',
    'wait_review',
    'wait_reels',
    'tz_sent',
  ].includes(lead.status);
  if (
    midFlow &&
    !hasPhoto &&
    shouldUseBrain({
      text,
      status: lead.status,
      hasPhoto: false,
      matchedProduct: false,
    }) &&
    !wantsTz(text) &&
    !wantsKey(text) &&
    !looksLikeBank(text)
  ) {
    // если текст явно про текущий шаг — пусть CRM сам
    const stepHint =
      (lead.status === 'wait_cart' && /корзин|конкурент|избранн/i.test(text)) ||
      (lead.status === 'wait_order' && /заказ|оформил|выкуп|пвз|доставк/i.test(text)) ||
      ((lead.status === 'key_sent' || lead.status === 'wait_product') &&
        /скрин|нашла|нашёл|наш товар|это он/i.test(text)) ||
      (lead.status === 'wait_pickup' && /забрал|получил|пвз|сегодня|завтра/i.test(text)) ||
      (lead.status === 'wait_review' && /отзыв|текст|звёзд|звезд|соглас/i.test(text));
    if (!stepHint) {
      const { brain } = await runBrain();
      if (brain.via === 'ai') {
        if (brain.action === 'send_tz') {
          const deal = (lead.deal_type || resolveDealFromCampaign(camp) || 'cashback') as DealType;
          return r(...tzBundle(deal, camp, lead));
        }
        if (brain.action === 'send_key') {
          return await sendKeyFlow(db, lead, camp, text);
        }
        if (brain.action === 'reply_only' && brain.reply) {
          await logEvent(db, lead.id, opts.chatId, 'brain_faq', { text, brain });
          return r(brain.reply);
        }
      }
    }
  }

  // ── key_sent / wait_product ──────────────────────────────────────────────
  if (lead.status === 'key_sent' || lead.status === 'wait_product') {
    if (wantsKey(text)) return await sendKeyFlow(db, lead, camp, text);
    if (hasPhoto || /скрин|нашла|нашёл|наш товар|это он/i.test(text)) {
      // «артикул» намеренно не принимаем как успех — по артикулу не ведём
      const vision = hasPhoto ? await readScreen('product') : null;
      if (visionBlocks(vision)) {
        return r(visionRejectReply(vision!, 'Нужен скрин поиска: ключ в строке сверху и наш товар в выдаче 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_cart',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT);
    }
    return r(
      lead.keyword
        ? `Жду скрин поиска по ключу «${lead.keyword}» — сверху строка запроса и наш товар 🙌\nЕсли не находите — напишите, скину фильтры`
        : 'Жду скрин: строка поиска (наш ключ) + наш товар в выдаче 🙌',
    );
  }

  // ── wait_cart ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_cart') {
    if (hasPhoto || /корзин|конкурент|избранн/i.test(text)) {
      const vision = hasPhoto ? await readScreen('cart') : null;
      if (visionBlocks(vision)) {
        return r(visionRejectReply(vision!, 'В корзине нужны наш + 2–3 конкурента из топа, и скрин ещё раз 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_order',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'cart'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_cart', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_CART);
    }
    return r('Нужен скрин корзины: наш товар + 2–3 конкурента и бренд в избранном ❤️');
  }

  // ── wait_order ───────────────────────────────────────────────────────────
  if (lead.status === 'wait_order') {
    if (hasPhoto || /заказ|оформил|выкуп|пвз|доставк/i.test(text)) {
      const vision = hasPhoto ? await readScreen('order') : null;
      if (visionBlocks(vision)) {
        return r(visionRejectReply(vision!, 'Нужен скрин заказа: цена, ПВЗ/город и дата получения 🙌'));
      }
      const orderMeta = [
        vision?.price ? `цена ${vision.price}` : '',
        vision?.pvz ? `ПВЗ ${vision.pvz}` : '',
        vision?.delivery_date || text.slice(0, 200) || new Date().toISOString().slice(0, 10),
      ].filter(Boolean).join(' · ');
      await updateLead(db, lead.id, {
        status: 'wait_bank',
        order_received_at: orderMeta.slice(0, 300),
        order_price: vision?.price || lead.order_price,
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'order'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_order', { text, hasPhoto, vision });
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
    if (!looksLikeBank(text)) {
      // вопрос про реквизиты/кэш — мозг
      if (shouldUseBrain({ text, status: 'wait_bank', hasPhoto: false, matchedProduct: false })) {
        const { brain } = await runBrain();
        if (brain.reply) return r(brain.reply);
      }
      return r('Нужны реквизиты одной строкой: телефон + ФИО + банк (СБП) 🙌');
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
      const vision = hasPhoto ? await readScreen('pickup') : null;
      await updateLead(db, lead.id, {
        pickup_at: text.slice(0, 200) || vision?.delivery_date ||
          new Date().toISOString().slice(0, 10),
        status: 'wait_review',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'pickup'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'pickup', { text, hasPhoto, vision });
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
      if (!looksLikeBank(details) && !looksLikeBank(text)) {
        return r('Пришлите: телефон + ФИО + банк после слова «реквизиты:».');
      }
      await updateLead(db, lead.id, {
        bank_details: (details || text).slice(0, 1000),
        last_client_text: text,
      });
      await syncLeadToSheet(db, lead.id);
      return r('Реквизиты обновила ✅');
    }
    if (wantsTz(text)) {
      const deal = (lead.deal_type || 'cashback') as DealType;
      return r(...tzBundle(deal, camp, lead));
    }
    if (shouldUseBrain({ text, status: 'done', hasPhoto, matchedProduct: false })) {
      const { brain } = await runBrain();
      if (brain.reply) {
        await updateLead(db, lead.id, {
          notes: `${lead.notes || ''}\n[+ ${text.slice(0, 200)}]`.trim(),
          last_client_text: text || (hasPhoto ? '[фото]' : ''),
        });
        return r(brain.reply);
      }
    }
    await updateLead(db, lead.id, {
      notes: `${lead.notes || ''}\n[+ ${text.slice(0, 200)}]`.trim(),
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
    });
    return r('Ок, всё на месте 🙌 Если что — напишите');
  }

  // fallback — мозг, иначе мягко в ask_ad
  if (!campaignAccepting(camp)) return r(MSG_CLOSED);
  const { brain, choices } = await runBrain();
  if (brain.action === 'pick_product') {
    const started = await applyBrainPick(brain.product_name, choices, brain.deal_type);
    if (started) return started;
  }
  if (brain.reply) {
    await updateLead(db, lead.id, { status: 'ask_ad', last_client_text: text });
    return r(brain.reply);
  }
  await updateLead(db, lead.id, { status: 'ask_ad', last_client_text: text });
  return r(msgAskAd(choices.map((o) => o.product_name || '').filter(Boolean)));
}

async function startDealFromOffer(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  offer: SheetPlanOffer,
  text: string,
): Promise<AlinaReply> {
  const typed = detectDealType(text) || resolveDealFromCampaign(camp);
  const deal = (typed ||
    (camp?.deal_type === 'barter' ? 'barter' : 'cashback')) as DealType;
  const campMerged: Campaign | null = camp
    ? {
      ...camp,
      product_name: offer.product_name || camp.product_name,
      keyword: offer.keyword || camp.keyword,
      order_deadline: offer.order_deadline || camp.order_deadline,
      article: offer.article || camp.article || null,
      slots_left: offer.slots_left ?? camp.slots_left,
      is_open: offer.is_open,
    }
    : {
      id: '',
      is_open: true,
      deal_type: 'both',
      product_name: offer.product_name,
      keyword: offer.keyword,
      cashback_pct: 70,
      slots_left: offer.slots_left,
      order_deadline: offer.order_deadline,
      notes: null,
      article: offer.article,
    };
  return await openDeal(db, lead, campMerged, deal, text, offer);
}

async function openDeal(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  deal: DealType,
  text: string,
  offer?: SheetPlanOffer | null,
): Promise<AlinaReply> {
  const pct = camp?.cashback_pct ?? 70;
  const ig = extractInstagram(text);
  const product = offer?.product_name || camp?.product_name || lead.product_name;
  const keyword = (
    offer?.keyword ||
    camp?.keyword ||
    lead.keyword ||
    Deno.env.get('ALINA_OFFER_KEYWORD') ||
    ''
  ).trim();
  const notesExtra = [
    lead.notes || '',
    ig ? `[ig ${ig}]` : '',
    offer?.article ? `[арт ${offer.article}]` : '',
  ].filter(Boolean).join('\n').trim();

  await updateLead(db, lead.id, {
    deal_type: deal,
    status: 'tz_sent',
    cashback_pct: deal === 'cashback' ? pct : null,
    product_name: product,
    keyword: keyword || null,
    last_client_text: text,
    notes: notesExtra || null,
  });
  // Слоты считаем из Google-графика при sync — тут не вычитаем,
  // иначе при тестах быстро уходит в «мест нет».
  await logEvent(db, lead.id, lead.chat_id, 'tz_sent', { deal, ig, product, keyword });
  await syncLeadToSheet(db, lead.id);

  const replies: string[] = [];
  if (ig) replies.push(MSG_GOT_IG);
  replies.push(msgOpenHuman(deal, product));
  replies.push(deal === 'barter'
    ? tzBarter(offer?.order_deadline || camp?.order_deadline)
    : TZ_CASHBACK);

  if (keyword) {
    await updateLead(db, lead.id, { keyword, status: 'key_sent' });
    await logEvent(db, lead.id, lead.chat_id, 'key_sent', { keyword });
    replies.push(msgKey(keyword));
  }
  return r(...replies);
}

async function sendKeyFlow(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  text: string,
): Promise<AlinaReply> {
  const keyword = (camp?.keyword || lead.keyword || Deno.env.get('ALINA_OFFER_KEYWORD') || '').trim();
  if (!keyword) {
    return r('Секунду, ключ уточню и пришлю 🙌');
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

function tzBundle(deal: DealType, camp: Campaign | null, _lead: SelfbuyLead): string[] {
  if (deal === 'barter') {
    return ['ТЗ ещё раз 👇', tzBarter(camp?.order_deadline || null)];
  }
  return ['ТЗ ещё раз 👇', TZ_CASHBACK];
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

function extractInstagram(text: string): string | null {
  const m = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i,
  );
  return m ? m[0] : null;
}

/** Блогер: IG-ссылка / «бартер» / «актуально по бартеру». Без лекций. */
function detectDealType(text: string): DealType | null {
  const t = text.toLowerCase();
  if (extractInstagram(text)) return 'barter';
  if (/бартер|блогер|рилс|reels|интеграц|коллаб/i.test(t)) return 'barter';
  if (/по\s*бартеру|на\s*бартер|бартером/i.test(t)) return 'barter';
  if (/кэш|кеш|cashback|самовыкуп|кэшбек|кешбек/i.test(t)) return 'cashback';
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
  const t = text.trim();
  if (t.length < 12) return false;
  const hasPhone = /(\+?\d[\d\s\-()]{8,}\d|\d{10,})/.test(t);
  if (!hasPhone) return false;
  const hasBank =
    /(банк|сбп|тинькоф|т-банк|сбер|альфа|втб|озон|райф|газпром|юмани|qiwi|совком)/i
      .test(t);
  // ФИО: хотя бы 2 слова из букв (кроме телефона)
  const words = t
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, ' ')
    .split(/[\s,;]+/)
    .map((w) => w.trim())
    .filter((w) => /^[A-Za-zА-Яа-яЁё]{2,}$/.test(w));
  const hasFio = words.length >= 2;
  return hasBank || hasFio;
}

function appendScreen(prev: string | null | undefined, name: string): string {
  const parts = String(prev || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.includes(name)) parts.push(name);
  return parts.join(',');
}

function isBareGreeting(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  if (/(фонар|вырез|блузк|белый|черн|чёрн|\d{6,})/i.test(t)) return false;
  if (
    /^(привет|здравствуйте|здравсьте|добрый\s+(день|вечер|утро)|hi|hello|hey|ку|йоу|актуально|пиш[уа]|интересно|есть\s+места|можно|здравствуй)[\s!.?]*$/i
      .test(t)
  ) {
    return true;
  }
  return /^(привет|здравствуйте)[\s,.!]+(актуально|пиш[уа]|по\s+объявлен)/i.test(t);
}

function visionNote(
  prev: string | null | undefined,
  vision: VisionResult | null | undefined,
): string | null {
  if (!vision || vision.via !== 'ai') return prev || null;
  const bit = [
    vision.kind,
    vision.search_query ? `q=${vision.search_query}` : '',
    vision.article ? `арт=${vision.article}` : '',
    vision.notes,
  ].filter(Boolean).join(' ');
  const line = `[vision ${bit}]`.slice(0, 220);
  return `${prev || ''}\n${line}`.trim().slice(0, 1800);
}

async function resolveAdChoice(
  text: string,
  hasPhoto: boolean,
  readScreen: (stage: ScreenStage) => Promise<VisionResult | null>,
  choices: SheetPlanOffer[],
): Promise<{ offer: SheetPlanOffer | null; ambiguous: SheetPlanOffer[] }> {
  const snapOffers = choices.length
    ? choices
    : (await fetchSheetPlan(false)).offers || [];
  const fromText = matchOfferFromText(snapOffers, text);
  if (fromText.offer) return fromText;

  if (hasPhoto) {
    const vision = await readScreen('ad');
    const hint = [vision?.product_hint, vision?.article, vision?.notes, text]
      .filter(Boolean)
      .join(' ');
    if (hint.trim()) {
      const fromPhoto = matchOfferFromText(snapOffers, hint);
      if (fromPhoto.offer || fromPhoto.ambiguous.length) return fromPhoto;
    }
  }
  return fromText;
}

function resumeStatus(lead: SelfbuyLead): SelfbuyStatus {
  if (!lead.deal_type) return 'ask_ad';
  if (lead.status === 'ask_filters' || /\bawait_filters\b/.test(lead.notes || '')) {
    return 'ask_filters';
  }
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
    case 'ask_ad':
      return [MSG_ASK_AD_AGAIN];
    case 'ask_type':
      return [MSG_NEED_TYPE];
    case 'ask_filters':
      return [MSG_ASK_FILTERS];
    case 'tz_sent':
      return tzBundle((lead.deal_type || 'cashback') as DealType, camp, lead);
    case 'key_sent':
    case 'wait_product':
      return ['Продолжаем: скрин поиска с ключом и нашим товаром. Если не находите — напишите.'];
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

/** Сброс диалога только для этого user+chat (тесты). Других клиентов не трогает. */
async function resetMyAlinaChat(
  db: SupabaseClient,
  opts: { userId: number; chatId: number; leadId: string },
) {
  await db.from('alina_selfbuy_events').delete().eq('lead_id', opts.leadId);
  await db.from('alina_selfbuy_events').delete().eq('chat_id', opts.chatId);
  await db
    .from('alina_selfbuy_leads')
    .delete()
    .eq('telegram_user_id', opts.userId)
    .eq('chat_id', opts.chatId);
  try {
    await db.from('agent_chat_history').delete().eq('chat_id', opts.chatId);
  } catch { /* таблица может отсутствовать / RLS */ }
  await logEvent(db, null, opts.chatId, 'resetme', {
    user_id: opts.userId,
    wiped_lead: opts.leadId,
  });
}

/** «Можно фото?» → главное фото с WB по товару из диалога / текста. */
async function handleProductPhotoRequest(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  text: string,
): Promise<AlinaReply | null> {
  const choices = await getOpenProductChoices();
  const allOffers = choices.length
    ? choices
    : ((await fetchSheetPlan(false)).offers || []).filter((o) => o.article);

  // 1) явно в сообщении («фото фонарь черный»)
  let matched = matchOfferFromText(allOffers, text);
  // 2) товар уже выбран в диалоге
  if (!matched.offer && lead.product_name) {
    matched = matchOfferFromText(allOffers, lead.product_name);
  }
  // 3) артикул в notes лида / кампании
  if (!matched.offer) {
    const art =
      (lead.notes || '').match(/(?:арт|article:)\s*(\d{6,})/i)?.[1] ||
      (camp?.notes || '').match(/article:(\d{6,})/i)?.[1] ||
      camp?.article ||
      null;
    if (art) {
      const byArt = allOffers.find((o) => String(o.article) === art);
      if (byArt) matched = { offer: byArt, ambiguous: [] };
    }
  }

  if (!matched.offer && matched.ambiguous.length > 1) {
    const names = matched.ambiguous.map((o) => o.product_name).filter(Boolean);
    return r(
      `Какую модель фото? 🙌\n` + names.map((n) => `• ${n}`).join('\n'),
    );
  }
  if (!matched.offer && allOffers.length > 1 && !lead.product_name) {
    const names = allOffers.map((o) => o.product_name).filter(Boolean);
    return r(
      `Фото какой модели? 🙌\n` + names.map((n) => `• ${n}`).join('\n'),
    );
  }

  const offer = matched.offer ||
    matched.ambiguous[0] ||
    (allOffers.length === 1 ? allOffers[0] : null);
  if (!offer?.article) {
    return r('Секунду, уточните модель (фонарь/вырез и цвет) — пришлю фото с WB 🙌');
  }

  const photo = await fetchWbMainPhoto(offer.article);
  await logEvent(db, lead.id, lead.chat_id, 'product_photo', {
    article: offer.article,
    product: offer.product_name,
    ok: Boolean(photo),
    url: photo?.url || null,
    bytes: photo?.bytes?.length || 0,
    text,
  });
  if (!photo) {
    return r(
      `Не вытащила фото с WB по «${offer.product_name}» 🙌 Напишите ещё раз чуть позже или уточните цвет`,
    );
  }

  // если ещё не выбрали товар — запомним модель из запроса фото
  if (!lead.product_name && offer.product_name) {
    await updateLead(db, lead.id, {
      product_name: offer.product_name,
      keyword: offer.keyword || lead.keyword,
    });
  }

  // Артикул в подписи НЕ светим — иначе ищут по фото/арту, а нам нужны ключи
  const caption =
    `Вот как выглядит${offer.product_name ? ` «${offer.product_name}»` : ''} 🙌\n` +
    `По фото не ищем — только по ключу из сообщения`;
  return rPhoto(
    {
      url: photo.url,
      bytes: photo.bytes,
      mime: photo.mime,
      filename: photo.filename,
    },
    caption,
  );
}

function cantFindProduct(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    /не\s*(могу|можем|получается|выходит)\s*(найти|найтии+|отыскать)/i.test(t) ||
    /не\s*(нашел|нашёл|нашла|нашли|вижу|видно)/i.test(t) ||
    /нет\s+в\s+выдаче|не\s+появляется|куда\s+делся|где\s+(ваш|наш)\s+товар/i.test(t) ||
    /не\s*находит|поискала?\s*не|ищу\s*не\s*могу/i.test(t) ||
    /^(нету|нет|нема)\s*(его|товар|блюд|блуз)?/i.test(t)
  );
}

function isYes(text: string): boolean {
  return /^(да|даа|дааа|ага|угу|yes|yep|ок|окей|давай|конечно|хочу|надо|скинь|пришли)([!?.…]|\s|$)/i
    .test(text.trim());
}

function isNo(text: string): boolean {
  return /^(нет|не|не надо|не надо|no|неа|не нужно)([!?.…]|\s|$)/i.test(text.trim());
}

function awaitingFiltersYes(lead: SelfbuyLead, text: string): boolean {
  return lead.status === 'ask_filters' ||
    (/\bawait_filters\b/.test(lead.notes || '') && (isYes(text) || isNo(text)));
}

function filterRoundDone(lead: SelfbuyLead): 0 | 1 | 2 {
  const s = lead.screens_done || '';
  if (/\bfilters2\b/.test(s)) return 2;
  if (/\bfilters1\b/.test(s)) return 1;
  return 0;
}

async function resolveLeadArticle(
  lead: SelfbuyLead,
  camp: Campaign | null,
): Promise<{ article: string; product: string | null } | null> {
  const choices = await getOpenProductChoices();
  const all = choices.length
    ? choices
    : ((await fetchSheetPlan(false)).offers || []).filter((o) => o.article);

  if (lead.product_name) {
    const m = matchOfferFromText(all, lead.product_name);
    if (m.offer?.article) {
      return { article: m.offer.article, product: m.offer.product_name };
    }
  }
  const art =
    (lead.notes || '').match(/(?:арт|article:)\s*(\d{6,})/i)?.[1] ||
    (camp?.notes || '').match(/article:(\d{6,})/i)?.[1] ||
    camp?.article ||
    null;
  if (art) {
    const by = all.find((o) => String(o.article) === art);
    return { article: art, product: by?.product_name || lead.product_name || null };
  }
  if (all.length === 1 && all[0].article) {
    return { article: all[0].article, product: all[0].product_name };
  }
  return null;
}

function pickFilterBatch(all: WbFilter[], round: 1 | 2): WbFilter[] {
  if (round === 1) return all.slice(0, 3);
  return all.slice(3, 5);
}

async function handleCantFindFilters(
  db: SupabaseClient,
  lead: SelfbuyLead,
  camp: Campaign | null,
  text: string,
): Promise<AlinaReply | null> {
  const round = filterRoundDone(lead);
  const waiting = lead.status === 'ask_filters' || /\bawait_filters\b/.test(lead.notes || '');

  // Ответ на «отправить фильтры?»
  if (waiting) {
    if (isNo(text)) {
      await updateLead(db, lead.id, {
        status: lead.keyword ? 'key_sent' : 'tz_sent',
        notes: (lead.notes || '').replace(/\bawait_filters\b/g, '').trim() || null,
        last_client_text: text,
      });
      return r(
        lead.keyword
          ? `Ок 🙌 Ещё раз ключ «${lead.keyword}» — и скрин поиска сверху`
          : 'Ок 🙌 Напишите, если всё же понадобятся фильтры',
      );
    }
    if (!isYes(text) && !cantFindProduct(text)) {
      // ждём да/нет
      if (lead.status === 'ask_filters') return r(MSG_ASK_FILTERS);
      return null;
    }
    // yes → ниже отправим batch
  } else if (cantFindProduct(text)) {
    if (round >= 2) {
      return r(
        'Попробуйте сортировку «Популярные» и без лишних фильтров кроме тех, что скидывала. Потом скрин поиска с ключом сверху 🙌',
      );
    }
    if (round === 1) {
      // сразу вторая пачка без повторного «хотите?»
    } else {
      // первый раз — спросить
      await updateLead(db, lead.id, {
        status: 'ask_filters',
        notes: `${lead.notes || ''}\nawait_filters`.trim(),
        last_client_text: text,
      });
      await logEvent(db, lead.id, lead.chat_id, 'ask_filters', { text });
      return r(MSG_ASK_FILTERS);
    }
  } else {
    return null;
  }

  const targetRound: 1 | 2 = round >= 1 ? 2 : 1;
  const resolved = await resolveLeadArticle(lead, camp);
  if (!resolved?.article) {
    await updateLead(db, lead.id, {
      status: 'ask_filters',
      notes: `${lead.notes || ''}\nawait_filters`.trim(),
    });
    return r('Уточните модель (фонарь/вырез и цвет) — и скину фильтры 🙌');
  }

  const all = await fetchWbSearchFilters(resolved.article);
  const batch = pickFilterBatch(all, targetRound);
  if (!batch.length) {
    await updateLead(db, lead.id, {
      status: lead.keyword ? 'key_sent' : 'wait_product',
      notes: (lead.notes || '').replace(/\bawait_filters\b/g, '').trim() || null,
    });
    return r(
      'Фильтры с карточки сейчас не подтянула 🙌 Проверьте ключ ещё раз и сортировку «Популярные»',
    );
  }

  const screenTag = targetRound === 1 ? 'filters1' : 'filters2';
  await updateLead(db, lead.id, {
    status: lead.keyword ? 'key_sent' : 'wait_product',
    screens_done: appendScreen(lead.screens_done, screenTag),
    notes: (lead.notes || '').replace(/\bawait_filters\b/g, '').trim() || null,
    last_client_text: text,
  });
  await logEvent(db, lead.id, lead.chat_id, 'filters_sent', {
    round: targetRound,
    filters: batch,
    product: resolved.product,
    // article только во внутренний лог
    article: resolved.article,
  });

  return r(msgFiltersBatch(batch, targetRound));
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
  let sheet: Record<string, unknown> | null = null;
  try {
    sheet = await refreshAlinaFromSheet();
  } catch { /* optional */ }
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

  return {
    ok: true,
    campaign: camp,
    sheet,
    knowledge: (camp as Campaign & { notes?: string })?.notes || sheet?.knowledge || null,
    leads: leads || [],
    events,
    recent_business: raw || [],
  };
}

export async function alinaSelfbuyStatsText(): Promise<string> {
  const db = admin();
  await ensureCampaignFresh();
  const camp = await getCampaign();
  let sheetLine = 'Sheet: не подключен (нужен ALINA_SHEET_ID)';
  try {
    const snap = await fetchSheetPlan();
    if (snap.ok) {
      sheetLine =
        `Sheet OK (${snap.source}): офферов ${snap.offers.length}, ` +
        `активный мест ${snap.active?.slots_left ?? 0}, строк лога ${snap.leads_rows}`;
    } else {
      sheetLine = `Sheet: ${snap.error || 'ошибка'}`;
    }
  } catch (e) {
    sheetLine = `Sheet: ${e instanceof Error ? e.message : String(e)}`;
  }

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
    sheetLine,
    `Оффер: ${camp?.is_open ? 'открыт' : 'закрыт'} · ${camp?.deal_type || '—'} · мест ${camp?.slots_left ?? '—'}`,
    `Товар: ${camp?.product_name || '—'}`,
    `Ключ: ${camp?.keyword || '—'}`,
    `Всего заявок в CRM: ${total} (в работе ${inProgress}, готово ${done})`,
    `кэшбек: ${cashback} · бартер: ${barter} · сегодня: ${todayCount}`,
    'План берётся из Google «План»; места = план − занятые строки.',
    'Вручную: алина оффер открыт … / алина оффер закрыт',
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
  const sheetId = (
    (await getCampaign())?.sheet_id ||
    Deno.env.get('ALINA_SHEET_ID') ||
    ''
  ).trim();
  const saJson = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '').trim();
  if (!sheetId || !saJson) {
    console.log('[alina-selfbuy] sheets write skip: need GOOGLE_SERVICE_ACCOUNT_JSON / sheet_id');
    return;
  }

  const { data: lead } = await db.from('alina_selfbuy_leads').select('*').eq('id', leadId)
    .maybeSingle();
  if (!lead) return;

  try {
    const token = await googleAccessToken(saJson);
    const tab = (Deno.env.get('ALINA_LEADS_TAB') || 'Список БЛУЗКИ ФОНАРЬ/ВЫРЕЗ ВБ').trim();
    const tg = lead.username
      ? `@${String(lead.username).replace(/^@/, '')}`
      : String(lead.telegram_user_id);
    // Формат BAZA «Список БЛУЗКИ ФОНАРЬ/ВЫРЕЗ ВБ»:
    // A Вид | B ТГ | C Дата заказа | D Цена | E Размер кэша | F | G Кэш выплачен |
    // H Примерная дата забора | I Факт забора | J Дата рекламы | K ШК | L Дата отзыва |
    // M Вид отзыва | N Реквизиты | O План выплаты | P Отзыв опубл | Q Ответственный | R Ключ |
    // S | T Фильтры | U ЧС | V Просмотры | W Reels
    const vid = lead.deal_type === 'barter' ? 'БЛОГЕР' : 'КЭШБЕК';
    const values = [[
      vid,
      tg,
      lead.order_received_at || new Date().toLocaleDateString('ru-RU'),
      lead.order_price || '',
      lead.cashback_pct != null ? String(lead.cashback_pct) : '',
      '',
      '',
      lead.pickup_at || '',
      lead.pickup_at || '',
      '',
      '',
      lead.review_planned_at || '',
      lead.review_note || '',
      lead.bank_details || '',
      '',
      lead.status === 'done' ? 'Да' : '',
      'Алина',
      lead.keyword || '',
      '',
      '',
      '',
      '',
      lead.reels_url || '',
    ]];

    // Имя вкладки с «/» обязательно в одинарных кавычках
    const qtab = `'${tab.replace(/'/g, "''")}'`;

    if (lead.sheet_row) {
      const range = `${qtab}!A${lead.sheet_row}:W${lead.sheet_row}`;
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
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${
        encodeURIComponent(`${qtab}!A:W`)
      }:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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
      console.error('[alina-selfbuy] sheet append', JSON.stringify(body).slice(0, 400));
      return;
    }
    const updated = String(body?.updates?.updatedRange || '');
    const m = updated.match(/![A-Z]+(\d+)/);
    if (m) {
      await db.from('alina_selfbuy_leads').update({ sheet_row: Number(m[1]) }).eq('id', leadId);
    }
    console.log('[alina-selfbuy] sheet append ok', updated);
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
