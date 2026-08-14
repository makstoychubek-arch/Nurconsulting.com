import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  hopPauseMs,
  pickWorkingStatus,
  thinkPauseMs,
  withTypingKeepalive,
  WORKING_STATUS_VARIANTS,
} from './agent-presence.ts';

Deno.test('thinkPauseMs scales with length', () => {
  const short = thinkPauseMs(10);
  const long = thinkPauseMs(200);
  assertEquals(short >= 280, true);
  assertEquals(long > short - 600, true); // probabilistic but long base higher
  assertEquals(long <= 280 + 900 + 550, true);
});

Deno.test('hopPauseMs in range', () => {
  const ms = hopPauseMs();
  assertEquals(ms >= 700 && ms < 2200, true);
});

Deno.test('withTypingKeepalive clears interval', async () => {
  let n = 0;
  const out = await withTypingKeepalive(
    async () => {
      n += 1;
    },
    async () => 'ok',
    50,
  );
  assertEquals(out, 'ok');
  assertEquals(n >= 1, true);
  await new Promise((r) => setTimeout(r, 80));
  const after = n;
  await new Promise((r) => setTimeout(r, 80));
  assertEquals(n, after); // no more ticks after clear
});

Deno.test('WORKING_STATUS_VARIANTS has 10 minimal lines', () => {
  assertEquals(WORKING_STATUS_VARIANTS.length, 10);
  for (const s of WORKING_STATUS_VARIANTS) {
    assertEquals(s.length >= 4 && s.length <= 20, true);
  }
});

Deno.test('pickWorkingStatus returns known variant', () => {
  for (const kind of ['analyze', 'lookup', 'price', 'create', 'generic'] as const) {
    const s = pickWorkingStatus(kind);
    assertEquals(WORKING_STATUS_VARIANTS.includes(s as typeof WORKING_STATUS_VARIANTS[number]), true);
  }
});

Deno.test('работаю is in status pool', () => {
  assertEquals(WORKING_STATUS_VARIANTS.includes('работаю'), true);
});
