// Диагностика (только чтение): состояние webhook бота Алины в Telegram. Токен берётся на сервере и наружу не отдаётся; адрес без параметров.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const botId = String(body.bot_id || 'alina');
    const { data } = await admin.from('telegram_bot_secrets').select('token').eq('bot_id', botId).maybeSingle();
    const token = String((data as { token?: string } | null)?.token || '').trim();
    if (!token) return json({ ok: false, error: 'нет токена бота ' + botId });
    const r = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({})) as { ok?: boolean; result?: Record<string, unknown> };
    const w = j.result || {};
    const url = String(w.url || '').split('?')[0];
    return json({ ok: !!j.ok, url, pending_update_count: w.pending_update_count, last_error_date: w.last_error_date ? new Date(Number(w.last_error_date) * 1000).toISOString() : null, last_error_message: w.last_error_message || null, allowed_updates: w.allowed_updates || null, max_connections: w.max_connections || null, ip_address: w.ip_address || null });
});
