/**
 * «Присутствие» в чате как у людей: typing keepalive + reactions.
 * Паттерны: telebot typing refresh, hermes debounce feel, human reply latency.
 */

import { pick } from './agent-voice.ts';

/** Держит «печатает…» пока идёт долгая работа (LLM / сеть). */
export async function withTypingKeepalive<T>(
  sendTyping: () => Promise<void>,
  work: () => Promise<T>,
  intervalMs = 3800,
): Promise<T> {
  await sendTyping();
  const id = setInterval(() => {
    void sendTyping();
  }, Math.max(2500, intervalMs));
  try {
    return await work();
  } finally {
    clearInterval(id);
  }
}

/** Пауза «думает» перед первым ответом — чуть длиннее на длинном вопросе. */
export function thinkPauseMs(textLen: number): number {
  const base = 280 + Math.min(900, Math.floor(textLen * 7));
  return base + Math.floor(Math.random() * 550);
}

/** Пауза перед hop — как люди не барабанят очередь. */
export function hopPauseMs(): number {
  return 700 + Math.floor(Math.random() * 1400);
}

/**
 * Минималистичные статусы «загрузка» в чате (одно короткое слово/фраза).
 * Ровно 10 вариантов — крутим случайно.
 */
export const WORKING_STATUS_VARIANTS = [
  'щас выясню',
  'делаю',
  'анализирую',
  'гляну',
  'секунду',
  'копаю',
  'считаю',
  'сверяю',
  'работаю',
  'в работе',
] as const;

export type WorkingStatusKind = 'analyze' | 'lookup' | 'price' | 'create' | 'generic';

/** Короткий статус под тип работы (все из одного пула из 10). */
export function pickWorkingStatus(kind: WorkingStatusKind = 'generic'): string {
  // лёгкий bias по kind, но только из тех же 10 фраз
  const prefer: Record<WorkingStatusKind, readonly string[]> = {
    analyze: ['анализирую', 'копаю', 'сверяю', 'считаю', 'щас выясню'],
    lookup: ['гляну', 'щас выясню', 'секунду', 'делаю', 'работаю'],
    price: ['считаю', 'сверяю', 'гляну', 'щас выясню', 'делаю'],
    create: ['работаю', 'делаю', 'секунду', 'в работе', 'гляну'],
    generic: WORKING_STATUS_VARIANTS,
  };
  const pool = prefer[kind] || WORKING_STATUS_VARIANTS;
  return pick([...pool]);
}

/**
 * Telegram setMessageReaction — живая реакция на сообщение владельца
 * без отдельного текстового спама.
 */
export async function setTelegramMessageReaction(opts: {
  token: string;
  chatId: number;
  messageId: number;
  emoji: string;
}): Promise<boolean> {
  const { token, chatId, messageId, emoji } = opts;
  if (!token || !chatId || !messageId || !emoji) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setMessageReaction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji }],
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.error(
        '[agent-presence] setMessageReaction',
        await res.text().catch(() => ''),
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error('[agent-presence] setMessageReaction', e);
    return false;
  }
}
