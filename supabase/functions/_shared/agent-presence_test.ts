import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  hopPauseMs,
  thinkPauseMs,
  withTypingKeepalive,
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
