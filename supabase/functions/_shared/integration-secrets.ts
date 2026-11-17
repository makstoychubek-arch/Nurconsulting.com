/**
 * Ключи интеграций: сначала таблица integration_secrets (их задают с сайта), если там пусто, переменная окружения.
 * Кэш 60 секунд. Значения не логируются и никуда не возвращаются, кроме вызывающего кода.
 */
import { getAdminClient } from './alina-db.ts';

/** Имя переменной окружения → ключ в таблице. */
export const SECRET_KEYS: Record<string, string> = {
  OPENAI_API_KEY: 'openai_api_key',
  GOOGLE_SERVICE_ACCOUNT_JSON: 'google_service_account',
};

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: string }>();

export async function secretOrEnv(envName: string, now = Date.now()): Promise<string> {
  const key = SECRET_KEYS[envName];
  if (key) {
    const hit = cache.get(key);
    if (hit && now - hit.at < TTL_MS) {
      if (hit.value) return hit.value;
    } else {
      try {
        const { data } = await getAdminClient().from('integration_secrets').select('value').eq('key', key).maybeSingle();
        const value = String((data as { value?: string } | null)?.value ?? '').trim();
        cache.set(key, { at: now, value });
        if (value) return value;
      } catch {
        // таблицы нет или база недоступна: используем окружение
        cache.set(key, { at: now, value: '' });
      }
    }
  }
  return (Deno.env.get(envName) ?? '').trim();
}

/** Сбросить кэш (после смены ключа в той же функции). */
export function forgetSecret(envName: string) {
  const key = SECRET_KEYS[envName];
  if (key) cache.delete(key);
}
