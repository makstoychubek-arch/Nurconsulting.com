import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractPriceProductQuery,
  formatPriceLookupLine,
  wantsBeforeDiscount,
  wantsPriceLookup,
} from './agent-qa.ts';
import { isLikelyFollowUp } from './agent-chat-focus.ts';
import { wantsPriceChange } from './agent-price-change.ts';

Deno.test('wantsPriceLookup catches typos and до скидки', () => {
  assert(wantsPriceLookup('Напиши блузка фонарь белая уена какая?'));
  assert(wantsPriceLookup('какая цена фонарь белый'));
  assert(wantsPriceLookup('А до скидки?'));
  assert(wantsPriceLookup('а до скидки'));
  assert(wantsPriceLookup('старая цена'));
  assert(wantsPriceLookup('Без продажи только цену спрашиваю'));
  assertFalse(wantsPriceLookup('как продажи сегодня'));
  assertFalse(wantsPriceLookup('Сауле понизь цену фонарь'));
  assert(wantsPriceChange('Сауле понизь цену фонарь'));
});

Deno.test('wantsBeforeDiscount only for pre-discount asks', () => {
  assert(wantsBeforeDiscount('А до скидки?'));
  assert(wantsBeforeDiscount('цена до скидки'));
  assert(wantsBeforeDiscount('без скидки сколько'));
  assertFalse(wantsBeforeDiscount('какая цена фонарь'));
});

Deno.test('extractPriceProductQuery strips price junk and typo уена', () => {
  assertEquals(
    extractPriceProductQuery('Напиши блузка фонарь белая уена какая?')
      .toLowerCase()
      .replace(/\s+/g, ' '),
    'блузка фонарь белая',
  );
  assertEquals(
    extractPriceProductQuery('А до скидки?').trim(),
    '',
  );
  assert(
    extractPriceProductQuery('Сауле цена лапша белая').toLowerCase().includes(
      'лапша',
    ),
  );
});

Deno.test('formatPriceLookupLine shows до/после', () => {
  const hit = {
    vendorCode: 'Блузка_фонарь_белый',
    price: 2500,
    discountedPrice: 1500,
  };
  assertEquals(
    formatPriceLookupLine(hit, 'full'),
    'Блузка_фонарь_белый — до скидки 2 500 ₽ · после 1 500 ₽',
  );
  assert(
    formatPriceLookupLine(hit, 'before').includes('до скидки 2 500 ₽'),
  );
  assert(
    formatPriceLookupLine(hit, 'after').includes('1 500 ₽'),
  );
});

Deno.test('formatPriceLookupLine before-only when no old price', () => {
  const hit = {
    vendorCode: 'X',
    price: null,
    discountedPrice: 1500,
  };
  assert(
    formatPriceLookupLine(hit, 'before').includes('цены до скидки нет'),
  );
});

Deno.test('isLikelyFollowUp catches а до скидки', () => {
  assert(isLikelyFollowUp('А до скидки?'));
  assert(isLikelyFollowUp('а до скидки'));
  assert(isLikelyFollowUp('старая цена'));
});
