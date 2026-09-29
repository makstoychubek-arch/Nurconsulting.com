// Supabase Edge Function: akylai-admin
// Сводка Акылай для админки: только суперадмин и команда (team_staff).
// По каждому кабинету: токен, Telegram, тумблер, последние ответы, расход токенов.
// Секреты (токен, chat_id) не отдаются — только их статус.
// deno-lint-ignore-file no-explicit-any

import { adminClient, agentLog, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const admin = adminClient();
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ ok: false }, 401);
        if (!(await isStaffUser(admin, user))) return json({ ok: false }, 403);

        const { data: settings } = await admin.from('akylai_settings')
            .select('cabinet_id, enabled, auto_publish, published_count, cabinets!inner(name, user_id)');
        const ids = (settings || []).map((s: any) => s.cabinet_id);
        if (!ids.length) return json({ ok: true, cabinets: [] });

        const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
        const [secrets, chats, replies, usage] = await Promise.all([
            admin.from('cabinet_secrets').select('cabinet_id, token_exp, token_broken').in('cabinet_id', ids),
            admin.from('akylai_chats').select('cabinet_id, blocked, connected_at').in('cabinet_id', ids),
            admin.from('akylai_replies')
                .select('cabinet_id, rating, product_name, reply_text, status, created_at')
                .in('cabinet_id', ids).order('created_at', { ascending: false }).limit(300),
            admin.from('ai_usage').select('cabinet_id, requests, prompt_tokens, completion_tokens')
                .in('cabinet_id', ids).gte('day', since),
        ]);
        const userIds = [...new Set((settings || []).map((s: any) => s.cabinets?.user_id).filter(Boolean))];
        const { data: spaces } = await admin.from('spaces').select('user_id, email, status').in('user_id', userIds);

        const by = (rows: any[] | null) => {
            const m = new Map<string, any[]>();
            for (const r of rows || []) m.set(r.cabinet_id, [...(m.get(r.cabinet_id) || []), r]);
            return m;
        };
        const sec = by(secrets.data), ch = by(chats.data), rep = by(replies.data), use = by(usage.data);
        const spaceOf = new Map((spaces || []).map((s: any) => [s.user_id, s]));

        const cabinets = (settings || []).map((s: any) => {
            const secret = sec.get(s.cabinet_id)?.[0];
            const chat = ch.get(s.cabinet_id)?.[0];
            const expired = secret && (secret.token_broken || (secret.token_exp && new Date(secret.token_exp).getTime() <= Date.now()));
            const u = (use.get(s.cabinet_id) || []).reduce((a: any, r: any) => ({
                requests: a.requests + Number(r.requests || 0),
                tokens: a.tokens + Number(r.prompt_tokens || 0) + Number(r.completion_tokens || 0),
            }), { requests: 0, tokens: 0 });
            const space = spaceOf.get(s.cabinets?.user_id);
            return {
                cabinet_id: s.cabinet_id,
                name: s.cabinets?.name || '',
                email: space?.email || '',
                space_status: space?.status || '',
                token: !secret ? 'missing' : expired ? 'expired' : 'ok',
                token_exp: secret?.token_exp || null,
                telegram: !chat ? 'none' : chat.blocked ? 'blocked' : 'connected',
                enabled: s.enabled === true,
                auto_publish: s.auto_publish === true,
                published_count: Number(s.published_count) || 0,
                usage_30d: u,
                last_replies: (rep.get(s.cabinet_id) || []).slice(0, 5),
            };
        });
        return json({ ok: true, cabinets });
    } catch (e) {
        console.error('[akylai-admin]', e);
        await agentLog(admin, null, 'admin_crashed', { error: String((e as Error)?.message || e).slice(0, 300) });
        return json({ ok: false }, 500);
    }
});
