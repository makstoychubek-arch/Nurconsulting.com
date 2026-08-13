/**
 * Умные ответы в тимчате (детерминированно, без CRM-пути клиентов).
 * Примеры:
 *  - «Алина, видишь таблицу по выкупам на сегодня?»
 *  - «дай главное фото фонаря»
 *  - «Антон, сколько остаток кабинет база блузки белой фонаря»
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCabinet } from './agent-actions.ts';
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

export type TeamQaResult = {
  handled: boolean;
  agentKey?: string;
  reply?: string;
  photos?: Array<{
    url?: string;
    bytes?: Uint8Array;
    mime?: string;
    filename?: string;
    caption?: string;
  }>;
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
  return /(остат|осталось|сколько\s+на\s+склад|фбс|fbs|на\s+склад)/i.test(text);
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
      reply: `Таблицу сейчас не вижу: ${snap.error || 'ошибка чтения'} 🙌`,
    };
  }

  const open = getOpenFromSnap(snap.offers || []);
  const lines: string[] = [];
  if (/видиш|видишь|есть\s+таблица|смотриш/i.test(text)) {
    lines.push('Да, вижу таблицу раздач на сегодня 🙌');
  } else {
    lines.push('По выкупам/раздачам на сегодня:');
  }

  const mode = snap.deal_mode === 'cashback'
    ? 'только кэшбек'
    : snap.deal_mode === 'barter'
    ? 'только бартер'
    : 'кэшбек и бартер';
  lines.push(`Режим: ${mode}`);

  if (open.length) {
    lines.push('Открыто:');
    for (const o of open.slice(0, 10)) {
      lines.push(
        `• ${o.product_name}${o.keyword ? ` · ключ «${o.keyword}»` : ''} · мест ${o.slots_left}`,
      );
    }
  } else {
    lines.push('Свободных мест на сегодня нет.');
  }

  try {
    const stats = await alinaSelfbuyStatsText();
    const crmLine = stats.split('\n').find((l) => /лид|в работе|сегодня/i.test(l));
    if (crmLine) lines.push(crmLine.replace(/^[-•\s]+/, ''));
  } catch { /* */ }

  return { handled: true, agentKey: 'alina', reply: lines.join('\n') };
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
        reply: 'Какую модель фото?\n' +
          m.ambiguous.map((o) => `• ${o.product_name}`).join('\n'),
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
      reply: 'Какую модель фото?\n' +
        picked.ambiguous.map((o) => `• ${o.product_name}`).join('\n'),
    };
  }
  if (!picked.offer?.article) {
    const all = listAllProductChoices(offers);
    return {
      handled: true,
      agentKey: 'alina',
      reply: all.length
        ? 'Уточни модель/цвет — скину главное фото с WB:\n' +
          all.map((o) => `• ${o.product_name}`).join('\n')
        : 'Не нашла модель в таблице раздач 🙌',
    };
  }

  const photo = await fetchWbMainPhoto(picked.offer.article);
  if (!photo) {
    return {
      handled: true,
      agentKey: 'alina',
      reply: `Не вытащила фото с WB по «${picked.offer.product_name}» 🙌`,
    };
  }
  return {
    handled: true,
    agentKey: 'alina',
    reply: `Главное фото «${picked.offer.product_name}» с WB 🙌`,
    photos: [{
      url: photo.url,
      bytes: photo.bytes,
      mime: photo.mime,
      filename: photo.filename,
      caption: `Главное фото «${picked.offer.product_name}»`,
    }],
  };
}

function scoreArticleName(name: string, text: string): number {
  const n = name.toLowerCase().replace(/ё/g, 'е');
  const t = text.toLowerCase().replace(/ё/g, 'е');
  let score = 0;
  if (/фонар/.test(t) && (/фонар|лапш/.test(n))) score += 4;
  if (/вырез/.test(t) && /вырез/.test(n)) score += 4;
  if (/блузк|лапш/.test(t) && (/блуз|лапш|фонар|вырез/.test(n))) score += 2;
  if (/бел/.test(t) && /бел/.test(n)) score += 3;
  if (/черн|чёрн/.test(t) && /черн/.test(n)) score += 3;
  if (/костюм/.test(t) && /костюм/.test(n)) score += 4;
  if (/жилет/.test(t) && /жилет/.test(n)) score += 4;
  return score;
}

async function resolveNmIdsForProduct(
  cabinetId: string,
  text: string,
): Promise<Array<{ nm_id: number; title: string }>> {
  const db = admin();
  const found: Array<{ nm_id: number; title: string; score: number }> = [];
  const seen = new Set<number>();

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
      if (!Number.isFinite(nm) || seen.has(nm)) continue;
      seen.add(nm);
      found.push({
        nm_id: nm,
        title: o.product_name || String(nm),
        score: 10,
      });
    }
  } catch { /* */ }

  const { data } = await db
    .from('rnp_articles')
    .select('nm_id, name')
    .eq('cabinet_id', cabinetId)
    .limit(800);

  for (const row of data || []) {
    const score = scoreArticleName(String(row.name || ''), text);
    if (score < 5) continue;
    const nm = Number(row.nm_id);
    if (!Number.isFinite(nm) || seen.has(nm)) continue;
    seen.add(nm);
    found.push({ nm_id: nm, title: String(row.name), score });
  }

  found.sort((a, b) => b.score - a.score);
  return found.slice(0, 6).map(({ nm_id, title }) => ({ nm_id, title }));
}

async function answerStock(text: string): Promise<TeamQaResult> {
  const resolved = await resolveCabinet(text);
  if (!resolved.match && (resolved.candidates?.length || 0) > 1) {
    return {
      handled: true,
      agentKey: 'anton',
      reply: 'По какому кабинету? ' +
        (resolved.candidates || []).map((c) => c.name).join(', '),
    };
  }
  let cabinet = resolved.match;
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
      reply:
        `Кабинет ${cabinet.name}: не понял товар. Пример: «остаток база блузка фонарь белый»`,
    };
  }

  const db = admin();
  const lines: string[] = [`Слышу 👍 ${cabinet.name}, остатки по складам WB:`];

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

  // ── Остатки (Антон) ─────────────────────────────────────────────────────
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
