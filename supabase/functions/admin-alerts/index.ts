// Supabase Edge Function: admin-alerts
//
// Раз в 15 минут собирает снимок системы (токены, синхронизация, задачи, боты, база, доступы)
// и пишет владельцу в Telegram, если что-то требует внимания. Одно и то же не повторяет чаще раза в сутки.
// Функция ничего не принимает и не отдаёт секретов: её можно вызывать без ключа.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAlerts, shouldSend, type AlertSetting } from '../_shared/admin-alerts.ts';
import { moscowDay, sumUsage } from '../_shared/llm-usage.ts';
import { fetchWithTimeout, sendTelegramMessage } from '../_shared/notify-once.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';

const PLAN_BYTES = 8 * 1024 * 1024 * 1024; // 8 ГБ на тарифе Pro

async function botToken(admin: any, botId: string, tokenEnv: string | null): Promise<string> {
    try {
        const { data } = await admin.from('telegram_bot_secrets').select('token').eq('bot_id', botId).maybeSingle();
        const t = String(data?.token || '').trim();
        if (t) return t;
    } catch (_) { /* таблицы может не быть */ }
    const key = botId === 'notify' ? 'TELEGRAM_BOT_TOKEN' : tokenEnv;
    return key ? (Deno.env.get(key) ?? '').trim() : '';
}

Deno.serve(async () => {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const now = new Date();

    const { data: setRows } = await admin.from('admin_alert_settings').select('key, enabled, threshold, value');
    const settings: Record<string, AlertSetting> = {};
    for (const r of setRows || []) settings[r.key] = { enabled: !!r.enabled, threshold: r.threshold == null ? null : Number(r.threshold), value: r.value == null ? null : Number(r.value) };

    const { data: cabs } = await admin.from('cabinets').select('id, name, nr_managed, wb_token, adv_token_valid');
    const { data: jobsDone } = await admin.from('sync_jobs').select('cabinet_id, finished_at').eq('status', 'done').order('finished_at', { ascending: false }).limit(2000);
    const { data: jobsErr } = await admin.from('sync_jobs').select('cabinet_id, error, finished_at').eq('status', 'error').order('finished_at', { ascending: false }).limit(500);
    const lastDone = new Map<string, string>();
    for (const j of jobsDone || []) if (!lastDone.has(j.cabinet_id)) lastDone.set(j.cabinet_id, j.finished_at);
    const lastErr = new Map<string, { error: string; at: string }>();
    for (const j of jobsErr || []) if (!lastErr.has(j.cabinet_id)) lastErr.set(j.cabinet_id, { error: j.error, at: j.finished_at });
    const cabinets = (cabs || []).map((c: any) => {
        const done = lastDone.get(c.id) ?? null, er = lastErr.get(c.id);
        return {
            id: c.id, name: c.name, nr_managed: !!c.nr_managed, has_wb: String(c.wb_token || '').trim() !== '', adv_ok: c.adv_token_valid,
            last_sync: done, sync_error: er && (!done || new Date(er.at) > new Date(done)) ? er.error : null,
        };
    });

    const { data: nodes } = await admin.from('admin_map_nodes').select('title, status').eq('kind', 'cron').eq('hidden', false);
    const jobs = (nodes || []).map((n: any) => ({ title: n.title, status: n.status }));

    const bots: { id: string; title: string; status: string }[] = [];
    if (settings.bots?.enabled) {
        const { data: botRows } = await admin.from('telegram_bots').select('id, title, token_env, is_enabled, deleted_at');
        await Promise.all((botRows || []).filter((b: any) => b.is_enabled && !b.deleted_at).map(async (b: any) => {
            const tok = await botToken(admin, b.id, b.token_env);
            if (!tok) { bots.push({ id: b.id, title: b.title, status: 'no_token' }); return; }
            try {
                const r = await fetchWithTimeout(`https://api.telegram.org/bot${tok}/getMe`, {}, 8000);
                const j = await r.json().catch(() => ({}));
                bots.push({ id: b.id, title: b.title, status: j?.ok ? 'online' : 'offline' });
            } catch (_) { bots.push({ id: b.id, title: b.title, status: 'offline' }); }
        }));
    }

    const { data: bytes } = await admin.rpc('admin_db_bytes');
    const { data: st } = await admin.from('admin_alert_state').select('key, fingerprint, last_sent');
    const state = new Map<string, { fingerprint: string; last_sent: string | null }>((st || []).map((r: any) => [r.key, r]));

    // События доступа: только новые с прошлой проверки.
    const sinceAccess = state.get('access:cursor')?.last_sent || new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: acc } = await admin.from('admin_audit').select('id, action, target, detail').in('action', ['access_granted', 'access_revoked']).gt('at', sinceAccess).order('id');

    // Обмен «Раздач» с листом Google
    let sheets: { name: string; error: string | null; last_sync: string | null }[] = [];
    if (settings.giveaway_sync?.enabled) {
        const { data: gs } = await admin.from('giveaway_sheets').select('cabinet_id, enabled, last_sync_at, last_error').eq('enabled', true);
        const names = new Map((cabs || []).map((c: any) => [c.id, c.name]));
        sheets = (gs || []).map((x: any) => ({ name: String(names.get(x.cabinet_id) || x.cabinet_id), error: x.last_error, last_sync: x.last_sync_at }));
    }
    // Расход ChatGPT
    let llm: { costUsd: number; budgetUsd: number; lastError: string | null; lastErrorAt: string | null } | null = null;
    if (settings.llm?.enabled) {
        try {
            const day = moscowDay();
            const { data: rows } = await admin.from('llm_usage').select('*').gte('day', `${day.slice(0, 7)}-01`);
            const u = sumUsage((rows || []) as never, day);
            const { data: bs } = await admin.from('alina_settings').select('value').eq('key', 'llmBudgetUsd').maybeSingle();
            const budget = Number((bs as { value?: unknown } | null)?.value);
            llm = { costUsd: u.costUsd, budgetUsd: Number.isFinite(budget) ? budget : 0, lastError: u.lastError, lastErrorAt: u.lastErrorAt };
        } catch (_) { /* таблицы может не быть */ }
    }
    // Вебхук Алины
    let alinaHook: { pending: number; error: string | null; errorAt: string | null } | null = null;
    if (settings.alina_hook?.enabled) {
        const tok = await botToken(admin, 'alina', 'ALINA_BOT_TOKEN');
        if (tok) {
            try {
                const r = await fetchWithTimeout(`https://api.telegram.org/bot${tok}/getWebhookInfo`, {}, 8000);
                const w = (await r.json().catch(() => ({})))?.result || {};
                alinaHook = { pending: Number(w.pending_update_count) || 0, error: w.last_error_message || null, errorAt: w.last_error_date ? new Date(Number(w.last_error_date) * 1000).toISOString() : null };
            } catch (_) { /* Telegram не ответил: оповещение про ботов скажет */ }
        }
    }

    const alerts = buildAlerts({ now, settings, cabinets, jobs, bots, dbBytes: Number(bytes) || 0, planBytes: PLAN_BYTES, access: acc || [], sheets, llm, alinaHook });
    const token = getTelegramToken(), chat = (Deno.env.get('TELEGRAM_CHAT_ADMIN') ?? '').trim() || getTelegramChatId('team');
    const sent: string[] = [];
    const active = new Set(alerts.map((a) => a.key));

    for (const a of alerts) {
        const prev = state.get(a.key);
        if (!shouldSend(prev?.fingerprint ?? '', prev?.last_sent ?? null, a.fingerprint, now)) continue;
        if (token && chat && await sendTelegramMessage(token, chat, 'NR SPACE · СИГНАЛ\n' + a.text)) {
            sent.push(a.key);
            await admin.from('admin_alert_state').upsert({ key: a.key, fingerprint: a.fingerprint, last_sent: now.toISOString() });
        }
    }
    // Проблема ушла: очищаем состояние, чтобы при повторе сообщить снова.
    for (const [key, v] of state) {
        if (key === 'access:cursor' || active.has(key) || !v.fingerprint) continue;
        await admin.from('admin_alert_state').upsert({ key, fingerprint: '', last_sent: v.last_sent });
    }
    await admin.from('admin_alert_state').upsert({ key: 'access:cursor', fingerprint: '', last_sent: now.toISOString() });

    return new Response(JSON.stringify({ ok: true, active: [...active], sent }), { headers: { 'Content-Type': 'application/json' } });
});
