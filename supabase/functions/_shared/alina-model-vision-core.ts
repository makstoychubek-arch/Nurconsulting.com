// Разбор ответа распознавания модели (без внешних зависимостей, чтобы проверять в тестах).
/** Из JSON {"model": n, "confidence": c} получаем название модели, только если уверенность не ниже 0,75. */
export function parseModelAnswer(raw: string, names: string[]): string | null {
  try {
    const j = JSON.parse(raw) as { model?: unknown; confidence?: unknown };
    const n = Number(j.model), c = Number(j.confidence);
    if (!Number.isInteger(n) || n < 1 || n > names.length || !(c >= 0.75)) return null;
    return names[n - 1] ?? null;
  } catch { return null; }
}
