import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  humanizeAgentReply,
  looksLikeSharedLink,
} from './agent-humanize.ts';

Deno.test('humanize strips sycophancy openers', () => {
  const out = humanizeAgentReply('Полностью согласен. По базе заказы 12', {
    valence: false,
  });
  assert(!/полностью согласен/i.test(out));
  assert(/заказ/i.test(out));
});

Deno.test('humanize strips bot meta lines', () => {
  const out = humanizeAgentReply('Глянула цифры\nЯ ИИ-ассистент и помогу\nОк', {
    valence: false,
  });
  assert(!/я ии/i.test(out));
  assert(!/^глянула/i.test(out.trim()));
  assert(/цифр|ок/i.test(out));
});

Deno.test('humanize strips Ok/Smotryu openers', () => {
  const a = humanizeAgentReply('Ок, по базе 12 заказов', { valence: false });
  assert(!/^ок/i.test(a));
  assert(/базе|заказ/i.test(a));
  const b = humanizeAgentReply('Смотрю рк по элиум', { valence: false });
  assert(!/^смотрю/i.test(b));
  assert(/рк|элиум/i.test(b));
});

Deno.test('humanize limits emoji to one', () => {
  const out = humanizeAgentReply('Рост 🔥 и ещё 👍 ок', { valence: false });
  const emojis = out.match(/\p{Extended_Pictographic}/gu) || [];
  assertEquals(emojis.length, 1);
});

Deno.test('humanize empty falls back', () => {
  assertEquals(humanizeAgentReply('Полностью согласен.', { valence: false }), 'ага');
});

Deno.test('looksLikeSharedLink', () => {
  assert(looksLikeSharedLink('глянь https://example.com/news'));
  assert(looksLikeSharedLink('скинул ссылку на новость'));
  assert(!looksLikeSharedLink('остаток лапша белая'));
});
