// Короткие «реакции» вместо слов «приняла/принято» (владелец, 25 ноября 2026). Реакции на сообщения Telegram в бизнес-чатах бот ставить не может,
// поэтому вместо реакции уходит одно сообщение из эмодзи. Разные, чтобы не повторялись подряд.
export const ACK_EMOJIS = ['❤️', '🙏', '👌', '🤝', '😊', '👍', '✨', '🤗'];

/** Случайная реакция, не равная тем, что уже были в последних сообщениях. */
export function pickAckEmoji(avoid: string[] = []): string {
  const bad = new Set(avoid.map((x) => x.trim()));
  const pool = ACK_EMOJIS.filter((e) => !bad.has(e));
  const list = pool.length ? pool : ACK_EMOJIS;
  return list[Math.floor(Math.random() * list.length)];
}
