import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  bubbleTypeDelayMs,
  interBubbleDelayMs,
  splitHumanBubbles,
} from './agent-bubbles.ts';

Deno.test('splitHumanBubbles keeps short single', () => {
  assertEquals(splitHumanBubbles('по базе 12'), ['по базе 12']);
});

Deno.test('splitHumanBubbles splits blank lines', () => {
  const parts = splitHumanBubbles('ща\n\nпо базе 12 заказов\n\nи выкуп норм');
  assert(parts.length >= 2);
  assert(parts.length <= 3);
  assert(parts[0].includes('ща') || parts[0].length > 0);
});

Deno.test('bubble delays in range', () => {
  const d = bubbleTypeDelayMs(40);
  assert(d >= 320 && d <= 4000);
  const g = interBubbleDelayMs();
  assert(g >= 480 && g < 2200);
});

Deno.test('splitHumanBubbles keeps competitor report whole', () => {
  const report = [
    'Сауле · сводка по конкурентам',
    'Наш: BAZ.A · Блузка',
    'арт. 1240248213 · 1600 ₽',
    'источник: выдача WB · «блузка»',
    '',
    'Топ-3 по выдаче:',
    '1) A · x',
    '2) B · y',
    '3) C · z',
    '',
    'Рекомендация: ДЕРЖАТЬ',
  ].join('\n');
  const parts = splitHumanBubbles(report);
  assertEquals(parts.length, 1);
  assert(parts[0].includes('Топ-3 по выдаче'));
  assert(parts[0].includes('Рекомендация'));
});
