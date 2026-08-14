import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractNmId,
  parseAbIntent,
  wantsAbQuery,
  pickVariant,
  roughLeader,
  abDialog,
} from './ab-test-dialogs.ts';

Deno.test('extractNmId: labeled and bare', () => {
  assertEquals(extractNmId('тест 123456789'), 123456789);
  assertEquals(extractNmId('арт. 987654321'), 987654321);
  assertEquals(extractNmId('123456789'), 123456789);
  assertEquals(extractNmId('как там 555666777'), 555666777);
  assertEquals(extractNmId('отчёт по 111222333'), 111222333);
});

Deno.test('parseAbIntent: human phrases', () => {
  assertEquals(parseAbIntent('какие тесты крутятся?').intent, 'list');
  assertEquals(parseAbIntent('тесты').intent, 'list');
  assertEquals(parseAbIntent('активные тесты').intent, 'list');
  assertEquals(parseAbIntent('помощь').intent, 'help');
  assertEquals(parseAbIntent('что умеешь').intent, 'help');
  assertEquals(parseAbIntent('как запустить тест').intent, 'how_start');
  assertEquals(parseAbIntent('скинь отчёт 123456789').intent, 'report');
  assertEquals(parseAbIntent('скинь отчёт 123456789').nmId, 123456789);
  assertEquals(parseAbIntent('смени фото 123456789').intent, 'rotate');
  assertEquals(parseAbIntent('следующий вариант 123456789').intent, 'rotate');
  assertEquals(parseAbIntent('кто выигрывает 123456789').intent, 'winner');
  assertEquals(parseAbIntent('как там 123456789').intent, 'detail');
  assertEquals(parseAbIntent('123456789').intent, 'detail');
  assertEquals(parseAbIntent('ротани 999000001').intent, 'rotate');
});

Deno.test('wantsAbQuery covers colloquial', () => {
  assert(wantsAbQuery('что крутится'));
  assert(wantsAbQuery('победителЬ какой'));
  assert(wantsAbQuery('ctr по карточке'));
});

Deno.test('pickVariant returns one of five', () => {
  const set = new Set<string>();
  for (let i = 0; i < 40; i++) set.add(abDialog.listEmpty());
  assert(set.size >= 2);
  assert(pickVariant(['a', 'b', 'c'] as const).length === 1);
});

Deno.test('roughLeader picks higher CTR', () => {
  const lead = roughLeader([
    { variant_label: 'A', impressions: 1000, clicks: 20 },
    { variant_label: 'B', impressions: 1000, clicks: 50 },
  ]);
  assertEquals(lead?.label, 'B');
});
