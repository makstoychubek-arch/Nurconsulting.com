// Supabase Edge Function: client-error
//
// Принимает сообщения об ошибках из браузера (nr-monitor.js). Без входа: ошибки случаются и до входа.
// Защита от мусора: ограничения длины, одинаковые ошибки копятся в один счётчик, общий потолок записей в час.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const HOURLY_CAP = 300;

const cut = (v: unknown, n: number) => String(v ?? '').slice(0, n);

async function fingerprint(parts: string[]): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')));
    return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return new Response('method', { status: 405, headers: CORS });

    let body: any = null;
    try { body = JSON.parse(await req.text()); } catch { /* не json */ }
    const message = cut(body?.message, 400);
    if (!message) return new Response('bad', { status: 400, headers: CORS });

    const page = cut(body?.page, 200).split('?')[0];
    const source = cut(body?.source, 200);
    const line = Number(body?.line) || null;
    const col = Number(body?.col) || null;
    const fp = await fingerprint([page, message, source, String(line)]);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: existing } = await admin.from('client_errors').select('id, count').eq('fingerprint', fp).maybeSingle();
    if (existing) {
        await admin.from('client_errors').update({ count: Number(existing.count) + 1, last_seen: new Date().toISOString() }).eq('id', existing.id);
        return new Response('ok', { headers: CORS });
    }
    const { count } = await admin.from('client_errors').select('id', { count: 'exact', head: true })
        .gte('first_seen', new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= HOURLY_CAP) return new Response('busy', { status: 429, headers: CORS });

    await admin.from('client_errors').insert({
        fingerprint: fp, page, message, source, line, col,
        stack: cut(body?.stack, 2000), user_agent: cut(req.headers.get('user-agent'), 200),
        user_id: /^[0-9a-f-]{36}$/i.test(String(body?.user_id || '')) ? body.user_id : null,
    });
    return new Response('ok', { headers: CORS });
});
