// Алина · бартер / кэшбек с рабочего аккаунта (Telegram Business).
// Голос = менеджер аккаунта, не «бот Алина». ТЗ + ключ + скрины → таблица.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAdminClient } from './alina-db.ts';
import { googleAccessToken } from './alina-google-auth.ts';
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
  MSG_ONLY_CASHBACK,
  msgAskAd,
  msgColorUnavailable,
  msgFiltersBatch,
  msgKey,
  msgOpenHuman,
  TZ_CASHBACK,
  tzBarter,
} from './alina-templates.ts';
import {
  fetchSheetPlan,
  getOpenProductChoices,
  matchOfferFromText,
  resolveProductChoice,
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
  sheet_id?: string | null;
};

function admin(): SupabaseClient {
  return getAdminClient();
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
  const source = opts.sourceAccount || 'business';
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

  // Бартер просят, а в таблице BAZA только кэшбек
  {
    const barterBlock = handleBarterWhenCashOnly(text, camp);
    if (barterBlock) {
      await updateLead(db, lead.id, {
        last_client_text: text,
        notes: `${lead.notes || ''}\n[want_barter_cash_only]`.trim(),
      });
      await logEvent(db, lead.id, opts.chatId, 'barter_unavailable', { text });
      // на входе оставим ask_ad, если ещё без сделки
      if (['new', 'closed', 'ask_ad', 'ask_type'].includes(lead.status)) {
        await updateLead(db, lead.id, { status: 'ask_ad' });
      }
      return barterBlock;
    }
  }
  // После «только кэш — ок?» клиент сказал да → ведём как кэш
  if (
    /\bwant_barter_cash_only\b/.test(lead.notes || '') &&
    isYes(text) &&
    ['new', 'ask_ad', 'ask_type', 'closed'].includes(lead.status)
  ) {
    await updateLead(db, lead.id, {
      notes: (lead.notes || '').replace(/\bwant_barter_cash_only\b/g, '').trim() || null,
      deal_type: 'cashback',
    });
    lead = { ...lead, deal_type: 'cashback' };
    // дальше обычный ask_ad / выбор модели
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

    const snap = await fetchSheetPlan(false);
    const choices = await getOpenProductChoices();
    const picked = await resolveClientProduct(text, hasPhoto, readScreen, snap.offers || choices);

    if (picked.unavailableColor) {
      await updateLead(db, lead.id, { status: 'ask_ad' });
      const label = picked.unavailableColor === 'black' ? 'чёрный' : 'белый';
      return r(msgColorUnavailable(
        label,
        picked.alternatives.map((o) => o.product_name || '').filter(Boolean),
      ));
    }
    if (picked.offer) {
      return await startDealFromOffer(db, lead, camp, picked.offer, text);
    }
    if (picked.ambiguous.length === 1) {
      return await startDealFromOffer(db, lead, camp, picked.ambiguous[0], text);
    }
    if (picked.ambiguous.length > 1 && !isBareGreeting(text)) {
      await updateLead(db, lead.id, { status: 'ask_ad' });
      return r(
        `Уточните модель 🙌\n` +
          picked.ambiguous.map((o) => `• ${o.product_name}`).filter(Boolean).join('\n'),
      );
    }
    if (choices.length === 1 && !isBareGreeting(text) && hasPhoto) {
      return await startDealFromOffer(db, lead, camp, choices[0], text);
    }

    // Мозг: вопросы / «какие доступны» / свободный текст
    if (
      shouldUseBrain({
        text,
        status: 'ask_ad',
        hasPhoto,
        matchedProduct: Boolean(picked.offer),
      }) && !isBareGreeting(text)
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
        if (brain.reply && brain.action === 'reply_only') {
          await updateLead(db, lead.id, { status: 'ask_ad' });
          await logEvent(db, lead.id, opts.chatId, 'ask_ad_brain', { text, brain });
          return r(brain.reply);
        }
      }
    }

    await updateLead(db, lead.id, { status: 'ask_ad' });
    await logEvent(db, lead.id, opts.chatId, 'ask_ad', { text, hasPhoto });
    return r(msgAskAd(choices.map((o) => o.product_name || '').filter(Boolean)));
  }

  // ── ask_ad: ждём модель / цвет ───────────────────────────────────────────
  if (lead.status === 'ask_ad') {
    const snap = await fetchSheetPlan(false);
    const choices = await getOpenProductChoices();
    if (!choices.length || !campaignAccepting(camp)) {
      await updateLead(db, lead.id, { status: 'closed', last_client_text: text });
      return r(MSG_CLOSED);
    }
    const picked = await resolveClientProduct(text, hasPhoto, readScreen, snap.offers || choices);
    if (picked.unavailableColor) {
      const label = picked.unavailableColor === 'black' ? 'чёрный' : 'белый';
      return r(msgColorUnavailable(
        label,
        picked.alternatives.map((o) => o.product_name || '').filter(Boolean),
      ));
    }
    if (picked.offer) {
      return await startDealFromOffer(db, lead, camp, picked.offer, text);
    }
    if (picked.ambiguous.length === 1) {
      return await startDealFromOffer(db, lead, camp, picked.ambiguous[0], text);
    }
    if (picked.ambiguous.length > 1) {
      return r(
        `Уточните модель 🙌\n` +
          picked.ambiguous.map((o) => `• ${o.product_name}`).filter(Boolean).join('\n'),
      );
    }
    if (choices.length === 1 && isYes(text)) {
      return await startDealFromOffer(db, lead, camp, choices[0], text);
    }

    if (shouldUseBrain({ text, status: 'ask_ad', hasPhoto, matchedProduct: false })) {
      const { brain } = await runBrain();
      if (brain.via === 'ai') {
        if (brain.action === 'pick_product') {
          const started = await applyBrainPick(brain.product_name, choices, brain.deal_type);
          if (started) return started;
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
    if (typed === 'barter' && !barterAvailable(camp)) {
      return r(MSG_ONLY_CASHBACK);
    }
    return await openDeal(db, lead, camp, typed || 'cashback', text);
  }

  // ── tz_sent: ключ сразу или скрин ────────────────────────────────────────
  if (lead.status === 'tz_sent') {
    if (wantsKey(text) || /готов|ознаком|прочитал|понял|(?:^|[\s,.:;!?/\\|])ок(?=$|[\s,.:;!?/\\|])|хорошо|давай|дальше/i.test(text)) {
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
      last_client_text: '[реквизиты]',
    });
    await logEvent(db, lead.id, opts.chatId, 'bank_done', {});
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
  if (!offer.is_open || (offer.slots_left ?? 0) <= 0) {
    const open = await getOpenProductChoices();
    return r(msgColorUnavailable(
      offer.product_name || 'этой модели',
      open.map((o) => o.product_name || '').filter(Boolean),
    ));
  }

  let typed = detectDealType(text) || lead.deal_type || resolveDealFromCampaign(camp);
  // таблица говорит только кэш — бартер не открываем
  if (typed === 'barter' && !barterAvailable(camp) && offer.deal_type !== 'barter' &&
    offer.deal_type !== 'both') {
    typed = 'cashback';
  }
  if (typed === 'barter' && !barterAvailable(camp)) {
    return r(MSG_ONLY_CASHBACK);
  }
  const mode = campaignDealMode(camp);
  const deal = (typed || (mode === 'barter' ? 'barter' : 'cashback')) as DealType;

  const campMerged: Campaign | null = camp
    ? {
      ...camp,
      deal_type: mode,
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
      deal_type: mode,
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

function campaignDealMode(camp: Campaign | null): 'cashback' | 'barter' | 'both' {
  if (!camp) {
    const t = (Deno.env.get('ALINA_OFFER_TYPE') || 'cashback').toLowerCase();
    if (t === 'barter' || t === 'both') return t;
    return 'cashback';
  }
  const fromNotes = (camp.notes || '').match(/deal_mode:(cashback|barter|both)/i)?.[1];
  if (fromNotes) return fromNotes.toLowerCase() as 'cashback' | 'barter' | 'both';
  if (camp.deal_type === 'barter' || camp.deal_type === 'both') return camp.deal_type;
  return 'cashback';
}

function barterAvailable(camp: Campaign | null): boolean {
  const m = campaignDealMode(camp);
  return m === 'barter' || m === 'both';
}

function resolveDealFromCampaign(camp: Campaign | null): DealType | null {
  const m = campaignDealMode(camp);
  if (m === 'both') return null;
  if (m === 'barter') return 'barter';
  return 'cashback';
}

/** Бартер просят, а в таблице только кэш — ответить по-человечески. */
function handleBarterWhenCashOnly(
  text: string,
  camp: Campaign | null,
): AlinaReply | null {
  if (barterAvailable(camp)) return null;
  if (!detectDealType(text) || detectDealType(text) !== 'barter') {
    // «бартер есть?» без явного detect — ловим вопросом
    if (!/бартер/i.test(text)) return null;
  }
  return r(MSG_ONLY_CASHBACK);
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
    /(?:^|[\s,.:;!?/\\|])(пришли|скинь|ещё раз|еще раз).{0,20}(тз|инструкц)/i.test(text);
}

function wantsKey(text: string): boolean {
  return /^(ключ|ключев|запрос)(?=$|[\s,.:;!?/\\|])/i.test(text) ||
    /(?:^|[\s,.:;!?/\\|])(дай|пришли|скинь|нужен).{0,15}ключ/i.test(text) ||
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

async function resolveClientProduct(
  text: string,
  hasPhoto: boolean,
  readScreen: (stage: ScreenStage) => Promise<VisionResult | null>,
  offers: SheetPlanOffer[],
): Promise<{
  offer: SheetPlanOffer | null;
  ambiguous: SheetPlanOffer[];
  unavailableColor: 'black' | 'white' | 'other' | null;
  alternatives: SheetPlanOffer[];
}> {
  const all = offers.length ? offers : (await fetchSheetPlan(false)).offers || [];
  let picked = resolveProductChoice(all, text);
  if (picked.offer || picked.unavailableColor || picked.ambiguous.length) return picked;

  if (hasPhoto) {
    const vision = await readScreen('ad');
    const hint = [vision?.product_hint, vision?.notes, text].filter(Boolean).join(' ');
    if (hint.trim()) {
      picked = resolveProductChoice(all, hint);
    }
  }
  return picked;
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
  const { data: existing, error: lookupError } = await db
    .from('alina_selfbuy_leads')
    .select('*')
    .eq('telegram_user_id', opts.userId)
    .eq('chat_id', opts.chatId)
    .maybeSingle();
  if (lookupError) throw new Error('alina lead lookup failed');
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
      lead.order_received_at || new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }),
      lead.order_price || '',
      lead.cashback_pct != null ? String(lead.cashback_pct) : '',
      null,
      null,
      lead.pickup_at || '',
      lead.pickup_at || '',
      null,
      null,
      lead.review_planned_at || '',
      lead.review_note || '',
      lead.bank_details || '',
      null,
      lead.status === 'done' ? 'Да' : '',
      'Алина',
      lead.keyword || '',
      null,
      null,
      null,
      null,
      lead.reels_url || '',
    ]];

    // Имя вкладки с «/» обязательно в одинарных кавычках
    const qtab = `'${tab.replace(/'/g, "''")}'`;

    if (lead.sheet_row) {
      const range = `${qtab}!A${lead.sheet_row}:W${lead.sheet_row}`;
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${
          encodeURIComponent(range)
        }?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values }),
        },
      );
      if (!res.ok) console.error('[alina-selfbuy] sheet update', res.status);
      return;
    }

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${
        encodeURIComponent(`${qtab}!A:W`)
      }:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
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
      console.error('[alina-selfbuy] sheet append', res.status);
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
