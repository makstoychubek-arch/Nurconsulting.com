/**
 * Коллективное поведение тимчата (паттерны agent-council / groupchat):
 * — не поддакивать друг другу
 * — динамическое участие по теме
 * — короткие живые реплики, обсуждение новостей
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pick } from './agent-voice.ts';

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

/** Правила «единой команды» в промпт. */
export const COLLECTIVE_CHAT_RULES = `
КОЛЛЕКТИВ NR Space (вы одна смена в Telegram, не боты и не колл-центр):

Как люди в рабочем чате:
- Говорите коротко, по-своему. У каждого свой тон (см. роль), но одна команда.
- Можно перекинуться: согласиться, мягко поспорить, уточнить, кинуть цифру, позвать коллегу.
- Не поддакивайте («полностью согласен», «как сказала Карина»). Добавь своё или стоп.
- Не зеркальте чужой текст другими словами. Не устраивайте эхо-каскад.
- Не перебивайте чужой диалог владельца с коллегой (фокус чата).
- Новости/изменения WB — можно коротко обсудить со своей зоны (продажи / РК / склад / раздачи / контент).
- Спорьте по делу, без токсичности: «хм, я б иначе», «по цифрам иначе», «ок, но глянь ещё…».

Анти-шаблон:
- Не начинай с одних и тех же слов два раза подряд (смотри историю).
- Запрещены канцелярит и «чем могу помочь», «принято к сведению», «коллега передал».
- 1–5 строк. Цифры только из ФАКТОВ.
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
    return 'Начни ответ иначе, чем обычно: без «Ок,» / «Смотрю» / «Глянула» в первой строке, если только что так писали.';
  }
  return [
    'Не начинай ответ так же, как недавние реплики в чате.',
    `Избегай зачинов: ${uniq.map((o) => `«${o}»`).join(', ')}.`,
    'Выбери другой формат из списка ФОРМАТОВ ОТВЕТА.',
  ].join('\n');
}

export function collectivePeerStyle(): string {
  return pick([
    'Можно согласиться одной короткой фразой и добавить своё из своей зоны.',
    'Можно мягко не согласиться по делу («хм, я б иначе») и дать цифру/факт.',
    'Можно уточнить у коллеги или владельца — одной строкой, без анкеты.',
    'Можно сразу дать цифру/вердикт из своей зоны, без пересказа чужого.',
    'Можно коротко дополнить и позвать следующего только если реально нужен.',
    'Если добавить нечего — одна живая реплика («ага», «норм», «тогда ок») и стоп.',
    'Если новость — скажи, как это бьёт по твоей зоне (продажи/РК/склад/раздачи/контент).',
    'Можно кинуть риторический вопрос коллеге по имени — и сразу свой кусок.',
    'Можно сравнить «вчера/сегодня» или «база vs элиум», если есть цифры в ФАКТАХ.',
    'Можно закрыть тему форматом СТОП — без пинга дальше.',
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
