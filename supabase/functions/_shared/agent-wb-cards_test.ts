import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  accessPresetItems,
  normalizeRuPhone,
  normalizeWbInvitePhone,
  parseAccessPreset,
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

Deno.test('normalizeWbInvitePhone countries', () => {
  assertEquals(normalizeWbInvitePhone('+7 (900) 123-45-67')?.phone, '79001234567');
  assertEquals(normalizeWbInvitePhone('89001234567')?.phone, '79001234567');
  assertEquals(normalizeWbInvitePhone('9001234567')?.phone, '79001234567');
  assertEquals(normalizeWbInvitePhone('9001234567')?.countryName, 'Россия');

  assertEquals(normalizeWbInvitePhone('+996 700 123 456')?.phone, '996700123456');
  assertEquals(normalizeWbInvitePhone('996700123456')?.countryName, 'Кыргызстан');
  assertEquals(normalizeWbInvitePhone('700123456')?.phone, '996700123456'); // local KG

  assertEquals(normalizeWbInvitePhone('77001234567')?.country, 'KZ');
  assertEquals(normalizeWbInvitePhone('+375 29 123-45-67')?.phone, '375291234567');
  assertEquals(normalizeWbInvitePhone('998901234567')?.countryName, 'Узбекистан');

  assertEquals(normalizeWbInvitePhone('123'), null);
  // back-compat
  assertEquals(normalizeRuPhone('89001234567'), '79001234567');
});

Deno.test('access presets', () => {
  assertEquals(parseAccessPreset('стандарт'), 'standard');
  assertEquals(parseAccessPreset('2'), 'manager');
  assertEquals(accessPresetItems('standard'), undefined);
  assert(accessPresetItems('manager')!.some((a) => a.code === 'balance' && a.disabled));
});

Deno.test('extractNm-ish intents still', () => {
  assert(wantsCardCreate('создай карточку блузка белая зевина 1 размеры с 40 по 54'));
  assert(wantsCardCreate('Создать карточку блузка тест размеры с 44 по 60'));
  assert(wantsCardSeo('поменяй описание карточки nm 1234567'));
  assert(wantsCardBrand('смени бренд на Nely по nm 123'));
  assertEquals(parseSizeRange('размеры с 44 по 60')?.[0], '44');
  assertEquals(parseSizeRange('размеры с 44 по 60')?.at(-1), '60');
  assert(wantsUserInvite('добавь человека в кабинет зевина 1'));
  assert(wantsUserInvite('сгенерите ссылку для приглашение'));
  assert(wantsUserInvite('ссылка для добавления пользователя'));
  assert(wantsUserInvite('приглашение в кабинет'));
  assert(wantsUserInvite('сгенери ссылку приглашения'));
  assert(wantsUserInvite('Сгенери ссылку для приглашения'));
  assert(wantsUserInvite('Сгенери ссылку для приглашении'));
  assert(!wantsUserInvite('как продажи вчера'));
  assert(!wantsUserInvite('ты сгенери номер дам')); // без «ссылка/приглашение» — не старт
  assert(wantsUserList('кто в кабинете база'));
  assert(wantsUserRevoke('удали доступ сотрудника'));
});
