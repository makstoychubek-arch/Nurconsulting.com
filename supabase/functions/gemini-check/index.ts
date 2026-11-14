// gemini-check: проверка запасной модели. Только для сервисного вызова. Возвращает ok и ответ модели, ключ не отдаёт.
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { geminiChat, geminiConfigured } from '../_shared/gemini-fallback.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (!await isServiceAuthorized(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) return json({ error: 'Unauthorized' }, 401);
    if (!geminiConfigured()) return json({ ok: false, error: 'GEMINI_API_KEY не задан' });
    const r = await geminiChat([{ role: 'user', content: 'Ответь одним словом: работает?' }], { temperature: 0, maxTokens: 20, timeoutMs: 20000 });
    return json({ ok: r.ok, model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-lite-latest', answer: r.text, error: r.error });
});
