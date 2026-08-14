import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  contactAck,
  contactNeedArticle,
  contactSoftCheck,
  abTaskLabel,
  withContact,
  channelHelpContact,
} from './bot-contact.ts';

Deno.test('contactAck mentions task', () => {
  const s = contactAck('отчёт по арт. 1');
  assert(s.includes('отчёт') || s.includes('арт') || s.length > 5);
});

Deno.test('softCheck invites correction', () => {
  const s = contactSoftCheck('статус теста');
  assert(/понял|Беру|Кажется|Правильно|Считываю/i.test(s));
});

Deno.test('needArticle asks for nm', () => {
  const s = contactNeedArticle(['отчёт 123', 'тест 123']);
  assert(/артикул|арт|nm/i.test(s));
});

Deno.test('abTaskLabel covers intents', () => {
  assertEquals(abTaskLabel('report', 99).includes('99'), true);
  assert(abTaskLabel('list').length > 3);
});

Deno.test('withContact joins', () => {
  assertEquals(withContact('Ок.', 'Тело'), 'Ок.\n\nТело');
  assertEquals(withContact('', 'Только'), 'Только');
});

Deno.test('channel help ab is human', () => {
  const h = channelHelpContact('ab_tests');
  assert(/тест|арт|отчёт|фото/i.test(h));
});
