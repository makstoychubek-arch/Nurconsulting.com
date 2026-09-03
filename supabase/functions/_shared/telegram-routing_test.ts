import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveIncomingChatChannel, getTelegramChatId } from './telegram-routing.ts';

function withEnv(vars: Record<string, string>, fn: () => void) {
  const prev = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    prev.set(k, Deno.env.get(k));
    Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, v] of prev) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

Deno.test('resolveIncomingChatChannel: dedicated penalties id wins', () => {
  withEnv(
    {
      TELEGRAM_GROUP_CHAT_ID: '-100shared',
      TELEGRAM_CHAT_PENALTIES: '-100penalties',
      TELEGRAM_CHAT_TRIGGERS: '-100triggers',
      TELEGRAM_CHAT_FBS: '-100fbs',
    },
    () => {
      assertEquals(resolveIncomingChatChannel('-100penalties'), 'penalties');
      assertEquals(resolveIncomingChatChannel('-100triggers'), 'triggers');
      assertEquals(resolveIncomingChatChannel('-100fbs'), 'fbs');
    },
  );
});

Deno.test('resolveIncomingChatChannel: shared fallback does NOT collapse channels', () => {
  withEnv(
    {
      TELEGRAM_GROUP_CHAT_ID: '-100shared',
      TELEGRAM_CHAT_PENALTIES: '',
      TELEGRAM_CHAT_TRIGGERS: '',
      TELEGRAM_CHAT_SALES: '',
      TELEGRAM_CHAT_ADS: '',
      TELEGRAM_CHAT_AB_TESTS: '',
      TELEGRAM_CHAT_NEWS: '',
      TELEGRAM_CHAT_REVIEWS: '',
      TELEGRAM_CHAT_BLOCKINGS: '',
      TELEGRAM_CHAT_WAREHOUSE: '',
      TELEGRAM_CHAT_FBS: '',
      TELEGRAM_CHANNEL_ID: '',
    },
    () => {
      // Штрафы — отдельная группа, даже без secret.
      assertEquals(getTelegramChatId('penalties'), '-1003907884000');
      assertEquals(getTelegramChatId('triggers'), '-100shared');
      // …but inbound must NOT map shared id to last channel (triggers/fbs).
      assertEquals(resolveIncomingChatChannel('-100shared'), null);
      assertEquals(resolveIncomingChatChannel('-1003907884000'), 'penalties');
    },
  );
});

Deno.test('getTelegramChatId: env TELEGRAM_CHAT_PENALTIES overrides hardcoded group', () => {
  withEnv({ TELEGRAM_CHAT_PENALTIES: '-100custom-penalties' }, () => {
    assertEquals(getTelegramChatId('penalties'), '-100custom-penalties');
    assertEquals(resolveIncomingChatChannel('-100custom-penalties'), 'penalties');
  });
});

Deno.test('resolveIncomingChatChannel: legacy ab_tests id', () => {
  withEnv(
    {
      TELEGRAM_CHAT_AB_TESTS: '',
      TELEGRAM_CHANNEL_ID: '-100legacy-ab',
      TELEGRAM_GROUP_CHAT_ID: '-100shared',
    },
    () => {
      assertEquals(resolveIncomingChatChannel('-100legacy-ab'), 'ab_tests');
    },
  );
});

Deno.test('resolveIncomingChatChannel: unknown chat → null', () => {
  withEnv({ TELEGRAM_CHAT_PENALTIES: '-100penalties' }, () => {
    assertEquals(resolveIncomingChatChannel('-999'), null);
    assertEquals(resolveIncomingChatChannel(''), null);
  });
});
