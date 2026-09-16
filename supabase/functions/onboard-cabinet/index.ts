// Supabase Edge Function: onboard-cabinet
//
// Первый шаг нового клиента: он вставляет персональный API-токен WB, мы
// проверяем токен, создаём кабинет и открываем доступ к интерфейсу.
//
// Почему отдельная функция, а не запись в cabinets из браузера:
//  * до подключения кабинета спейс ещё не активен, и wb-proxy справедливо
//    отвечает 403 — проверить токен из браузера нечем;
//  * непроверенный токен раньше просто молча не работал, и клиент видел
//    пустые экраны вместо понятной причины;
//  * токен не должен попадать в логи браузера и в чужие руки.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
    decodeWbToken,
    missingScopesMessage,
    pingStatusMeansNoAccess,
    summarizePings,
    OPTIONAL_CATEGORIES,
    REQUIRED_CATEGORIES,
    type PingResult,
} from '../_shared/wb-token-check.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

const PING_TIMEOUT_MS = 8000;

async function pingCategory(host: string, key: string, label: string, token: string): Promise<PingResult> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    try {
        const res = await fetch(`https://${host}.wildberries.ru/ping`, {
            headers: { Authorization: token },
            signal: ctrl.signal,
        });
        return { key, label, ok: !pingStatusMeansNoAccess(res.status), status: res.status };
    } catch {
        // Сеть или таймаут — это не отказ в доступе, категорию не хороним.
        return { key, label, ok: true, status: 0 };
    } finally {
        clearTimeout(timer);
    }
}

/** Заказы, остатки, реклама и финотчёт по свежему кабинету — без ожидания. */
async function kickOffFirstSync(url: string, serviceKey: string, cabinetId: string): Promise<void> {
    const call = (fn: string, body: Record<string, unknown>) =>
        fetch(`${url}/functions/v1/${fn}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ cabinet_id: cabinetId, ...body }),
        }).catch((e) => console.error(`[onboard-cabinet] ${fn}:`, e));

    await Promise.allSettled([
        call('auto-sync', { mode: 'full' }),
        call('advertising-sync', {}),
        call('rnp-finance-sync', { mode: 'sync' }),
    ]);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);

        const admin = createClient(supabaseUrl, supabaseService);

        const { data: space } = await admin
            .from('spaces')
            .select('status')
            .eq('user_id', user.id)
            .maybeSingle();

        if (space?.status === 'blocked') {
            return json({ error: 'Спейс заблокирован. Обратитесь в поддержку.', code: 'BLOCKED' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const rawToken = String((body as Record<string, unknown>).token ?? '');
        const rawName = String((body as Record<string, unknown>).name ?? '').trim();

        const decoded = decodeWbToken(rawToken);
        if (!decoded.ok) {
            return json({ error: decoded.message, code: decoded.code }, 400);
        }
        const token = rawToken.trim().replace(/\s+/g, '');

        // Живая проверка: токен действительно принимается WB и в нём есть
        // категории, без которых дашборд не построится.
        const checks = await Promise.all([
            ...REQUIRED_CATEGORIES.map((c) => pingCategory(c.host, c.key, c.label, token)),
            ...OPTIONAL_CATEGORIES.map((c) => pingCategory(c.host, c.key, c.label, token)),
        ]);

        const allRejected = checks.every((c) => c.status === 401);
        if (allRejected) {
            return json({
                error: 'Wildberries не принял этот токен. Проверьте, что скопирован токен целиком и не отозван.',
                code: 'REJECTED',
            }, 400);
        }

        const summary = summarizePings(checks, REQUIRED_CATEGORIES.map((c) => c.key));
        if (!summary.ok) {
            return json({
                error: missingScopesMessage(summary.missingRequired),
                code: 'MISSING_SCOPES',
                missing: summary.missingRequired,
            }, 400);
        }

        // Повторный онбординг не должен плодить кабинеты-дубли.
        const { data: existing } = await admin
            .from('cabinets')
            .select('id, name')
            .eq('user_id', user.id)
            .limit(1);

        const name = rawName || 'Мой магазин';
        let cabinetId: string;

        if (existing && existing.length) {
            cabinetId = existing[0].id;
            const { error: updErr } = await admin
                .from('cabinets')
                .update({ wb_token: token, name: rawName || existing[0].name })
                .eq('id', cabinetId);
            if (updErr) return json({ error: updErr.message }, 500);
        } else {
            const { data: created, error: insErr } = await admin
                .from('cabinets')
                .insert({ name, wb_token: token, user_id: user.id })
                .select('id')
                .single();
            if (insErr || !created) return json({ error: insErr?.message || 'Не удалось создать кабинет' }, 500);
            cabinetId = created.id;
        }

        // Кабинет подключён — клиенту больше нечего ждать, открываем интерфейс.
        // В team_staff клиента не добавляем: он видит только свой кабинет.
        if (space?.status !== 'active') {
            await admin
                .from('spaces')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('user_id', user.id);
        }

        // Первая выгрузка сразу, не дожидаясь ночного cron: иначе клиент
        // подключил магазин и весь первый день смотрит на пустой дашборд.
        const firstSync = kickOffFirstSync(supabaseUrl, supabaseService, cabinetId);
        const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
            .EdgeRuntime?.waitUntil;
        if (waitUntil) waitUntil(firstSync);
        else await firstSync;

        return json({
            ok: true,
            cabinet_id: cabinetId,
            missing_optional: summary.missingOptional,
            sync_started: true,
        });
    } catch (e) {
        console.error('[onboard-cabinet]', e);
        return json({ error: String(e) }, 500);
    }
});
