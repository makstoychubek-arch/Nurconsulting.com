/**
 * Каталог из ПЛАНИРОВАНИЕ.xlsx: nm_id + себес + каждое слово названия.
 * Бот отвечает на «себес кимоно бежевый» / «стоимость 334548155».
 */

import catalogJson from './data/planning-catalog.json' with { type: 'json' };
import { normProduct, scoreProductMatch } from './agent-product-catalog.ts';
import { fuzzyIncludesAny, normalizeBotText } from './agent-fuzzy.ts';

export type PlanningItem = {
  nm_id: number;
  brand: string;
  plan_brand?: string;
  vendor: string;
  name: string;
  cost_price: number | null;
  words: string[];
  cabinet_name?: string | null;
  cabinet_id?: string | null;
};

type CatalogFile = {
  source: string;
  updated_at: string;
  count: number;
  with_cost: number;
  items: PlanningItem[];
};

const FILE = catalogJson as CatalogFile;

export function planningCatalogMeta(): { count: number; withCost: number; source: string } {
  return {
    count: FILE.count,
    withCost: FILE.with_cost,
    source: FILE.source,
  };
}

export function allPlanningItems(): PlanningItem[] {
  return FILE.items || [];
}

export function wantsCostQuery(text: string): boolean {
  const t = normalizeBotText(text);
  if (!t || t.length > 160) return false;
  return fuzzyIncludesAny(t, [
    'себес',
    'себестоимость',
    'себис',
    'себистоимость',
    'cost',
    'стоимость товара',
    'сколько себес',
    'какой себес',
    'unit cost',
  ]);
}

/** Вытащить поисковую фразу без слов «себес/стоимость». */
export function costQueryProductText(text: string): string {
  let t = normalizeBotText(text);
  const stop = new Set([
    'какая', 'какой', 'какие', 'сколько',
    'себестоимость', 'себистоимость', 'себес', 'себис', 'cost',
    'стоимость', 'товара', 'товар', 'артикул', 'артикула', 'артикулу', 'nm',
    'unit',
  ]);
  return t
    .split(/\s+/)
    .filter((w) => w.length >= 1)
    .filter((w) => !stop.has(w))
    .join(' ')
    .trim();
}

export function findPlanningByNm(nmId: number): PlanningItem | null {
  return FILE.items.find((i) => i.nm_id === nmId) || null;
}

/**
 * Поиск по nm / словам / vendor / названию.
 * Каждое слово из Excel участвует в матче.
 */
export function findPlanningProducts(
  query: string,
  opts?: { max?: number; minScore?: number },
): Array<PlanningItem & { score: number }> {
  const q = String(query || '').trim();
  if (!q) return [];
  const nmOnly = normProduct(q).replace(/ /g, '').match(/^(\d{6,12})$/);
  if (nmOnly) {
    const hit = findPlanningByNm(Number(nmOnly[1]));
    return hit ? [{ ...hit, score: 100 }] : [];
  }

  const qNorm = normProduct(q);
  const qTokens = qNorm.split(' ').filter((w) => w.length >= 2);
  const out: Array<PlanningItem & { score: number }> = [];

  for (const item of FILE.items) {
    let score = Math.max(
      scoreProductMatch(item.name, q),
      scoreProductMatch(item.vendor, q),
    );
    // каждое слово из Excel
    const wordSet = new Set(item.words.map((w) => normProduct(w)));
    let wordHits = 0;
    for (const tok of qTokens) {
      if (wordSet.has(tok)) {
        wordHits++;
        score += 3;
        continue;
      }
      for (const w of wordSet) {
        if (w.includes(tok) || tok.includes(w)) {
          wordHits++;
          score += 2;
          break;
        }
      }
    }
    if (wordHits && wordHits === qTokens.length && qTokens.length >= 2) {
      score += 4;
    }
    if (score < (opts?.minScore ?? 4)) continue;
    out.push({ ...item, score });
  }

  out.sort((a, b) => b.score - a.score || a.nm_id - b.nm_id);
  const max = opts?.max ?? 8;
  if (!out.length) return [];
  const top = out[0]!.score;
  return out.filter((x) => x.score >= top - 2).slice(0, max);
}

export function formatCostReply(items: Array<PlanningItem & { score?: number }>): string {
  if (!items.length) {
    return 'Не нашла артикул в плане. Кинь nm_id или название как в таблице (например «кимоно бежевый» / 334548155).';
  }
  if (items.length === 1) {
    const i = items[0]!;
    const cost = i.cost_price != null
      ? `${Math.round(i.cost_price)} ₽`
      : 'в плане нет себеса — допиши в «ВЫГРУЗКА ОСТАТКИ»';
    return [
      `Себес · ${i.name}`,
      `nm ${i.nm_id}` + (i.vendor && i.vendor !== i.name ? ` · ${i.vendor}` : ''),
      i.cabinet_name || i.brand ? `кабинет/бренд: ${i.cabinet_name || i.brand}` : '',
      `себестоимость: ${cost}`,
    ].filter(Boolean).join('\n');
  }
  const lines = ['Нашла несколько — уточни:', ...items.slice(0, 6).map((i) => {
    const cost = i.cost_price != null ? `${Math.round(i.cost_price)}₽` : 'без себеса';
    return `• nm ${i.nm_id} · ${i.name} · ${cost}`;
  })];
  return lines.join('\n');
}

export function planningCatalogBrief(limit = 12): string {
  const withCost = FILE.items.filter((i) => i.cost_price != null);
  const lines = [
    `Каталог плана: ${FILE.count} арт., себес у ${FILE.with_cost}.`,
    'Спроси: «себес кимоно бежевый» или «себестоимость 334548155».',
    '',
    ...withCost.slice(0, limit).map(
      (i) => `• ${i.nm_id} · ${i.name} · ${Math.round(i.cost_price!)}₽`,
    ),
  ];
  if (withCost.length > limit) lines.push(`…ещё ${withCost.length - limit}`);
  return lines.join('\n');
}
