/**
 * Консервативный разбор «вчера / сегодня» — по кабинету или по конкретному артикулу:
 * «блузка фонарь белый вчера 40 заказов а сегодня много» и т.п.
 * факты → гипотезы → обсуждение Сауле / Амина / Антон.
 */

import { normalizeBotText, fuzzyIncludesAny } from './agent-fuzzy.ts';
import {
  buildAgentWbContext,
  createWbContextCache,
  findArticleDayCompare,
  type AgentKey,
  type ArticleDayHit,
} from './agent-wb-context.ts';

export type CabDelta = {
  name: string;
  yOrders: number;
  tOrders: number;
  ySum: number;
  tSum: number;
  deltaOrdersPct: number | null;
  topYesterday: string;
};

/** Владелец спрашивает про дельту дня — общую или по товару. */
export function wantsSalesDropDiscuss(text: string): boolean {
  const t = normalizeBotText(text);
  if (!t) return false;
  if (/^\/?(разбор|почему|просадка|почемупродаж)(@\w+)?(\s|$)/i.test(String(text || '').trim())) {
    return true;
  }
  if (
    fuzzyIncludesAny(t, [
      'вчера много сегодня мало',
      'вчера мало сегодня много',
      'почему мало продаж',
      'почему продажи упали',
      'почему продажи выросли',
      'почему просадка',
      'разберите продажи',
      'обсудите продажи',
      'что с продажами',
      'продажи просели',
      'продажи выросли',
      'заказы упали',
      'заказы выросли',
      'сегодня мало заказов',
      'сегодня много заказов',
      'почему по базе',
    ])
  ) {
    return true;
  }
  // вчера…сегодня + мало/много/упал/вырос/почему
  if (
    /вчера/.test(t) &&
    /сегодня/.test(t) &&
    /(мало|много|упал|упали|вырос|выросли|просад|почему|меньше|больше|хуже|лучше)/.test(t)
  ) {
    return true;
  }
  // «заков» = опечатка «заказов»; число заказов + день
  if (
    /(заказ|заков|штук|\d+\s*шт)/.test(t) &&
    /(вчера|сегодня)/.test(t) &&
    /(почему|а\s+сегодня|а\s+вчера|мало|много|упал|вырос)/.test(t)
  ) {
    return true;
  }
  // товар + (вчера|сегодня|почему) + заказ/просадк
  if (
    /(блуз|фонар|лапш|пиджак|кимоно|костюм|плать|рубаш|жилет|жл|кардиган|бомбер)/.test(t) &&
    /(вчера|сегодня|почему)/.test(t) &&
    /(заказ|заков|продаж|просад|мало|много|\d+)/.test(t)
  ) {
    return true;
  }
  if (
    /(продаж|заказ|заков)/.test(t) &&
    /(почему|просад|упал|упали|вырос|мало\s+сегодня|много\s+сегодня|вчера.{0,24}сегодня)/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Вытащить товар из фразы разбора (без служебных слов и чисел). */
export function extractDiscussProductQuery(text: string): string {
  let t = normalizeBotText(text);
  t = t.replace(/^\/?(разбор|почему|просадка|почемупродаж)(@\w+)?\s*/i, '');
  // \b плохо с кириллицей — режем токенами
  const stop = new Set([
    'почему', 'разбери', 'разберите', 'обсудите', 'глянь', 'посмотри', 'скажи',
    'по', 'базе', 'базы', 'база', 'итд', 'etc',
    'вчера', 'сегодня', 'позавчера',
    'заказ', 'заказа', 'заказы', 'заказов', 'заков', 'заказу',
    'продажа', 'продажи', 'продаж', 'продажу',
    'штук', 'шт', 'много', 'мало',
    'упал', 'упала', 'упали', 'вырос', 'выросла', 'выросли',
    'просел', 'просела', 'просели', 'меньше', 'больше',
    'а', 'и', 'или', 'на', 'в', 'у', 'с', 'к', 'о', 'об', 'из', 'для',
    'что', 'как', 'это', 'там', 'тут', 'еще', 'ещё', 'уже', 'очень',
    'сильнее', 'резко', 'резкая',
  ]);
  const tokens = t
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .filter((w) => !/^\d+([.,]\d+)?$/.test(w))
    .filter((w) => !stop.has(w));
  return tokens.join(' ').trim();
}

/** Кто в цепочке: факты → реклама → логистика. */
export function salesDropDiscussPlan(text = ''): string[] {
  const t = normalizeBotText(text);
  const plan = ['saule', 'amina', 'anton'];
  if (/(раздач|самовыкуп|отзыв)/.test(t)) plan.push('alina');
  return plan.slice(0, 4);
}

function bishkekHour(): number {
  return new Date(Date.now() + 6 * 3600 * 1000).getUTCHours();
}

function parseNum(s: string): number {
  const n = Number(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Разбор блока продаж из agent-wb-context. */
export function parseSalesDeltas(wbText: string): CabDelta[] {
  const blocks = String(wbText || '').split(/▶\s+/).slice(1);
  const out: CabDelta[] = [];
  for (const block of blocks) {
    const name = (block.split('\n')[0] || '').trim();
    if (!name || /ошибка/i.test(block)) continue;
    const y = block.match(
      /вчера:\s*заказы\s+([\d\s]+)\s*шт\s*\/\s*([\d\s]+)\s*₽/i,
    );
    const t = block.match(
      /сегодня:\s*заказы\s+([\d\s]+)\s*шт\s*\/\s*([\d\s]+)\s*₽/i,
    );
    if (!y || !t) continue;
    const yOrders = parseNum(y[1]!);
    const ySum = parseNum(y[2]!);
    const tOrders = parseNum(t[1]!);
    const tSum = parseNum(t[2]!);
    const topM = block.match(/топ вчера:\s*(.+)/i);
    const deltaOrdersPct = yOrders > 0
      ? Math.round(((tOrders - yOrders) / yOrders) * 100)
      : (tOrders > 0 ? 100 : null);
    out.push({
      name,
      yOrders,
      tOrders,
      ySum,
      tSum,
      deltaOrdersPct,
      topYesterday: (topM?.[1] || '').trim(),
    });
  }
  return out;
}

function dayIncompleteHypo(): string | null {
  const hour = bishkekHour();
  if (hour < 18) {
    return `гипотеза: день ещё идёт (~${hour}:00 Бишкек) — полный вчера vs неполный сегодня; рано делать вердикт`;
  }
  if (hour < 22) {
    return 'гипотеза: вечер ещё может догнать — сверь темп с тем же часом вчера, не только итог';
  }
  return null;
}

/** Консервативные гипотезы по кабинетам — не факты. */
export function buildConservativeHypotheses(cabs: CabDelta[]): string[] {
  const hypos: string[] = [];
  const inc = dayIncompleteHypo();
  if (inc) hypos.push(inc);

  const drops = cabs
    .filter((c) => c.deltaOrdersPct != null && c.deltaOrdersPct <= -25)
    .sort((a, b) => (a.deltaOrdersPct! - b.deltaOrdersPct!));
  const spikes = cabs
    .filter((c) => c.deltaOrdersPct != null && c.deltaOrdersPct >= 40)
    .sort((a, b) => (b.deltaOrdersPct! - a.deltaOrdersPct!));

  if (drops.length) {
    const worst = drops[0]!;
    hypos.push(
      `гипотеза: сильнее всего просел ${worst.name} (${worst.deltaOrdersPct}% заказов) — смотреть топ/ставки/остатки именно там`,
    );
    if (worst.topYesterday && !/нет заказов/i.test(worst.topYesterday)) {
      hypos.push(
        `гипотеза: вчера тянули «${worst.topYesterday.slice(0, 80)}» — проверить остаток и выдачу этих арт.`,
      );
    }
  } else if (spikes.length) {
    const best = spikes[0]!;
    hypos.push(
      `гипотеза: рост по ${best.name} (${best.deltaOrdersPct > 0 ? '+' : ''}${best.deltaOrdersPct}%) — проверить РК/цену/выдачу, не только «везёт»`,
    );
  } else if (cabs.length) {
    hypos.push(
      'гипотеза: по базе нет жёсткой дельты (±25%+) — возможно шум дня или неполный срез',
    );
  } else {
    hypos.push('гипотеза: цифр по кабинетам нет в фактах — сначала /sales, без теорий');
  }

  hypos.push(
    'гипотеза: реклама (пауза/запуск РК, ставка, ДРР) — зона Амины, только если видно в фактах РК',
  );
  hypos.push(
    'гипотеза: остатки/FBS на топе — зона Антона; без остатка не утверждать out-of-stock',
  );
  hypos.push(
    'не гипотеза, правило: не списывать на «алгоритм WB» без факта из отчёта',
  );

  return hypos.slice(0, 7);
}

/** Гипотезы по конкретному артикулу (рост или падение). */
export function buildArticleHypotheses(
  hits: ArticleDayHit[],
  productQuery: string,
): string[] {
  const hypos: string[] = [];
  const inc = dayIncompleteHypo();
  if (inc) hypos.push(inc);

  if (!hits.length) {
    hypos.push(
      `гипотеза: по запросу «${productQuery}» точного арт. в заказах вчера/сегодня не вижу — уточни vendor/nm или кабинет`,
    );
    return hypos;
  }

  const best = hits[0]!;
  const delta = best.yQty > 0
    ? Math.round(((best.tQty - best.yQty) / best.yQty) * 100)
    : (best.tQty > 0 ? 100 : 0);

  if (best.tQty > best.yQty && delta >= 25) {
    hypos.push(
      `гипотеза: «${best.article}» растёт (${best.yQty}→${best.tQty}, ${delta > 0 ? '+' : ''}${delta}%) — РК/цена/выдача; Амина глянет ставки`,
    );
    hypos.push(
      'гипотеза: всплеск может быть неполным днём + утренний хвост — сверить час-к-часу',
    );
  } else if (best.tQty < best.yQty && delta <= -25) {
    hypos.push(
      `гипотеза: «${best.article}» просел (${best.yQty}→${best.tQty}, ${delta}%) — остаток/выдача/пауза РК`,
    );
    hypos.push(
      'гипотеза: Антон — не ушли ли в ноль размеры; Амина — не сняли ли кампанию',
    );
  } else {
    hypos.push(
      `гипотеза: по «${best.article}» дельта умеренная (${best.yQty}→${best.tQty}) — возможно шум; не раздувать`,
    );
  }

  if (hits.length > 1) {
    hypos.push(
      `гипотеза: похожих арт. несколько (${hits.length}) — не смешивать цвета/фасоны без уточнения`,
    );
  }

  hypos.push(
    'не гипотеза, правило: цифры владельца («40 заказов») сверяй с ФАКТАМИ; расхождение — скажи честно',
  );
  return hypos.slice(0, 6);
}

export function formatSalesDropFacts(cabs: CabDelta[], hypos: string[]): string {
  const hour = bishkekHour();
  const lines = [
    '=== РАЗБОР ВЧЕРА / СЕГОДНЯ (консервативно) ===',
    `Сейчас ~${hour}:00 Бишкек. Сравниваем заказы шт (не выдумывать).`,
  ];
  if (!cabs.length) {
    lines.push('Нет разобранных кабинетов в ФАКТАХ.');
  } else {
    for (const c of cabs) {
      const d = c.deltaOrdersPct == null
        ? 'н/д'
        : `${c.deltaOrdersPct > 0 ? '+' : ''}${c.deltaOrdersPct}%`;
      lines.push(
        `▶ ${c.name}: вчера ${c.yOrders} шт / ${Math.round(c.ySum)} ₽ → сегодня ${c.tOrders} шт / ${Math.round(c.tSum)} ₽ (${d})`,
      );
    }
  }
  lines.push('', 'ГИПОТЕЗЫ (не факты — помечай в речи):');
  for (const h of hypos) lines.push(`• ${h}`);
  lines.push(
    '',
    'Порядок обсуждения: Сауле (цифры+гипотезы) → Амина (РК) → Антон (остатки). Спорьте мягко, без паники.',
  );
  return lines.join('\n');
}

export function formatArticleDayFacts(
  hits: ArticleDayHit[],
  productQuery: string,
  hypos: string[],
): string {
  const hour = bishkekHour();
  const lines = [
    '=== РАЗБОР АРТИКУЛА ВЧЕРА / СЕГОДНЯ ===',
    `Запрос владельца (товар): «${productQuery}» · ~${hour}:00 Бишкек`,
  ];
  if (!hits.length) {
    lines.push('В заказах WB за вчера/сегодня похожий артикул не нашла.');
  } else {
    for (const h of hits) {
      const d = h.yQty > 0
        ? Math.round(((h.tQty - h.yQty) / h.yQty) * 100)
        : (h.tQty > 0 ? 100 : 0);
      const dLabel = `${d > 0 ? '+' : ''}${d}%`;
      lines.push(
        `▶ ${h.cabinetName} · ${h.article}` +
          (h.nmId ? ` · nm ${h.nmId}` : '') +
          `: вчера ${h.yQty} шт → сегодня ${h.tQty} шт (${dLabel})`,
      );
    }
  }
  lines.push('', 'ГИПОТЕЗЫ (не факты):');
  for (const h of hypos) lines.push(`• ${h}`);
  lines.push(
    '',
    'Сауле ведёт цифры → Амина РК по этому арт. → Антон остатки. Рост и падение разбираем одинаково спокойно.',
  );
  return lines.join('\n');
}

/** Промпт-режим для lead/hop. */
export function salesDropDiscussBrief(agent: string, productQuery = ''): string {
  const focus = productQuery
    ? `Фокус товара: «${productQuery}». Сначала блок РАЗБОР АРТИКУЛА, потом кабинетный фон.`
    : 'Может быть общий разбор или конкретный артикул — смотри блок РАЗБОР.';
  const common = [
    'РЕЖИМ: консервативный разбор вчера→сегодня (просадка ИЛИ рост — оба ок).',
    focus,
    'Сначала факты из ФАКТОВ. Потом 1–2 гипотезы с пометкой «похоже» / «гипотеза».',
    'Не драматизируй. Не «всё умерло» / «взлетело навсегда». Не поддакивай вхолостую.',
    'Цифры только из ФАКТОВ. Нет цифры — «не вижу в фактах».',
  ];
  if (agent === 'saule') {
    return [
      ...common,
      'Ты ведёшь: дельта по арт./кабинетам → 2 гипотезы → пинг Амины или Антона («Амина, …»).',
    ].join('\n');
  }
  if (agent === 'amina') {
    return [
      ...common,
      'Твоя зона: РК/ставки/паузы/ДРР по этому товару или кабинету. Рост — не перелили ли бюджет? Падение — не на паузе ли РК?',
      'В конце можно «Антон, …» если нужен остаток.',
    ].join('\n');
  }
  if (agent === 'anton') {
    return [
      ...common,
      'Твоя зона: остатки/FBS по названному арт. Рост при нулевом остатке — странно; падение при нуле — логично. Без цифр не утверждай.',
      'Закрой тему коротко, никого не зови.',
    ].join('\n');
  }
  if (agent === 'alina') {
    return [
      ...common,
      'Только если раздачи/отзывы могли качнуть выдачу — одна гипотеза. Иначе «по моей зоне тихо» и стоп.',
    ].join('\n');
  }
  return common.join('\n');
}

/** Собрать факты разбора (WB + опционально артикул из вопроса). */
export async function buildSalesDropFactsBundle(
  rootTask = '',
  cache = createWbContextCache(),
): Promise<string> {
  const productQ = extractDiscussProductQuery(rootTask);
  const wb = await buildAgentWbContext('saule' as AgentKey, cache);
  const cabs = parseSalesDeltas(wb);

  if (productQ.length >= 3) {
    const hits = await findArticleDayCompare(productQ, { minScore: 4, max: 8 });
    const artHypos = buildArticleHypotheses(hits, productQ);
    const cabHypos = buildConservativeHypotheses(cabs).slice(0, 3);
    const hypos = [...artHypos, ...cabHypos.filter((h) => !artHypos.includes(h))].slice(0, 8);
    const head = formatArticleDayFacts(hits, productQ, hypos);
    const cabTail = formatSalesDropFacts(cabs, []).split('\n').slice(0, 12).join('\n');
    return `${head}\n\n--- фон по кабинетам ---\n${cabTail}\n\n${wb}`;
  }

  const hypos = buildConservativeHypotheses(cabs);
  return `${formatSalesDropFacts(cabs, hypos)}\n\n${wb}`;
}
