import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractNmId,
  normalizeRuPhone,
  parseSizeRange,
} from './agent-wb-api.ts';
import {
  wantsCardBrand,
  wantsCardCreate,
  wantsCardSeo,
} from './agent-wb-cards.ts';
import {
  wantsUserInvite,
  wantsUserList,
  wantsUserRevoke,
} from './agent-wb-users.ts';

Deno.test('parseSizeRange 40-54 step 2', () => {
  const s = parseSizeRange('блузка белая размеры с 40 по 54');
  assert(s);
  assertEquals(s![0], '40');
  assertEquals(s![s!.length - 1], '54');
  assert(s!.includes('42'));
  assert(!s!.includes('41'));
});

Deno.test('normalizeRuPhone', () => {
  assertEquals(normalizeRuPhone('+7 (900) 123-45-67'), '79001234567');
  assertEquals(normalizeRuPhone('89001234567'), '79001234567');
  assertEquals(normalizeRuPhone('9001234567'), '79001234567');
  assertEquals(normalizeRuPhone('123'), null);
});

Deno.test('extractNmId', () => {
  assertEquals(extractNmId('nm 211195995 описание'), 211195995);
  assertEquals(extractNmId('артикул 1234567'), 1234567);
});

Deno.test('card intents', () => {
  assert(wantsCardCreate('создай карточку блузка белая зевина 1 размеры с 40 по 54'));
  assert(wantsCardSeo('поменяй описание карточки nm 1234567'));
  assert(wantsCardSeo('сео по базе обнови'));
  assert(wantsCardBrand('смени бренд на Nely по nm 123'));
  assert(!wantsCardCreate('остаток блузка'));
});

Deno.test('users intents', () => {
  assert(wantsUserInvite('добавь человека в кабинет зевина 1'));
  assert(wantsUserInvite('пригласи в элиум'));
  assert(wantsUserList('кто в кабинете база'));
  assert(wantsUserRevoke('удали доступ сотрудника'));
});
