import {
  assert,
  assertEquals,
  assertFalse,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractArticleProductQuery,
  extractPriceProductQuery,
  formatArticleLookupLine,
  formatPriceLookupLine,
  wantsArticleLookup,
  wantsBeforeDiscount,
  wantsPriceLookup,
} from './agent-qa.ts';
import { isLikelyFollowUp } from './agent-chat-focus.ts';
import { wantsPriceChange } from './agent-price-change.ts';
import { findPlanningProducts } from './agent-planning-catalog.ts';

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

Deno.test('wantsArticleLookup for дай артикул лапша', () => {
  assert(wantsArticleLookup('артикул дай на лапшу бел'));
  assert(wantsArticleLookup('какой nm на фонарь белый'));
  assert(wantsArticleLookup('дай артикул блузка лапша белая'));
  assertFalse(wantsArticleLookup('как у конкурентов цена'));
  assertFalse(wantsArticleLookup('какая цена лапша'));
});

Deno.test('extractArticleProductQuery strips артикул junk', () => {
  assertEquals(
    extractArticleProductQuery('артикул дай на лапшу бел')
      .toLowerCase()
      .replace(/\s+/g, ' '),
    'лапшу бел',
  );
});

Deno.test('formatArticleLookupLine uses real nm not example', () => {
  const line = formatArticleLookupLine({
    vendorCode: 'Блузка-лапша-белый',
    nmId: 771499220,
    cabinetName: 'Baza',
  });
  assert(line.includes('771499220'));
  assertFalse(line.includes('211195995'));
});

Deno.test('planning catalog resolves лапшу бел to real nm', () => {
  const hits = findPlanningProducts('лапшу бел', { max: 3, minScore: 4 });
  assert(hits.length >= 1);
  assertEquals(hits[0].nm_id, 771499220);
  assert(/лапша.*бел/i.test(hits[0].name));
});
