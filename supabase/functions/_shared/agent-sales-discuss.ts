/**
 * Консервативный разбор «вчера много / сегодня мало»:
 * факты → гипотезы (не утверждения) → обсуждение зон Сауле/Амина/Антон.
 */

import { normalizeBotText, fuzzyIncludesAny } from './agent-fuzzy.ts';
import { buildAgentWbContext, createWbContextCache, type AgentKey } from './agent-wb-context.ts';

export type CabDelta = {
  name: string;
  yOrders: number;
  tOrders: number;
  ySum: number;
  tSum: number;
  deltaOrdersPct: number | null;
  topYesterday: string;
};

/** Владелец просит разобрать просадку / обсудить почему продаж мало. */
export function wantsSalesDropDiscuss(text: string): boolean {
  const t = normalizeBotText(text);
  if (!t) return false;
  if (/^\/?(разбор|почему|просадка|почемупродаж)(@\w+)?(\s|$)/i.test(String(text || '').trim())) {
    return true;
  }
  if (
    fuzzyIncludesAny(t, [
      'вчера много сегодня мало',
      'вчера много сегодня мало',
      'почему мало продаж',
      'почему продажи упали',
      'почему просадка',
      'разберите продажи',
      'обсудите продажи',
      'что с продажами',
      'продажи просели',
      'заказы упали',
      'сегодня мало заказов',
      'почему по базе',
    ])
  ) {
    return true;
  }
  // вчера…сегодня + (мало|упал|просадк|почему)
  if (
    /вчера/.test(t) &&
    /сегодня/.test(t) &&
    /(мало|много|упал|упали|просад|почему|меньше|хуже)/.test(t)
  ) {
    return true;
  }
  if (
    /(продаж|заказ)/.test(t) &&
    /(почему|просад|упал|упали|мало\s+сегодня|вчера.{0,20}сегодня)/.test(t)
  ) {
    return true;
  }
  return false;
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

/** Консервативные гипотезы — не факты. */
export function buildConservativeHypotheses(cabs: CabDelta[]): string[] {
  const hypos: string[] = [];
  const hour = bishkekHour();

  if (hour < 18) {
    hypos.push(
      `гипотеза: день ещё идёт (~${hour}:00 Бишкек) — полный вчера vs неполный сегодня; рано делать вердикт`,
    );
  } else if (hour < 22) {
    hypos.push(
      'гипотеза: вечер ещё может догнать — сверь темп с тем же часом вчера, не только итог',
    );
  }

  const drops = cabs
    .filter((c) => c.deltaOrdersPct != null && c.deltaOrdersPct <= -25)
    .sort((a, b) => (a.deltaOrdersPct! - b.deltaOrdersPct!));

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
  } else if (cabs.length) {
    hypos.push(
      'гипотеза: по базе нет жёсткой просадки (−25%+) — возможно шум дня или неполный срез',
    );
  } else {
    hypos.push('гипотеза: цифр по кабинетам нет в фактах — сначала /sales, без теорий');
  }

  hypos.push(
    'гипотеза: реклама (пауза РК / ДРР / ставка) — зона Амины, только если видно в фактах РК',
  );
  hypos.push(
    'гипотеза: остатки/FBS на топе — зона Антона; без остатка не утверждать out-of-stock',
  );
  hypos.push(
    'не гипотеза, правило: не списывать на «алгоритм WB» без факта из отчёта',
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

/** Промпт-режим для lead/hop. */
export function salesDropDiscussBrief(agent: string): string {
  const common = [
    'РЕЖИМ: консервативный разбор продаж вчера→сегодня.',
    'Сначала факты из блока РАЗБОР / ПРОДАЖИ. Потом 1–2 гипотезы с пометкой «похоже» / «гипотеза».',
    'Не драматизируй. Не «всё умерло». Не поддакивай коллеге вхолостую — своя зона или стоп.',
    'Цифры только из ФАКТОВ. Нет цифры — «не вижу в фактах».',
  ];
  if (agent === 'saule') {
    return [
      ...common,
      'Ты ведёшь: коротко дельта по кабинетам → 2 гипотезы → пинг Амины или Антона одной строкой («Амина, …»).',
    ].join('\n');
  }
  if (agent === 'amina') {
    return [
      ...common,
      'Твоя зона: РК/ставки/паузы/ДРР. Могла ли реклама объяснить просадку? Если в фактах РК пусто — так и скажи, не гадай.',
      'В конце можно «Антон, …» если нужен остаток.',
    ].join('\n');
  }
  if (agent === 'anton') {
    return [
      ...common,
      'Твоя зона: остатки/FBS по топ-артикулам вчера. Есть ли риск нуля? Без цифр остатков — не утверждай out-of-stock.',
      'Закрой тему коротко, никого не зови.',
    ].join('\n');
  }
  if (agent === 'alina') {
    return [
      ...common,
      'Только если раздачи/отзывы могли ударить по выдаче — одна гипотеза. Иначе «по моей зоне тихо» и стоп.',
    ].join('\n');
  }
  return common.join('\n');
}

/** Собрать факты разбора (WB + гипотезы). */
export async function buildSalesDropFactsBundle(
  cache = createWbContextCache(),
): Promise<string> {
  const wb = await buildAgentWbContext('saule' as AgentKey, cache);
  const cabs = parseSalesDeltas(wb);
  const hypos = buildConservativeHypotheses(cabs);
  return `${formatSalesDropFacts(cabs, hypos)}\n\n${wb}`;
}
