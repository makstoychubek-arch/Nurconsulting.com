/**
 * Диалог Сауле: карточки WB (SEO/описание, бренд, создание).
 * API: content/v2/cards/upload|update, object/all, barcodes.
 */

import { getAdminClient } from './supabase-admin.ts';
import {
  cancelOtherPending,
  getActivePending,
  isCancelText,
  isConfirmText,
  resolveCabinet,
  stripCabinetAliases,
} from './agent-actions.ts';
import { setChatFocus } from './agent-chat-focus.ts';
import {
  cardToUpdatePayload,
  extractNmId,
  fetchCardsList,
  findCardByNm,
  generateBarcodes,
  listCardErrors,
  parseSizeRange,
  searchSubjects,
  subjectCharcs,
  uploadCards,
  updateCards,
  cabinetTokenById,
  type WbCard,
} from './agent-wb-api.ts';
import { findCatalogProducts } from './agent-product-catalog.ts';
import { pick } from './agent-voice.ts';

export const CARD_ACTION = 'wb_card';
export const CARD_AGENT = 'saule';

export type CardReply = { handled: boolean; reply?: string };

type CardKind = 'create' | 'seo' | 'brand';

type CardPayload = {
  kind?: CardKind;
  step?: string;
  cabinetId?: string;
  cabinetName?: string;
  nmId?: number;
  vendorCode?: string;
  title?: string;
  description?: string;
  brand?: string;
  subjectId?: number;
  subjectName?: string;
  color?: string;
  sizes?: string[];
  productHint?: string;
  price?: number;
};

function admin() {
  return getAdminClient();
}

function ownerOk(tgUserId: number): boolean {
  const raw = (Deno.env.get('AGENT_OWNER_TG_IDS') || '').trim();
  if (!raw) return true;
  const ids = new Set(
    raw.split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)),
  );
  return ids.has(tgUserId);
}

export function wantsCardCreate(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(созда[йть]|завед[иь]|добав[ьи]|сдела[йть]).{0,24}карточки?/i.test(t) ||
    /нов(ая|ую)\s+карточки?/i.test(t) ||
    /карточки?.{0,16}(созда|завед|нов)/i.test(t)
  );
}

export function wantsCardSeo(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(сео|seo)/i.test(t) ||
    /(поменя[йть]|измени|смен[иь]|обнови|перепиши|напиши).{0,20}(описан|назван|title|тайтл)/i
      .test(t) ||
    /(описан|назван).{0,16}(поменя|измени|смен|обнов|перепиш)/i.test(t) ||
    /описан(ие)?\s+карточки?/i.test(t)
  );
}

export function wantsCardBrand(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  return (
    /(поменя[йть]|измени|смен[иь]|поставь|сделай).{0,16}бренд/i.test(t) ||
    /бренд.{0,16}(поменя|измени|смен|поставь|на\s+)/i.test(t)
  );
}

export function wantsWbCardWork(text: string): boolean {
  return wantsCardCreate(text) || wantsCardSeo(text) || wantsCardBrand(text);
}

export function isCardDialogPending(
  pending: { agent_key?: string; action_type?: string } | null,
): boolean {
  return Boolean(
    pending &&
      pending.agent_key === CARD_AGENT &&
      pending.action_type === CARD_ACTION,
  );
}

function parseBrandValue(text: string): string | null {
  const t = String(text || '').trim();
  const m = t.match(
    /бренд(?:\s+(?:на|в))?\s*[«"']?([^«"'\n]{2,60})[»"']?/i,
  );
  if (m) return m[1].replace(/^(поменяй|измени|смени|поставь)\s+/i, '').trim();
  if (/^бренд\s+/i.test(t)) return t.replace(/^бренд\s+/i, '').trim() || null;
  // после «бренд на X» — \b перед кириллицей не работает
  const m2 = t.match(/(?:^|[\s,.:;!?/\\|])на\s+[«"']?([^«"'\n,]{2,60})[»"']?\s*$/i);
  if (m2 && /бренд/i.test(t)) return m2[1].trim();
  return null;
}

function parseSeoPatch(text: string): { title?: string; description?: string } {
  const t = String(text || '').trim();
  // \w* — ASCII; для кириллицы [а-яё]*
  const title =
    t.match(/(?:назван[а-яё]*|тайтл|title)\s*[:=]?\s*[«"']?([^«"'\n]{5,200})[»"']?/i)?.[1]
      ?.trim();
  const description =
    t.match(/(?:описан[а-яё]*|сео|seo|текст)\s*[:=]?\s*[«"']?([^«"'\n]{20,2000})[»"']?/i)?.[1]
      ?.trim() ||
    t.match(/описан[а-яё]*\s+на\s+[«"']?([^«"'\n]{20,2000})[»"']?/i)?.[1]?.trim();
  return { title, description };
}

function parseCreateHint(text: string): {
  productHint: string;
  color?: string;
  sizes?: string[];
  brand?: string;
  price?: number;
} {
  let t = stripCabinetAliases(text);
  t = t
    .replace(
      /(созда[йть]|завед[иь]|добав[ьи]|сдела[йть]|нов(ая|ую))\s*карточки?/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  const sizes = parseSizeRange(t) || undefined;
  if (sizes) {
    t = t.replace(
      /(?:размер[а-яё]*|разм\.?)?\s*(?:с|от)?\s*\d{2,3}\s*(?:по|до|-|–|—)\s*\d{2,3}/i,
      ' ',
    );
  }

  const brand = parseBrandValue(t) || undefined;
  if (brand) t = t.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');

  const priceM = t.match(/(?:цен[аоуы]?|price)\s*[:=]?\s*(\d{3,7})/i);
  const price = priceM ? Number(priceM[1]) : undefined;
  if (priceM) t = t.replace(priceM[0], ' ');

  const colors = [
    'белая', 'белый', 'черная', 'чёрная', 'черный', 'чёрный',
    'синяя', 'синий', 'красная', 'красный', 'бежевая', 'бежевый',
    'серая', 'серый', 'розовая', 'розовый', 'зеленая', 'зелёная',
    'голубая', 'голубой', 'коричневая', 'коричневый',
  ];
  let color: string | undefined;
  for (const c of colors) {
    if (new RegExp(`(^|\\s)${c}(\\s|$)`, 'i').test(t)) {
      color = c.replace(/ая$/i, 'ый').replace(/я$/i, 'й');
      // human form for char: белый, чёрный...
      const map: Record<string, string> = {
        белая: 'белый',
        белый: 'белый',
        черная: 'черный',
        чёрная: 'черный',
        черный: 'черный',
        чёрный: 'черный',
        синяя: 'синий',
        синий: 'синий',
        красная: 'красный',
        красный: 'красный',
        бежевая: 'бежевый',
        бежевый: 'бежевый',
        серая: 'серый',
        серый: 'серый',
        розовая: 'розовый',
        розовый: 'розовый',
        зеленая: 'зеленый',
        зелёная: 'зеленый',
        голубая: 'голубой',
        голубой: 'голубой',
        коричневая: 'коричневый',
        коричневый: 'коричневый',
      };
      color = map[c] || c;
      t = t.replace(new RegExp(c, 'ig'), ' ');
      break;
    }
  }

  const productHint = t.replace(/\s+/g, ' ').trim() || 'товар';
  return { productHint, color, sizes, brand, price };
}

async function savePending(
  chatId: number,
  tgUserId: number,
  cabinet: { id: string; name: string } | null,
  payload: CardPayload,
  status: 'awaiting_selection' | 'awaiting_confirm' = 'awaiting_confirm',
) {
  const db = admin();
  await cancelOtherPending(db, chatId);
  const { error } = await db.from('agent_pending_actions').insert({
    chat_id: chatId,
    agent_key: CARD_AGENT,
    action_type: CARD_ACTION,
    status,
    cabinet_id: cabinet?.id || null,
    cabinet_name: cabinet?.name || null,
    proposed_by_tg: tgUserId,
    payload,
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  if (error) throw new Error(`card pending: ${error.message}`);
  await setChatFocus(chatId, CARD_AGENT, 'wb_card', 25);
}

async function patchPending(id: string, payload: CardPayload, status?: string) {
  const upd: Record<string, unknown> = {
    payload,
    updated_at: new Date().toISOString(),
  };
  if (status) upd.status = status;
  await admin().from('agent_pending_actions').update(upd).eq('id', id);
}

async function finishPending(id: string, resultText: string) {
  await admin()
    .from('agent_pending_actions')
    .update({
      status: 'done',
      result_text: resultText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}

function confirmLine(kind: CardKind, p: CardPayload): string {
  if (kind === 'create') {
    return [
      `Черновик карточки · ${p.cabinetName}`,
      `${p.productHint || p.title}${p.color ? `, ${p.color}` : ''}`,
      p.sizes?.length ? `размеры: ${p.sizes.join(', ')}` : 'без размеров',
      p.brand ? `бренд: ${p.brand}` : null,
      p.subjectName ? `предмет: ${p.subjectName}` : null,
      p.price ? `цена размера: ${p.price}` : 'цена: 0 (потом поставим)',
      '',
      'Только создание новой — старые карточки не трогаю.',
      '«да» — отправлю в WB. «отмена» — стоп.',
    ].filter(Boolean).join('\n');
  }
  if (kind === 'brand') {
    return [
      `${p.cabinetName} · nm ${p.nmId}`,
      `Бренд → «${p.brand}»`,
      '',
      '«да» — сохраняю. «отмена» — стоп.',
    ].join('\n');
  }
  return [
    `${p.cabinetName} · nm ${p.nmId}`,
    p.title ? `Название: ${p.title}` : null,
    p.description ? `Описание: ${p.description.slice(0, 180)}${p.description.length > 180 ? '…' : ''}` : null,
    '',
    '«да» — сохраняю SEO. «отмена» — стоп.',
  ].filter(Boolean).join('\n');
}

async function resolveCardTarget(
  text: string,
  cabinetId: string,
  token: string,
): Promise<{ card?: WbCard; ask?: string }> {
  const nm = extractNmId(text);
  if (nm) {
    const card = await findCardByNm(token, nm);
    if (!card) return { ask: `Не вижу nm ${nm} в этом кабинете. Кинь другой артикул.` };
    return { card };
  }
  const hint = stripCabinetAliases(text)
    .replace(/(поменя[йть]|измени|смен[иь]|обнови|перепиши|напиши|бренд|сео|seo|описан[а-яё]*|назван[а-яё]*)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (hint.length >= 3) {
    const found = await findCatalogProducts(hint, { cabinetId, max: 5 });
    if (found.length === 1) {
      const card = await findCardByNm(token, found[0].nmId);
      if (card) return { card };
    }
    if (found.length > 1) {
      return {
        ask: [
          'Несколько карточек — уточни nm:',
          ...found.slice(0, 5).map((f, i) =>
            `${i + 1}) ${f.nmId} · ${f.title || f.vendorCode}`
          ),
        ].join('\n'),
      };
    }
    const list = await fetchCardsList(token, { textSearch: hint, limit: 5 });
    if (list.length === 1) return { card: list[0] };
    if (list.length > 1) {
      return {
        ask: [
          'Нашла несколько — кинь nm:',
          ...list.map((c, i) => `${i + 1}) ${c.nmID} · ${c.title || c.vendorCode}`),
        ].join('\n'),
      };
    }
  }
  return { ask: 'Кинь nm / артикул карточки (или название точнее).' };
}

async function executeCreate(
  token: string,
  p: CardPayload,
): Promise<string> {
  // SAFETY: только upload новой карточки. Никаких update/delete существующих.
  const subjectQuery = (p.productHint || p.title || 'блузка').slice(0, 40);
  let subjectId = p.subjectId;
  let subjectName = p.subjectName;
  if (!subjectId) {
    const subjects = await searchSubjects(token, subjectQuery);
    // prefer exact-ish clothing
    const hit = subjects.find((s) =>
      new RegExp(subjectQuery.split(/\s+/)[0], 'i').test(s.name)
    ) || subjects[0];
    if (!hit) {
      return `Не нашла предмет «${subjectQuery}» в справочнике WB. Уточни категорию (блузки / платья…).`;
    }
    subjectId = hit.id;
    subjectName = hit.name;
  }

  const charcs = await subjectCharcs(token, subjectId);
  const colorChar = charcs.find((c) => /цвет/i.test(c.name));
  const characteristics: Array<{ id: number; value: unknown }> = [];
  if (colorChar && p.color) {
    characteristics.push({ id: colorChar.id, value: [p.color] });
  }

  const sizes = p.sizes?.length ? p.sizes : ['0'];
  const barcodes = await generateBarcodes(token, sizes.length);
  if (barcodes.length < sizes.length) {
    return 'Не вышло сгенерить баркоды WB. Повтори чуть позже.';
  }

  const vendorCode = `NR-${Date.now().toString(36).toUpperCase()}`;
  const title = (p.title || `${p.productHint || subjectName}${p.color ? ' ' + p.color : ''}`)
    .slice(0, 60);
  const description = (
    p.description ||
    `${title}. ${p.sizes?.length ? 'Размеры: ' + p.sizes.join(', ') + '.' : ''}`.trim()
  ).slice(0, 2000);

  const sizeRows = sizes.map((sz, i) => ({
    techSize: sz,
    wbSize: sz,
    price: p.price && p.price > 0 ? p.price : 0,
    skus: [barcodes[i]],
  }));

  const body = [{
    subjectID: subjectId,
    variants: [{
      vendorCode,
      title,
      description: description.length >= 100
        ? description
        : (description + ' '.repeat(Math.max(0, 100 - description.length))).slice(0, 120),
      brand: p.brand || '',
      dimensions: {
        length: 30,
        width: 25,
        height: 5,
        weightBrutto: 0.4,
      },
      characteristics,
      sizes: sizeRows,
    }],
  }];

  const up = await uploadCards(token, body);
  if (!up.ok) {
    return `Карточку не создала — WB отклонил: ${up.errorText}`;
  }

  // дать очереди чуть времени и глянуть ошибки (только чтение)
  await new Promise((r) => setTimeout(r, 1500));
  const errs = await listCardErrors(token);
  const related = errs.filter((e) => e.includes(vendorCode));

  return [
    'Карточку создала — отправила в очередь WB',
    `${p.cabinetName} · ${title}`,
    `vendor: ${vendorCode}`,
    subjectName ? `предмет: ${subjectName}` : null,
    sizes.length ? `размеры: ${sizes.join(', ')}` : null,
    'Появится в кабинете после синка (до ~30 мин). Старые карточки не трогала.',
    related.length ? `Ошибки очереди:\n${related.slice(0, 3).join('\n')}` : null,
  ].filter(Boolean).join('\n');
}

async function executeUpdate(
  token: string,
  p: CardPayload,
): Promise<string> {
  if (!p.nmId) return 'Нет nm — нечего обновлять.';
  const card = await findCardByNm(token, p.nmId);
  if (!card) return `Карточку nm ${p.nmId} не вижу.`;

  const payload = cardToUpdatePayload(card, {
    title: p.title,
    description: p.description,
    brand: p.brand,
  });
  const up = await updateCards(token, [payload]);
  if (!up.ok) return `WB не приняла: ${up.errorText}`;
  if (p.kind === 'brand') {
    return pick([
      `Бренд на «${p.brand}» отправила · nm ${p.nmId}`,
      `Сохранила бренд «${p.brand}» по nm ${p.nmId}`,
    ]);
  }
  return pick([
    `SEO обновила · nm ${p.nmId}`,
    `Описание/название ушло в WB · nm ${p.nmId}`,
  ]);
}

export async function startWbCardDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<CardReply> {
  try {
    return await startWbCardDialogInner(opts);
  } catch (e) {
    console.error('[wb-cards] start', e);
    return {
      handled: true,
      reply: 'Сбой диалога карточки. Напиши ещё раз через минуту.',
    };
  }
}

async function startWbCardDialogInner(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<CardReply> {
  const text = opts.text.trim();
  if (!wantsWbCardWork(text)) return { handled: false };

  const kind: CardKind = wantsCardCreate(text)
    ? 'create'
    : wantsCardBrand(text)
    ? 'brand'
    : 'seo';

  const resolved = await resolveCabinet(text);
  if (!resolved.match) {
    const names = resolved.candidates.map((c) => c.name).join(', ');
    const hint = kind === 'create' ? parseCreateHint(text) : null;
    const seo = kind === 'seo' ? parseSeoPatch(text) : {};
    const brand = kind === 'brand' ? (parseBrandValue(text) || undefined) : undefined;
    await savePending(opts.chatId, opts.tgUserId, null, {
      kind,
      step: 'await_cabinet',
      productHint: hint?.productHint,
      color: hint?.color,
      sizes: hint?.sizes,
      brand: brand || hint?.brand,
      price: hint?.price,
      title: seo.title,
      description: seo.description,
    }, 'awaiting_selection');
    return {
      handled: true,
      reply: pick([
        `В каком кабинете? ${names || 'Baza / SAAI / Zevina / Elium'}`,
        `Кабинет кинь: ${names || 'зевина 1, база…'}`,
      ]),
    };
  }

  const tok = await cabinetTokenById(resolved.match.id);
  if (!tok) {
    return { handled: true, reply: `${resolved.match.name}: нет токена WB.` };
  }

  if (kind === 'create') {
    const hint = parseCreateHint(text);
    if (!hint.sizes?.length) {
      await savePending(opts.chatId, opts.tgUserId, resolved.match, {
        kind,
        step: 'await_sizes',
        cabinetId: resolved.match.id,
        cabinetName: resolved.match.name,
        productHint: hint.productHint,
        color: hint.color,
        brand: hint.brand,
        price: hint.price,
      }, 'awaiting_selection');
      return {
        handled: true,
        reply: [
          `${resolved.match.name}: ${hint.productHint}${hint.color ? ' · ' + hint.color : ''}`,
          'Какие размеры? Например «с 40 по 54»',
        ].join('\n'),
      };
    }

    const subjects = await searchSubjects(tok.token, hint.productHint.split(/\s+/)[0]);
    const sub = subjects[0];
    const payload: CardPayload = {
      kind,
      step: 'await_confirm',
      cabinetId: resolved.match.id,
      cabinetName: resolved.match.name,
      productHint: hint.productHint,
      color: hint.color,
      sizes: hint.sizes,
      brand: hint.brand,
      price: hint.price,
      subjectId: sub?.id,
      subjectName: sub?.name,
      title: `${hint.productHint}${hint.color ? ' ' + hint.color : ''}`.slice(0, 60),
    };
    await savePending(opts.chatId, opts.tgUserId, resolved.match, payload);
    return { handled: true, reply: confirmLine('create', payload) };
  }

  // seo / brand
  const target = await resolveCardTarget(text, resolved.match.id, tok.token);
  if (!target.card) {
    await savePending(opts.chatId, opts.tgUserId, resolved.match, {
      kind,
      step: 'await_product',
      cabinetId: resolved.match.id,
      cabinetName: resolved.match.name,
      brand: kind === 'brand' ? (parseBrandValue(text) || undefined) : undefined,
      ...parseSeoPatch(text),
    }, 'awaiting_selection');
    return { handled: true, reply: target.ask || 'Кинь nm карточки.' };
  }

  if (kind === 'brand') {
    const brand = parseBrandValue(text);
    if (!brand) {
      await savePending(opts.chatId, opts.tgUserId, resolved.match, {
        kind,
        step: 'await_brand',
        cabinetId: resolved.match.id,
        cabinetName: resolved.match.name,
        nmId: target.card.nmID,
        vendorCode: target.card.vendorCode,
      }, 'awaiting_selection');
      return {
        handled: true,
        reply: `nm ${target.card.nmID} · сейчас бренд «${target.card.brand || '—'}». На какой меняем?`,
      };
    }
    const payload: CardPayload = {
      kind,
      step: 'await_confirm',
      cabinetId: resolved.match.id,
      cabinetName: resolved.match.name,
      nmId: target.card.nmID,
      vendorCode: target.card.vendorCode,
      brand,
    };
    await savePending(opts.chatId, opts.tgUserId, resolved.match, payload);
    return { handled: true, reply: confirmLine('brand', payload) };
  }

  // seo
  const patch = parseSeoPatch(text);
  if (!patch.title && !patch.description) {
    await savePending(opts.chatId, opts.tgUserId, resolved.match, {
      kind,
      step: 'await_seo_text',
      cabinetId: resolved.match.id,
      cabinetName: resolved.match.name,
      nmId: target.card.nmID,
      vendorCode: target.card.vendorCode,
      title: target.card.title,
      description: target.card.description,
    }, 'awaiting_selection');
    return {
      handled: true,
      reply: [
        `nm ${target.card.nmID} · ${target.card.title || target.card.vendorCode}`,
        'Кинь новое описание (или «название: …» / «описание: …»).',
      ].join('\n'),
    };
  }

  const payload: CardPayload = {
    kind,
    step: 'await_confirm',
    cabinetId: resolved.match.id,
    cabinetName: resolved.match.name,
    nmId: target.card.nmID,
    vendorCode: target.card.vendorCode,
    title: patch.title || target.card.title,
    description: patch.description || target.card.description,
  };
  await savePending(opts.chatId, opts.tgUserId, resolved.match, payload);
  return { handled: true, reply: confirmLine('seo', payload) };
}

export async function continueWbCardDialog(opts: {
  chatId: number;
  tgUserId: number;
  text: string;
}): Promise<CardReply> {
  const pending = await getActivePending(opts.chatId);
  if (!isCardDialogPending(pending)) return { handled: false };

  const text = opts.text.trim();
  const p = { ...(pending!.payload as CardPayload) };
  const kind = (p.kind || 'seo') as CardKind;

  if (isCancelText(text)) {
    await admin()
      .from('agent_pending_actions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', pending!.id);
    return { handled: true, reply: pick(['Ок, стопнула', 'Отмена', 'Не трогаю']) };
  }

  // кабинет после «создать карточку» без кабинета в первой фразе
  if (p.step === 'await_cabinet') {
    const resolved = await resolveCabinet(text);
    if (!resolved.match) {
      const names = resolved.candidates.map((c) => c.name).join(', ');
      return {
        handled: true,
        reply: pick([
          `Не поняла кабинет. Напиши: ${names || 'база / элиум / зевина 1'}`,
          `Кабинет точнее: ${names || 'как в списке'}`,
        ]),
      };
    }
    p.cabinetId = resolved.match.id;
    p.cabinetName = resolved.match.name;
    await admin()
      .from('agent_pending_actions')
      .update({
        cabinet_id: resolved.match.id,
        cabinet_name: resolved.match.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending!.id);

    const tok = await cabinetTokenById(resolved.match.id);
    if (!tok) {
      await finishPending(pending!.id, 'нет токена');
      return { handled: true, reply: `${resolved.match.name}: нет токена WB.` };
    }

    if (kind === 'create') {
      if (!p.sizes?.length) {
        p.step = 'await_sizes';
        await patchPending(pending!.id, p, 'awaiting_selection');
        return {
          handled: true,
          reply: [
            `${resolved.match.name}: ${p.productHint || 'товар'}${p.color ? ' · ' + p.color : ''}`,
            'Какие размеры? Например «с 40 по 54»',
          ].join('\n'),
        };
      }
      const subjects = await searchSubjects(
        tok.token,
        (p.productHint || 'блузка').split(/\s+/)[0],
      );
      if (subjects[0]) {
        p.subjectId = subjects[0].id;
        p.subjectName = subjects[0].name;
      }
      p.title = `${p.productHint || ''}${p.color ? ' ' + p.color : ''}`.slice(0, 60);
      p.step = 'await_confirm';
      await patchPending(pending!.id, p, 'awaiting_confirm');
      return { handled: true, reply: confirmLine('create', p) };
    }

    // seo / brand — нужен nm существующей карточки (явное изменение, не create)
    p.step = 'await_product';
    await patchPending(pending!.id, p, 'awaiting_selection');
    const target = await resolveCardTarget(text, resolved.match.id, tok.token);
    if (target.card) {
      p.nmId = target.card.nmID;
      p.vendorCode = target.card.vendorCode;
      if (kind === 'brand') {
        if (p.brand) {
          p.step = 'await_confirm';
          await patchPending(pending!.id, p, 'awaiting_confirm');
          return { handled: true, reply: confirmLine('brand', p) };
        }
        p.step = 'await_brand';
        await patchPending(pending!.id, p);
        return {
          handled: true,
          reply: `nm ${p.nmId} · сейчас бренд «${target.card.brand || '—'}». На какой меняем?`,
        };
      }
      p.step = 'await_seo_text';
      p.title = target.card.title;
      p.description = target.card.description;
      await patchPending(pending!.id, p);
      return {
        handled: true,
        reply: [
          `nm ${target.card.nmID} · ${target.card.title || target.card.vendorCode}`,
          'Кинь новое описание (или «название: …» / «описание: …»).',
        ].join('\n'),
      };
    }
    return { handled: true, reply: target.ask || 'Кинь nm карточки.' };
  }

  if (p.step === 'await_sizes') {
    const sizes = parseSizeRange(text);
    if (!sizes?.length) {
      return { handled: true, reply: 'Размеры вида «с 40 по 54» или «40 42 44».' };
    }
    p.sizes = sizes;
    p.step = 'await_confirm';
    const tok = p.cabinetId ? await cabinetTokenById(p.cabinetId) : null;
    if (tok && p.productHint) {
      const subjects = await searchSubjects(tok.token, p.productHint.split(/\s+/)[0]);
      if (subjects[0]) {
        p.subjectId = subjects[0].id;
        p.subjectName = subjects[0].name;
      }
    }
    await patchPending(pending!.id, p, 'awaiting_confirm');
    return { handled: true, reply: confirmLine('create', p) };
  }

  if (p.step === 'await_product') {
    if (!p.cabinetId) return { handled: true, reply: 'Сначала кабинет.' };
    const tok = await cabinetTokenById(p.cabinetId);
    if (!tok) return { handled: true, reply: 'Нет токена.' };
    const target = await resolveCardTarget(text, p.cabinetId, tok.token);
    if (!target.card) return { handled: true, reply: target.ask || 'Не нашла карточку.' };
    p.nmId = target.card.nmID;
    p.vendorCode = target.card.vendorCode;
    if (kind === 'brand') {
      if (p.brand) {
        p.step = 'await_confirm';
        await patchPending(pending!.id, p, 'awaiting_confirm');
        return { handled: true, reply: confirmLine('brand', p) };
      }
      p.step = 'await_brand';
      await patchPending(pending!.id, p);
      return {
        handled: true,
        reply: `nm ${p.nmId}. На какой бренд меняем?`,
      };
    }
    p.step = 'await_seo_text';
    p.title = target.card.title;
    p.description = target.card.description;
    await patchPending(pending!.id, p);
    return {
      handled: true,
      reply: `nm ${p.nmId}. Кинь описание или «название: …».`,
    };
  }

  if (p.step === 'await_brand') {
    const brand = parseBrandValue(text) || text.replace(/^бренд\s*/i, '').trim();
    if (brand.length < 2) return { handled: true, reply: 'Бренд коротко: например «Nely»' };
    p.brand = brand.slice(0, 60);
    p.step = 'await_confirm';
    await patchPending(pending!.id, p, 'awaiting_confirm');
    return { handled: true, reply: confirmLine('brand', p) };
  }

  if (p.step === 'await_seo_text') {
    const patch = parseSeoPatch(text);
    if (patch.title) p.title = patch.title;
    if (patch.description) p.description = patch.description;
    if (!patch.title && !patch.description) {
      // весь текст = новое описание
      if (text.length < 20) {
        return { handled: true, reply: 'Описание коротковато — кинь текст от ~20 символов или «название: …».' };
      }
      p.description = text.slice(0, 2000);
    }
    p.step = 'await_confirm';
    await patchPending(pending!.id, p, 'awaiting_confirm');
    return { handled: true, reply: confirmLine('seo', p) };
  }

  if (p.step === 'await_confirm' || pending!.status === 'awaiting_confirm') {
    if (!isConfirmText(text)) {
      return {
        handled: true,
        reply: pick(['Нужно «да» или «отмена»', 'Подтверди «да» — иначе не трогаю']),
      };
    }
    if (!ownerOk(opts.tgUserId)) {
      return { handled: true, reply: 'Подтверждать может только владелец.' };
    }
    if (!p.cabinetId) return { handled: true, reply: 'Нет кабинета в диалоге.' };
    const tok = await cabinetTokenById(p.cabinetId);
    if (!tok) return { handled: true, reply: 'Нет токена WB.' };

    const result = kind === 'create'
      ? await executeCreate(tok.token, p)
      : await executeUpdate(tok.token, p);
    // create никогда не вызывает updateCards; update — только после явного SEO/бренд + «да»
    await finishPending(pending!.id, result);
    return { handled: true, reply: result };
  }

  return { handled: true, reply: 'Не поняла шаг. «отмена» или начнём заново.' };
}
