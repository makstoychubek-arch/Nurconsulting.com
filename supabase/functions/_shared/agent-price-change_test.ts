import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parsePriceDelta,
  parsePriceEdit,
  resolveUploadPrices,
  scorePriceProduct,
  wantsPriceChange,
} from './agent-price-change.ts';
import { isLikelyFollowUp } from './agent-chat-focus.ts';

Deno.test('wantsPriceChange detects lower/change phrases', () => {
  assert(wantsPriceChange('Карина снизь цену одного артикула'));
  assert(wantsPriceChange('цену менять надо блузки лапша'));
  assert(wantsPriceChange('Сауле понизь цену фонарь черный'));
  assert(!wantsPriceChange('как продажи сегодня'));
});

Deno.test('parsePriceDelta reads plain numbers', () => {
  assertEquals(parsePriceDelta('4000'), 4000);
  assertEquals(parsePriceDelta('на 1300'), 1300);
  assertEquals(parsePriceDelta('1300 руб'), 1300);
  assertEquals(parsePriceDelta('лапша белая'), null);
});

Deno.test('parsePriceEdit reads до/после + цена', () => {
  assertEquals(parsePriceEdit('после 3000'), { which: 'after', value: 3000 });
  assertEquals(parsePriceEdit('до скидки 5000'), { which: 'before', value: 5000 });
  assertEquals(parsePriceEdit('после скидки 2800'), { which: 'after', value: 2800 });
  assertEquals(parsePriceEdit('до 5500'), { which: 'before', value: 5500 });
  assertEquals(parsePriceEdit('4000'), null);
});

Deno.test('resolveUploadPrices before keeps discount', () => {
  const r = resolveUploadPrices(6000, 44, { which: 'before', value: 5000 });
  assertEquals(r?.price, 5000);
  assertEquals(r?.discountPct, 44);
});

Deno.test('resolveUploadPrices after adjusts discount', () => {
  const r = resolveUploadPrices(6000, 44, { which: 'after', value: 3000 });
  assertEquals(r?.price, 6000);
  assertEquals(r?.discountPct, 50);
  assertEquals(r?.after, 3000);
});

Deno.test('scorePriceProduct understands short product names', () => {
  assert(scorePriceProduct('Блузка-лапша-белый', 'лапша белая') >= 8);
  assert(scorePriceProduct('Блузка_фонарь_черный', 'фонарь черный') >= 8);
  assert(scorePriceProduct('укороч_костюм_брючный_черный', 'укороченный черный') >= 8);
  assert(
    scorePriceProduct('Блузка-лапша-белый', 'лапша белая') >
      scorePriceProduct('Блузка-лапша-черный', 'лапша белая'),
  );
});

Deno.test('scorePriceProduct finds Elium vest abbreviations', () => {
  assert(scorePriceProduct('жл-темносиний', 'жилетка темно синяя') >= 8);
  assert(scorePriceProduct('жл-темносиний', 'жилетка синяя') >= 8);
  assert(scorePriceProduct('жл-черный', 'жилетка черная') >= 8);
  assert(
    scorePriceProduct('жл-темносиний', 'жилетка темно синяя') >
      scorePriceProduct('жл-черный', 'жилетка темно синяя'),
  );
});

Deno.test('isLikelyFollowUp catches short product replies', () => {
  assert(isLikelyFollowUp('лапша белая'));
  assert(isLikelyFollowUp('фонарь черный'));
  assert(isLikelyFollowUp('4000'));
  assert(!isLikelyFollowUp('Карина, дай продажи по всем кабинетам за неделю подробно'));
});
