import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parsePriceDelta,
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

Deno.test('scorePriceProduct understands short product names', () => {
  assert(scorePriceProduct('Блузка-лапша-белый', 'лапша белая') >= 8);
  assert(scorePriceProduct('Блузка_фонарь_черный', 'фонарь черный') >= 8);
  assert(scorePriceProduct('укороч_костюм_брючный_черный', 'укороченный черный') >= 8);
  assert(
    scorePriceProduct('Блузка-лапша-белый', 'лапша белая') >
      scorePriceProduct('Блузка-лапша-черный', 'лапша белая'),
  );
});

Deno.test('isLikelyFollowUp catches short product replies', () => {
  assert(isLikelyFollowUp('лапша белая'));
  assert(isLikelyFollowUp('фонарь черный'));
  assert(isLikelyFollowUp('4000'));
  assert(!isLikelyFollowUp('Карина, дай продажи по всем кабинетам за неделю подробно'));
});
