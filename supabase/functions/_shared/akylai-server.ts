// Серверная обвязка Акылай: окружение, авторизация, Telegram, журнал,
// вызовы WB и OpenAI. Все секреты — только из переменных окружения:
//   AKYLAI_BOT_TOKEN      — токен бота Акылай;
//   AKYLAI_BOT_USERNAME   — имя бота без @ (для ссылки t.me/<бот>);
//   AKYLAI_NR_CHAT_ID     — служебный чат NR для уведомлений;
//   AKYLAI_ENC_KEY        — 32 байта base64 для шифрования токенов WB;
//   AKYLAI_WEBHOOK_SECRET — секрет вебхука бота;
//   OPENAI_API_KEY, OPENAI_MODEL.
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasAllCabinetsAccess } from './cabinet-access.ts';
import { decryptSecret, importSecretKey } from './secret-box.ts';

export const FEEDBACKS_API = 'https://feedbacks-api.wildberries.ru';
export const COMMON_API = 'https://common-api.wildberries.ru';

export const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export function env(name: string): string {
    return (Deno.env.get(name) ?? '').trim();
}

export function adminClient() {
    return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
}

/** Пользователь из JWT запроса или null. */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string } | null> {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return null;
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: auth } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;
    return { id: data.user.id, email: String(data.user.email || '').toLowerCase() };
}

export async function isStaffUser(admin: any, user: { id: string; email: string }): Promise<boolean> {
    return await hasAllCabinetsAccess(admin, user);
}

/** Кабинет Акылай этого пользователя (первый, где есть секрет токена). */
export async function ownAkylaiCabinet(admin: any, userId: string) {
    const { data } = await admin
        .from('cabinets')
        .select('id, name, user_id, wb_sid, cabinet_secrets!inner(cabinet_id, token_exp)')
        .eq('user_id', userId)
        .limit(1);
    return Array.isArray(data) && data.length ? data[0] : null;
}

export async function agentLog(admin: any, cabinetId: string | null, event: string, detail: Record<string, unknown> = {}) {
    try {
        await admin.from('agent_logs').insert({ agent: 'akylai', cabinet_id: cabinetId, event, detail });
    } catch (e) {
        console.error('[akylai] agent_logs insert failed:', (e as Error)?.message || e);
    }
}

// ── Telegram ─────────────────────────────────────────────────

export async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
    const token = env('AKYLAI_BOT_TOKEN');
    if (!token) return { ok: false, status: 0, data: null };
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(12000),
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok && data?.ok === true, status: res.status, data };
    } catch {
        return { ok: false, status: 0, data: null };
    }
}

/** 403 от Telegram на отправку в личку = клиент заблокировал бота. */
export function tgBlocked(r: { status: number; data: any }): boolean {
    return r.status === 403 || /blocked|deactivated|chat not found/i.test(String(r.data?.description || ''));
}

/** Сообщение в служебный чат NR. Без HTML, чтобы имя магазина не ломало разметку. */
export async function notifyNr(text: string): Promise<void> {
    const chat = env('AKYLAI_NR_CHAT_ID');
    if (!chat) return;
    await tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true });
}

// ── Токен WB ─────────────────────────────────────────────────

export async function cabinetWbToken(admin: any, cabinetId: string): Promise<string> {
    const { data } = await admin.from('cabinet_secrets').select('wb_token_enc').eq('cabinet_id', cabinetId).maybeSingle();
    if (!data?.wb_token_enc) return '';
    const key = await importSecretKey(env('AKYLAI_ENC_KEY'));
    return await decryptSecret(data.wb_token_enc, key);
}

export async function wbFetch(url: string, token: string, method = 'GET', body?: unknown) {
    try {
        const res = await fetch(url, {
            method,
            headers: {
                Authorization: token,
                Accept: 'application/json',
                ...(body != null ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body != null ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(15000),
        });
        const text = await res.text().catch(() => '');
        let data: any = null;
        if (text) { try { data = JSON.parse(text); } catch { data = null; } }
        return { ok: res.ok, status: res.status, data, text: text.slice(0, 300) };
    } catch (e) {
        return { ok: false, status: 0, data: null, text: String((e as Error)?.message || e).slice(0, 300) };
    }
}

// ── OpenAI ───────────────────────────────────────────────────

export async function openaiChat(messages: Array<{ role: string; content: string }>) {
    const key = env('OPENAI_API_KEY');
    if (!key) return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: 'no_key' };
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: env('OPENAI_MODEL') || 'gpt-4o-mini',
                messages,
                temperature: 0.6,
                max_tokens: 400,
            }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: `openai_${res.status}` };
        return {
            ok: true,
            text: String(data?.choices?.[0]?.message?.content || '').trim(),
            promptTokens: Number(data?.usage?.prompt_tokens) || 0,
            completionTokens: Number(data?.usage?.completion_tokens) || 0,
            error: '',
        };
    } catch (e) {
        return { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: String((e as Error)?.message || e).slice(0, 120) };
    }
}

export async function addUsage(admin: any, cabinetId: string, promptTokens: number, completionTokens: number) {
    if (!promptTokens && !completionTokens) return;
    const { error } = await admin.rpc('akylai_add_usage', {
        p_cabinet_id: cabinetId,
        p_prompt: promptTokens,
        p_completion: completionTokens,
    });
    if (error) console.error('[akylai] usage:', error.message);
}

/** Фоновая задача, не держащая ответ клиенту. */
export function background(p: Promise<unknown>) {
    const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
    if (waitUntil) waitUntil(p.catch((e) => console.error('[akylai] bg:', e)));
    else p.catch((e) => console.error('[akylai] bg:', e));
}

/** Запуск обработки отзывов кабинета сразу, не дожидаясь cron. */
export async function kickReviews(cabinetId: string): Promise<void> {
    await fetch(`${env('SUPABASE_URL')}/functions/v1/akylai-reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabinet_id: cabinetId }),
        signal: AbortSignal.timeout(20000),
    }).catch(() => null);
}
