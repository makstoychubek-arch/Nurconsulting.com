import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  costQueryProductText,
  findPlanningProducts,
  formatCostReply,
  planningCatalogMeta,
  wantsCostQuery,
} from './agent-planning-catalog.ts';

Deno.test('planning catalog loaded', () => {
  const m = planningCatalogMeta();
  assert(m.count >= 200);
  assert(m.withCost >= 150);
});

Deno.test('wantsCostQuery', () => {
  assert(wantsCostQuery('себес кимоно бежевый'));
  assert(wantsCostQuery('какая себестоимость 334548155'));
  assert(wantsCostQuery('себис лапша черный'));
  assert(!wantsCostQuery('остатки лапша'));
});

Deno.test('find by nm and words', () => {
  const byNm = findPlanningProducts('334548155');
  assertEquals(byNm.length, 1);
  assertEquals(byNm[0]!.nm_id, 334548155);
  assert(byNm[0]!.cost_price! > 0);

  const byWord = findPlanningProducts('кимоно бежевый');
  assert(byWord.length >= 1);
  assert(byWord.some((x) => x.nm_id === 334548155));
});

Deno.test('formatCostReply', () => {
  const hits = findPlanningProducts('334548155');
  const t = formatCostReply(hits);
  assert(/334548155/.test(t));
  assert(/себестоимость/i.test(t));
});

Deno.test('costQueryProductText strips', () => {
  assertEquals(costQueryProductText('себес кимоно бежевый'), 'кимоно бежевый');
});
