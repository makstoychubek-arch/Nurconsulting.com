import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  cheapNamePingFact,
  isShortSocialAck,
  planSocialAck,
  shortSocialAckReply,
  wantsShorterStyle,
} from './agent-social.ts';

Deno.test('short social ack', () => {
  assert(isShortSocialAck('спасибо'));
  assert(isShortSocialAck('ок'));
  assert(isShortSocialAck('поняла'));
  assert(!isShortSocialAck('спасибо глянь продажи база'));
});

Deno.test('short ack reply non-empty', () => {
  assert(shortSocialAckReply('saule').length >= 2);
});

Deno.test('planSocialAck has text and delay', () => {
  const p = planSocialAck('karina', 'спасибо');
  assert(p.text.length >= 2);
  assert(p.delayMs >= 100);
  assert(p.reactionEmoji);
});

Deno.test('cheapNamePingFact optional', () => {
  // may be undefined — just must not throw
  const v = cheapNamePingFact('saule');
  if (v != null) assert(v.length > 3);
});

Deno.test('wantsShorterStyle', () => {
  assert(wantsShorterStyle('короче по базе'));
  assertEquals(wantsShorterStyle('остаток лапша'), false);
});
