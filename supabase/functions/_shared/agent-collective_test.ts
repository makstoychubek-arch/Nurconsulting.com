import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  formatNewsFacts,
  newsDiscussionPlan,
  openingDiversityHint,
  wantsNewsDiscussion,
  wantsTeamBanter,
} from './agent-collective.ts';
import { buildTeamPlan, peerTalkBrief } from './agent-team.ts';

Deno.test('wantsNewsDiscussion catches news phrases', () => {
  assert(wantsNewsDiscussion('что по новостям wb'));
  assert(wantsNewsDiscussion('обсудите свежую новость про комиссию'));
  assert(wantsNewsDiscussion('Карина, глянь новости'));
  assert(!wantsNewsDiscussion('остаток лапша белая'));
});

Deno.test('newsDiscussionPlan picks specialists', () => {
  const ads = newsDiscussionPlan('новость про ставки рк');
  assertEquals(ads[0], 'karina');
  assert(ads.includes('amina'));
  const stock = newsDiscussionPlan('новости про склады fbs');
  assert(stock.includes('anton'));
});

Deno.test('buildTeamPlan routes news to collective', () => {
  const plan = buildTeamPlan('что нового по wb, обсудите');
  assertEquals(plan[0], 'karina');
  assert(plan.length >= 2);
});

Deno.test('openingDiversityHint bans recent openings', () => {
  const hint = openingDiversityHint('Сауле: Ок глянула\nАмина: Смотрю рк');
  assert(/ок глянула|смотрю рк/i.test(hint) || /Избегай зачинов/i.test(hint));
});

Deno.test('peerTalkBrief anti-sycophancy', () => {
  const t = peerTalkBrief('saule', 'продажи норм');
  assert(/не поддакивай|не копируй|сразу по делу/i.test(t));
});

Deno.test('wantsTeamBanter', () => {
  assert(wantsTeamBanter('поговорите между собой что думаете'));
  assert(!wantsTeamBanter('остаток элиум'));
});

Deno.test('formatNewsFacts empty', () => {
  assert(/нет/i.test(formatNewsFacts([])));
});
