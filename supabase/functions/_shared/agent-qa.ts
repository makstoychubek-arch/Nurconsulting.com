/**
 * Умные ответы в тимчате (детерминированно, без CRM-пути клиентов).
 * Примеры:
 *  - «Алина, видишь таблицу по выкупам на сегодня?»
 *  - «дай главное фото фонаря»
 *  - «Антон, сколько остаток кабинет база блузки белой фонаря»
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCabinet, listCabinets } from './agent-actions.ts';
import {
  fetchSheetPlan,
  listAllProductChoices,
  matchOfferFromText,
  resolveProductChoice,
  type SheetPlanOffer,
} from './alina-sheet-plan.ts';
import { alinaSelfbuyStatsText } from './alina-selfbuy.ts';
import { fetchWbMainPhoto } from './alina-wb-photo.ts';
import { detectNamedAgents, detectMentionedAgents } from './agent-team.ts';
import { wantsFbsStock } from './agent-fbs-stock.ts';
import { alinaAskProduct, alinaSeesSheet, antonWbStockLead, pick } from './agent-voice.ts';
import { findCatalogProducts } from './agent-product-catalog.ts';

function alinaPickModel(lines: string[]): string {
  return [alinaAskProduct(), ...lines].join('\n');
}

function alinaPhotoOk(name: string, extra?: string): string {
  const base = pick([
    `Главное фото «${name}»`,
    `Вот главное с WB: «${name}»`,
    `Скинула «${name}»`,
    `Фото карточки «${name}»`,
  ]);
  return extra ? `${base} (${extra})` : base;
}

function alinaPhotoMiss(name: string): string {
  return pick([
    `Не вытащила фото с WB по «${name}»`,
    `По «${name}» фото не нашла`,
    `Пусто по фото «${name}» — другой nm/название?`,
  ]);
}

export type TeamQaResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
  photos?: Array<{
    url?: string;
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  }>;
  /** Нужны chatId/userId — роутер сам стартует FBS-диалог */
  deferFbsStock?: boolean;
};

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

function namedAgents(text: string): string[] {
  return [...new Set([...detectMentionedAgents(text), ...detectNamedAgents(text)])];
}

function wantsAlinaSheet(text: string): boolean {
  const t = text.toLowerCase();
  return /(таблиц|выкуп|раздач|план\s+на\s+сегодня|слот|самовыкуп|график\s+раздач)/i.test(t);
}

function wantsWbProductPhoto(text: string): boolean {
  const t = text.toLowerCase();
  if (/сгенерир|нарисуй|ии\s*фото|dall|фотоворон/i.test(t)) return false;
  if (!/(фото|фотк|фоту|картинк)/i.test(t)) return false;
  return (
    /главн\w*\s+фото|фото\s+с\s*вб|фото\s+(товар|фонар|вырез|блузк|карточк)/i.test(t) ||
    /(дай|скинь|пришли|покажи|есть).{0,20}(фото|фотк)/i.test(t) ||
    /(фото|фотк).{0,30}(фонар|вырез|блузк|бел|черн|чёрн)/i.test(t)
  );
}

function wantsStock(text: string): boolean {
  // FBS-остатки — отдельный диалог Антона (wantsFbsStock)
  if (wantsFbsStock(text)) return false;
  return /(остат|осталось|сколько\s+на\s+склад|на\s+склад)/i.test(text);
}

function getOpenFromSnap(offers: SheetPlanOffer[]): SheetPlanOffer[] {
  const open = offers.filter((o) => o.is_open && (o.slots_left ?? 0) > 0);
  const seen = new Set<string>();
  const out: SheetPlanOffer[] = [];
  for (const o of open) {
    const k = `${o.product_name}|${o.article}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

async function answerAlinaSheet(text: string): Promise<TeamQaResult> {
  const snap = await fetchSheetPlan(true);
  if (!snap.ok) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: `Таблицу сейчас не вижу: ${snap.error || 'ошибка чтения'}`,
    };
  }

  const open = getOpenFromSnap(snap.offers || []);
  const mode = snap.deal_mode === 'cashback'
    ? 'только кэшбек'
    : snap.deal_mode === 'barter'
    ? 'только бартер'
    : 'кэшбек и бартер';
  const openLines = open.slice(0, 10).map((o) =>
    `• ${o.product_name}${o.keyword ? ` · ключ «${o.keyword}»` : ''} · мест ${o.slots_left}`
  );
  let reply = alinaSeesSheet(openLines, mode);

  try {
    const stats = await alinaSelfbuyStatsText();
    const crmLine = stats.split('\n').find((l) => /лид|в работе|сегодня/i.test(l));
    if (crmLine) reply += '\n' + crmLine.replace(/^[-•\s]+/, '');
  } catch { /* */ }

  return { handled: true, agentKey: 'alina', reply };
}

async function answerProductPhoto(text: string): Promise<TeamQaResult> {
  const snap = await fetchSheetPlan(false);
  const offers = snap.offers || [];
  let picked = resolveProductChoice(offers, text);
  if (!picked.offer) {
    const m = matchOfferFromText(offers, text);
    if (m.offer) picked = { ...picked, offer: m.offer };
    else if (m.ambiguous.length === 1) picked = { ...picked, offer: m.ambiguous[0] };
    else if (m.ambiguous.length > 1) {
      return {
        handled: true,
        agentKey: 'alina',
        reply: alinaPickModel(
          m.ambiguous.map((o) => `• ${o.product_name}`),
        ),
      };
    }
  }
  if (!picked.offer && picked.ambiguous.length === 1) {
    picked = { ...picked, offer: picked.ambiguous[0] };
  }
  if (!picked.offer && picked.ambiguous.length > 1) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: alinaPickModel(
        picked.ambiguous.map((o) => `• ${o.product_name}`),
      ),
    };
  }
  if (!picked.offer?.article) {
    // fallback: общий каталог (все кабинеты), не только таблица раздач
    try {
      const hits = await findCatalogProducts(text, {
        sources: ['wb_prices', 'rnp'],
        minScore: 4,
        max: 5,
      });
      if (hits.length === 1 || (hits.length > 1 && hits[0].score > hits[1].score)) {
        const h = hits[0];
        const photo = await fetchWbMainPhoto(String(h.nmId));
        if (photo) {
          return {
            handled: true,
            agentKey: 'alina',
            reply: alinaPhotoOk(h.vendorCode || h.title, h.cabinetName),
            photos: [{
              url: photo.url,
              bytes: photo.bytes,
              mime: photo.mime,
              filename: photo.filename,
              caption: `${h.cabinetName} · ${h.vendorCode || h.title}`,
            }],
          };
        }
      }
      if (hits.length > 1) {
        return {
          handled: true,
          agentKey: 'alina',
          reply: alinaPickModel(
            hits.slice(0, 6).map((h) => `• ${h.cabinetName} · ${h.vendorCode || h.title}`),
          ),
        };
      }
    } catch { /* */ }
    const all = listAllProductChoices(offers);
    return {
      handled: true,
      agentKey: 'alina',
      reply: all.length
        ? alinaPickModel(all.map((o) => `• ${o.product_name}`))
        : 'Не нашла модель — напиши точнее или nm',
    };
  }

  const photo = await fetchWbMainPhoto(picked.offer.article);
  if (!photo) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: alinaPhotoMiss(picked.offer.product_name || 'товар'),
    };
  }
  return {
    handled: true,
    agentKey: 'alina',
    reply: alinaPhotoOk(picked.offer.product_name || 'товар'),
    photos: [{
      url: photo.url,
      bytes: photo.bytes,
      mime: photo.mime,
      filename: photo.filename,
      caption: pick([
        `Главное фото «${picked.offer.product_name}»`,
        `${picked.offer.product_name}`,
        `WB · ${picked.offer.product_name}`,
      ]),
    }],
  };
}

async function resolveNmIdsForProduct(
  cabinetId: string | null,
  text: string,
): Promise<Array<{ nm_id: number; title: string; cabinet_id?: string }>> {
  const found: Array<{ nm_id: number; title: string; score: number; cabinet_id?: string }> = [];
  const seen = new Set<string>();

  try {
    const snap = await fetchSheetPlan(false);
    const picked = resolveProductChoice(snap.offers || [], text);
    const candidates = [
      ...(picked.offer ? [picked.offer] : []),
      ...picked.ambiguous.slice(0, 4),
    ];
    if (!candidates.length) {
      const m = matchOfferFromText(snap.offers || [], text);
      if (m.offer) candidates.push(m.offer);
      candidates.push(...m.ambiguous.slice(0, 4));
    }
    for (const o of candidates) {
      const nm = Number(o.article);
      if (!Number.isFinite(nm)) continue;
      const key = `${cabinetId || 'sheet'}:${nm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        nm_id: nm,
        title: o.product_name || String(nm),
        score: 10,
        cabinet_id: cabinetId || undefined,
      });
    }
  } catch { /* */ }

  try {
    const hits = await findCatalogProducts(text, {
      cabinetId: cabinetId || null,
      sources: ['rnp', 'wb_prices'],
      minScore: 4,
      max: 8,
    });
    for (const h of hits) {
      const key = `${h.cabinetId}:${h.nmId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        nm_id: h.nmId,
        title: h.vendorCode || h.title,
        score: h.score,
        cabinet_id: h.cabinetId,
      });
    }
  } catch { /* */ }

  found.sort((a, b) => b.score - a.score);
  return found.slice(0, 6).map(({ nm_id, title, cabinet_id }) => ({
    nm_id,
    title,
    cabinet_id,
  }));
}

async function answerStock(text: string): Promise<TeamQaResult> {
  const resolved = await resolveCabinet(text);
  if (!resolved.match && (resolved.candidates?.length || 0) > 1) {
    // если товар однозначно из одного кабинета — не спрашиваем
    const guessed = await resolveNmIdsForProduct(null, text);
    const cabs = [...new Set(guessed.map((g) => g.cabinet_id).filter(Boolean))];
    if (cabs.length !== 1) {
      return {
        handled: true,
        agentKey: 'anton',
        reply: 'По какому кабинету? ' +
          (resolved.candidates || []).map((c) => c.name).join(', '),
      };
    }
  }
  let cabinet = resolved.match;
  if (!cabinet) {
    const guessed = await resolveNmIdsForProduct(null, text);
    if (guessed[0]?.cabinet_id) {
      const all = await listCabinets();
      const hit = all.find((c) => c.id === guessed[0].cabinet_id);
      if (hit) cabinet = hit;
    }
  }
  if (!cabinet) {
    cabinet = (await resolveCabinet('база')).match;
  }
  if (!cabinet) {
    return {
      handled: true,
      agentKey: 'anton',
      reply: 'Не нашёл кабинет. Напиши: база / elium / saai / zevina',
    };
  }

  const products = await resolveNmIdsForProduct(cabinet.id, text);
  if (!products.length) {
    return {
      handled: true,
      agentKey: 'anton',
      reply: `Не понял товар в ${cabinet.name}. Пример: «жилетка темно синяя» / «фонарь белый»`,
    };
  }

  const db = admin();
  const lines: string[] = [antonWbStockLead(cabinet.name)];

  for (const p of products) {
    const { data: rows } = await db
      .from('wb_stocks')
      .select('quantity, warehouse_name, in_way_to_client')
      .eq('cabinet_id', cabinet.id)
      .eq('nm_id', p.nm_id);
    const list = rows || [];
    const byWh = new Map<string, number>();
    let qty = 0;
    let inWay = 0;
    for (const r of list) {
      const q = Number(r.quantity || 0);
      qty += q;
      inWay += Number(r.in_way_to_client || 0);
      const wh = String(r.warehouse_name || 'склад');
      byWh.set(wh, (byWh.get(wh) || 0) + q);
    }
    lines.push(
      `• ${p.title}: ${qty} шт` + (inWay ? ` (в пути к клиенту ${inWay})` : ''),
    );
    const top = [...byWh.entries()]
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [wh, q] of top) {
      lines.push(`  – ${wh}: ${q}`);
    }
    if (!list.length) lines.push('  – в базе остатков по этому nm нет (нужен sync stocks)');
    else if (!top.length) lines.push('  – везде 0');
  }

  return { handled: true, agentKey: 'anton', reply: lines.join('\n') };
}

/**
 * Точка входа для тимчата.
 * Каждый бот получает свой webhook — отвечаем только «своим» интентом,
 * чужие глотаем (handled без reply), чтобы не дублировать LLM.
 */
export async function tryTeamSmartQa(
  text: string,
  triggeringBot: string,
): Promise<TeamQaResult> {
  const t = (text || '').trim();
  if (!t || t.length > 900) return { handled: false };
  const named = namedAgents(t);

  // ── Фото с WB (Алина), Муху на это глушим ───────────────────────────────
  if (wantsWbProductPhoto(t)) {
    if (triggeringBot === 'muha' && !/сгенерир|нарисуй/i.test(t)) {
      return { handled: true }; // не генерить AI-фото вместо карточки
    }
    if (triggeringBot === 'alina' && (!named.length || named.includes('alina'))) {
      return await answerProductPhoto(t);
    }
    if (named.includes('alina') && triggeringBot !== 'alina') {
      return { handled: true };
    }
  }

  // ── Таблица выкупов (Алина) ──────────────────────────────────────────────
  if (wantsAlinaSheet(t)) {
    if (triggeringBot === 'alina' && (!named.length || named.includes('alina'))) {
      return await answerAlinaSheet(t);
    }
    if (named.includes('alina') && triggeringBot !== 'alina') {
      return { handled: true };
    }
  }

  // ── Остатки FBS (Антон, мультишаг с кнопками) ───────────────────────────
  if (wantsFbsStock(t)) {
    if (triggeringBot === 'anton' && (!named.length || named.includes('anton'))) {
      return { handled: true, agentKey: 'anton', deferFbsStock: true };
    }
    // чужие боты молчат, пока вопрос про FBS-остатки
    if (!named.length || named.includes('anton')) {
      return { handled: true };
    }
  }

  // ── Смена цены (Сауле) — чужие боты молчат ─────────────────────────────
  if (/(сниз|понизь|пониз|убав|уменьш).{0,20}цен/i.test(t) ||
    /цен.{0,20}(сниз|понизь|пониз|убав|уменьш|меня|измени|поменя)/i.test(t) ||
    /(менять|поменять|изменить|поменяй).{0,12}цен/i.test(t)) {
    if (triggeringBot === 'saule' && (!named.length || named.includes('saule') || named.includes('karina'))) {
      return { handled: false }; // роутер стартует price dialog
    }
    if (!named.length || named.includes('saule') || named.includes('karina')) {
      return { handled: true };
    }
  }

  // ── Остатки WB-складов (Антон, без FBS) ─────────────────────────────────
  if (wantsStock(t)) {
    if (triggeringBot === 'anton' && (!named.length || named.includes('anton'))) {
      return await answerStock(t);
    }
    if (named.includes('anton') && triggeringBot !== 'anton') {
      return { handled: true };
    }
  }

  return { handled: false };
}

/** Доп. факты в LLM, если QA не перехватил вопрос целиком. */
export async function teamQaFactsForAgent(
  agent: string,
  text: string,
): Promise<string> {
  try {
    if (agent === 'alina') {
      const snap = await fetchSheetPlan(false);
      if (!snap.ok) return '';
      const open = getOpenFromSnap(snap.offers || []).slice(0, 8)
        .map((o) => `${o.product_name}: ${o.slots_left} мест`)
        .join('; ');
      return `ФАКТЫ РАЗДАЧИ СЕГОДНЯ (${snap.deal_mode}): ${open || 'мест нет'}`;
    }
    if (agent === 'anton' && wantsStock(text)) {
      const qa = await answerStock(text);
      return qa.reply ? `ФАКТЫ ОСТАТКОВ:\n${qa.reply}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

export { wantsWbProductPhoto, wantsAlinaSheet, wantsStock };
