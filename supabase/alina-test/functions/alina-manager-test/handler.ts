// Тестовый вебхук Алины для передачи вопроса менеджеру. Живёт ВНЕ supabase/functions, чтобы CI
// не выложил его в рабочий проект. Только для отдельного тестового проекта Supabase и тестового бота.
// Все зависимости передаются снаружи, поэтому логику можно проверять без Deno и без сети.

export const PROD_REF = 'fiukyfyhotctvfdidktx';
const ALLOWED_UPDATES = ['message', 'business_message', 'business_connection'];

type Query = {
  insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string } | null }>;
};
export type Deps = {
  env: (name: string) => string | undefined;
  db: { from: (table: string) => Query };
  process: (token: string, update: Record<string, unknown>) => Promise<boolean>;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
};

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function telegram(deps: Deps, token: string, method: string, body?: object) {
  const response = await deps.fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return response ? await response.json().catch(() => null) : null;
}

export async function handleTestWebhook(req: Request, deps: Deps): Promise<Response> {
  if ((deps.env('SUPABASE_URL') || '').includes(PROD_REF)) return reply({ ok: false, error: 'refused_production_project' }, 503);
  const secret = (deps.env('ALINA_TEST_WEBHOOK_SECRET') || '').trim();
  const token = (deps.env('ALINA_BOT_TOKEN') || '').trim();
  if (secret.length < 24 || !token) return reply({ ok: false, error: 'not_configured' }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const telegramSecret = (req.headers.get('x-telegram-bot-api-secret-token') || '').trim();
  const adminKey = (req.headers.get('x-alina-test-key') || '').trim();

  if (action) {
    if (!same(adminKey, secret)) return reply({ ok: false, error: 'bad_key' }, 401);
    if (action === 'set-webhook') {
      const hook = `https://${url.host}${url.pathname}`;
      const result = await telegram(deps, token, 'setWebhook', {
        url: hook, secret_token: secret, allowed_updates: ALLOWED_UPDATES, drop_pending_updates: true,
      });
      return reply({ ok: result?.ok === true, webhook: hook, allowed_updates: ALLOWED_UPDATES });
    }
    if (action === 'info') {
      const [me, info] = await Promise.all([telegram(deps, token, 'getMe'), telegram(deps, token, 'getWebhookInfo')]);
      const w = info?.result || {};
      return reply({
        ok: true,
        bot: me?.result?.username ?? null,
        webhook_path: String(w.url || '').split('/').slice(-1)[0] || null,
        pending: w.pending_update_count ?? null,
        last_error: w.last_error_message ?? null,
        allowed_updates: w.allowed_updates ?? null,
      });
    }
    return reply({ ok: false, error: 'unknown_action' }, 400);
  }

  if (req.method !== 'POST') return reply({ ok: false, error: 'method' }, 405);
  if (!same(telegramSecret, secret)) return reply({ ok: false, error: 'bad_secret' }, 401);

  const update = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!update || typeof update.update_id !== 'number') return reply({ ok: true, ignored: 'no_update' });

  // Telegram повторяет доставку, если ответ не 200: один update_id обрабатываем один раз.
  const { error } = await deps.db.from('alina_test_updates').insert({ update_id: update.update_id });
  if (error?.code === '23505') return reply({ ok: true, duplicate: true });
  if (error) return reply({ ok: false, error: 'storage_unavailable' }, 503);

  try {
    return reply({ ok: true, handled: await deps.process(token, update) });
  } catch {
    // Всегда 200 после взятия update_id: повтор доставки дал бы второе сообщение в группу.
    console.error('[alina-test] update failed after being claimed');
    return reply({ ok: true, handled: false, error: 'processing_failed' });
  }
}
