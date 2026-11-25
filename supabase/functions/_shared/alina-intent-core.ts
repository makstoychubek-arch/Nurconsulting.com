// Чистые функции разбора ответов клиента (без внешних зависимостей, чтобы проверять в тестах).
export type AnswerKind = 'yes' | 'no' | 'other';

/** Подходит ли сообщение для проверки: короткое, без ссылок, без цифр-реквизитов. */
export function worthClassifying(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 60 && !/https?:\/\/|@\w{4,}|\d{6,}/i.test(t);
}

/** Разбор ответа модели в «yes/no/other»; всё непонятное считается «other» (тогда ничего не делаем). */
export function parseAnswerKind(raw: unknown): AnswerKind {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'yes' || v === 'no') return v;
  return 'other';
}

