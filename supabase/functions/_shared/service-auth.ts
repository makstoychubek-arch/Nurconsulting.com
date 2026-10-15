/** Авторизация cron и ручных вызовов edge functions.
 *  pg_cron часто шлёт старый JWT service_role, а Deno.env уже новый ключ —
 *  байт-в-байт сверка тогда даёт 401 и канал молчит. Принимаем оба ключа из окружения,
 *  а JWT формата service_role принимаем только после проверки подписи самой платформой:
 *  без неё подделать токен (header.{"role":"service_role","ref":"…"}.мусор) мог кто угодно. */

const PROJECT_REF = 'fiukyfyhotctvfdidktx';

const OK_TTL_MS = 10 * 60_000;
const FAIL_TTL_MS = 60_000;
const verdicts = new Map<string, { ok: boolean; until: number }>();

export async function isServiceAuthorized(req: Request, serviceKey: string): Promise<boolean> {
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return false;
    if (serviceKey && bearer === serviceKey) return true;
    const alt = (Deno.env.get('SERVICE_ROLE_KEY') ?? '').trim();
    if (alt && bearer === alt) return true;
    if (!looksLikeServiceRoleJwt(bearer)) return false;
    return await signatureAccepted(bearer);
}

/** Только предфильтр по заявленным полям: подпись он НЕ проверяет и сам по себе доступ не даёт. */
export function looksLikeServiceRoleJwt(token: string): boolean {
    if (!token.startsWith('eyJ')) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload?.role === 'service_role' && payload?.ref === PROJECT_REF;
    } catch {
        return false;
    }
}

async function sha256Hex(s: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Подпись проверяет GoTrue: админский эндпоинт отвечает 200 только на настоящий service_role JWT. */
async function signatureAccepted(token: string): Promise<boolean> {
    const key = await sha256Hex(token);
    const now = Date.now();
    const hit = verdicts.get(key);
    if (hit && hit.until > now) return hit.ok;
    const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
    if (!base) return false;
    try {
        const res = await fetch(`${base}/auth/v1/admin/users?per_page=1`, {
            headers: { apikey: token, Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000),
        });
        const ok = res.status === 200;
        await res.body?.cancel();
        if (verdicts.size > 200) verdicts.clear();
        verdicts.set(key, { ok, until: now + (ok ? OK_TTL_MS : FAIL_TTL_MS) });
        return ok;
    } catch {
        return false; // сеть недоступна — не пускаем и не запоминаем отказ
    }
}
