// Supabase Edge Function: cabinet-features
//
// Блок «Агенты и функции» в настройках кабинета. Только над кабинетом, к которому у пользователя
// есть доступ (владелец, команда, супер-админ). Токены и chat_id наружу не отдаются.
//   { action: 'state', cabinet_id }                                 — тумблеры + диагностика по каждой функции;
//   { action: 'set', cabinet_id, feature, enabled }                 — включить/выключить до ручного изменения;
//   { action: 'pause', cabinet_id, feature, minutes }               — пауза на N минут, дальше сама включится;
//   { action: 'resume', cabinet_id, feature }                       — вернуть сразу.
// feature = ключ функции или 'all' (все функции кабинета).
// deno-lint-ignore-file no-explicit-any

import { FEATURES, FEATURE_KEYS, featureOffReason, isFeatureOn, type FeatureKey } from '../_shared/cabinet-features.ts';
import { adminClient, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';

const PAUSE_MINUTES = new Set([60, 360, 1440]); // 1 час, 6 часов, сутки

type Blocker = { code: string; text: string };

const ts = (v: string | null | undefined) => (v ? Date.parse(v) : 0);

/** Что мешает функции работать (без учёта тумблера). Пусто — всё готово. */
function blockers(feature: FeatureKey, c: any): Blocker[] {
    const out: Blocker[] = [];
    const noToken = !c.hasLegacyToken;
    if (feature === 'reviews') {
        if (c.nrManaged) {
            if (noToken) out.push({ code: 'NO_TOKEN', text: 'В кабинете нет токена WB' });
        } else {
            if (!c.hasSecret) out.push({ code: 'NO_TOKEN', text: 'Токен не добавлен на странице «Агенты»' });
            else if (c.tokenBroken) out.push({ code: 'TOKEN_EXPIRED', text: 'Токен WB истёк или отозван: добавьте новый' });
            if (!c.chat) out.push({ code: 'NO_CHAT', text: 'Не подключён Telegram-чат Акылай' });
            else if (c.chat === 'blocked') out.push({ code: 'CHAT_BLOCKED', text: 'Telegram-чат заблокировал бота' });
            if (!c.akylaiEnabled) out.push({ code: 'AKYLAI_OFF', text: 'Акылай не включён в мастере' });
        }
        if (c.recentEvents?.has('daily_limit')) out.push({ code: 'LIMIT', text: 'Достигнут дневной лимит ответов' });
        return out;
    }
    if (noToken && feature !== 'ads') out.push({ code: 'NO_TOKEN', text: 'В кабинете нет токена WB' });
    if (feature === 'ads' && !c.advTokenValid) out.push({ code: 'NO_ADV_TOKEN', text: 'Нет действующего токена рекламы' });
    if ((feature === 'rnp_morning' || feature === 'order_alerts') && !c.nrManaged) {
        out.push({ code: 'NOT_TEAM', text: 'Кабинет не помечен как «ведёт команда NR»: функция для него не запускается' });
    }
    return out;
}

async function loadContext(admin: any, cabinetId: string) {
    const since = new Date(Date.now() - 2 * 86400_000).toISOString();
    const [cab, legacy, secret, chat, settings, logs, replyLog, akReplies, rows, sync] = await Promise.all([
        admin.from('cabinets').select('id, name, user_id, nr_managed, adv_token_valid').eq('id', cabinetId).maybeSingle(),
        admin.from('cabinets').select('id').eq('id', cabinetId).not('wb_token', 'is', null).gt('wb_token', '').maybeSingle(),
        admin.from('cabinet_secrets').select('token_exp, token_broken').eq('cabinet_id', cabinetId).maybeSingle(),
        admin.from('akylai_chats').select('blocked').eq('cabinet_id', cabinetId).maybeSingle(),
        admin.from('akylai_settings').select('enabled').eq('cabinet_id', cabinetId).maybeSingle(),
        admin.from('agent_logs').select('event, created_at').eq('cabinet_id', cabinetId).gte('created_at', since).order('created_at', { ascending: false }).limit(50),
        admin.from('review_reply_log').select('created_at').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(1),
        admin.from('akylai_replies').select('created_at').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(1),
        admin.from('cabinet_features').select('*').eq('cabinet_id', cabinetId),
        admin.from('sync_log').select('synced_at, status, error_msg').eq('cabinet_id', cabinetId).order('synced_at', { ascending: false }).limit(1),
    ]);
    if (!cab.data) return null;
    const tokenExpired = secret.data?.token_exp && new Date(secret.data.token_exp).getTime() <= Date.now();
    return {
        cab: cab.data,
        ctx: {
            nrManaged: cab.data.nr_managed === true,
            advTokenValid: cab.data.adv_token_valid === true,
            hasLegacyToken: Boolean(legacy.data),
            hasSecret: Boolean(secret.data),
            tokenBroken: Boolean(secret.data?.token_broken || tokenExpired),
            chat: !chat.data ? null : chat.data.blocked ? 'blocked' : 'connected',
            akylaiEnabled: settings.data?.enabled === true,
            recentEvents: new Set((logs.data || []).filter((l: any) => l.event === 'daily_limit').map((l: any) => l.event)),
        },
        rows: new Map<string, any>((rows.data || []).map((r: any) => [r.feature, r])),
        lastReview: [replyLog.data?.[0]?.created_at, akReplies.data?.[0]?.created_at].filter(Boolean).sort((a, b) => ts(a) - ts(b)).pop() || null,
        sync: sync.data?.[0] || null,
    };
}

function featureState(key: FeatureKey, loaded: any) {
    const row = loaded.rows.get(key) || null;
    const on = isFeatureOn(row);
    const meta = FEATURES.find((f) => f.key === key)!;
    const bl = blockers(key, loaded.ctx);
    let lastRun: string | null = row?.last_run_at || null;
    let lastStatus: string | null = row?.last_status || null;
    let lastError: string | null = row?.last_error || null;
    // Функции, которые сами не пишут итог запуска, показываем по их собственным журналам.
    if (key === 'reviews' && loaded.lastReview && (!lastRun || ts(loaded.lastReview) > ts(lastRun))) {
        lastRun = loaded.lastReview; lastStatus = 'ok'; lastError = null;
    }
    if (key === 'sync' && loaded.sync && (!lastRun || ts(loaded.sync.synced_at) > ts(lastRun))) {
        lastRun = loaded.sync.synced_at;
        lastStatus = loaded.sync.status === 'success' ? 'ok' : 'error';
        lastError = loaded.sync.error_msg || null;
    }
    return {
        feature: key,
        title: meta.title,
        hint: meta.hint,
        agent: meta.agent,
        enabled: row ? row.enabled !== false : true,
        active: on,
        paused_until: row?.paused_until && new Date(row.paused_until).getTime() > Date.now() ? row.paused_until : null,
        off_reason: featureOffReason(row),
        last_run_at: lastRun,
        last_status: lastStatus,
        last_error: lastError,
        blockers: bl,
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false }, 405);

    const admin = adminClient();
    try {
        const user = await userFromRequest(req);
        if (!user) return json({ ok: false, code: 'UNAUTHORIZED' }, 401);

        const body = await req.json().catch(() => ({}));
        const action = String(body?.action || 'state');
        const cabinetId = String(body?.cabinet_id || '');
        if (!/^[0-9a-f-]{36}$/i.test(cabinetId)) return json({ ok: false, code: 'BAD_CABINET' }, 400);

        const { data: cab } = await admin.from('cabinets').select('id, user_id').eq('id', cabinetId).maybeSingle();
        if (!cab) return json({ ok: false, code: 'NOT_FOUND' }, 404);
        if (cab.user_id !== user.id && !(await isStaffUser(admin, user))) return json({ ok: false, code: 'FORBIDDEN' }, 403);

        if (action !== 'state') {
            const feature = String(body?.feature || '');
            const keys: FeatureKey[] = feature === 'all' ? FEATURE_KEYS : FEATURE_KEYS.filter((k) => k === feature);
            if (!keys.length) return json({ ok: false, code: 'BAD_FEATURE' }, 400);

            let patch: Record<string, unknown>;
            if (action === 'set') {
                patch = { enabled: body?.enabled === true, paused_until: null };
            } else if (action === 'pause') {
                const minutes = Number(body?.minutes);
                if (!PAUSE_MINUTES.has(minutes)) return json({ ok: false, code: 'BAD_PERIOD' }, 400);
                patch = { enabled: true, paused_until: new Date(Date.now() + minutes * 60_000).toISOString() };
            } else if (action === 'resume') {
                patch = { enabled: true, paused_until: null };
            } else {
                return json({ ok: false, code: 'BAD_ACTION' }, 400);
            }
            const now = new Date().toISOString();
            const { error } = await admin.from('cabinet_features').upsert(
                keys.map((k) => ({ cabinet_id: cabinetId, feature: k, ...patch, updated_by: user.id, updated_at: now })),
                { onConflict: 'cabinet_id,feature' },
            );
            if (error) return json({ ok: false, code: 'SERVER_ERROR' }, 500);
            await admin.from('agent_logs').insert({
                agent: 'features', cabinet_id: cabinetId, event: 'feature_' + action,
                detail: { features: keys, user_id: user.id, ...patch },
            });
        }

        const loaded = await loadContext(admin, cabinetId);
        if (!loaded) return json({ ok: false, code: 'NOT_FOUND' }, 404);
        return json({ ok: true, features: FEATURE_KEYS.map((k) => featureState(k, loaded)) });
    } catch (e) {
        console.error('[cabinet-features]', e);
        return json({ ok: false, code: 'SERVER_ERROR' }, 500);
    }
});
