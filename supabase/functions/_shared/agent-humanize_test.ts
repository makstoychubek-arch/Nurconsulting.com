import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  humanizeAgentReply,
  isStructuredAgentReport,
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

Deno.test('humanize strips AI essay tells', () => {
  const out = humanizeAgentReply(
    'Давайте разберём.\nПо базе 12\nНадеюсь, это поможет!\nЕсли будут вопросы — пишите',
    { valence: false },
  );
  assert(!/давайте разбер/i.test(out));
  assert(!/надеюсь/i.test(out));
  assert(!/если будут вопросы/i.test(out));
  assert(/базе|12/i.test(out));
});

Deno.test('humanize strips markdown', () => {
  const out = humanizeAgentReply('**База**\n1. заказы 12\n- выкуп ок', {
    valence: false,
  });
  assert(!/\*\*/.test(out));
  assert(!/^1\./m.test(out));
  assert(/база/i.test(out));
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

Deno.test('humanize keeps competitor top-3 report', () => {
  const raw = [
    'Сауле · сводка по конкурентам',
    'Наш: BAZ.A · Нарядная блузка фонарь',
    'арт. 1240248213 · 1 600 ₽ (до 5 000 ₽)',
    'карточка: https://www.wildberries.ru/catalog/1240248213/detail.aspx',
    'источник: выдача WB · «нарядная блузка фонарь»',
    '',
    'Топ-3 по выдаче:',
    '1) Rival · Блузка офисная',
    '   арт. 165629769 · 978 ₽',
    '2) Other · Блузка',
    '   арт. 211634909 · 495 ₽',
    '3) Brand · Блузка',
    '   арт. 345045044 · 1 500 ₽',
    '',
    'Рекомендация: ОПУСТИТЬ → ориентир 980 ₽',
  ].join('\n');
  assert(isStructuredAgentReport(raw));
  const out = humanizeAgentReply(raw, { valence: false });
  assert(out.includes('Топ-3 по выдаче'));
  assert(out.includes('165629769'));
  assert(out.includes('Рекомендация'));
  assert(/^\d+\)/m.test(out));
});
