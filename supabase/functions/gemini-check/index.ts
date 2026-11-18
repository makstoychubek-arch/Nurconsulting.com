// gemini-check: проверка запасной модели. Доступна сервисному вызову и сотрудникам NR (вошедшим на сайт). Ключ не отдаёт.
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { geminiChat, geminiConfigured } from '../_shared/gemini-fallback.ts';
import { adminClient, CORS, isStaffUser, userFromRequest } from '../_shared/akylai-server.ts';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    let allowed = await isServiceAuthorized(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    if (!allowed) {
        const user = await userFromRequest(req);
        allowed = !!user && await isStaffUser(adminClient(), user);
    }
    if (!allowed) return json({ error: 'Unauthorized' }, 401);
    if (!geminiConfigured()) return json({ ok: false, error: 'GEMINI_API_KEY не задан' });
    const r = await geminiChat([{ role: 'user', content: 'Ответь одним словом: работает?' }], { temperature: 0, maxTokens: 20, timeoutMs: 20000 });
    return json({ ok: r.ok, model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-lite-latest', answer: r.text, error: r.error });
});
