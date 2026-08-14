import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { scoreProductMatch } from './agent-product-catalog.ts';

Deno.test('catalog scorer: all cabinets style names', () => {
  assert(scoreProductMatch('жл-темносиний', 'жилетка темно синяя') >= 8);
  assert(scoreProductMatch('Блузка-лапша-белый', 'лапша белая') >= 8);
  assert(scoreProductMatch('Блузка-лапша-белый', 'водолазка белая') >= 8);
  assert(scoreProductMatch('укороч_костюм_брючный_черный', 'укороченный черный') >= 8);
  assert(scoreProductMatch('бомбер черный', 'бомбер черный') >= 8);
  assert(scoreProductMatch('Платье/Лиза/изумрудный', 'платье лиза изумруд') >= 6);
  assert(scoreProductMatch('кардиган бежевый', 'кардиган беж') >= 8);
  assert(scoreProductMatch('худи хаки', 'худи хаки') >= 8);
  assert(
    scoreProductMatch('жл-темносиний', 'жилетка темно синяя') >
      scoreProductMatch('жл-черный', 'жилетка темно синяя'),
  );
});

Deno.test('catalog scorer: nm direct', () => {
  assertEquals(scoreProductMatch('жл-темносиний 1171792658', '1171792658') >= 20, true);
});

Deno.test('catalog scorer: rnp real names', () => {
  assert(scoreProductMatch('Двойка_юбка_черный полоска', 'двойка юбка черная') >= 8);
  assert(scoreProductMatch('Спорт_костюм_велюр_хаки', 'спорт велюр хаки') >= 8);
  assert(scoreProductMatch('укороч.пидж брюч бордо', 'укороченный пиджак бордо') >= 8);
  assert(scoreProductMatch('Платье/Рыбка/ментол', 'платье рыбка ментол') >= 8);
  assert(scoreProductMatch('кимоно_однотон_тсиний_короткий', 'кимоно темно синее') >= 8);
  assert(scoreProductMatch('бомбер корич', 'бомбер коричневый') >= 6);
  assert(scoreProductMatch('Куртка_фуфайка_кофе', 'фуфайка кофе') >= 8);
  assert(scoreProductMatch('оверсайз жакет черный', 'оверсайз жакет черный') >= 8);
});
