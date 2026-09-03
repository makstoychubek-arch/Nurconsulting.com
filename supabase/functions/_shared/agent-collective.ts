/**
 * Коллективное поведение тимчата (паттерны agent-council / groupchat):
 * — не поддакивать друг другу
 * — динамическое участие по теме
 * — короткие живые реплики, обсуждение новостей
 */

import { pick } from './agent-voice.ts';
import { getAdminClient } from './supabase-admin.ts';

function admin() {
  return getAdminClient();
}

/** Правила «единой команды» в промпт. */
export const COLLECTIVE_CHAT_RULES = `
Вы одна смена NR Space в Telegram — живые люди, не боты.

- У каждого свой тон, но одна команда. Коротко, по-своему.
- Консервативно: сначала факты из ФАКТОВ, потом гипотезы. Гипотезу помечай («похоже», «гипотеза»).
- Можно согласиться / мягко поспорить / кинуть цифру / позвать коллегу.
- Не поддакивай («полностью согласен», «как сказала Карина»). Своё или стоп.
- Не усиливай панику и не эхо «да, всё плохо». Не зеркаль чужой текст.
- Не перебивай чужой диалог владельца с коллегой.
- Новости WB — одна реплика из своей зоны, без воды.
- Спорь по делу: «хм, я б иначе», «по цифрам иначе» — без токсичности.
- Не начинай два раза подряд одними словами (смотри историю).
- 1–4 строки. Цифры только из ФАКТОВ. Нет цифры — «не вижу», без теорий про «алгоритм».
`;

export function wantsNewsDiscussion(text: string): boolean {
  const t = String(text || '').toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (
    /новост|что\s+нового|свеж(ее|ие)|апдейт\s+wb|изменения\s+(на\s+)?(wb|вб|вайлд)|правила\s+wb|комисси|тариф|штрафн|блокировк|триггер/i
      .test(t) ||
    /(обсуд|глянь|смотрите).{0,20}(новост|статью|пост)/i.test(t) ||
    /wildberries|вайлдберр|озон|яндекс\s*маркет|мегамаркет/i.test(t) &&
      /(новост|статья|пишет|вышло|анонс)/i.test(t)
  ) {
    return true;
  }
  // скинули ссылку на статью/пост — тоже обсуждаем
  if (
    /https?:\/\/\S+/i.test(t) &&
    /(wb|wildberries|вайлд|ozon|озон|маркет|retail|комисс|тариф|продавц)/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Кто подключается к обсуждению новости (динамическое участие). */
export function newsDiscussionPlan(text: string): string[] {
  const t = String(text || '').toLowerCase();
  const plan: string[] = ['karina'];
  if (/реклам|рк|cpc|ставк|аукцион|бюджет/i.test(t)) plan.push('amina');
  if (/продаж|цен|выкуп|заказ|комисси|тариф/i.test(t)) plan.push('saule');
  if (/склад|fbs|логист|поставк|остат|отгруз/i.test(t)) plan.push('anton');
  if (/раздач|самовыкуп|кэш|кеш|бартер|продвиж/i.test(t)) plan.push('alina');
  if (/фото|креатив|карточк|инфограф|контент/i.test(t)) plan.push('muha');
  // дефолт: продажи + реклама — чаще всего про новости WB
  if (plan.length === 1) {
    plan.push('saule', 'amina');
  }
  return [...new Set(plan)].slice(0, 4);
}

export type NewsRow = {
  title: string;
  market: string;
  url: string;
  published_at: string | null;
};

/** Свежие новости из marketplace_news_sent для обсуждения в тимчате. */
export async function recentMarketplaceNews(limit = 5): Promise<NewsRow[]> {
  const db = admin();
  const { data } = await db
    .from('marketplace_news_sent')
    .select('title, market, url, published_at, sent_at')
    .order('sent_at', { ascending: false })
    .limit(Math.max(1, Math.min(12, limit)));
  return (data || []).map((r) => ({
    title: String(r.title || '').trim(),
    market: String(r.market || 'MP'),
    url: String(r.url || ''),
    published_at: r.published_at ? String(r.published_at) : null,
  })).filter((r) => r.title);
}

export function formatNewsFacts(rows: NewsRow[]): string {
  if (!rows.length) {
    return 'Свежих новостей в базе нет — скажи честно и предложи тему/ссылку.';
  }
  return [
    'СВЕЖИЕ НОВОСТИ МАРКЕТПЛЕЙСОВ (из мониторинга):',
    ...rows.map((r, i) => {
      const when = r.published_at
        ? r.published_at.slice(0, 10)
        : 'недавно';
      return `${i + 1}. [${r.market}] ${r.title} (${when})${r.url ? ` · ${r.url}` : ''}`;
    }),
    'Обсудите коротко как смена: что важно для наших кабинетов, без воды.',
  ].join('\n');
}

/** Запрет повторять зачины из последних реплик в истории. */
export function openingDiversityHint(historyText: string): string {
  const lines = String(historyText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-12);
  const openings: string[] = [];
  for (const line of lines) {
    // "Сауле: Ок, глянула" → берём первые 2–3 слова ответа
    const body = line.replace(/^[^:]{1,20}:\s*/, '');
    const words = body.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    if (words.length >= 3) openings.push(words);
  }
  const uniq = [...new Set(openings)].slice(-6);
  if (!uniq.length) {
    return 'Начни иначе, чем обычно: без «Ок,» / «Смотрю» / «Глянула» в первой строке.';
  }
  return [
    'Не начинай так же, как недавние реплики в чате.',
    `Избегай зачинов: ${uniq.map((o) => `«${o}»`).join(', ')}.`,
    'Сразу по делу, другим заходом.',
  ].join('\n');
}

export function collectivePeerStyle(): string {
  return pick([
    'Согласись коротко и добавь своё из зоны — или молчи.',
    'Мягко не согласись («хм, я б иначе») и кинь цифру из ФАКТОВ.',
    'Уточни одной строкой, без анкеты.',
    'Сразу цифра/вердикт из своей зоны, без пересказа.',
    'Дополни коротко; коллегу зови только если реально нужен.',
    'Нечего добавить по зоне — одна мысль из ФАКТОВ или передай коллеге «Амина, …».',
    'Новость — как бьёт по твоей зоне, одной-двумя строками.',
    'Можно «Антон, …» и сразу свой кусок.',
    'Сравни вчера/сегодня или кабинеты, если есть цифры в ФАКТАХ. Гипотезу помечай.',
    'Закрой тему фактом из своей зоны, без пустого «норм».',
    'Не усиливай чужую тревогу — факт или стоп.',
  ]);
}

export function newsDiscussLead(): string {
  return pick([
    'Карина · новости',
    'Свежее по площадкам:',
    'Глянула мониторинг:',
    'Что вышло:',
    'Коротко по новостям:',
  ]);
}

export function wantsTeamBanter(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (
    /поболта|поговорите|обсудите|как\s+команда|между\s+собой|посп[оа]рьте|что\s+думаете/i
      .test(t)
  );
}
