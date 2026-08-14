import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  isShortSocialAck,
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

Deno.test('wantsShorterStyle', () => {
  assert(wantsShorterStyle('короче по базе'));
  assertEquals(wantsShorterStyle('остаток лапша'), false);
});
