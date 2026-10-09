// Supabase Edge Function: admin-space
// Super Admin only: activate / block client spaces + revoke sessions

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptSecret, importSecretKey } from '../_shared/secret-box.ts';

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';

function isSuperAdmin(user: { email?: string | null; id?: string }) {
    return String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || user.id === SUPER_ADMIN_ID;
}

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

/**
 * Клиент, пришедший через Акылай, хранит токен WB только зашифрованным
 * (cabinet_secrets). При одобрении переносим его в кабинет — иначе остальные
 * разделы (дашборд, синхронизация) работать не смогут. Только на сервере.
 */
// deno-lint-ignore no-explicit-any
async function moveAkylaiTokens(admin: any, userId: string): Promise<number> {
    const key = (Deno.env.get('AKYLAI_ENC_KEY') ?? '').trim();
    if (!key) return 0;
    const { data: cabs } = await admin
        .from('cabinets')
        .select('id, wb_token, cabinet_secrets!inner(wb_token_enc)')
        .eq('user_id', userId);
    let moved = 0;
    const cryptoKey = await importSecretKey(key);
    for (const c of cabs || []) {
        if (c.wb_token) continue;
        const enc = Array.isArray(c.cabinet_secrets) ? c.cabinet_secrets[0]?.wb_token_enc : c.cabinet_secrets?.wb_token_enc;
        if (!enc) continue;
        try {
            const token = await decryptSecret(enc, cryptoKey);
            const { error } = await admin.from('cabinets').update({ wb_token: token }).eq('id', c.id);
            if (!error) moved++;
            else console.error('[admin-space] token move:', c.id, error.message);
        } catch (e) {
            console.error('[admin-space] token decrypt:', c.id, (e as Error)?.message || e);
        }
    }
    return moved;
}

const PLANS = ['start', 'basic', 'business', 'premium', 'vip'];

// deno-lint-ignore no-explicit-any
async function setStaff(admin: any, email: string | null, on: boolean): Promise<string | null> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return 'У пользователя нет e-mail';
    if (on) {
        const { error } = await admin.from('team_staff').upsert({ email: e, note: 'Добавлен из «Доступ к NR Space»' }, { onConflict: 'email' });
        return error ? `Не удалось сделать сотрудником: ${error.message}` : null;
    }
    const { error } = await admin.from('team_staff').delete().eq('email', e);
    return error ? `Не удалось снять права сотрудника: ${error.message}` : null;
}

// deno-lint-ignore no-explicit-any
async function setPlan(admin: any, userId: string, plan: string): Promise<string | null> {
    if (!PLANS.includes(plan)) return 'Неизвестный тариф';
    // Без срока: тариф действует, пока вы его не смените.
    const { error } = await admin.from('spaces')
        .update({ tariff_plan: plan, plan_until: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    return error ? `Не удалось выдать тариф: ${error.message}` : null;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Invalid session' }, 401);

        if (!isSuperAdmin(user)) {
            return json({ error: 'Super Admin access required' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const action = String(body.action || '');
        const targetUserId = String(body.user_id || '');

        if (!targetUserId) return json({ error: 'user_id required' }, 400);
        if (targetUserId === user.id) {
            return json({ error: 'Cannot modify your own space via admin panel' }, 400);
        }

        const admin = createClient(supabaseUrl, supabaseService);

        const { data: space, error: spaceErr } = await admin
            .from('spaces')
            .select('id, email, status, user_id')
            .eq('user_id', targetUserId)
            .maybeSingle();

        if (spaceErr || !space) return json({ error: 'Space not found' }, 404);

        if (action === 'activate') {
            const { error: updErr } = await admin
                .from('spaces')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId);

            if (updErr) return json({ error: `Не удалось разрешить: ${updErr.message}` }, 500);

            // Обычная активация даёт доступ только к своему спейсу. В team_staff клиента
            // не добавляем: этот список означает «сотрудник видит все кабинеты».
            // Сотрудником и «Фулл» делает только явный флаг (кнопка «Как сотрудник»).
            if (body.as_staff === true) {
                const st = await setStaff(admin, space.email, true);
                if (st) return json({ error: st }, 500);
                const pl = await setPlan(admin, targetUserId, 'premium');
                if (pl) return json({ error: pl }, 500);
            }
            const tokensMoved = await moveAkylaiTokens(admin, targetUserId);
            return json({ ok: true, status: 'active', email: space.email, tokens_moved: tokensMoved });
        }

        if (action === 'set_staff') {
            const err = await setStaff(admin, space.email, body.value === true);
            if (err) return json({ error: err }, 500);
            return json({ ok: true, email: space.email, staff: body.value === true });
        }

        if (action === 'set_plan') {
            const plan = String(body.plan || '');
            const err = await setPlan(admin, targetUserId, plan);
            if (err) return json({ error: err }, 400);
            return json({ ok: true, email: space.email, plan });
        }

        if (action === 'block') {
            const { error: updErr } = await admin
                .from('spaces')
                .update({ status: 'blocked', updated_at: new Date().toISOString() })
                .eq('user_id', targetUserId);

            if (updErr) return json({ error: `Не удалось заблокировать: ${updErr.message}` }, 500);

            // Остальные шаги чистят хвосты: ошибка любого из них не должна отменять блокировку.
            const warns: string[] = [];
            const sess = await admin.from('user_sessions').delete().eq('user_id', targetUserId);
            if (sess.error) warns.push(`user_sessions: ${sess.error.message}`);
            if (space.email) {
                // Блокировка снимает и права сотрудника, иначе бывший сотрудник
                // продолжал бы читать чужие кабинеты в обход интерфейса.
                const e1 = await admin.from('team_staff').delete().eq('email', space.email);
                if (e1.error) warns.push(`team_staff: ${e1.error.message}`);
                const e2 = await admin.from('allowed_users').delete().eq('email', space.email);
                if (e2.error) warns.push(`allowed_users: ${e2.error.message}`);
            }

            let revoked = false;
            try {
                // signOut принимает JWT пользователя, а не id: сессии снимаем через админ-API по id.
                const { error: signOutErr } = await admin.auth.admin.signOut(targetUserId, 'global');
                revoked = !signOutErr;
                if (signOutErr) warns.push(`signOut: ${signOutErr.message}`);
            } catch (e) {
                warns.push(`signOut: ${String((e as Error)?.message || e)}`);
            }
            if (warns.length) console.warn('[admin-space] block warnings:', warns.join(' | '));

            return json({ ok: true, status: 'blocked', email: space.email, sessions_revoked: revoked, warnings: warns });
        }

        return json({ error: 'Unknown action. Use activate, block, set_staff or set_plan.' }, 400);
    } catch (e) {
        console.error('[admin-space]', e);
        return json({ error: String(e?.message || e) }, 500);
    }
});
