// Supabase Edge Function: site-uptime
//
// Раз в 5 минут проверяет, что сайт и вход отвечают, и пишет в Telegram команды, если нет.
// Ничего секретного не делает и не принимает данных: можно вызывать без ключа.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { alertText, decide, type Check } from '../_shared/site-uptime.ts';
import { fetchWithTimeout, sendTelegramMessage } from '../_shared/notify-once.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';

const SITE = 'https://nurcon.kg';

async function probe(name: string, url: string, mustContain?: string, headers: Record<string, string> = {}): Promise<Check> {
    try {
        const res = await fetchWithTimeout(url, { headers, redirect: 'follow' }, 10000);
        if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}` };
        if (mustContain) {
            const text = await res.text();
            if (!text.includes(mustContain)) return { name, ok: false, detail: 'страница без ожидаемого содержимого' };
        }
        return { name, ok: true, detail: 'ok' };
    } catch (e) {
        return { name, ok: false, detail: String((e as Error)?.message || e).slice(0, 80) };
    }
}

Deno.serve(async () => {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const checks = await Promise.all([
        probe('Сайт', SITE + '/', 'NR Space'),
        probe('Вход', SITE + '/login', 'NR Space'),
        probe('Приложение', SITE + '/space', 'NR Space'),
        probe('Авторизация Supabase', `${url}/auth/v1/health`, undefined, { apikey: anon }),
    ]);

    const { data: row } = await admin.from('site_uptime').select('status, failures, since').eq('id', 1).maybeSingle();
    const prev = row ? { status: row.status, failures: Number(row.failures) || 0, since: row.since } : { status: 'up' as const, failures: 0, since: new Date().toISOString() };
    const verdict = decide(prev as any, checks, new Date());

    await admin.from('site_uptime').upsert({
        id: 1, status: verdict.next.status, failures: verdict.next.failures, since: verdict.next.since,
        last_checked: new Date().toISOString(), details: { checks },
        ...(verdict.alert ? { last_alert_at: new Date().toISOString() } : {}),
    });

    if (verdict.alert) {
        const token = getTelegramToken(), chat = getTelegramChatId('team');
        if (token && chat) await sendTelegramMessage(token, chat, alertText(verdict.alert, checks, verdict.next.since));
    }
    return new Response(JSON.stringify({ ok: checks.every((c) => c.ok), alert: verdict.alert, checks }), { headers: { 'Content-Type': 'application/json' } });
});
