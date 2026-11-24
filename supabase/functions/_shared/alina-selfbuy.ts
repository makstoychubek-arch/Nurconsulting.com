// Алина · бартер / кэшбек с рабочего аккаунта (Telegram Business).
// Голос = менеджер аккаунта, не «бот Алина». ТЗ + ключ + скрины → таблица.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { secretOrEnv } from './integration-secrets.ts';
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
  resolveActiveSheet,
  getOpenProductChoices,
  lastPlanAtMs,
  matchOfferFromText,
  razdachiRowsMode,
  resolveProductChoice,
  syncCampaignFromSheet,
  type SheetPlanOffer,
} from './alina-sheet-plan.ts';
import { bookPlace, parseIntegrationDate, takePlaceToday } from './alina-razdachi-sync.ts';
import { PAJAMA_MODEL_NAMES, pajamaPhotosFor } from './alina-pajama-photos.ts';
import { humanizeReplies } from './alina-humanize.ts';
import { BRAND_REPLIES, askedAgainKind, isAck, isBrandQuestion, saysNotReceived } from './alina-guard.ts';
import { freeSlots, matchModels, nearestFree, normModel, ruDay, setLateException, todayMskKey, tooLateForToday } from './alina-razdachi.ts';
import { getLastRazdachi } from './alina-sheet-plan.ts';
import {
  analyzeAlinaScreenshot,
  downloadTelegramFile,
  visionBlocks,
  visionVerdict,
  visionRejectReply,
  type ScreenStage,
  type VisionResult,
} from './alina-vision.ts';
import { alinaBrain, shouldUseBrain } from './alina-brain.ts';
import { clientRowsToday, syncLeadToRazdachiRow } from './alina-razdachi-sync.ts';
import { loadAlinaSettings } from './alina-settings.ts';
import { gate, isWorkingTime } from './alina-gate.ts';
import { setTextOverrides } from './alina-templates.ts';
import { alinaHoldPhrase, managerGroupId } from './alina-manager.ts';
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
  | 'wait_size'
  | 'wait_integration'
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
  sheet_target?: string | null;
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
  /** Вопрос уходит менеджерам: Telegram-слой отправляет его в группу (песочница только показывает). */
  escalate?: { topic: string; question: string; group: number };
  /** Ответить реплаем на своё прежнее сообщение этого вида («Отправила выше»). */
  replyToKind?: 'tz' | 'key' | 'photo';
  /** Ответ про наличие моделей: один раз в 5 минут на чат, чтобы не было дублей (проверяет alina-telegram). */
  tag?: string;
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

/** Если Алина пообещала «уточню у менеджера», вопрос действительно уходит в группу менеджеров (раньше фраза говорилась, а в группу ничего не шло). */
export async function handleAlinaClientMessage(opts: Parameters<typeof handleAlinaClientMessageInner>[0]): Promise<AlinaReply> {
  // Разовое исключение владельца: пока не истекло, место на сегодня берём и поздно вечером.
  try {
    const { data: ex } = await admin().from('alina_settings').select('value').eq('key', 'lateException').maybeSingle();
    const until = Date.parse(String((ex?.value as { until?: string } | null)?.until || ''));
    setLateException(Number.isFinite(until) && until > Date.now());
  } catch { setLateException(false); }
  const res = await handleAlinaClientMessageInner(opts);
  // Менеджеру передаём, если Алина пообещала «уточню / спрошу / передам» (в любой формулировке) или клиент прямо зовёт менеджера.
  const promised = res.replies.some((x) => /уточню|спрошу|передам|узнаю у|выясню|сверю/i.test(x));
  const asksManager = /(?:^|[^а-яё])(менеджер\S*|оператор\S*|живо\S* человек\S*|администратор\S*)(?![а-яё])/i.test((opts.text || '').slice(0, 300));
  if (res.escalate || !(promised || asksManager)) return await withHuman(res, opts.text);
  const group = await managerGroupId();
  if (!group) return await withHuman(res, opts.text);
  const question = (opts.text || '').trim() || '[клиент прислал фото]';
  await logAlinaRawEvent(opts.chatId, 'manager_escalated', { topic: 'вопрос клиента', text: question.slice(0, 200), auto: true });
  return await withHuman({ ...res, escalate: { topic: 'вопрос клиента', question, group } }, opts.text);
}

/** Очеловечивание коротких шаблонных реплик (факты проверяет код, при сомнении остаётся исходный текст). */
async function withHuman(res: AlinaReply, clientText?: string): Promise<AlinaReply> {
  if (!res.replies.length) return res;
  return { ...res, replies: await humanizeReplies(res.replies, clientText || '') };
}

async function handleAlinaClientMessageInner(opts: {
  chatId: number;
  userId: number;
  username?: string;
  fullName?: string;
  text: string;
  hasPhoto?: boolean;
  photoFileId?: string | null;
  botToken?: string | null;
  sourceAccount?: string;
  /** Последние сообщения чата (клиент, менеджер, Алина) для контекста ChatGPT. */
  history?: string;
  /** Момент для часов работы (песочница); по умолчанию сейчас. */
  nowMs?: number;
}): Promise<AlinaReply> {
  const db = admin();
  const source = opts.sourceAccount || 'business';
  const text = (opts.text || '').trim();
  const hasPhoto = Boolean(opts.hasPhoto);

  // Входные правила: часы работы и темы для менеджера. До чтения таблицы и до ChatGPT, чтобы не тратить на них время.
  {
    const settings = await loadAlinaSettings();
    setTextOverrides(settings.texts); // свои тексты Алины с сайта
    const nowMs = opts.nowMs ?? Date.now();
    const group = await managerGroupId();
    let told = false;
    if (settings.hoursOn && !isWorkingTime(nowMs, settings.hoursFrom, settings.hoursTo)) {
      const { data: prev } = await getAdminClient().from('alina_selfbuy_events').select('id')
        .eq('chat_id', opts.chatId).eq('event_type', 'offhours_sent')
        .gt('created_at', new Date(Date.now() - 12 * 3600_000).toISOString()).limit(1);
      told = Boolean(prev && prev.length);
    }
    const firstName = (opts.fullName || '').trim().split(/\s+/)[0];
    const verdict = gate({
      text, nowMs, settings, alreadyToldOffHours: told, hasManagerGroup: Boolean(group), username: opts.username,
      holdReply: alinaHoldPhrase(firstName, text.length, settings.phrases, settings.useName),
    });
    if (verdict.kind === 'blocked') {
      await logAlinaRawEvent(opts.chatId, 'blacklist_skip', { username: opts.username || null });
      return { replies: [] };
    }
    if (verdict.kind === 'offhours') {
      await logAlinaRawEvent(opts.chatId, verdict.reply ? 'offhours_sent' : 'offhours_skip', { text: text.slice(0, 200) });
      return { replies: verdict.reply ? [verdict.reply] : [] };
    }
    if (verdict.kind === 'escalate') {
      await logAlinaRawEvent(opts.chatId, 'manager_escalated', { topic: verdict.topic, text: text.slice(0, 200) });
      return { replies: [verdict.reply], escalate: { topic: verdict.topic, question: verdict.question, group } };
    }
  }

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

  // Вторая модель по очереди: первая заявка прошла этап скрина заказа, клиент называет другую модель → отдельная заявка на неё.
  if (razdachiRowsMode() && !hasPhoto && ['wait_bank', 'wait_pickup', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status))) {
    const next = await startSecondModelLead(db, lead, text);
    if (next) lead = next;
  }

  // Размер назван в любой момент: запоминаем, потом не переспрашиваем.
  if (!hasPhoto && lead.status !== 'wait_size' && !sizeOf(lead)) {
    const early = parseSize(text);
    if (early) {
      const notes = withSize(lead.notes, early);
      await updateLead(db, lead.id, { notes });
      lead = { ...lead, notes };
    }
  }

  // Дата интеграции названа в любой момент («выйду 28-го»): запоминаем, потом не переспрашиваем.
  if (!hasPhoto && lead.status !== 'wait_integration' && !intOf(lead)) {
    const d = parseIntegrationDate(text);
    if (d) {
      const notes = withInt(lead.notes, d);
      await updateLead(db, lead.id, { notes });
      lead = { ...lead, notes };
    }
  }

  // Режим строк: бронь места (ответ на предложение даты или запрос модели, которой сегодня нет).
  if (razdachiRowsMode() && !hasPhoto && ['new', 'closed', 'ask_ad', 'ask_type'].includes(String(lead.status))) {
    const booked = await handleRowsBooking(db, lead, text);
    if (booked) return booked;
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
    // Эталон: главное фото нашей карточки с WB. Клиенту оно не уходит, нужно только чтобы сверить, наш ли товар на его скрине.
    let reference: { bytes: Uint8Array; mime: string } | null = null;
    const abRefs: { bytes: Uint8Array; mime: string }[] = [];
    let article = expectArticle;
    if (razdachiRowsMode() && (stage === 'product' || stage === 'cart' || stage === 'order')) {
      const mine = await resolveLeadArticle(lead, camp).catch(() => null);
      if (mine?.article) article = mine.article;
      const ref = article ? await fetchWbMainPhoto(article).catch(() => null) : null;
      if (ref?.bytes) reference = { bytes: ref.bytes, mime: ref.mime || 'image/jpeg' };
      // A/B-тест меняет главное фото карточки: клиент мог снять скрин с прошлым вариантом, поэтому сверяем и с ними.
      if (article) {
        try {
          const { data: vars } = await db.from('ab_tests').select('id, ab_test_variants(photo_url, is_currently_on_wb)')
            .eq('nm_id', Number(article)).eq('status', 'active').limit(1);
          const urls = ((vars?.[0] as { ab_test_variants?: { photo_url?: string }[] } | undefined)?.ab_test_variants || [])
            .map((v) => v.photo_url).filter(Boolean) as string[];
          for (const u of urls.slice(0, 5)) {
            const res = await fetch(u, { signal: AbortSignal.timeout(8000) }).catch(() => null);
            if (res?.ok) {
              const buf = new Uint8Array(await res.arrayBuffer());
              if (buf.length > 800) abRefs.push({ bytes: buf, mime: res.headers.get('content-type') || 'image/jpeg' });
            }
          }
        } catch { /* без A/B-эталонов сверяем по главному фото */ }
      }
    }
    return await analyzeAlinaScreenshot({
      imageBytes: file.bytes,
      mime: file.mime,
      stage,
      expectKeyword: lead.keyword || camp?.keyword,
      expectProduct: lead.product_name || camp?.product_name,
      expectArticle: article,
      reference,
      references: reference ? [reference, ...abRefs] : abRefs,
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
        placesFact: razdachiRowsMode() ? placesFactFor(lead.username) : null,
        history: opts.history || null,
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
  // Фото модели шлём только в начале (выбор модели). Когда процесс идёт дальше или речь про отзыв («пример фото отзыва»), фото пижамы не отправляем.
  const lateStage = ['wait_bank', 'wait_size', 'wait_integration', 'wait_pickup', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status));
  if (wantsProductPhoto(text) && !(razdachiRowsMode() && (lateStage || /отзыв/i.test(text)))) {
    const photoReply = await handleProductPhotoRequest(db, lead, camp, text);
    if (photoReply) return photoReply;
  }

  // Не находят после ключа → фильтры с карточки (без бренда)
  if (
    lead.status === 'ask_filters' ||
    ((lead.status === 'key_sent' || lead.status === 'wait_product' || lead.status === 'wait_cart' ||
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

  // Режим строк: клиент, которому уже сказали «сегодня мест нет», пишет дальше («хорошо», вопрос): не повторяем список мест, а отвечаем по делу.
  if (razdachiRowsMode() && lead.status === 'closed' && !campaignAccepting(camp) && !hasPhoto) {
    if (isAck(text)) return { replies: [] };
    const { brain: closedBrain } = await runBrain();
    if (closedBrain.via === 'ai' && closedBrain.reply) return r(closedBrain.reply);
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
    if (razdachiRowsMode()) {
      // Режим строк: вместо «напишите завтра» называем ближайшие свободные даты и предлагаем бронь.
      const sheet = getLastRazdachi()?.sheet;
      const today = todayMskKey();
      const late = tooLateForToday();
      const first = sheet ? freeSlots(sheet, today, 14).find((x) => !late || x.date !== today) : null; // только ближайшая дата, весь план не перечисляем
      if (first) {
        return { ...r(`${late ? 'На сегодня уже не успеть: заказ до 22:00 МСК' : 'На сегодня всё занято'} 😔\nБлижайшая дата: ${ruDay(first.date, today)}. Какую модель забронировать?`), tag: 'models' as const };
      }
    }
    return r(MSG_CLOSED());
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
      return r(MSG_CLOSED());
    }
    if (camp && (camp.slots_left ?? 0) <= 0 && camp.is_open) {
      await updateLead(db, lead.id, { status: 'closed' });
      return r(MSG_CLOSED_FULL());
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
    // Клиент уже закрепил место на эту дату (бронь с вчера): модель берём из его строки, заново не спрашиваем.
    if (razdachiRowsMode() && !hasPhoto && matchModels(PAJAMA_MODEL_NAMES, text).length === 0) {
      const own = clientRowsToday(lead.username);
      if (own.state === 'ok' && own.rows.length === 1) {
        const mine = choices.find((o) => normModel(o.product_name) === normModel(own.rows[0].model));
        if (mine) return await startDealFromOffer(db, lead, camp, mine, text);
      }
    }
    // Режим строк: условия отправляем только после того, как клиент сам выбрал модель. Не выбираем за него, даже если сегодня открыта одна.
    if (razdachiRowsMode() && matchModels(PAJAMA_MODEL_NAMES, text).length === 0 && !(isYes(text) && lead.status === 'ask_ad')) {
      await updateLead(db, lead.id, { status: 'ask_ad' });
      await logEvent(db, lead.id, opts.chatId, 'ask_model', { text, open: choices.map((o) => o.product_name) });
      const names = choices.map((o) => o.product_name || '').filter(Boolean);
      return await modelsReply(db, lead, names);
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
          return r(brain.reply || MSG_CLOSED());
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
    return await modelsReply(db, lead, choices.map((o) => o.product_name || '').filter(Boolean));
  }

  // ── ask_ad: ждём модель / цвет ───────────────────────────────────────────
  if (lead.status === 'ask_ad') {
    const snap = await fetchSheetPlan(false);
    const choices = await getOpenProductChoices();
    if (!choices.length || !campaignAccepting(camp)) {
      await updateLead(db, lead.id, { status: 'closed', last_client_text: text });
      return r(MSG_CLOSED());
    }
    const picked = await resolveClientProduct(text, hasPhoto, readScreen, snap.offers || choices);
    if (picked.unavailableColor) {
      const label = picked.unavailableColor === 'black' ? 'чёрный' : 'белый';
      return r(msgColorUnavailable(
        label,
        picked.alternatives.map((o) => o.product_name || '').filter(Boolean),
      ));
    }
    // Клиент уже закрепил место на эту дату (бронь с вчера): модель берём из его строки, заново не спрашиваем.
    if (razdachiRowsMode() && !hasPhoto && matchModels(PAJAMA_MODEL_NAMES, text).length === 0) {
      const own = clientRowsToday(lead.username);
      if (own.state === 'ok' && own.rows.length === 1) {
        const mine = choices.find((o) => normModel(o.product_name) === normModel(own.rows[0].model));
        if (mine) return await startDealFromOffer(db, lead, camp, mine, text);
      }
    }
    // Режим строк: условия отправляем только после того, как клиент сам выбрал модель. Не выбираем за него, даже если сегодня открыта одна.
    if (razdachiRowsMode() && matchModels(PAJAMA_MODEL_NAMES, text).length === 0 && !(isYes(text) && lead.status === 'ask_ad')) {
      await updateLead(db, lead.id, { status: 'ask_ad' });
      await logEvent(db, lead.id, opts.chatId, 'ask_model', { text, open: choices.map((o) => o.product_name) });
      const names = choices.map((o) => o.product_name || '').filter(Boolean);
      return await modelsReply(db, lead, names);
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
      MSG_ASK_AD_AGAIN(),
      choices.map((o) => `• ${o.product_name}`).filter((s) => s.length > 2).join('\n'),
    );
  }

  // ── ask_type (редко) ─────────────────────────────────────────────────────
  if (lead.status === 'ask_type') {
    const typed = detectDealType(text);
    if (typed === 'barter' && !barterAvailable(camp)) {
      return r(MSG_ONLY_CASHBACK());
    }
    return await openDeal(db, lead, camp, typed || 'cashback', text);
  }

  // Просят то, что уже отправили (условия, ключ, фото): отвечаем «отправила выше» реплаем на своё сообщение, а не шлём второй раз.
  if (!hasPhoto && razdachiRowsMode()) {
    const again = askedAgainKind(text);
    if (again && !saysNotReceived(text) && await alreadySent(db, opts.chatId, again, text)) {
      return { replies: ['Отправила выше 👆'], replyToKind: again };
    }
  }

  // Вопрос про бренд: не называем, объясняем, что товар определяем сами по фото на скрине (владелец, 24 ноября 2026).
  if (!hasPhoto && isBrandQuestion(text) && !['new', 'closed', 'done'].includes(String(lead.status))) {
    return r(BRAND_REPLIES[(opts.chatId % 2 + (text.length % 2)) % BRAND_REPLIES.length]);
  }

  // Клиент просто подтвердил («да», «ок», «поняла»): на обычное подтверждение молчим (владелец, 24 ноября 2026), это не вопрос.
  if (!hasPhoto && isAck(text) && ['key_sent', 'wait_product', 'wait_cart', 'wait_order'].includes(String(lead.status))) {
    return { replies: [] };
  }

  // ── tz_sent: ключ сразу или скрин ────────────────────────────────────────
  if (lead.status === 'tz_sent') {
    if (wantsKey(text) || /готов|ознаком|прочитал|понял|согласн|принима|понятно|ясно|конечно|(?:^|[\s,.:;!?/\\|])(?:да|даа+|ага|угу|окей|ок)(?=$|[\s,.:;!?/\\|])|хорошо|давай|дальше/i.test(text)) {
      return await sendKeyFlow(db, lead, camp, text);
    }
    if (hasPhoto) {
      const vision = await readScreen('product');
      {
        const verdict = visionVerdict(vision);
        if (verdict === 'manager') return await visionToManager(lead, vision!);
        if (verdict === 'reject') return r(visionRejectReply(vision!, 'На скрине не вижу наш товар/ключ. Пришлите поиск с ключом сверху и наш товар 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_cart',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT());
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
    if (hasPhoto || (!razdachiRowsMode() && /скрин|нашла|нашёл|наш товар|это он/i.test(text))) {
      // «артикул» намеренно не принимаем как успех — по артикулу не ведём
      const vision = hasPhoto ? await readScreen('product') : null;
      {
        const verdict = visionVerdict(vision);
        if (verdict === 'manager') return await visionToManager(lead, vision!);
        if (verdict === 'reject') return r(visionRejectReply(vision!, 'Нужен скрин поиска: ключ в строке сверху и наш товар в выдаче 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_cart',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'product'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_product', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_PRODUCT());
    }
    return rAsk(
      'key_sent',
      lead.keyword
        ? `Жду скрин поиска по ключу «${lead.keyword}» — сверху строка запроса и наш товар 🙌\nЕсли не находите — напишите, скину фильтры`
        : 'Жду скрин: строка поиска (наш ключ) + наш товар в выдаче 🙌',
    );
  }

  // ── wait_cart ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_cart') {
    if (hasPhoto || (!razdachiRowsMode() && /корзин|конкурент|избранн/i.test(text))) {
      const vision = hasPhoto ? await readScreen('cart') : null;
      // Клиент заново прислал скрин прошлого этапа (поиск, корзина): повторять и звать менеджера не нужно, молчим.
      if (vision && vision.via === 'ai' && ['product'].includes(String(vision.kind)) && vision.has_our_product !== false) return { replies: [] };
      {
        const verdict = visionVerdict(vision);
        if (verdict === 'manager') return await visionToManager(lead, vision!);
        if (verdict === 'reject') return r(visionRejectReply(vision!, 'В корзине нужны наш + 2–3 конкурента из топа, и скрин ещё раз 🙌'));
      }
      await updateLead(db, lead.id, {
        status: 'wait_order',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'cart'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_cart', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      return r(MSG_APPROVED_CART());
    }
    return r('Нужен скрин корзины: наш товар + 2–3 конкурента и бренд в избранном ❤️');
  }

  // ── wait_order ───────────────────────────────────────────────────────────
  // ── wait_size: заказ принят, не хватает размера ───────────────────────────
  if (lead.status === 'wait_size') {
    const size = parseSize(text, true);
    if (!size) return r('Напишите размер, который заказали, например M или 46 🙌');
    await updateLead(db, lead.id, { status: 'wait_bank', notes: withSize(lead.notes, size), last_client_text: text });
    await logEvent(db, lead.id, opts.chatId, 'size_done', { size });
    await syncLeadToSheet(db, lead.id);
    return r(lead.deal_type === 'barter' ? MSG_ASK_BANK_BARTER() : MSG_ASK_BANK_CASHBACK());
  }

  if (lead.status === 'wait_order') {
    if (hasPhoto || (!razdachiRowsMode() && /заказ|оформил|выкуп|пвз|доставк/i.test(text))) {
      const vision = hasPhoto ? await readScreen('order') : null;
      // Клиент заново прислал скрин прошлого этапа (поиск, корзина): повторять и звать менеджера не нужно, молчим.
      if (vision && vision.via === 'ai' && ['product', 'cart'].includes(String(vision.kind)) && vision.has_our_product !== false) return { replies: [] };
      {
        const verdict = visionVerdict(vision);
        if (verdict === 'manager') return await visionToManager(lead, vision!);
        if (verdict === 'reject') return r(visionRejectReply(vision!, 'Нужен скрин заказа: цена, ПВЗ/город и дата получения 🙌'));
      }
      const orderMeta = [
        vision?.price ? `цена ${vision.price}` : '',
        vision?.pvz ? `ПВЗ ${vision.pvz}` : '',
        vision?.delivery_date || text.slice(0, 200) || new Date().toISOString().slice(0, 10),
      ].filter(Boolean).join(' · ');
      // Размер: со скрина заказа, из сообщения или из того, что клиент уже писал раньше; нет нигде, спрашиваем как человек.
      const size = parseSize(vision?.size || '', true) || parseSize(text) || sizeOf(lead);
      const baseNotes = visionNote(lead.notes, vision);
      await updateLead(db, lead.id, {
        status: size ? 'wait_bank' : 'wait_size',
        order_received_at: orderMeta.slice(0, 300),
        order_price: vision?.price || lead.order_price,
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'order'),
        notes: size ? withSize(baseNotes, size) : baseNotes,
      });
      await logEvent(db, lead.id, opts.chatId, 'screen_order', { text, hasPhoto, vision, size });
      await syncLeadToSheet(db, lead.id);
      if (!size) return r('Заказ вижу ✅ Подскажите, какой размер заказали?');
      const bankMsg = lead.deal_type === 'barter' ? MSG_ASK_BANK_BARTER() : MSG_ASK_BANK_CASHBACK();
      return r(bankMsg);
    }
    return rAsk('wait_order', 'После оформления пришлите скрин заказа: цена, город/ПВЗ, дата получения.');
  }

  // ── wait_bank ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_bank') {
    if (hasPhoto && text.length < 8) {
      return rAsk('wait_bank', 'Реквизиты текстом: телефон + ФИО + банк (СБП).');
    }
    if (!looksLikeBank(text)) {
      // вопрос про реквизиты/кэш — мозг
      if (shouldUseBrain({ text, status: 'wait_bank', hasPhoto: false, matchedProduct: false })) {
        const { brain } = await runBrain();
        if (brain.reply) return r(brain.reply);
      }
      return rAsk('wait_bank', 'Нужны реквизиты одной строкой: телефон + ФИО + банк (СБП) 🙌');
    }
    // Дату интеграции спрашиваем только если клиент её ещё не называл.
    const haveInt = Boolean(intOf(lead));
    await updateLead(db, lead.id, {
      bank_details: text.slice(0, 1000),
      status: haveInt ? 'wait_pickup' : 'wait_integration',
      last_client_text: '[реквизиты]',
    });
    await logEvent(db, lead.id, opts.chatId, 'bank_done', {});
    await syncLeadToSheet(db, lead.id);
    if (!haveInt) return { ...r('Реквизиты приняла ✅', 'Когда планируете выход интеграции? Напишите дату 🙌'), tag: 'ask:wait_integration' };
    return r('Реквизиты приняла ✅', MSG_ASK_PICKUP());
  }

  // ── wait_integration: ждём дату выхода интеграции ────────────────────────
  if (lead.status === 'wait_integration') {
    const d = parseIntegrationDate(text, true);
    // Вторая часть реквизитов (ФИО отдельным сообщением): дописываем к реквизитам, дату не переспрашиваем
    const isPhone = /^\+?\d[\d\s\-()]{9,}$/.test(text.trim()) && text.replace(/\D/g, '').length >= 10;
    if (!d && (isPhone || /^[А-Яа-яЁёA-Za-z\-]+(?:\s+[А-Яа-яЁёA-Za-z\-]+){1,3}$/.test(text.trim())) && lead.bank_details) {
      await updateLead(db, lead.id, { bank_details: `${lead.bank_details} ${text.trim()}`.slice(0, 1000), last_client_text: text });
      await syncLeadToSheet(db, lead.id);
      return { replies: [] };
    }
    if (!d) return rAsk('wait_integration', 'Напишите дату выхода интеграции, например 28.11 или «завтра» 🙌');
    await updateLead(db, lead.id, { status: 'wait_pickup', notes: withInt(lead.notes, d), last_client_text: text });
    await logEvent(db, lead.id, opts.chatId, 'integration_done', { date: d });
    await syncLeadToSheet(db, lead.id);
    return r(MSG_ASK_PICKUP());
  }

  // ── wait_pickup ──────────────────────────────────────────────────────────
  if (lead.status === 'wait_pickup') {
    if (hasPhoto || /забрал|получил|пвз|сегодня|завтра|\d{1,2}[./]/i.test(text)) {
      const vision = hasPhoto ? await readScreen('pickup') : null;
      // Скрин поиска/корзины/заказа здесь не «получение»: не двигаем этап, решает менеджер
      if (vision && ['product', 'cart', 'order'].includes(String(vision.kind)) && !text.trim().replace(/^скрин$/i, '')) {
        return await visionToManager(lead, vision);
      }
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
      return r(MSG_ASK_REVIEW());
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
      if (next === 'wait_reels') return r('Отзыв на согласовании/принят 👍', MSG_ASK_REELS());
      return r(
        'Супер, зафиксировала ✅ Кэшбек — через 16 дней после получения при выполнении всех условий (отзыв, фото, разрезанные ШК).',
      );
    }
    return r(MSG_ASK_REVIEW());
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
    return r(MSG_ASK_REELS());
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
        return rAsk('done', brain.reply);
      }
    }
    await updateLead(db, lead.id, {
      notes: `${lead.notes || ''}\n[+ ${text.slice(0, 200)}]`.trim(),
      last_client_text: text || (hasPhoto ? '[фото]' : ''),
    });
    // Простое «спасибо/ок/хорошо» после завершения — молчим, иначе выходят похожие дубли
    if (!hasPhoto && /^[\s\p{L}\p{P}\p{S}]{0,30}$/u.test(text) && /^(спасибо|спс|благодарю|ок|окей|хорошо|ладно|понятно|поняла|понял|good|ok|👍|🙏|❤️?)/iu.test(text.trim())) {
      return { replies: [] };
    }
    return rAsk('done', 'Всё на месте 🙌 Если что — напишите');
  }

  // fallback — мозг, иначе мягко в ask_ad
  if (!campaignAccepting(camp)) return r(MSG_CLOSED());
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
  return await modelsReply(db, lead, choices.map((o) => o.product_name || '').filter(Boolean));
}

/** Ключ места: модель и ключевой запрос. */
function slotKey(offer: SheetPlanOffer): string {
  return `${String(offer.product_name || '').trim().toLowerCase()}|${String(offer.keyword || '').trim().toLowerCase()}`;
}

/**
 * Защита от гонки за последнее место: строки в графике появляются после ответа клиенту, поэтому одновременные клиенты видят одно и то же
 * число мест. Каждый записывает заявку на место в свою базу и считает, сколько заявок на эту модель легло раньше него с момента чтения графика.
 * Раньше чтения графика заявки уже вычтены из мест самим графиком, поэтому их не считаем. Если база не отвечает, не блокируем клиента.
 */
export async function claimSlot(db: SupabaseClient, lead: SelfbuyLead, offer: SheetPlanOffer, planAtMs: number): Promise<boolean> {
  const slots = offer.slots_left ?? 0;
  const key = slotKey(offer);
  try {
    const { data: mine, error } = await db.from('alina_selfbuy_events')
      .insert({ lead_id: lead.id, chat_id: lead.chat_id, event_type: 'slot_claim', payload: { key } })
      .select('id, created_at').single();
    if (error || !mine) return true;
    const since = new Date(offer.read_ms ?? planAtMs).toISOString();
    const { data: rows } = await db.from('alina_selfbuy_events').select('id, lead_id, created_at, payload')
      .eq('event_type', 'slot_claim').gte('created_at', since).order('created_at', { ascending: true }).limit(500);
    const seen = new Set<string>();
    let rank = 0;
    const me = mine as { id: string | number; created_at: string };
    for (const r of (rows || []) as Array<{ id: string | number; lead_id: string | null; created_at: string; payload: { key?: string } | null }>) {
      if (r.payload?.key !== key || !r.lead_id) continue;
      const earlier = r.created_at < me.created_at || (r.created_at === me.created_at && String(r.id) < String(me.id));
      if (r.lead_id === lead.id) { if (earlier) return rank < slots; continue; } // уже занимал место раньше: берём его очередь
      if (earlier && !seen.has(r.lead_id)) { seen.add(r.lead_id); rank++; }
    }
    return rank < slots;
  } catch (_) {
    return true;
  }
}


/** Факты о местах для мозга: свободные места по моделям и датам и строки клиента. */
function placesFactFor(username?: string | null): string | null {
  const sheet = getLastRazdachi()?.sheet;
  if (!sheet) return null;
  const today = todayMskKey();
  const free = freeSlots(sheet, today, 14);
  const lines = free.length
    ? free.map((x) => `${x.model}: ${ruDay(x.date, today)}, свободно ${x.rows.length}`)
    : ['свободных мест в ближайшие 14 дней нет'];
  const tg = (username || '').replace(/^@/, '').toLowerCase();
  const mine = sheet.rows.filter((x) => tg && x.tg === tg && x.date >= '' && x.date.length === 10).map((x) => `${x.model} ${ruDay(x.date, today)}`);
  return [`свободные места: ${lines.join('; ')}${tooLateForToday() ? ' (после 20:30 МСК на сегодня уже не берём: заказ нужно сделать до 22:00 МСК)' : ''}`, mine.length ? `у клиента уже закреплено: ${mine.join('; ')}` : 'у клиента пока нет закреплённых мест'].join('\n');
}

/** Клиент назвал другую модель после скрина заказа: заводим отдельную заявку (одна на клиента и модель). */
async function startSecondModelLead(db: SupabaseClient, lead: SelfbuyLead, text: string): Promise<SelfbuyLead | null> {
  const sheet = getLastRazdachi()?.sheet;
  if (!sheet || !lead.product_name) return null;
  const hit = matchModels([...new Set(sheet.rows.map((x) => x.model))], text);
  if (hit.length !== 1 || normModel(hit[0]) === normModel(lead.product_name)) return null;
  const key = normModel(hit[0]);
  const { data: have } = await db.from('alina_selfbuy_leads').select('*')
    .eq('telegram_user_id', lead.telegram_user_id).eq('chat_id', lead.chat_id).eq('model_key', key).maybeSingle();
  if (have) return have as SelfbuyLead;
  const { data: made, error } = await db.from('alina_selfbuy_leads').insert({
    telegram_user_id: lead.telegram_user_id, chat_id: lead.chat_id, username: lead.username, full_name: lead.full_name,
    status: 'new', source_account: lead.source_account, model_key: key,
  }).select('*').single();
  if (error || !made) return null;
  await logEvent(db, (made as SelfbuyLead).id, lead.chat_id, 'second_model_lead', { model: hit[0], first_lead: lead.id });
  return made as SelfbuyLead;
}

/** Модель не уверена, наш ли товар на скрине: клиенту «сверю с менеджером», менеджерам вопрос с пометкой модели. */
async function visionToManager(lead: SelfbuyLead, v: { notes?: string; search_query?: string | null; has_our_product?: boolean | null }): Promise<AlinaReply> {
  await logAlinaRawEvent(lead.chat_id, 'vision_unsure', { notes: v.notes || null, query: v.search_query || null, has_our: v.has_our_product ?? null });
  const group = await managerGroupId();
  const question = `Скрин клиента: Алина не уверена, подходит ли он (наш товар/ключ). Модель в заявке: ${lead.product_name || '—'}; ключ: ${lead.keyword || '—'}. Заметка зрения: ${(v.notes || '—').slice(0, 200)}. Посмотрите скрин в чате и ответьте клиенту.`;
  return {
    replies: ['Секунду, сверю скрин с менеджером и вернусь к вам 🙌'],
    ...(group ? { escalate: { topic: 'скрин клиента', question, group } } : {}),
  };
}

// ── Размер вещи (колонка «Размер»; кэшбека нет, только бартер) ──
const SIZE_RE = '(xxxl|xxl|xl|xxs|xs|s|m|l|\\d{2}(?:\\s*[-/]\\s*\\d{2})?)';

/** Размер из текста: «размер M», «р-р 46», «44-46». В режиме loose годится и просто «M» или «беру 46». */
export function parseSize(text: string, loose = false): string {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  const m = t.match(new RegExp('(?:размер|р-р|р\\.)\\s*[:\\-—]?\\s*' + SIZE_RE + '(?![a-zа-я0-9])', 'i'));
  if (m) return m[1].replace(/\s+/g, '').toUpperCase();
  if (loose) {
    const w = t.trim().match(new RegExp('^(?:беру|заказал[аи]?|взял[аи]?|у меня|мне|это)?\\s*' + SIZE_RE + '\\s*[.!)]*$', 'i'));
    if (w) return w[1].replace(/\s+/g, '').toUpperCase();
  }
  return '';
}

const sizeOf = (lead: SelfbuyLead): string => (lead.notes || '').match(/размер:(\S+)/)?.[1]?.replace(/_/g, ' ') ?? '';
const withSize = (notes: string | null | undefined, size: string): string =>
  `${(notes || '').replace(/\s*размер:\S+/g, '').trim()} размер:${size.replace(/\s+/g, '_')}`.trim();

const intOf = (lead: SelfbuyLead): string => (lead.notes || '').match(/интеграция:(\S+)/)?.[1] ?? '';
const withInt = (notes: string | null | undefined, date: string): string =>
  `${(notes || '').replace(/\s*интеграция:\S+/g, '').trim()} интеграция:${date}`.trim();

/** Это уже отправляли в этом чате за последние сутки (условия, ключ, фото именно этой модели). */
async function alreadySent(db: SupabaseClient, chatId: number, kind: 'tz' | 'key' | 'photo', text: string): Promise<boolean> {
  const { data } = await db.from('alina_selfbuy_events').select('payload').eq('chat_id', chatId).eq('event_type', 'chat_log')
    .eq('payload->>dir', 'alina').eq('payload->>kind', kind).gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .order('created_at', { ascending: false }).limit(6);
  const rows = (data || []) as Array<{ payload: { text?: string } }>;
  if (!rows.length) return false;
  if (kind !== 'photo') return true;
  const named = matchModels(PAJAMA_MODEL_NAMES, text);
  if (!named.length) return true; // фото «вообще»: то, что уже присылали
  return rows.some((x) => named.some((m) => normModel(m) === normModel(x.payload?.text || '')));
}

/** Ответ «что доступно»: одна короткая строка и фото этих моделей (только те, что ещё не отправляли). Помечен tag, второй раз за 5 минут не уйдёт. */
async function modelsReply(db: SupabaseClient, lead: SelfbuyLead, names: string[]): Promise<AlinaReply> {
  const short = (n: string) => n.replace(/^Пижама\s*/i, '');
  const text = names.length === 1
    ? `Сегодня в раздаче «${short(names[0])}». Подойдёт?`
    : names.length ? `Сегодня доступны: ${names.map(short).join(', ')}. Какая нравится?` : 'Какая модель вас интересует?';
  let photos: NonNullable<AlinaReply['photos']> = [];
  if (names.length && names.length <= 4) {
    const { data } = await db.from('alina_selfbuy_events').select('payload').eq('chat_id', lead.chat_id).eq('event_type', 'chat_log')
      .eq('payload->>kind', 'photo').gt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString()).limit(20);
    const sent = new Set(((data || []) as Array<{ payload: { text?: string } }>).map((x) => normModel(x.payload?.text || '')));
    photos = pajamaPhotosFor(names).filter((x) => !sent.has(normModel(x.caption)))
      .map((x) => ({ bytes: x.bytes, mime: x.mime, filename: x.filename, caption: x.caption }));
  }
  return { replies: [text], ...(photos.length ? { photos } : {}), tag: 'models' };
}

/** Повторный вопрос в том же шаге («пришлите скрин…», «реквизиты…», «дата интеграции»): помечаем, чтобы второй раз за 3 минуты он не ушёл. */
function rAsk(status: string, text: string): AlinaReply {
  return { ...r(text), tag: `ask:${status}` };
}

// ── Бронь места в режиме строк (владелец, 24 ноября 2026) ──
const YES_RE = /^(да|давай|ок|окей|хорошо|конечно|бронируй|бронирую|забронируй|бронь|беру|хочу|можно|согласн\S*|угу|ага|подходит|пойдёт|пойдет)(?=[\s!.,]|$)/i;
const NO_RE = /^(нет|не надо|не нужно|не хочу|отмена|не подходит|не буду)(?=[\s!.,]|$)/i;

async function offerLater(db: SupabaseClient, lead: SelfbuyLead, model: string, date: string): Promise<AlinaReply> {
  await logEvent(db, lead.id, lead.chat_id, 'slot_offer', { model, date });
  const day = ruDay(date, todayMskKey());
  return { ...r(`На сегодня «${model}» уже нет 😔\nБлижайшее место: ${day}. Забронировать?`), tag: 'models' as const };
}

async function handleRowsBooking(db: SupabaseClient, lead: SelfbuyLead, text: string): Promise<AlinaReply | null> {
  const t = text.trim();
  // 1. Ответ на предложение даты
  const { data: ev } = await db.from('alina_selfbuy_events').select('event_type, payload, created_at')
    .eq('chat_id', lead.chat_id).in('event_type', ['slot_offer', 'slot_booked', 'slot_declined'])
    .order('created_at', { ascending: false }).limit(1);
  const last = (ev || [])[0] as { event_type: string; payload: { model?: string; date?: string }; created_at: string } | undefined;
  const fresh = last && Date.now() - Date.parse(last.created_at) < 24 * 3600_000;
  if (last?.event_type === 'slot_offer' && fresh && last.payload?.model && last.payload?.date) {
    const { model, date } = last.payload;
    if (YES_RE.test(t)) {
      const res = await bookPlace(db, lead, model!, date!);
      if (res === 'claimed') {
        return r(`Готово ✅ «${model}» за вами на ${ruDay(date!, todayMskKey())}.`, 'Напишите в этот день, и начнём.');
      }
      if (res === 'taken') {
        const sheet = getLastRazdachi()?.sheet;
        const near = sheet ? nearestFree(sheet, model!, todayMskKey(), 14) : null;
        if (near) return await offerLater(db, lead, near.model, near.date);
        return r('Пока писали, это место заняли, а других свободных пока нет. Уточню у менеджера и вернусь к вам.');
      }
      return r('Не получилось записать место, уточню у менеджера и вернусь к вам.');
    }
    if (NO_RE.test(t)) {
      await logEvent(db, lead.id, lead.chat_id, 'slot_declined', { model, date });
      return r('Хорошо, без брони. Если передумаете или захотите другую модель, просто напишите 🙌');
    }
  }
  // Бронь закреплена, клиент отвечает «хорошо / ок / да» или коротким словом: не начинаем заново и не перечисляем места, а коротко подтверждаем.
  if (last?.event_type === 'slot_booked' && fresh && last.payload?.model && last.payload?.date && !/[?]/.test(t) && t.length <= 40 &&
    !/заброн|закрепит|запиш/i.test(t) && matchModels(PAJAMA_MODEL_NAMES, t).length === 0) {
    if (isAck(t)) return { replies: [] };
    return r(`Ваше место «${last.payload.model}» на ${ruDay(last.payload.date, todayMskKey())} закреплено ✅ Напишите мне в этот день, и сразу начнём.`);
  }
  // Бронь только что закреплена, а клиент просит «забронируйте»: подтверждаем уже сделанное, а не берём другую модель.
  if (last?.event_type === 'slot_booked' && fresh && /заброн|закрепит|запиш/i.test(t) && last.payload?.model && last.payload?.date) {
    return r(`Уже закрепила за вами «${last.payload.model}» на ${ruDay(last.payload.date, todayMskKey())} ✅`);
  }
  // 2. Клиент назвал модель, на которую сегодня мест нет
  const sheet = getLastRazdachi()?.sheet;
  if (!sheet) return null;
  const today = todayMskKey();
  const late = tooLateForToday();
  // Поздно вечером места «на сегодня» уже не берём: считаем только будущие даты.
  const slots = freeSlots(sheet, today, 14).filter((x) => !late || x.date !== today);
  const models = [...new Set(sheet.rows.map((x) => x.model))];
  let hit = matchModels(models, t);
  const sinceIso = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  if (hit.length > 1) {
    // Клиент называет модель по частям («со штанами», «шоколадный», «3 в 1 на завтра»): уточняем по последним его сообщениям.
    const { data: recent } = await db.from('alina_selfbuy_events').select('payload').eq('chat_id', lead.chat_id).eq('event_type', 'chat_log')
      .gt('created_at', sinceIso(60)).order('created_at', { ascending: false }).limit(12);
    const ctx = (recent || []).map((e) => e.payload as { dir?: string; text?: string }).filter((p) => p?.dir === 'client').map((p) => String(p.text || '')).reverse().join(' ');
    const narrowed = matchModels(models, `${ctx} ${t}`);
    if (narrowed.length === 1) hit = narrowed;
  }
  if (hit.length > 1) {
    // Цвет есть в нескольких форматах (2в1 и 3в1), а сегодня место только у части: не выбираем за клиента.
    const todayFree = hit.filter((m) => slots.some((x) => x.date === today && x.model.toLowerCase() === m.toLowerCase()));
    if (todayFree.length && todayFree.length < hit.length) {
      const parts = hit.map((m) => {
        const near = slots.find((x) => x.model.toLowerCase() === m.toLowerCase());
        return `${m} — ${near ? ruDay(near.date, today) : 'пока мест нет'}`;
      });
      return r(`Такой цвет есть в нескольких вариантах: ${parts.join('; ')}.`, 'Какой вам подходит? Напишите, и я закреплю место.');
    }
    return null;
  }
  if (hit.length !== 1) return null;
  const model = hit[0];
  const k = model.toLowerCase();
  if (slots.some((x) => x.date === today && x.model.toLowerCase() === k)) return null; // сегодня есть место: идём по обычному пути и берём его сразу
  const near = slots.find((x) => x.model.toLowerCase() === k) ?? null;
  if (!near) return r(`На «${model}» свободных мест в ближайшие дни нет. Уточню у менеджера и вернусь к вам.`);
  // Клиенту уже называли ближайшую дату и спросили модель: он выбрал, бронируем сразу, без повторного «забронировать?».
  const { data: told } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'chat_log')
    .gt('created_at', sinceIso(90)).like('payload->>kind', 'models').limit(1);
  if (told && told.length) {
    const res = await bookPlace(db, lead, near.model, near.date);
    if (res === 'claimed') return r(`Готово ✅ «${near.model}» за вами на ${ruDay(near.date, today)}.`, 'Напишите в этот день, и начнём.');
  }
  return await offerLater(db, lead, near.model, near.date);
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

  if (razdachiRowsMode()) {
    // Режим строк: место это свободная строка листа, берём её сразу (логин клиента в строку), без предложения.
    const place = await takePlaceToday(db, lead, offer.product_name || '');
    if (place.kind === 'later') return await offerLater(db, lead, place.model, place.date);
    if (place.kind === 'none') {
      await updateLead(db, lead.id, { status: 'closed' });
      return r(MSG_CLOSED_FULL());
    }
    if (place.kind === 'unavailable') {
      await logAlinaRawEvent(lead.chat_id, 'razdachi_unmatched', { username: lead.username || null, model: offer.product_name });
      return r('Секунду, уточню у менеджера и вернусь к вам.');
    }
  } else if (!(await claimSlot(db, lead, offer, lastPlanAtMs()))) {
    await updateLead(db, lead.id, { status: 'closed' });
    await logEvent(db, lead.id, lead.chat_id, 'slot_lost', { product: offer.product_name, keyword: offer.keyword });
    return r(MSG_CLOSED_FULL());
  }

  let typed = detectDealType(text) || lead.deal_type || resolveDealFromCampaign(camp);
  // таблица говорит только кэш — бартер не открываем
  if (typed === 'barter' && !barterAvailable(camp) && offer.deal_type !== 'barter' &&
    offer.deal_type !== 'both') {
    typed = 'cashback';
  }
  if (typed === 'barter' && !barterAvailable(camp)) {
    return r(MSG_ONLY_CASHBACK());
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
  if (ig) replies.push(MSG_GOT_IG());
  const tzText = deal === 'barter'
    ? tzBarter(offer?.order_deadline || camp?.order_deadline)
    : TZ_CASHBACK();
  if (razdachiRowsMode()) {
    // Владелец (24 ноября 2026): условия одним сообщением, ключ отправляем после согласия клиента.
    replies.push(`${tzText}\n\nЕсли согласны с условиями, отправлю ключ 🙌`);
    return r(...replies);
  }
  replies.push(msgOpenHuman(deal, product));
  replies.push(tzText);

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
  // Ключ берём из заявки (он взят из строки графика этой модели); ключ кампании по умолчанию может быть от другой модели.
  let planKey = '';
  if (razdachiRowsMode() && lead.product_name) {
    // Ключ берём заново из графика по модели заявки: поле заявки могло остаться от другой модели (так Карине ушёл ключ «со штанами» вместо «с шортами»).
    try {
      const snap = await fetchSheetPlan(false);
      const want = String(lead.product_name).trim().toLowerCase();
      const art = (lead.notes || '').match(/\[арт\s*(\d+)\]/)?.[1];
      const hit = snap.ok
        ? snap.offers.find((o) => (art && String(o.article || '') === art && o.keyword) || (String(o.product_name || '').trim().toLowerCase() === want && o.keyword))
        : null;
      if (hit?.keyword) planKey = String(hit.keyword).trim();
    } catch { /* ключ заявки как запасной */ }
  }
  const keyword = (planKey || lead.keyword || camp?.keyword || Deno.env.get('ALINA_OFFER_KEYWORD') || '').trim();
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
  return ['ТЗ ещё раз 👇', TZ_CASHBACK()];
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
  return r(MSG_ONLY_CASHBACK());
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
      return [MSG_ASK_AD_AGAIN()];
    case 'ask_type':
      return [MSG_NEED_TYPE()];
    case 'ask_filters':
      return [MSG_ASK_FILTERS()];
    case 'tz_sent':
      return tzBundle((lead.deal_type || 'cashback') as DealType, camp, lead);
    case 'key_sent':
    case 'wait_product':
      return ['Продолжаем: скрин поиска с ключом и нашим товаром. Если не находите — напишите.'];
    case 'wait_cart':
      return [MSG_APPROVED_PRODUCT()];
    case 'wait_order':
      return [MSG_APPROVED_CART()];
    case 'wait_bank':
      return [lead.deal_type === 'barter' ? MSG_ASK_BANK_BARTER() : MSG_ASK_BANK_CASHBACK()];
    case 'wait_pickup':
      return [MSG_ASK_PICKUP()];
    case 'wait_review':
      return [MSG_ASK_REVIEW()];
    case 'wait_reels':
      return [MSG_ASK_REELS()];
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
    .order('created_at', { ascending: false })
    .limit(1)
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
  if (error) {
    // Два сообщения нового клиента пришли одновременно: заявку уже создало первое. Берём её, а не падаем.
    const dup = (error as { code?: string }).code === '23505' || /duplicate key/i.test(error.message || '');
    if (dup) {
      const { data: again } = await db
        .from('alina_selfbuy_leads')
        .select('*')
        .eq('telegram_user_id', opts.userId)
        .eq('chat_id', opts.chatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (again) return again as SelfbuyLead;
    }
    throw new Error(`alina lead insert: ${error.message}`);
  }
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
  if (razdachiRowsMode()) {
    // Владелец (24 ноября 2026): главное фото WB не отправляем, по нему товар находят без ключа. Шлём свои фото модели и цвета, встроенные в код.
    const named = matchModels(PAJAMA_MODEL_NAMES, text);
    const open = (await getOpenProductChoices()).map((o) => o.product_name || '').filter(Boolean);
    let shots = named.length ? pajamaPhotosFor(named) : [];
    if (!shots.length && lead.product_name) shots = pajamaPhotosFor([lead.product_name]);
    let ask = '';
    if (!shots.length) {
      shots = pajamaPhotosFor(open);
      ask = 'Выберите модель, которая нравится, и напишите мне 🙌';
    }
    await logEvent(db, lead.id, lead.chat_id, 'product_photo', { text, own: shots.map((x) => x.caption) });
    if (!shots.length) return r('Фото пришлю чуть позже, передала менеджеру 🙌');
    return {
      replies: ask ? [ask] : [],
      photos: shots.map((x) => ({ bytes: x.bytes, mime: x.mime, filename: x.filename, caption: x.caption })),
    };
  }
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
  // 3) артикул в notes лида / кампании (в режиме строк не берём «первый попавшийся» товар кампании)
  if (!matched.offer && !razdachiRowsMode()) {
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
  if (!matched.offer && allOffers.length > 1 && !lead.product_name && razdachiRowsMode()) {
    // Клиент просит фото, не назвав модель: показываем все модели, пока он выбирает.
    const seen = new Set<string>();
    const uniq = allOffers.filter((o) => o.article && o.product_name && !seen.has(o.product_name) && seen.add(o.product_name)).slice(0, 5);
    const shots = await Promise.all(uniq.map(async (o) => ({ o, photo: await fetchWbMainPhoto(o.article!) })));
    const ok = shots.filter((x) => x.photo);
    await logEvent(db, lead.id, lead.chat_id, 'product_photo_all', { text, total: uniq.length, sent: ok.length });
    if (ok.length) {
      return {
        replies: ['Выберите модель, которая нравится, и напишите мне 🙌'],
        photos: ok.map((x) => ({ url: x.photo!.url, bytes: x.photo!.bytes, mime: x.photo!.mime, filename: x.photo!.filename, caption: x.o.product_name! })),
      };
    }
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
    /фильтр|не\s*(выбива\S*|ищет|ищется|нашло|ношла|нашлось)|\d+\s*мин\S*\s+ищу|что\s+делать/i.test(t) ||
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
      if (lead.status === 'ask_filters') return rAsk('ask_filters', MSG_ASK_FILTERS());
      return null;
    }
    // yes → ниже отправим batch
  } else if (cantFindProduct(text)) {
    if (round >= 2) {
      // Обе пачки фильтров отправлены, а клиент всё равно не находит (регион, недоступная карточка): не крутим одно и то же, передаём менеджеру один раз.
      const { data: done } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'filters_escalated')
        .gt('created_at', new Date(Date.now() - 3 * 3600_000).toISOString()).limit(1);
      if (done && done.length) return { replies: [] };
      const group = await managerGroupId();
      await logEvent(db, lead.id, lead.chat_id, 'filters_escalated', { text });
      if (group) {
        return {
          replies: ['Передала менеджеру, он посмотрит и подскажет.'],
          escalate: { topic: 'не находит товар', question: `Клиент не находит товар даже с фильтрами: «${text.slice(0, 200)}». Модель: ${lead.product_name || '—'}, ключ: ${lead.keyword || '—'}. Посмотрите регион и доступность карточки.`, group },
        };
      }
      return r('Попробуйте сортировку «Популярные» и без лишних фильтров кроме тех, что скидывала. Потом скрин поиска с ключом сверху 🙌');
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
      return rAsk('ask_filters', MSG_ASK_FILTERS());
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

/** Диалоги «песочницы» с сайта (отрицательный chat_id, source_account = sandbox) никогда не пишутся в рабочую таблицу. */
export async function isSandboxLead(db: SupabaseClient, leadId: string): Promise<boolean> {
  const { data } = await db.from('alina_selfbuy_leads').select('chat_id, source_account').eq('id', leadId).maybeSingle();
  const l = data as { chat_id?: number | null; source_account?: string | null } | null;
  return Boolean(l && (l.source_account === 'sandbox' || Number(l.chat_id) < 0));
}

async function syncLeadToSheet(db: SupabaseClient, leadId: string) {
  if (await isSandboxLead(db, leadId)) return;
  if (razdachiRowsMode()) {
    // Строки размечены заранее: заполняем свою строку в фоне, ответ клиенту не ждёт таблицу. Новые строки не добавляем.
    const task = syncLeadToRazdachiRow(db, leadId).catch(() => console.error('[alina-selfbuy] razdachi sync'));
    const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edge?.waitUntil) edge.waitUntil(task); else await task;
    return;
  }
  const targetSheet = await resolveActiveSheet(db);
  const sheetId = targetSheet?.sheet_id || '';
  const saJson = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!sheetId || !saJson) {
    console.log('[alina-selfbuy] sheets write skip: need GOOGLE_SERVICE_ACCOUNT_JSON / sheet_id');
    return;
  }

  const { data: lead } = await db.from('alina_selfbuy_leads').select('*').eq('id', leadId)
    .maybeSingle();
  if (!lead) return;

  try {
    const token = await googleAccessToken(saJson);
    const tab = targetSheet?.cabinet_key === 'mars'
      ? 'Раздачи Пижам'
      : (Deno.env.get('ALINA_LEADS_TAB') || 'Список БЛУЗКИ ФОНАРЬ/ВЫРЕЗ ВБ').trim();
    const tg = lead.username
      ? `@${String(lead.username).replace(/^@/, '')}`
      : String(lead.telegram_user_id);
    const qtab = `'${tab.replace(/'/g, "''")}'`;
    const target = `${sheetId}/${tab}`;
    const vid = lead.deal_type === 'barter' ? 'БЛОГЕР' : 'КЭШБЕК';
    const date = lead.order_received_at || new Date().toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
    const pct = lead.cashback_pct == null ? '' : String(lead.cashback_pct);
    const headersRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`${qtab}!A1:W1`)}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!headersRes.ok) throw new Error('Alina cannot read the destination sheet headers');
    const headers = (await headersRes.json()).values?.[0] as string[] | undefined;
    if (!headers?.some((header) => /^(ссылка тг|тг)$/i.test(header.trim()))) {
      throw new Error('Alina destination sheet has no Telegram column');
    }
    const fields = new Map<string, string>([
      ['товар', lead.product_name || ''], ['вид', vid], ['вид раздачи', vid],
      ['ссылка тг', tg], ['тг', tg], ['дата заказа', date], ['цена в заказе', lead.order_price || ''],
      ['цена', lead.order_price || ''], ['размер кэша', pct],
      ['фактическая дата забора', lead.pickup_at || ''], ['факт забора', lead.pickup_at || ''],
      ['дата публикации отзыва', lead.review_planned_at || ''], ['дата отзыва', lead.review_planned_at || ''],
      ['вид отзыва', lead.review_note ? 'Получен' : ''], ['отзыв опубликован', lead.status === 'done' ? 'Да' : ''],
      ['ответственный', 'Алина'], ['ключ', lead.keyword || ''], ['ссылка на reels', lead.reels_url || ''],
    ]);
    const values = [headers.map((header) => fields.get(header.trim().toLowerCase()) ?? null)];

    if (lead.sheet_row && lead.sheet_target === target) {
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
      await db.from('alina_selfbuy_leads').update({ sheet_row: Number(m[1]), sheet_target: target }).eq('id', leadId);
    }
    console.log('[alina-selfbuy] sheet append ok', updated);
  } catch (e) {
    console.error('[alina-selfbuy] sheet sync', e);
  }
}
