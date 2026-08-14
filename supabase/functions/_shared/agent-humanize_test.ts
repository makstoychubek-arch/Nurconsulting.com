import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  humanizeAgentReply,
  looksLikeSharedLink,
} from './agent-humanize.ts';

Deno.test('humanize strips sycophancy openers', () => {
  const out = humanizeAgentReply('Полностью согласен. По базе заказы 12');
  assert(!/полностью согласен/i.test(out));
  assert(/заказ/i.test(out));
});

Deno.test('humanize strips bot meta lines', () => {
  const out = humanizeAgentReply('Глянула цифры\nЯ ИИ-ассистент и помогу\nОк');
  assert(!/я ии/i.test(out));
  assert(/глянула|ок/i.test(out));
});

Deno.test('humanize empty falls back', () => {
  assertEquals(humanizeAgentReply('Полностью согласен.'), 'ага');
});

Deno.test('looksLikeSharedLink', () => {
  assert(looksLikeSharedLink('глянь https://example.com/news'));
  assert(looksLikeSharedLink('скинул ссылку на новость'));
  assert(!looksLikeSharedLink('остаток лапша белая'));
});
