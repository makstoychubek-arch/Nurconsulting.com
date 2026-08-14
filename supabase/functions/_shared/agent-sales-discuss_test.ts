import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildConservativeHypotheses,
  extractDiscussProductQuery,
  formatSalesDropFacts,
  parseSalesDeltas,
  salesDropDiscussPlan,
  wantsSalesDropDiscuss,
} from './agent-sales-discuss.ts';
import { buildTeamPlan } from './agent-team.ts';

Deno.test('wantsSalesDropDiscuss phrases', () => {
  assert(wantsSalesDropDiscuss('/разбор'));
  assert(wantsSalesDropDiscuss('почему вчера много сегодня мало'));
  assert(wantsSalesDropDiscuss('что с продажами, обсудите'));
  assert(wantsSalesDropDiscuss('продажи просели по базе'));
  assert(wantsSalesDropDiscuss('почему по блузке фонарь белый вчера 40 заков а сегодня много'));
  assert(wantsSalesDropDiscuss('лапша черный вчера мало сегодня выросла'));
  assert(!wantsSalesDropDiscuss('остаток лапша белая'));
});

Deno.test('extractDiscussProductQuery', () => {
  const q = extractDiscussProductQuery(
    'почему по блузке фонарь белый вчера 40 заков а сегодня много',
  );
  assert(/фонар/.test(q));
  assert(/блуз/.test(q));
  assert(/бел/.test(q));
  assert(!/вчера/.test(q));
  assert(!/40/.test(q));
});

Deno.test('salesDropDiscussPlan order', () => {
  const p = salesDropDiscussPlan('почему продаж мало');
  assertEquals(p[0], 'saule');
  assert(p.includes('amina'));
  assert(p.includes('anton'));
});

Deno.test('buildTeamPlan routes sales drop', () => {
  const plan = buildTeamPlan('почему вчера много сегодня мало по продажам');
  assertEquals(plan[0], 'saule');
  assert(plan.length >= 2);
});

Deno.test('parseSalesDeltas + conservative hypos', () => {
  const sample = `
▶ Baza
  вчера: заказы 100 шт / 50 000 ₽; выкупы 40 шт / 20 000 ₽; отмены 5
  сегодня: заказы 30 шт / 12 000 ₽; выкупы 10 шт / 4 000 ₽
  топ вчера: лапша 40шт; кимоно 20шт
▶ Elium
  вчера: заказы 10 шт / 5 000 ₽; выкупы 2 шт / 1 000 ₽; отмены 0
  сегодня: заказы 9 шт / 4 500 ₽; выкупы 2 шт / 900 ₽
  топ вчера: нет заказов
`;
  const cabs = parseSalesDeltas(sample);
  assertEquals(cabs.length, 2);
  assertEquals(cabs[0]!.name, 'Baza');
  assertEquals(cabs[0]!.deltaOrdersPct, -70);
  const hypos = buildConservativeHypotheses(cabs);
  assert(hypos.some((h) => /гипотеза/i.test(h)));
  assert(hypos.some((h) => /алгоритм/i.test(h)));
  const facts = formatSalesDropFacts(cabs, hypos);
  assert(/Baza/.test(facts));
  assert(/РАЗБОР/i.test(facts));
});
