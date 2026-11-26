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
  MSG_REELS_TZ,
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
import { classifyAnswer, worthClassifying } from './alina-intent.ts';
import { pickupDateFromText } from './alina-dates.ts';
import { identifyModelFromPhoto } from './alina-model-vision.ts';
import { dayApproved } from './alina-dayplan.ts';
import { moveReviewDate, releaseClientPlace } from './alina-razdachi-sync.ts';
import { BRAND_REPLIES, askedAgainKind, isAck, isBrandQuestion, saysNotReceived } from './alina-guard.ts';
import { freeSlots, matchModels, nearestFree, normModel, dayClosedOn, isModelBlocked, ruDay, setBlockedModels, setDayClosed, setLateException, setTodayOnly, todayOnlyOn, todayMskKey, tooLateForToday } from './alina-razdachi.ts';
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
  | 'wait_shk'
  | 'wait_review'
  | 'wait_reels'
  | 'done'
  | 'closed'
  | 'paused';

export type DealType = 'cashback' | 'barter';

const MSG_PICKUP_LATER = 'Всё записала ✅ Когда заказ придёт в пункт выдачи, напомню, и вы пришлёте фото с разрезанными штрихкодами 🙌';
const RECEIVED_RE = /(?<!не\s)(?:забрал[аи]?|получил[аи]?|заб[её]р\s+сделал[аи]?|(?:товар|заказ|пижам\S*)\s+(?:уже\s+)?(?:у\s+меня|пришл\S+))/i;

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
    /** Фото модели без подписи: название модели пишем только в журнал, клиент выбирает ответом (реплаем) на фото. */
    model?: string;
    hideCaption?: boolean;
  }[];
  /** Вопрос уходит менеджерам: Telegram-слой отправляет его в группу (песочница только показывает). */
  escalate?: { topic: string; question: string; group: number };
  /** Ответить реплаем на своё прежнее сообщение этого вида («Отправила выше»). */
  replyToKind?: 'tz' | 'key' | 'photo';
  /** Вместо отдельного «принято» ставим реакцию на сообщение клиента; если не вышло, уходит reactFallback. */
  react?: string;
  reactFallback?: string;
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
  // Логин появился у клиента позже (создал в Telegram): подставляем его во все заявки чата, иначе в таблицу писать нечего.
  if (String(opts.username || '').trim()) {
    await admin().from('alina_selfbuy_leads').update({ username: String(opts.username).replace(/^@/, '') }).eq('chat_id', opts.chatId).is('username', null).then(() => undefined, () => undefined);
  }
  // ── Алина 2.0: картинка модели вместо названия ───────────────────────────────────────────────────
  // Клиент без заказа в работе присылает фото или скрин пижамы («вот эта»): определяем модель по нашим фото и дальше ведём, как будто он назвал её словами.
  if (razdachiRowsMode() && opts.hasPhoto && opts.photoFileId && opts.botToken) {
    try {
      const dbm = admin();
      const { data: ls } = await dbm.from('alina_selfbuy_leads').select('status').eq('chat_id', opts.chatId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const st = String((ls as { status?: string } | null)?.status || 'new');
      const { data: busy } = await dbm.from('alina_selfbuy_leads').select('id').eq('chat_id', opts.chatId)
        .in('status', ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order', 'wait_size', 'wait_bank', 'wait_integration', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels']).limit(1);
      if (['new', 'closed', 'ask_ad', 'ask_type'].includes(st) && !(busy && busy.length)) {
        const found = await identifyModelFromPhoto(opts.botToken, opts.photoFileId);
        await logAlinaRawEvent(opts.chatId, 'model_from_photo', { model: found });
        if (found) opts = { ...opts, text: `${found}${opts.text ? ' ' + opts.text : ''}`, hasPhoto: false, photoFileId: undefined };
      }
    } catch (e) { console.warn('[alina2] model photo', e); }
  }
  // ── Алина 2.0: ожидаемый ответ и понимание коротких ответов ───────────────────────────────────────────
  if (razdachiRowsMode() && (opts.text || '').trim() && !opts.hasPhoto) {
    try {
      const db2 = admin();
      const since = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
      const { data: exs } = await db2.from('alina_selfbuy_events').select('id, event_type, payload, created_at').eq('chat_id', opts.chatId)
        .in('event_type', ['expect', 'expect_done']).gt('created_at', since(360)).order('created_at', { ascending: false }).limit(2);
      const lastEx = (exs || [])[0] as { id: string; event_type: string; payload: { kind?: string; model?: string; date?: string }; created_at: string } | undefined;
      const pendingEx = lastEx && lastEx.event_type === 'expect' ? lastEx : undefined;
      // Последний вопрос Алины
      const { data: lastOut } = await db2.from('alina_selfbuy_events').select('payload, created_at').eq('chat_id', opts.chatId).eq('event_type', 'chat_log')
        .eq('payload->>dir', 'alina').gt('created_at', since(60)).order('created_at', { ascending: false }).limit(3);
      const lastQ = ((lastOut || []) as Array<{ payload: { text?: string } }>).map((x) => String(x.payload?.text || '')).find((t) => /\?\s*(?:[^\p{L}\p{N}]*)$/u.test(t.trim()));
      let answer: 'yes' | 'no' | 'other' = isYes(opts.text || '') ? 'yes' : isNo(opts.text || '') ? 'no' : 'other';
      if (answer === 'other' && (pendingEx || lastQ) && worthClassifying(opts.text || '') && !isAck(opts.text || '')) {
        answer = await classifyAnswer(lastQ || String(pendingEx?.payload?.kind || ''), opts.text || '');
        if (answer !== 'other') await logAlinaRawEvent(opts.chatId, 'intent_resolved', { text: (opts.text || '').slice(0, 80), answer });
      }
      if (pendingEx) {
        if (answer === 'no') await logAlinaRawEvent(opts.chatId, 'expect_done', { ref: pendingEx.id, result: 'no' });
        else if (answer === 'yes') {
          const done = await handleExpectedYes(db2, opts, pendingEx.payload);
          await logAlinaRawEvent(opts.chatId, 'expect_done', { ref: pendingEx.id, result: 'yes' });
          if (done) return done;
        }
      } else if (answer === 'yes' && !isYes(opts.text || '')) {
        opts = { ...opts, text: 'Да' }; // шаблон не узнал, а смысл «да»: дальше работает обычная логика
      }
    } catch (e) { console.warn('[alina2] expect', e); }
  }
  // У клиента нет логина в Telegram: в строку таблицы писать нечего, место не закрепить. Просим логин один раз, дальше берём его из ответа.
  if (razdachiRowsMode() && !String(opts.username || '').trim() && (opts.text || '').trim() && !opts.hasPhoto) {
    const t0 = (opts.text || '').trim();
    const m0 = t0.match(/@([A-Za-z][A-Za-z0-9_]{4,31})/) || t0.match(/^([A-Za-z][A-Za-z0-9_]{4,31})$/);
    if (m0) {
      await admin().from('alina_selfbuy_leads').update({ username: m0[1] }).eq('chat_id', opts.chatId).is('username', null).then(() => undefined, () => undefined);
      await logAlinaRawEvent(opts.chatId, 'username_given', { username: m0[1] });
      opts = { ...opts, username: m0[1] };
    } else {
      const { data: asked } = await admin().from('alina_selfbuy_events').select('id').eq('chat_id', opts.chatId).eq('event_type', 'ask_username')
        .gt('created_at', new Date(Date.now() - 12 * 3600_000).toISOString()).limit(1);
      if (!asked || !asked.length) {
        await logAlinaRawEvent(opts.chatId, 'ask_username', { text: t0.slice(0, 120) });
        return r('Чтобы закрепить за вами место, мне нужен ваш логин в Telegram (он начинается с @, например @name).', 'Напишите его, пожалуйста 🙌');
      }
    }
  }
  // Разовое исключение владельца: пока не истекло, место на сегодня берём и поздно вечером.
  try {
    const { data: ex } = await admin().from('alina_settings').select('value').eq('key', 'lateException').maybeSingle();
    const until = Date.parse(String((ex?.value as { until?: string } | null)?.until || ''));
    const only = String((ex?.value as { login?: string } | null)?.login || '').replace(/^@/, '').toLowerCase();
    const me = String(opts.username || '').replace(/^@/, '').toLowerCase();
    setLateException(Number.isFinite(until) && until > Date.now() && (!only || only === me));
  } catch { setLateException(false); }
  // Модели, недоступные на WB (alina_settings.blockedModels): не предлагаем и не бронируем.
  try {
    const { data: bm } = await admin().from('alina_settings').select('value').eq('key', 'blockedModels').maybeSingle();
    setBlockedModels(Array.isArray(bm?.value) ? (bm!.value as string[]) : []);
  } catch { setBlockedModels([]); }
  // Только на сегодня, без броней (alina_settings.todayOnly {day: 'ДД.ММ.ГГГГ'}): действует только в указанный день.
  try {
    const { data: to } = await admin().from('alina_settings').select('value').eq('key', 'todayOnly').maybeSingle();
    setTodayOnly(String((to?.value as { day?: string } | null)?.day || '') === todayMskKey());
  } catch { setTodayOnly(false); }
  // План дня должен быть согласован владельцем (ответ «ок» в группе менеджеров), пока нет, места на сегодня не отдаём.
  try { setDayClosed(razdachiRowsMode() && !(await dayApproved(admin()))); } catch { setDayClosed(false); }
  // «Эту ищем?» (с фото или без) после ключа: показываем нашу модель из заявки и повторяем, что искать (владелец, 26 ноября 2026).
  if (razdachiRowsMode() && /(?:эту|эта|такую|это)\s+(?:ищем|искать|ищу|пижам\S*)?\s*\?|эту\s+ищем/i.test((opts.text || '').slice(0, 200))) {
    try {
      const db1 = admin();
      const { data: l1 } = await db1.from('alina_selfbuy_leads').select('*').eq('chat_id', opts.chatId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const lead1 = l1 as SelfbuyLead | null;
      if (lead1 && lead1.product_name && ['key_sent', 'wait_product', 'tz_sent'].includes(String(lead1.status))) {
        const mine1 = await resolveLeadArticle(lead1, null).catch(() => null);
        const photo1 = mine1?.article ? await fetchWbMainPhoto(mine1.article).catch(() => null) : null;
        if (photo1?.bytes) {
          await logEvent(db1, lead1.id, opts.chatId, 'main_photo_sent', { text: opts.text });
          return {
            replies: [`Ваше место на «${lead1.product_name.replace(/^Пижама\s+/i, '')}», вот главное фото нашего товара 🙌 По фото не ищем: вбейте ключ${lead1.keyword ? ` «${lead1.keyword}»` : ''} в поиск, найдите этот товар и пришлите скрин, чтобы сверху был виден запрос.`],
            photos: [{ bytes: photo1.bytes, mime: photo1.mime, filename: photo1.filename, caption: '' }],
          } as never;
        }
        // Главного фото WB достать не вышло: показываем свою фото модели, чтобы клиент понял, какой товар ищем.
        const ph2 = await handleProductPhotoRequest(db1, lead1, null, 'покажите ' + lead1.product_name);
        if (ph2?.photos?.length) {
          await logEvent(db1, lead1.id, opts.chatId, 'model_shown', { model: lead1.product_name });
          return { ...ph2, replies: [`Ваше место на «${lead1.product_name.replace(/^Пижама\s+/i, '')}», вот фото 🙌 Вбейте ключ${lead1.keyword ? ` «${lead1.keyword}»` : ''} в поиск WB, найдите этот товар и пришлите скрин, чтобы сверху был виден запрос.`] } as never;
        }
      }
    } catch (e) { console.warn('[alina] show model', e); }
  }
  // Клиент передумал и называет другую модель, пока не заказал (ТЗ/ключ/поиск/корзина): освобождаем прежнюю строку и ведём заново по новой модели.
  if (razdachiRowsMode() && !opts.photoFileId && (opts.text || '').length <= 80) {
    try {
      const db2 = admin();
      const { data: l2 } = await db2.from('alina_selfbuy_leads').select('*').eq('chat_id', opts.chatId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const lead2 = l2 as SelfbuyLead | null;
      if (lead2?.product_name && ['tz_sent', 'key_sent', 'wait_product', 'wait_cart'].includes(String(lead2.status))) {
        const hit2 = matchModels(PAJAMA_MODEL_NAMES, opts.text || '');
        const sheet2 = getLastRazdachi()?.sheet;
        if (hit2.length === 1 && normModel(hit2[0]) !== normModel(lead2.product_name) && sheet2 &&
          freeSlots(sheet2, todayMskKey(), 0).some((x) => x.date === todayMskKey() && normModel(x.model) === normModel(hit2[0]))) {
          const freed = await releaseClientPlace(db2, lead2 as never);
          if (freed !== null) {
            await updateLead(db2, lead2.id, { status: 'closed', product_name: null, keyword: null, sheet_row: null, sheet_target: null } as never);
            await logEvent(db2, lead2.id, opts.chatId, 'model_switched', { from: lead2.product_name, to: hit2[0] });
          }
        }
      }
    } catch (e) { console.warn('[alina] model switch', e); }
  }
  // «Это за отзыв?», «что взамен?»: коротко объясняем суть бартера и сразу зовём выбрать модель (владелец, 26 ноября 2026).
  if (razdachiRowsMode() && !opts.photoFileId && (opts.text || '').length <= 120 &&
    /за\s+(?:отзыв|видео|рилс\S*|рэлс|reels)|(?:это|у\s+вас)\s+бартер|что\s+(?:вза[мм]ен|нужно\s+сделать|надо\s+сделать|я\s+должна)|бесплатно\s*\?|в\s+обмен\s+на/i.test(opts.text || '')) {
    try {
      const db4 = admin();
      const { data: l4 } = await db4.from('alina_selfbuy_leads').select('status').eq('chat_id', opts.chatId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      const st4 = String((l4 as { status?: string } | null)?.status || 'new');
      if (['new', 'closed', 'ask_ad', 'ask_type'].includes(st4)) {
        const sheet4 = getLastRazdachi()?.sheet;
        const names4 = sheet4 ? [...new Set(freeSlots(sheet4, todayMskKey(), 0).filter((x) => x.date === todayMskKey()).map((x) => x.model.replace(/^Пижама\s+/i, '')))] : [];
        return { replies: [`Да 🙌 Это бартер: пижама за рилс (видео) и отзыв на WB.${names4.length ? ` Сегодня в наличии: ${names4.join(', ')}. Выберите одну модель 🙌` : ''}`], tag: 'models' } as never;
      }
    } catch (e) { console.warn('[alina] barter faq', e); }
  }
  let res = await handleAlinaClientMessageInner(opts);
  // Алина пообещала фото («вот обе», «секунду, отправлю»), а фото в ответе нет: добавляем свои фото моделей, иначе клиент остаётся с пустым обещанием.
  if (razdachiRowsMode() && !(res.photos && res.photos.length) && res.replies.some((x) => x.length < 140 && /вот обе|вот фото|вот они|секунду,?\s*отправлю|сейчас\s+отправлю|пришлю\s+фото|высылаю\s+фото|подписала/i.test(x))) {
    try {
      const db0 = admin();
      const { data: l0 } = await db0.from('alina_selfbuy_leads').select('*').eq('chat_id', opts.chatId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (l0) {
        const ph = await handleProductPhotoRequest(db0, l0 as SelfbuyLead, null, 'покажите все модели');
        if (ph?.photos?.length) res = { ...res, photos: ph.photos, replies: res.replies.filter((x) => !(x.length < 140 && /секунду,?\s*отправлю|сейчас\s+отправлю|пришлю\s+фото/i.test(x))) };
      }
    } catch (e) { console.warn('[alina] photo promise', e); }
  }
  // Алина сказала «сегодня мест нет», а в таблице на сегодня места есть (клиент написал неточно: «2 можно?»): вместо отказа называем, что есть сегодня.
  if (razdachiRowsMode() && !tooLateForToday() && res.replies.length && !(res.photos && res.photos.length) && res.replies.some((x) => /мест[^.!?\n]{0,60}\sнет|нет\s+мест|разобрал|попробуйте\s+завтра|напишите\s+завтра/i.test(x))) {
    try {
      const sheet = getLastRazdachi()?.sheet;
      const today = todayMskKey();
      const names = sheet ? [...new Set(freeSlots(sheet, today, 0).filter((x) => x.date === today).map((x) => x.model.replace(/^Пижама\s+/i, '')))] : [];
      if (names.length) res = { ...res, replies: [`Сегодня есть: ${names.join(', ')}. Какую выберете?`], tag: 'models' };
    } catch { /* оставляем ответ как есть */ }
  }
  // Клиент назвал только формат («давайте 3в1»): показываем цвета этого формата, а не весь список.
  if (razdachiRowsMode() && res.replies.length && (res as { tag?: string }).tag === 'models') {
    const fm = (opts.text || '').match(/(?:^|[^\d])([23])\s?в\s?1(?![а-яa-z])/i);
    const sheet3 = getLastRazdachi()?.sheet;
    if (fm && sheet3 && matchModels(PAJAMA_MODEL_NAMES, opts.text || '').length > 1) {
      const names3 = [...new Set(freeSlots(sheet3, todayMskKey(), 0).filter((x) => x.date === todayMskKey() && normModel(x.model).includes(`${fm[1]}в1`)).map((x) => x.model.replace(/^Пижама\s+[23]в1\s*/i, "")))];
      // Свободен единственный цвет этого формата: клиент по сути его выбрал, начинаем заявку сразу.
      if (names3.length === 1 && /^\s*(?:да\S*|хорошо|давайте|хочу|беру|возьму|можно)?[\s,.!]*(?:.{0,15})?[23]\s?в\s?1[\s?.!]*$/i.test(opts.text || '')) {
        res = await handleAlinaClientMessageInner({ ...opts, text: `Пижама ${fm[1]}в1 ${names3[0]}` });
      } else
      if (names3.length) res = { ...res, replies: [names3.length === 1 ? `${fm[1]}в1 сегодня есть один цвет: ${names3[0]}. Берёте? 🙌` : `${fm[1]}в1 сегодня есть: ${names3.join(', ')}. Какой цвет берёте?`] };
    }
  }
  // Список моделей столбиком («• Пижама 3в1 …») может прийти от ИИ со всеми моделями подряд, включая закончившиеся: оставляем только те, что есть сегодня.
  if (razdachiRowsMode() && res.replies.some((x) => /•\s*Пижама/.test(x))) {
    try {
      const sheet6 = getLastRazdachi()?.sheet;
      const free6 = sheet6 ? [...new Set(freeSlots(sheet6, todayMskKey(), 0).filter((x) => x.date === todayMskKey()).map((x) => x.model))] : [];
      if (sheet6) {
        res = { ...res, replies: res.replies.map((x) => {
          if (!/•\s*Пижама/.test(x)) return x;
          const asked = [...x.matchAll(/•\s*(Пижама[^\n]*)/g)].map((m) => m[1].trim());
          const alive = asked.filter((a) => free6.some((f) => normModel(f) === normModel(a)));
          const short = (n: string) => n.replace(/^Пижама\s+/i, '');
          if (alive.length) return `Сегодня доступны: ${alive.map(short).join(', ')}. Какую берёте? Выберите одну модель 🙌`;
          return free6.length ? `Этих моделей на сегодня уже нет. Есть: ${free6.map(short).join(', ')}. Какую берёте? Выберите одну модель 🙌` : 'На сегодня места закончились 🙏';
        }) };
      }
    } catch { /* оставляем как есть */ }
  }
  // Осталась одна модель на сегодня: не просим выбирать из списка, а прямо говорим, что доступна одна (владелец, 26 ноября 2026).
  if (razdachiRowsMode() && res.replies.length && (res as { tag?: string }).tag === 'models') {
    try {
      const sheet5 = getLastRazdachi()?.sheet;
      const free5 = sheet5 ? [...new Set(freeSlots(sheet5, todayMskKey(), 0).filter((x) => x.date === todayMskKey()).map((x) => x.model))] : [];
      if (free5.length === 1 && !tooLateForToday()) {
        const only = free5[0];
        await logAlinaRawEvent(opts.chatId, 'expect', { kind: 'start_deal', model: only, by: 'one_model' });
        const left5 = freeSlots(sheet5!, todayMskKey(), 0).filter((x) => x.date === todayMskKey() && normModel(x.model) === normModel(only)).reduce((n, x) => n + x.rows.length, 0);
        res = { ...res, photos: undefined, replies: [`Сегодня доступна только одна модель: «${only.replace(/^Пижама\s+/i, '')}»${left5 && left5 <= 5 ? ` (осталось мест: ${left5})` : ''} 🙌 Берёте? Напишите «да», и пришлю условия.`] };
      }
    } catch { /* оставляем список */ }
  }
  // Список моделей для выбора всегда заканчивается просьбой выбрать одну (владелец, 26 ноября 2026): клиенты иначе называют сразу несколько.
  if (res.replies.length) {
    const hasPhotos = Boolean(res.photos && res.photos.length);
    res = { ...res, replies: res.replies.map((x) => ((x.match(/[23]\s?в\s?1/gi) || []).length >= 2 && /\?\s*(?:🙌|🙏|😊)?\s*$/.test(x) && !/выберите\s+(?:одну|1)/i.test(x)) ? `${x.replace(/\s*(?:🙌|🙏|😊)?\s*$/, '')} ${hasPhotos ? 'Выберите одну модель: ответьте (реплаем) на её фото 🙌' : 'Выберите одну модель 🙌'}` : x) };
  }
  // Одинокая дата после записи заказа: не молчим, уточняем, о какой дате речь.
  if (!res.replies.length && !(res.photos && res.photos.length) && !res.react && /^\s*\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\s*$/.test(opts.text || '')) {
    res = { ...res, replies: [`Уточните, пожалуйста: ${(opts.text || '').trim()} это новая дата интеграции или дата, когда заберёте заказ? 🙌`] };
  }
  // Диагностика: клиент написал по делу, а ответа нет (не «ок/спасибо»). Пишем в журнал, на каком этапе так вышло, чтобы найти причину.
  if (!res.replies.length && !(res.photos && res.photos.length) && !res.react && !res.escalate && !isAck(opts.text || '') && (opts.text || '').trim()) {
    await logAlinaRawEvent(opts.chatId, 'empty_reply', { text: (opts.text || '').slice(0, 160) });
  }
  // Место уже освобождено после «не нашёл» (лесенка): повторное «освобождаю место» в ответ на отказ клиента не шлём.
  if (res.replies.length && res.replies.some((x) => /освобожда\S*\s+(?:ваше\s+)?мест/i.test(x))) {
    const { data: rel } = await admin().from('alina_selfbuy_events').select('id').eq('chat_id', opts.chatId).eq('event_type', 'not_found_released')
      .gt('created_at', new Date(Date.now() - 12 * 3600_000).toISOString()).limit(1);
    if (rel && rel.length && !(res.replies.some((x) => /не\s+получилось\s+помочь/i.test(x)))) res = { ...res, replies: [] };
  }
  // Менеджеру передаём, если Алина пообещала «уточню / спрошу / передам» (в любой формулировке) или клиент прямо зовёт менеджера.
  const promised = res.replies.some((x) => /уточню|спрошу|передам|узнаю у|выясню|сверю/i.test(x));
  const asksManager = /(?:^|[^а-яё])(менеджер\S*|оператор\S*|живо\S* человек\S*|администратор\S*)(?![а-яё])/i.test((opts.text || '').slice(0, 300));
  if (res.escalate || !(promised || asksManager)) return await withHuman(res, opts.text);
  const group = await managerGroupId();
  if (!group) return await withHuman(res, opts.text);
  // Менеджеру этот клиент уже писал за последние 10 минут: второй раз не передаём и «уточню» не повторяем.
  {
    const { data: recent } = await admin().from('alina_selfbuy_events').select('id').eq('chat_id', opts.chatId).eq('event_type', 'manager_escalated')
      .gt('created_at', new Date(Date.now() - 10 * 60_000).toISOString()).limit(1);
    if (recent && recent.length) {
      await logAlinaRawEvent(opts.chatId, 'escalation_suppressed', { text: (opts.text || '').slice(0, 120) });
      return { ...res, replies: res.replies.filter((x) => !/уточню|спрошу|передам|узнаю у|выясню|сверю/i.test(x)) };
    }
  }
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
  // Клиент с оформленным заказом присылает фото (разрезанные ШК, отзыв): ведём по его живой заявке, а не по закрытой или новой (иначе Алина снова спросит модель).
  // Так же для текста: клиент с заказом в работе не считается новым (иначе ему снова предлагают модели и места). Вторую модель ведёт обработчик «по очереди».
  if (['new', 'closed', 'ask_ad', 'ask_type'].includes(String(lead.status))) {
    const { data: active } = await db.from('alina_selfbuy_leads').select('*').eq('chat_id', opts.chatId)
      .in('status', ['wait_size', 'wait_bank', 'wait_integration', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels', 'done']).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (active) lead = active as SelfbuyLead;
  }

  // Старые/зависшие статусы → снова уточняем объявление
  if (
    (lead.status === 'ask_type' || String(lead.status) === 'ask_order') &&
    !lead.deal_type
  ) {
    await updateLead(db, lead.id, { status: 'ask_ad' });
    lead = { ...lead, status: 'ask_ad' };
  }

  // Вторая модель по очереди: первая заявка прошла этап скрина заказа, клиент называет другую модель → отдельная заявка на неё.
  if (razdachiRowsMode() && !hasPhoto && ['wait_bank', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status))) {
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

  // «Можно две модели?», «сколько костюмов могу взять?»: честный ответ по наличию, по очереди одну за другой (владелец, 25 ноября 2026).
  if (razdachiRowsMode() && !hasPhoto && QTY_RE.test(text)) {
    const qty = await handleQuantityQuestion(db, lead);
    if (qty) return qty;
  }

  // Клиент пишет, что его размера нет (владелец, 25 ноября 2026): предлагаем другую модель; если и её нет, переносим на следующий день и убираем из строки на сегодня.
  if (razdachiRowsMode() && !hasPhoto) {
    const moved = await handleSizeMissing(db, lead, text);
    if (moved) return moved;
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
    const abVars: { bytes: Uint8Array; mime: string }[] = []; // варианты идущего A/B-теста: первыми в списке эталонов
    let article = expectArticle;
    if (razdachiRowsMode() && (stage === 'product' || stage === 'cart' || stage === 'order')) {
      const mine = await resolveLeadArticle(lead, camp).catch(() => null);
      if (mine?.article) article = mine.article;
      const ref = article ? await fetchWbMainPhoto(article).catch(() => null) : null;
      if (ref?.bytes) reference = { bytes: ref.bytes, mime: ref.mime || 'image/jpeg' };
      // На скрине может быть не только главное фото, но и следующие кадры галереи карточки: берём ещё 2-е и 3-е как эталоны.
      if (article) {
        for (const idx of [2, 3, 4, 5, 6]) {
          const extra = await fetchWbMainPhoto(article, idx).catch(() => null);
          if (extra?.bytes) abRefs.push({ bytes: extra.bytes, mime: extra.mime || 'image/jpeg' });
        }
      }
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
              if (buf.length > 800) abVars.push({ bytes: buf, mime: res.headers.get('content-type') || 'image/jpeg' });
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
      references: [...(reference ? [reference] : []), ...abRefs, ...abVars],
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

  // Реквизиты без просьбы (владелец, 25 ноября 2026): клиент прислал их сам до нужного шага. Не записываем молча, а переспрашиваем «это реквизиты?».
  if (razdachiRowsMode() && !hasPhoto && !lead.bank_details && lead.status !== 'wait_bank' && lead.status !== 'wait_integration' && ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order', 'wait_size'].includes(String(lead.status))) {
    const { data: ask } = await db.from('alina_selfbuy_events').select('payload').eq('chat_id', lead.chat_id).eq('event_type', 'requisites_ask')
      .gt('created_at', new Date(Date.now() - 30 * 60_000).toISOString()).order('created_at', { ascending: false }).limit(1);
    const pending = ((ask || [])[0]?.payload as { text?: string } | undefined)?.text;
    if (pending && isYes(text)) {
      await updateLead(db, lead.id, { bank_details: pending.slice(0, 1000), last_client_text: '[реквизиты]' });
      await logEvent(db, lead.id, opts.chatId, 'bank_done', { early: true });
      await syncLeadToSheet(db, lead.id);
      return { replies: [], react: '❤', reactFallback: '❤' };
    }
    if (looksLikeBank(text)) {
      await logEvent(db, lead.id, opts.chatId, 'requisites_ask', { text });
      return r('Это реквизиты для выплаты?');
    }
  }
  // Главное фото (владелец, 25 ноября 2026): если клиент просит главное фото карточки, даём настоящее главное фото WB (или по «да» на наше предложение).
  if (razdachiRowsMode() && !hasPhoto && ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'ask_filters'].includes(String(lead.status))) {
    let wantMain = MAIN_PHOTO_RE.test(text);
    if (!wantMain && isYes(text)) {
      const { data: offer } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'main_photo_offer')
        .gt('created_at', new Date(Date.now() - 6 * 3600_000).toISOString()).limit(1);
      wantMain = Boolean(offer && offer.length);
    }
    if (wantMain) {
      const mine = await resolveLeadArticle(lead, camp).catch(() => null);
      const photo = mine?.article ? await fetchWbMainPhoto(mine.article).catch(() => null) : null;
      if (photo?.bytes) {
        await logEvent(db, lead.id, lead.chat_id, 'main_photo_sent', { text });
        return {
          replies: [`Вот главное фото нашего товара. По фото не ищем: вбейте ключ${lead.keyword ? ` «${lead.keyword}»` : ''} в поиск, найдите этот товар и пришлите скрин 🙌`],
          photos: [{ bytes: photo.bytes, mime: photo.mime, filename: photo.filename, caption: '' }],
        };
      }
    }
  }
  // Фото товара с WB (по контексту диалога / названию в сообщении)
  // Фото модели шлём только в начале (выбор модели). Когда процесс идёт дальше или речь про отзыв («пример фото отзыва»), фото пижамы не отправляем.
  const lateStage = ['wait_bank', 'wait_size', 'wait_integration', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status));
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

  // Клиент передумал или «просто хотела посмотреть условия» (25 ноября 2026): место сразу освобождаем и отдаём другим, а не держим закреплённым.
  if (razdachiRowsMode() && ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order'].includes(String(lead.status)) && !hasPhoto && text.length <= 90
    && /(?:^|[^а-яё])(?:стоп|не\s+надо|не\s+хочу|не\s+буду|не\s+нужно|передума\S*|отказыва\S*|не\s+актуальн\S*|не\s+подходит|не\s+готов\S*|просто\s+(?:хоте\S*|смотре\S*|интересно|узна\S*))/i.test(text)
    && !/(?:^|[^а-яё])(?:не\s+нашл\S*|не\s+наход\S*|не\s+могу)/i.test(text)) {
    const row = await releaseClientPlace(db, lead).catch(() => null);
    await updateLead(db, lead.id, { status: 'closed', sheet_row: null, last_client_text: text });
    await logEvent(db, lead.id, opts.chatId, 'declined_released', { text, row });
    return r('Хорошо, освободила место, спасибо за интерес 🙌', 'Если захотите вернуться, напишите.');
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
  // Приписку «(в ответ на «…»)» (цитата сообщения, на которое ответил клиент) в запросах ТЗ и ключа не учитываем: «Я забрала» в ответ на «скиньте скрин…» не просьба прислать ТЗ.
  const bareText = text.replace(/\s*\(в ответ на[\s\S]*$/, '');
  if (wantsTz(bareText)) {
    const deal = (lead.deal_type || resolveDealFromCampaign(camp) || 'cashback') as DealType;
    return r(...tzBundle(deal, camp, lead));
  }
  if (wantsKey(bareText)) {
    return await sendKeyFlow(db, lead, camp, text);
  }

  // Режим строк: клиент, которому уже сказали «сегодня мест нет», пишет дальше («хорошо», вопрос): не повторяем список мест, а отвечаем по делу.
  if (razdachiRowsMode() && lead.status === 'closed' && !campaignAccepting(camp) && !hasPhoto) {
    // Клиент записан на будущий день и уже просит фильтры или пишет «не могу найти»: объясняем, что поиск начнём в его день.
    if (/фильтр|не\s+могу\s+найти|не\s+нахожу/i.test(text)) {
      const { data: resv } = await db.from('alina_sheet_reservations').select('order_day').eq('lead_id', lead.id).limit(5);
      const future = (resv || []).map((x) => String(x.order_day || '')).find((d) => d && d !== todayMskKey());
      if (future) return r(`Поиск и заказ начнём в ваш день, ${ruDay(future, todayMskKey())}: тогда пришлю ключ и главное фото, фильтры не нужны ✅`);
    }
    if (isAck(text)) return { replies: [] };
    const { brain: closedBrain } = await runBrain();
    if (closedBrain.via === 'ai' && closedBrain.reply) return r(closedBrain.reply);
  }

  // Клиент уже держит строку на сегодня (записан вручную, бронью или после «начинаем?») и отвечает «да» или называет модель: начинаем по его строке, а не «мест нет».
  if (razdachiRowsMode() && ['new', 'ask_ad', 'ask_type', 'closed'].includes(lead.status) && !lead.deal_type && !hasPhoto && !tooLateForToday() && (isYes(text) || matchModels(PAJAMA_MODEL_NAMES, text).length > 0)) {
    const own = clientRowsToday(lead.username);
    const sh = getLastRazdachi()?.sheet;
    if (own.state === 'ok' && sh && new Set(own.rows.map((x) => normModel(x.model))).size === 1) {
      const row = own.rows[0];
      const named = matchModels(PAJAMA_MODEL_NAMES, text);
      if (!named.length || named.some((n) => normModel(n) === normModel(row.model))) {
        const keyIdx = sh.col.key;
        const mine = {
          date: null, deal_type: 'barter', product_name: row.model, keyword: keyIdx != null ? String(row.cells[keyIdx] ?? '').trim() || null : null,
          article: null, cashback_pct: null, plan_slots: 1, used_slots: 0, slots_left: 1, order_deadline: null, is_open: true, status_raw: null, tab: '', row_index: 0,
        } as unknown as SheetPlanOffer;
        return await startDealFromOffer(db, lead, camp, mine, text);
      }
    }
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
        if (dayClosedOn()) return { ...r('Сейчас уточняю наличие на сегодня и вернусь к вам в течение дня 🙌'), tag: 'models' as const };
        return { ...r(`${late ? 'На сегодня уже не успеть: заказ до 22:00 МСК' : 'На сегодня всё занято'} 😔\nБлижайшая дата: ${ruDay(first.date, today)}. Какую модель забронировать?`), tag: 'models' as const };
      }
    }
    if (todayOnlyOn()) return r('На сегодня все места уже заняты 😔 Бронь на другие дни пока не делаем: освободится место на сегодня, напишу вам первой 🙌');
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

  // Товар по скрину уже подтверждён нашей проверкой, а клиент сверяется («она?», «этот?») или пишет артикул цифрами: менеджеру не передаём.
  if (!hasPhoto && String(lead.screens_done || '').split(',').map((x) => x.trim()).includes('product') &&
    ['wait_cart', 'wait_order', 'wait_size', 'wait_bank', 'wait_integration'].includes(String(lead.status))) {
    if (/^\s*\d{7,}\s*$/.test(text)) return { replies: [] };
    if (/^\s*(?:это\s+)?(?:она|он|этот|эта|наш[а]?|ваш[а]?|та)(?:\s+самая)?\s*[?!.]*\s*$/i.test(text) || /^\s*(?:точно\s+)?(?:наш[а]?|ваш[а]?|она)\s*\?+\s*$/i.test(text)) {
      return rAsk(String(lead.status), 'Да, она, всё верно 👍');
    }
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
      (lead.status === 'wait_pickup' && /забра\S*|заберу|получ\S*|пвз|сегодня|завтра/i.test(text)) ||
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
        ? `Жду скрин поиска по ключу «${lead.keyword}» — сверху строка запроса и наш товар 🙌\nЕсли не находите — напишите, пришлю главное фото`
        : 'Жду скрин: строка поиска (наш ключ) + наш товар в выдаче 🙌',
    );
  }

  // ── wait_cart ────────────────────────────────────────────────────────────
  if (lead.status === 'wait_cart') {
    if (hasPhoto || (!razdachiRowsMode() && /корзин|конкурент|избранн/i.test(text))) {
      const vision = hasPhoto ? await readScreen('cart') : null;
      // Клиент заново прислал скрин прошлого этапа (поиск, корзина): повторять и звать менеджера не нужно, молчим.
      // Карточка или поиск уже проверены раньше: повторный такой скрин (даже с другим фото карточки из A/B-теста) менеджеру не передаём, молчим.
      if (vision && vision.via === 'ai' && String(vision.kind) === 'product') return { replies: [] };
      if (vision && vision.via === 'ai' && String(vision.kind) === 'other' && vision.ok !== false) return rAsk('wait_cart', 'Пришлите скрин корзины: наш товар + 2–3 конкурента и бренд в избранном ❤️');
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
      // Поиск, карточка и корзина уже пройдены: повторный такой скрин не повод звать менеджера, молчим. Нужен именно скрин заказа.
      if (vision && vision.via === 'ai' && ['product', 'cart'].includes(String(vision.kind))) return { replies: [] };
      if (vision && vision.via === 'ai' && String(vision.kind) === 'other' && vision.ok !== false) return rAsk('wait_order', 'Пришлите скрин заказа: видны цена, ПВЗ и дата доставки 🙌');
      // Скрин другого этапа (корзина, бренд в избранном, страница продавца и т.п.): не ругаем «нет нашего товара», мягко просим скрин самого заказа (26 ноября 2026).
      if (vision && vision.via === 'ai' && String(vision.kind) !== 'order') return rAsk('wait_order', 'Скрин получила 👍 Заказ оформите через 20–30 минут после корзины и пришлите скрин заказа: цена, ПВЗ, дата получения.');
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
    // Клиент пишет, что заказал: отвечаем всегда (не подавляем как повторный вопрос), просим именно скрин.
    if (/заказал|оформил|выкупил|купил/i.test(text)) return r('Отлично! Пришлите скрин заказа: видны цена, город/ПВЗ и дата получения 🙌');
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
    if (!haveInt) return { ...r('Когда планируете выход интеграции? Напишите дату 🙌'), tag: 'ask:wait_integration', react: '❤', reactFallback: 'Реквизиты приняла ✅' };
    return { ...r(MSG_PICKUP_LATER), react: '❤', reactFallback: 'Реквизиты приняла ✅' };
  }

  // ── wait_integration: ждём дату выхода интеграции ────────────────────────
  if (lead.status === 'wait_integration') {
    if (hasPhoto) return rAsk('wait_integration', 'Спасибо, получила ✅ Подскажите дату выхода интеграции, например 28.11 или «завтра» 🙌');
    const d = parseIntegrationDate(text, true);
    // Вторая часть реквизитов (ФИО отдельным сообщением): дописываем к реквизитам, дату не переспрашиваем
    const isPhone = /^\+?\d[\d\s\-()]{9,}$/.test(text.trim()) && text.replace(/\D/g, '').length >= 10;
    if (!d && (isPhone || /^[А-Яа-яЁёA-Za-z\-]+(?:\s+[А-Яа-яЁёA-Za-z\-]+){1,3}$/.test(text.trim())) && lead.bank_details) {
      await updateLead(db, lead.id, { bank_details: `${lead.bank_details} ${text.trim()}`.slice(0, 1000), last_client_text: text });
      await syncLeadToSheet(db, lead.id);
      return { replies: [] };
    }
    if (!d) return rAsk('wait_integration', 'Спасибо, получила ✅ Подскажите дату выхода интеграции, например 28.11 или «завтра» 🙌');
    await updateLead(db, lead.id, { status: 'wait_pickup', notes: withInt(lead.notes, d), last_client_text: text });
    await logEvent(db, lead.id, opts.chatId, 'integration_done', { date: d });
    await syncLeadToSheet(db, lead.id);
    return r(MSG_PICKUP_LATER);
  }

  // Клиент просит перенести публикацию («не успеваю», «задерживаюсь»): сначала предлагаем перенос на завтра, после «да» двигаем дату в таблице (владелец, 25 ноября 2026).
  if (razdachiRowsMode() && !hasPhoto && ['wait_pickup', 'wait_shk', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status))) {
    const { data: offerEv } = await db.from('alina_selfbuy_events').select('id, payload, created_at').eq('chat_id', opts.chatId).eq('event_type', 'review_move_offer')
      .gt('created_at', new Date(Date.now() - 6 * 3600_000).toISOString()).order('created_at', { ascending: false }).limit(1);
    const offer = (offerEv || [])[0] as { payload?: { date?: string } } | undefined;
    if (offer && isYes(text)) {
      const date = String(offer.payload?.date || '');
      const row = date ? await moveReviewDate(db, lead, date).catch(() => null) : null;
      await logEvent(db, lead.id, opts.chatId, 'review_move_done', { date, row });
      return row ? r(`Хорошо, перенесла публикацию на ${date} ✅`) : r('Хорошо, передала менеджеру, он поправит дату 🙌');
    }
    if (/не\s+успе\S*|задерж\S*|перенес\S*|попозже|позже\s+(?:опубл|выл|сниму|сделаю)|не\s+смогу\s+(?:опубл|выл)/i.test(text)) {
      const d = new Date(Date.now() + 3 * 3600_000 + 86400_000);
      const date = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
      await logEvent(db, lead.id, opts.chatId, 'review_move_offer', { date, text });
      return rAsk(String(lead.status), `Поняла. Можем перенести публикацию на завтра, ${date}. Подойдёт?`);
    }
  }

  // ── wait_pickup: ждём, когда заказ заберут ───────────────────────────────
  if (lead.status === 'wait_pickup') {
    // «Забрала / получила» (или скрин получения): записываем фактическую дату сегодняшней, просим фото разрезанных ШК.
    // Даты вроде «28.11» здесь не получение: это интеграция или вопрос, фактическую дату сами не ставим.
    const vision = hasPhoto ? await readScreen('pickup') : null;
    const photoIsPickup = Boolean(vision && vision.via === 'ai' && String(vision.kind) === 'pickup' && vision.ok === true);
    if (RECEIVED_RE.test(text) || photoIsPickup) {
      await updateLead(db, lead.id, {
        pickup_at: new Date().toISOString().slice(0, 10),
        status: 'wait_shk',
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'pickup'),
        notes: visionNote(lead.notes, vision),
      });
      await logEvent(db, lead.id, opts.chatId, 'pickup', { text, hasPhoto, vision });
      await syncLeadToSheet(db, lead.id);
      // Отдельное ТЗ к рилсу не шлём: оно уже в условиях (владелец, 26 ноября 2026); просим фото ШК и черновик отзыва.
      return r('Отлично! Пришлите, пожалуйста, фото с разрезанными штрихкодами WB и черновик отзыва (фото и текст). Отзыв сначала согласуем, сразу не публикуйте 🙌');
    }
    // «Можно товар забрать 1 числа?»: клиент сообщает, когда заберёт заказ из пункта выдачи. Записываем плановую дату забора и разрешаем (25 ноября 2026).
    if (!hasPhoto && /забра\S*|получ\S*|заберу|пвз|пункт/i.test(text)) {
      const pd = pickupDateFromText(text);
      if (pd) {
        const notes = `${(lead.notes || '').replace(/\s*забор:\S+/g, '')} забор:${pd}`.trim();
        await updateLead(db, lead.id, { notes, last_client_text: text });
        await logEvent(db, lead.id, opts.chatId, 'pickup_date', { text, date: pd });
        await syncLeadToSheet(db, lead.id);
        return r(`Да, можно, записала: заберёте ${ruDay(pd, todayMskKey())} 🙌`, 'Фото с разрезанными штрихкодами пришлите, когда заберёте.');
      }
    }
    if (hasPhoto) return rAsk('wait_pickup', 'Спасибо, получила ✅ Когда заберёте заказ, напишите.');
    if (/заказал|оформил|выкупил/i.test(text)) return r('Заказ у вас уже записан ✅ Когда он придёт в пункт выдачи, я напомню 🙌');
    // Задержка, «не пришло», «нет ссылки» и подобное: коротко отвечаем, дату в таблице меняет менеджер.
    if (shouldUseBrain({ text, status: 'wait_pickup', hasPhoto, matchedProduct: false })) {
      const { brain } = await runBrain();
      if (brain.reply) return rAsk('wait_pickup', brain.reply);
    }
    return { replies: [] };
  }

  // ── wait_shk: ждём фото с разрезанными штрихкодами ───────────────────────
  if (lead.status === 'wait_shk') {
    if (hasPhoto) {
      await updateLead(db, lead.id, {
        status: 'wait_review',
        last_client_text: '[фото]',
        screens_done: appendScreen(lead.screens_done, 'shk'),
      });
      await logEvent(db, lead.id, opts.chatId, 'shk', { hasPhoto });
      await syncLeadToSheet(db, lead.id);
      return r('Спасибо ✅ Теперь пришлите отзыв: фото и текст. Публиковать сразу не нужно, сначала согласуем 🙌');
    }
    if (isAck(text)) return { replies: [] };
    return rAsk('wait_shk', 'Пришлите, пожалуйста, фото с разрезанными штрихкодами WB 🙌');
  }

  // ── wait_review: черновик отзыва уходит менеджеру на согласование ────────
  if (lead.status === 'wait_review') {
    if (hasPhoto || text.trim().length > 25 || /отзыв|звёзд|звезд/i.test(text)) {
      const next = lead.deal_type === 'barter' ? 'wait_reels' : 'done';
      await updateLead(db, lead.id, {
        review_note: text.slice(0, 2000) || '[фото отзыва]',
        status: next,
        last_client_text: text || '[фото]',
        screens_done: appendScreen(lead.screens_done, 'review'),
      });
      await logEvent(db, lead.id, opts.chatId, 'review', { text, hasPhoto });
      const group = await managerGroupId();
      const reply = next === 'wait_reels' ? r('Передала отзыв менеджеру на согласование, ответ придёт сюда 🙌', MSG_ASK_REELS()) : r('Передала отзыв менеджеру на согласование, ответ придёт сюда 🙌');
      if (group) {
        return { ...reply, escalate: { topic: 'отзыв', question: `Отзыв от @${lead.username || opts.chatId} (${lead.product_name || 'модель'}) необходимо согласовать: ${text ? '«' + text.slice(0, 600) + '»' : 'фото отзыва в чате'}`, group } };
      }
      return reply;
    }
    if (isAck(text)) return { replies: [] };
    return rAsk('wait_review', MSG_ASK_REVIEW());
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
      return { replies: [], react: '❤', reactFallback: 'Реквизиты обновила ✅' };
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
  // Первый сомнительный скрин за 3 часа: не дёргаем менеджера, просим прислать чётче. Второй подряд уходит менеджеру.
  {
    const { data: prevUnsure } = await admin().from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'vision_unsure')
      .gt('created_at', new Date(Date.now() - 3 * 3600_000).toISOString()).limit(2);
    if ((prevUnsure || []).length <= 1) return rAsk(String(lead.status), 'Не вижу на скрине наш товар. Пришлите, пожалуйста, скрин ещё раз: сверху запрос, ниже наш товар 🙌');
  }
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
      .map((x) => ({ bytes: x.bytes, mime: x.mime, filename: x.filename, caption: x.caption, model: x.caption, hideCaption: true }));
  }
  return { replies: [text], ...(photos.length ? { photos } : {}), tag: 'models' };
}

/** Повторный вопрос в том же шаге («пришлите скрин…», «реквизиты…», «дата интеграции»): помечаем, чтобы второй раз за 3 минуты он не ушёл. */
function rAsk(status: string, text: string): AlinaReply {
  return { ...r(text), tag: `ask:${status}` };
}

// ── Бронь места в режиме строк (владелец, 24 ноября 2026) ──
const YES_RE = /^(да|давай|ок|окей|хорошо|конечно|бронируй|бронирую|забронируй|бронь|беру|хочу|можно|согласн\S*|угу|ага|подходит|пойдёт|пойдет)(?![\p{L}\p{N}_])/iu;
const NO_RE = /^(нет|не надо|не нужно|не хочу|отмена|не подходит|не буду)(?=[\s!.,]|$)/i;

/** План дня ещё не согласован владельцем: клиентам на сегодня говорим одно, без дальних дат. */
const dayWaitReply = (): AlinaReply => ({ ...r('Сейчас уточняю наличие на сегодня и вернусь к вам в течение дня 🙌'), tag: 'models' as const });

async function offerLater(db: SupabaseClient, lead: SelfbuyLead, model: string, date: string): Promise<AlinaReply> {
  if (dayClosedOn()) return dayWaitReply();
  await logEvent(db, lead.id, lead.chat_id, 'slot_offer', { model, date });
  const day = ruDay(date, todayMskKey());
  return { ...r(`На сегодня «${model}» уже нет 😔\nБлижайшее место: ${day}. Забронировать?`), tag: 'models' as const };
}

const SIZE_MISSING_RE = /(?:размер[а-яё]*\s+(?:нет|нету|закончил\S*|кончил\S*|не\s+(?:вижу|остал\S*|хватает))|(?:нет|нету)\s+(?:в\s+наличии\s+)?(?:\S+\s+){0,2}?размер|размер\S*\s+в\s+наличии\s+нет|не\s+(?:вижу|нахожу)\s+(?:свой|мой|нужный)\s+размер)/i;

/** Размера нет: другая модель на сегодня, потом перенос на ближайший день и освобождение строки сегодняшнего дня. */
async function handleSizeMissing(db: SupabaseClient, lead: SelfbuyLead, text: string): Promise<AlinaReply | null> {
  // Правило владельца (25 ноября 2026): нужного размера у клиента нет (из-за региона), пишем коротко, сразу освобождаем строку в таблице и отдаём место другим. Другую модель и перенос не предлагаем.
  if (!SIZE_MISSING_RE.test(text)) return null;
  await releaseClientPlace(db, lead).catch(() => null);
  await updateLead(db, lead.id, { status: 'closed', last_client_text: text });
  await logEvent(db, lead.id, lead.chat_id, 'size_missing_released', { text });
  return r('Извините, у других выходят все размеры, это связано с регионом.', 'Ваше место передаём другому, спасибо 🙏');
}

/** Клиент просит главное фото карточки. */
const MAIN_PHOTO_RE = /фото\s+карточк\S*|карточк\S*\s+фото|главн\S*\s+(?:фото\S*|страниц\S*|картинк\S*|карточк\S*)|фото\s+главн\S*|точное\s+фото|как\s+(?:именно\s+|она\s+|он\s+|оно\s+)?выгляд\S*|что\s+(?:именно\s+)?(?:искать|ищем|ищу)|как\s+(?:она|он|оно)\s+(?:выгляд|вид)\S*|(?:пример|образец)\S*\s+(?:фото|того|что)|(?:скин\S*|пришл\S*|покаж\S*|отправ\S*)\s+(?:мне\s+)?(?:\S+\s+)?(?:фото|картинк\S*|пример)/i;

const QTY_RE = /(?:можно|могу|мож\S*|хочу|хотела|возьм\S*|взять)\s+(?:сразу\s+)?(?:две|2(?!\s*в\s*\d)|два|обе|оба|три|3(?!\s*в\s*\d)|несколько|больше\s+одн\S*|ещ[её]\s+одн\S*)\s*(?:модел\S*|костюм\S*|пижам\S*|штук\S*|комплект\S*|шт\b)?|сколько\s+(?:костюм\S*|пижам\S*|модел\S*|штук|комплект\S*)?\s*(?:можно|могу|мне)?\s*(?:взять|заказать|получить)|сколько\s+могу\s+взять|(?:две|2(?!\s*в\s*\d)|два)\s+(?:модел\S*|костюм\S*|пижам\S*)\s+(?:можно|возможн\S*)/i;

/** Вопрос про несколько моделей: Алина отвечает честно по наличию, по правилу «по очереди одну за другой». */
async function handleQuantityQuestion(db: SupabaseClient, lead: SelfbuyLead): Promise<AlinaReply | null> {
  const sheet = getLastRazdachi()?.sheet;
  if (!sheet) return null;
  const today = todayMskKey();
  const slots = freeSlots(sheet, today, 14).filter((x) => !tooLateForToday() || x.date !== today);
  const own = clientRowsToday(lead.username);
  const busy = own.state === 'ok' && own.rows.length > 0;
  const todayNames = [...new Set(slots.filter((x) => x.date === today).map((x) => x.model.replace(/^Пижама\s+/i, '')))];
  const later = slots.filter((x) => x.date !== today);
  const laterNames = [...new Set(later.map((x) => x.model))].slice(0, 3).map((m) => `${m.replace(/^Пижама\s+/i, '')} (${ruDay(later.find((x) => x.model === m)!.date, today)})`);
  await logEvent(db, lead.id, lead.chat_id, 'qty_question', {});
  const rule = 'Берём по очереди: сначала оформляете одну пижаму, потом можно вторую.';
  if (todayNames.length >= 2) return { ...r(`${rule} Сегодня есть: ${todayNames.join(', ')}. С какой начнём?`), tag: 'models' as const };
  if (todayNames.length === 1) {
    return { ...r(`${rule} Сегодня доступна только одна модель: ${todayNames[0]}.${laterNames.length ? ` Другие появятся позже: ${laterNames.join('; ')}.` : ' Других моделей пока нет.'}${busy ? '' : ' Берёте её?'}`), tag: 'models' as const };
  }
  return { ...r(`${rule} Сегодня мест уже нет.${laterNames.length ? ` Ближайшие: ${laterNames.join('; ')}.` : ' Других моделей пока нет.'}`), tag: 'models' as const };
}

async function handleRowsBooking(db: SupabaseClient, lead: SelfbuyLead, text: string): Promise<AlinaReply | null> {
  const t = text.trim();
  // Вопрос про забор заказа из пункта выдачи («забрать 1 числа?») это не бронь места, даже если в тексте дата.
  if (/забра\S*|получ\S*|заберу|пвз/i.test(t) && ['wait_bank', 'wait_integration', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels', 'done'].includes(String(lead.status))) return null;
  // 1. Ответ на предложение даты
  const { data: ev } = await db.from('alina_selfbuy_events').select('event_type, payload, created_at')
    .eq('chat_id', lead.chat_id).in('event_type', ['slot_offer', 'slot_booked', 'slot_declined'])
    .order('created_at', { ascending: false }).limit(1);
  const last = (ev || [])[0] as { event_type: string; payload: { model?: string; date?: string }; created_at: string } | undefined;
  const dayKey = (d?: string) => { const m = String(d || '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}${m[2]}${m[1]}` : ''; };
  // Бронь и предложение живут сутки и только пока дата не прошла (иначе вчерашнее «закреплено» всплывает в ответ на любое сообщение).
  const fresh = last && Date.now() - Date.parse(last.created_at) < 24 * 3600_000 && dayKey(last.payload?.date) >= dayKey(todayMskKey());
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
        return r('Вы не успели: это место уже занял другой клиент 🙏');
      }
      return r('Не получилось записать место, уточню у менеджера и вернусь к вам.');
    }
    if (NO_RE.test(t)) {
      await logEvent(db, lead.id, lead.chat_id, 'slot_declined', { model, date });
      return r('Хорошо, без брони. Если передумаете или захотите другую модель, просто напишите 🙌');
    }
  }
  // Бронь закреплена, клиент отвечает «хорошо / ок / да» или коротким словом: не начинаем заново и не перечисляем места, а коротко подтверждаем.
  // Только на сегодня: прежняя бронь на другую дату уже не действует (строки перенесены на сегодня), её не повторяем.
  const staleBook = todayOnlyOn() && last?.event_type === 'slot_booked' && last.payload?.date !== todayMskKey();
  if (last?.event_type === 'slot_booked' && fresh && !staleBook && last.payload?.model && last.payload?.date && !/[?]/.test(t) && t.length <= 40 &&
    !/заброн|закрепит|запиш/i.test(t) && matchModels(PAJAMA_MODEL_NAMES, t).length === 0) {
    if (isAck(t)) return { replies: [] };
    return r(`Ваше место «${last.payload.model}» на ${ruDay(last.payload.date, todayMskKey())} закреплено ✅ Напишите мне в этот день, и сразу начнём.`);
  }
  // Бронь только что закреплена, а клиент просит «забронируйте»: подтверждаем уже сделанное, а не берём другую модель.
  if (last?.event_type === 'slot_booked' && fresh && !staleBook && /заброн|закрепит|запиш/i.test(t) && last.payload?.model && last.payload?.date) {
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
  // «А 3 в 1 появятся?», «когда будет 2 в 1?»: называем для каждой модели этого формата ближайшую дату со свободным местом.
  if (hit.length > 1 && /появ|будет|будут|когда|есть\s+ли|доступн|остал/i.test(t)) {
    const parts = hit.map((m) => {
      const near = slots.find((x) => x.model.toLowerCase() === m.toLowerCase());
      return `${m.replace(/^Пижама\s+/i, '')}: ${near ? ruDay(near.date, today) : 'пока мест нет'}`;
    });
    return { ...r(`Ближайшие места: ${parts.join('; ')}. Какую забронировать?`), tag: 'models' as const };
  }
  if (hit.length > 1) {
    // Цвет есть в нескольких форматах (2в1 и 3в1), а сегодня место только у части: не выбираем за клиента.
    const todayFree = hit.filter((m) => slots.some((x) => x.date === today && x.model.toLowerCase() === m.toLowerCase()));
    if (todayFree.length && todayFree.length < hit.length) {
      const parts = hit.map((m) => {
        const near = slots.find((x) => x.model.toLowerCase() === m.toLowerCase());
        return `${m} — ${near ? ruDay(near.date, today) : 'пока мест нет'}`;
      });
      return r(`Есть несколько вариантов: ${parts.join('; ')}.`, 'Какой вам подходит? Напишите, и я закреплю место.');
    }
    return null;
  }
  // Клиент соглашается («Хорошо на завтра», «давайте») на ближайшую дату, но модель не назвал: называем, что есть на эту дату, а не зовём менеджера.
  // «Хорошо, завтра напишу», «подумаю», «вернусь»: клиент не выбрал модель и ничего не просит закрепить. Место не бронируем.
  if (hit.length === 0 && slots.length && /напиш[уе]\S*|подума\S*|верн[уё]\S*|позже|потом|попозже/i.test(t) && !/забронир|закреп|запиш/i.test(t)) {
    const { data: toldW } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'chat_log')
      .gt('created_at', sinceIso(180)).like('payload->>kind', 'models').limit(1);
    if (toldW && toldW.length) return r('Хорошо 🙌', 'Захотите закрепить место, напишите модель, и я забронирую.');
  }
  if (hit.length === 0 && (isYes(t) || /завтра|ближайш/i.test(t)) && slots.length) {
    const { data: told0 } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'chat_log')
      .gt('created_at', sinceIso(25)).like('payload->>kind', 'models').limit(1);
    if (told0 && told0.length) {
      const first = slots.find((x) => x.date !== today) ?? slots[0];
      const onDate = [...new Set(slots.filter((x) => x.date === first.date).map((x) => x.model))];
      // Одна модель на дату: клиент её не называл, сами не бронируем, а спрашиваем (бронь по «да»).
      if (onDate.length === 1) return await offerLater(db, lead, onDate[0], first.date);
      return { ...r(`На ${ruDay(first.date, today)} есть: ${onDate.map((n) => n.replace(/^Пижама\s+/i, '')).join(', ')}. Какую забронировать?`), tag: 'models' as const };
    }
  }
  if (hit.length !== 1) return null;
  const model = hit[0];
  if (isModelBlocked(model)) {
    const seenB = new Set<string>();
    const altB = slots.filter((x) => (seenB.has(x.model) ? false : (seenB.add(x.model), true))).slice(0, 4);
    return { ...r(`«${model.replace(/^Пижама\s+/i, '')}» сейчас недоступна на WB, как только появится, напишу вам 🙌${altB.length ? ` Пока могу предложить: ${altB.map((x) => `${x.model.replace(/^Пижама\s+/i, '')} (${ruDay(x.date, today)})`).join('; ')}. Какую хотите?` : ''}`), tag: 'models' as const };
  }
  const k = model.toLowerCase();
  if (slots.some((x) => x.date === today && x.model.toLowerCase() === k)) return null; // сегодня есть место: идём по обычному пути и берём его сразу
  // Клиент уже держит строку этой модели на сегодня (записан вручную или бронью): «мест нет» ему не говорим, ведём по обычному пути.
  { const own = clientRowsToday(lead.username); if (own.state === 'ok' && own.rows.some((x) => x.model.toLowerCase() === k)) return null; }
  const near = slots.find((x) => x.model.toLowerCase() === k) ?? null;
  if (!near) {
    // Этой модели нет ни сегодня, ни в ближайшие дни: предлагаем, что есть (по одной ближайшей дате на модель), менеджера не зовём.
    const seen = new Set<string>();
    const alt = slots.filter((x) => (seen.has(x.model) ? false : (seen.add(x.model), true))).slice(0, 4);
    if (alt.length) return { ...r(`Мест на «${model.replace(/^Пижама\s+/i, '')}» пока нет. Могу предложить: ${alt.map((x) => `${x.model.replace(/^Пижама\s+/i, '')} (${ruDay(x.date, today)})`).join('; ')}. Какую хотите?`), tag: 'models' as const };
    return r(`Мест на «${model.replace(/^Пижама\s+/i, '')}» пока нет, как появятся, напишу вам 🙌`);
  }
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
  if (dayClosedOn()) return dayWaitReply();
  // Клиент уже занимает строку этой модели на сегодня (его записал менеджер или бронь): места в плане «0», но ему они не нужны, продолжаем с его строкой.
  const ownRows = clientRowsToday(lead.username);
  const holdsModel = ownRows.state === 'ok' && ownRows.rows.some((x) => normModel(x.model) === normModel(offer.product_name || ''));
  if (!holdsModel && (!offer.is_open || (offer.slots_left ?? 0) <= 0)) {
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

  // Режим строк «Раздачи Пижам»: только бартер (владелец, 26 ноября 2026), старый тип сделки из прежней заявки не берём.
  let typed = razdachiRowsMode() ? 'barter' : (detectDealType(text) || lead.deal_type || resolveDealFromCampaign(camp));
  // таблица говорит только кэш — бартер не открываем
  if (!razdachiRowsMode() && typed === 'barter' && !barterAvailable(camp) && offer.deal_type !== 'barter' &&
    offer.deal_type !== 'both') {
    typed = 'cashback';
  }
  if (!razdachiRowsMode() && typed === 'barter' && !barterAvailable(camp)) {
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
  const tzText = (deal === 'barter' || razdachiRowsMode())
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
  if (deal === 'barter' || razdachiRowsMode()) {
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
  if (t.length > 160 || t.replace(/\D/g, '').length < 10) return false; // реквизиты короткие и с номером, длинный разговорный текст не считаем
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
  if (razdachiRowsMode() && text.trim()) {
    // Названия моделей понимаем по формату и цвету («2 в 1 бордовая», «белую 2в1»): надёжнее общего подбора по словам.
    const names = [...new Set(all.map((o) => String(o.product_name || '')).filter(Boolean))];
    const hit = matchModels(names, text);
    const pick = (n: string) => all.find((o) => o.product_name === n && o.is_open) || all.find((o) => o.product_name === n) || null;
    if (hit.length === 1) {
      const o = pick(hit[0]);
      if (o) return { offer: o, ambiguous: [], unavailableColor: null, alternatives: [] };
    }
    if (hit.length > 1 && hit.length < names.length) {
      const amb = hit.map(pick).filter(Boolean) as SheetPlanOffer[];
      if (amb.length > 1) return { offer: null, ambiguous: amb, unavailableColor: null, alternatives: [] };
    }
  }
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


/** Клиент ответил «да» на ожидаемый вопрос (предложение места от владельца или листа ожидания): выполняем то, что предлагали. */
async function handleExpectedYes(
  db: SupabaseClient,
  opts: { chatId: number; userId: number; username?: string; fullName?: string; text?: string },
  ex: { kind?: string; model?: string; date?: string },
): Promise<AlinaReply | null> {
  const model = String(ex.model || '').trim();
  if (!model) return null;
  const { data: l } = await db.from('alina_selfbuy_leads').select('*').eq('chat_id', opts.chatId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!l) return null;
  let lead = l as SelfbuyLead;
  // Заявка уже идёт (ТЗ, ключ, поиск и дальше): старое ожидание «да» не трогаем, «да» клиента относится к текущему шагу.
  if (['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order', 'wait_size', 'wait_bank', 'wait_integration', 'wait_pickup', 'wait_shk', 'wait_review', 'wait_reels'].includes(String(lead.status))) return null;
  if (!lead.username && opts.username) {
    await db.from('alina_selfbuy_leads').update({ username: String(opts.username).replace(/^@/, '') }).eq('id', lead.id);
    lead = { ...lead, username: String(opts.username).replace(/^@/, '') };
  }
  const today = todayMskKey();
  const sheet = getLastRazdachi()?.sheet;
  const notInTime = () => r('Вы не успели: это место уже занял другой клиент 🙏');
  // Только на сегодня: старое предложение брони на другую дату не выполняем, «да» ведёт к месту на сегодня (если оно есть).
  if (ex.kind === 'book' && ex.date && !(todayOnlyOn() && ex.date !== today)) {
    const res = await bookPlace(db, lead, model, ex.date);
    if (res === 'claimed') return r(`Готово ✅ «${model}» за вами на ${ruDay(ex.date, today)}.`, 'Напишите в этот день, и начнём.');
    return notInTime();
  }
  // start_deal: место на сегодня
  const own = clientRowsToday(lead.username);
  const holds = own.state === 'ok' && own.rows.some((x) => normModel(x.model) === normModel(model));
  const free = Boolean(sheet && freeSlots(sheet, today, 0).some((x) => x.date === today && normModel(x.model) === normModel(model)));
  if (!holds && !free) return notInTime();
  if (tooLateForToday()) return r('На сегодня уже не успеть: заказ нужно сделать до 22:00 МСК 🙏 Напишите завтра, поставлю на ближайшую дату.');
  const keyIdx = sheet?.col.key;
  const row = sheet?.rows.find((x) => normModel(x.model) === normModel(model) && x.date === today);
  const offer = {
    date: null, deal_type: 'barter', product_name: model, keyword: keyIdx != null && row ? String(row.cells[keyIdx] ?? '').trim() || null : null,
    article: null, cashback_pct: null, plan_slots: 1, used_slots: 0, slots_left: 1, order_deadline: null, is_open: true, status_raw: null, tab: '', row_index: 0,
  } as unknown as SheetPlanOffer;
  return await startDealFromOffer(db, lead, null, offer, 'Да');
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
    if (!shots.length) {
      // Поздно вечером «открытых на сегодня» нет: показываем модели, у которых есть свободные места в ближайшие дни.
      const sheet = getLastRazdachi()?.sheet;
      const freeModels = sheet ? [...new Set(freeSlots(sheet, todayMskKey(), 14).map((x) => x.model))] : [];
      shots = pajamaPhotosFor(freeModels);
      ask = 'Выберите модель, которая нравится, и напишите мне 🙌';
    }
    await logEvent(db, lead.id, lead.chat_id, 'product_photo', { text, own: shots.map((x) => x.caption) });
    if (!shots.length) return r('Фото пришлю чуть позже, передала менеджеру 🙌');
    return {
      replies: ask ? [ask] : [],
      photos: shots.map((x) => ({ bytes: x.bytes, mime: x.mime, filename: x.filename, caption: x.caption, model: x.caption, hideCaption: true })),
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
        photos: ok.map((x) => ({ url: x.photo!.url, bytes: x.photo!.bytes, mime: x.photo!.mime, filename: x.photo!.filename, caption: x.o.product_name!, model: x.o.product_name!, hideCaption: true })),
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
  return /^(да|даа|дааа|ага|угу|yes|yep|ок|окей|давай|давайте|конечно|хочу|надо|скинь|пришли|подходит|согласн\S*|беру|берём|берем|хорошо|отлично|ладно)(?![\p{L}\p{N}_])/iu
    .test(text.trim());
}

function isNo(text: string): boolean {
  return /^(нет|не|не надо|не надо|no|неа|не нужно)(?![\p{L}\p{N}_])/iu.test(text.trim());
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
  let wantFilters = false; // клиент прямо просит фильтры: отправляем их (владелец, 26 ноября 2026)
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
    // Просьба «добавьте фильтры» это не «не нашла»: фильтров у нас нет, место не освобождаем, напоминаем про ключ и главное фото (25 ноября 2026).
    const bare = text.replace(/\s*\(в ответ на[\s\S]*$/, '');
    if (/фильтр/i.test(bare) && !/не\s+(?:наш|могу|получа|нахо)/i.test(bare)) wantFilters = true;
    if (round >= 0 && !wantFilters) {
      // Лесенка (владелец, 25 ноября 2026): фильтров нет вообще: сразу главное фото с подписью «по фото не ищем» карточки → извиняемся и освобождаем место другим.
      // Фото считаем только по текущей модели: после последнего ТЗ (клиент мог сменить модель, и фото прежней не в счёт).
      const { data: lastTz } = await db.from('alina_selfbuy_events').select('created_at').eq('chat_id', lead.chat_id).eq('event_type', 'tz_sent')
        .order('created_at', { ascending: false }).limit(1);
      const photoSince = Math.max(Date.now() - 12 * 3600_000, lastTz?.[0]?.created_at ? Date.parse(lastTz[0].created_at as string) : 0);
      const { data: sentPhoto } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'main_photo_sent')
        .gt('created_at', new Date(photoSince).toISOString()).limit(1);
      if (!sentPhoto || !sentPhoto.length) {
        const mine = await resolveLeadArticle(lead, camp).catch(() => null);
        const photo = mine?.article ? await fetchWbMainPhoto(mine.article).catch(() => null) : null;
        if (photo?.bytes) {
          await logEvent(db, lead.id, lead.chat_id, 'main_photo_sent', { text });
          return {
            replies: [`Вот главное фото нашего товара. По фото не ищем: вбейте ключ${lead.keyword ? ` «${lead.keyword}»` : ''} в поиск, найдите этот товар и пришлите скрин 🙌`],
            photos: [{ bytes: photo.bytes, mime: photo.mime, filename: photo.filename, caption: '' }],
          };
        }
      }
      // Фото уже отправляли (или его нет), а товар всё равно не находят: извиняемся и сразу отдаём место другим.
      const { data: done } = await db.from('alina_selfbuy_events').select('id').eq('chat_id', lead.chat_id).eq('event_type', 'not_found_released')
        .gt('created_at', new Date(Date.now() - 12 * 3600_000).toISOString()).limit(1);
      if (done && done.length) return { replies: [] };
      const row = await releaseClientPlace(db, lead).catch(() => null);
      await updateLead(db, lead.id, { status: 'closed', sheet_row: null, last_client_text: text });
      await logEvent(db, lead.id, lead.chat_id, 'not_found_released', { text, row });
      return r('Извините, не получилось помочь найти товар 🙏 Освобождаю ваше место, чтобы его смогли занять другие. Если захотите попробовать ещё раз в другой день, напишите.');
    }
    if (round === 1 || wantFilters) {
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
