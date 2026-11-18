/**
 * Расход ChatGPT: учёт по ответам OpenAI и защита бюджета. Суммы в долларах оценочные (по цене модели за миллион токенов).
 * Бюджет задаётся в настройках Алины (llmBudgetUsd, 0 = без ограничения); при превышении Алина не обращается к ChatGPT
 * и отвечает по шаблонам. Всё best-effort: сбой учёта не мешает ответу клиенту.
 */
import { getAdminClient } from './alina-db.ts';
import { loadAlinaSettings } from './alina-settings.ts';

/** Оценка цены, доллары за миллион токенов: [вход, выход]. Неизвестная модель считается как gpt-4o. */
export const MODEL_PRICE: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2, 8],
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const key = Object.keys(MODEL_PRICE).sort((a, b) => b.length - a.length).find((k) => model.startsWith(k));
  const [pin, pout] = MODEL_PRICE[key || 'gpt-4o'];
  return (promptTokens * pin + completionTokens * pout) / 1_000_000;
}

/** Код ошибки OpenAI из тела ответа: insufficient_quota, invalid_api_key, rate_limit_exceeded или http_<код>. */
export function openAiErrorCode(status: number, raw: string): string {
  try {
    const e = JSON.parse(raw)?.error;
    const code = String(e?.code || e?.type || '');
    if (code) return code.slice(0, 60);
  } catch { /* не JSON */ }
  return `http_${status}`;
}

export async function recordLlmUsage(
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  error: string | null = null,
): Promise<void> {
  try {
    await getAdminClient().rpc('llm_usage_add', {
      p_model: model.slice(0, 60), p_prompt: Math.round(usage?.prompt_tokens ?? 0), p_completion: Math.round(usage?.completion_tokens ?? 0), p_error: error,
    });
  } catch { /* учёт не обязателен */ }
}

export type MonthUsage = { costUsd: number; calls: number; errors: number; todayUsd: number; lastError: string | null; lastErrorAt: string | null };

/** Расход текущего месяца (по Москве) по строкам llm_usage. Чистая функция для проверки. */
export function sumUsage(rows: Array<{ day: string; model: string; calls: number; prompt_tokens: number; completion_tokens: number; errors: number; last_error: string | null; last_error_at: string | null }>, today: string): MonthUsage {
  const out: MonthUsage = { costUsd: 0, calls: 0, errors: 0, todayUsd: 0, lastError: null, lastErrorAt: null };
  for (const r of rows) {
    const c = estimateCostUsd(r.model, Number(r.prompt_tokens), Number(r.completion_tokens));
    out.costUsd += c; out.calls += Number(r.calls); out.errors += Number(r.errors);
    if (r.day === today) out.todayUsd += c;
    if (r.last_error_at && (!out.lastErrorAt || r.last_error_at > out.lastErrorAt)) { out.lastError = r.last_error; out.lastErrorAt = r.last_error_at; }
  }
  return out;
}

export function moscowDay(now = Date.now()): string {
  const d = new Date(now + 3 * 3600_000);
  return d.toISOString().slice(0, 10);
}

let budgetCache: { at: number; ok: boolean } | null = null;

/** Можно ли обращаться к ChatGPT: бюджет не задан или ещё не израсходован. Кэш 60 секунд; при сбое учёта разрешаем. */
export async function llmBudgetOk(now = Date.now()): Promise<boolean> {
  if (budgetCache && now - budgetCache.at < 60_000) return budgetCache.ok;
  let ok = true;
  try {
    const budget = (await loadAlinaSettings(now)).llmBudgetUsd;
    if (budget > 0) {
      const day = moscowDay(now);
      const { data } = await getAdminClient().from('llm_usage').select('*').gte('day', `${day.slice(0, 7)}-01`);
      ok = sumUsage((data || []) as never, day).costUsd < budget;
    }
  } catch { ok = true; }
  budgetCache = { at: now, ok };
  return ok;
}
