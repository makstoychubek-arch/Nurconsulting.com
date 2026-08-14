import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { scoreProductMatch } from './agent-product-catalog.ts';

Deno.test('catalog scorer: all cabinets style names', () => {
  assert(scoreProductMatch('жл-темносиний', 'жилетка темно синяя') >= 8);
  assert(scoreProductMatch('Блузка-лапша-белый', 'лапша белая') >= 8);
  assert(scoreProductMatch('укороч_костюм_брючный_черный', 'укороченный черный') >= 8);
  assert(scoreProductMatch('бомбер черный', 'бомбер черный') >= 8);
  assert(scoreProductMatch('Платье/Лиза/изумрудный', 'платье лиза изумруд') >= 6);
  assert(
    scoreProductMatch('жл-темносиний', 'жилетка темно синяя') >
      scoreProductMatch('жл-черный', 'жилетка темно синяя'),
  );
});

Deno.test('catalog scorer: nm direct', () => {
  assertEquals(scoreProductMatch('жл-темносиний 1171792658', '1171792658') >= 20, true);
});
