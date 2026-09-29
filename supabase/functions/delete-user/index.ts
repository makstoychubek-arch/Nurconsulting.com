// Supabase Edge Function: delete-user
// Удаляет пользователя из админки. Вызывать могут суперадмин и сотрудники
// (team_staff); сотрудника удалить может только суперадмин. Себя и суперадмина
// удалить нельзя.
//
// Кабинеты и их данные НЕ удаляются: admin_detach_user() снимает владельца
// (cabinets.user_id = null), затем auth.admin.deleteUser().
// Клиенту уходит одна короткая фраза, подробности — только в лог функции.
//
// Функция самодостаточна (без ../_shared), чтобы её можно было вставить
// целиком в редактор Edge Functions в дашборде Supabase.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPER_ADMIN_EMAIL = 'global.pro.1004@gmail.com';
const SUPER_ADMIN_ID = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function isSuperAdminUser(user: { email?: string | null; id?: string } | null | undefined): boolean {
    if (!user) return false;
    return String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL || user.id === SUPER_ADMIN_ID;
}

// deno-lint-ignore no-explicit-any
async function isStaffEmail(admin: any, email: string | null | undefined): Promise<boolean> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return false;
    const { data, error } = await admin.from('team_staff').select('email');
    if (error || !Array.isArray(data)) {
        console.error('[delete-user] team_staff read failed:', error?.message);
        return false;
    }
    // deno-lint-ignore no-explicit-any
    return data.some((r: any) => String(r.email || '').trim().toLowerCase() === e);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) return json({ error: 'Войдите заново' }, 401);
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const userClient = createClient(supabaseUrl, supabaseAnon, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !caller) return json({ error: 'Войдите заново' }, 401);

        const admin = createClient(supabaseUrl, supabaseService);

        const callerIsSuper = isSuperAdminUser(caller);
        if (!callerIsSuper && !(await isStaffEmail(admin, caller.email))) {
            console.warn('[delete-user] forbidden caller:', caller.id, caller.email);
            return json({ error: 'Нет прав на удаление пользователей' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const targetId = String(body.user_id || '').trim();
        if (!UUID_RE.test(targetId)) return json({ error: 'Не удалось удалить пользователя' }, 400);

        if (targetId === caller.id) {
            console.warn('[delete-user] self delete refused:', caller.id);
            return json({ error: 'Нельзя удалить самого себя' }, 400);
        }

        const { data: space, error: spaceErr } = await admin
            .from('spaces')
            .select('email, is_super_admin')
            .eq('user_id', targetId)
            .maybeSingle();
        if (spaceErr) {
            console.error('[delete-user] spaces read failed:', targetId, spaceErr.message);
            return json({ error: 'Не удалось удалить пользователя' }, 500);
        }

        const { data: authTarget, error: getErr } = await admin.auth.admin.getUserById(targetId);
        const authGone = !!getErr && (getErr.status === 404 || /not found/i.test(getErr.message || ''));
        if (getErr && !authGone) {
            console.error('[delete-user] getUserById failed:', targetId, getErr.message);
            return json({ error: 'Не удалось удалить пользователя' }, 500);
        }
        if (authGone && !space) return json({ error: 'Пользователь не найден' }, 404);

        const targetEmail = String(space?.email || authTarget?.user?.email || '').trim().toLowerCase();

        if (space?.is_super_admin || isSuperAdminUser({ id: targetId, email: targetEmail })) {
            console.warn('[delete-user] super admin delete refused:', targetId, 'by', caller.id);
            return json({ error: 'Нельзя удалить суперадмина' }, 400);
        }

        // Сотрудника команды удаляет только суперадмин.
        if (!callerIsSuper && (await isStaffEmail(admin, targetEmail))) {
            console.warn('[delete-user] staff delete by non-super refused:', targetId, 'by', caller.id);
            return json({ error: 'Нет прав на удаление сотрудника' }, 403);
        }

        // 1) Снять права и владение кабинетами (одна транзакция в БД).
        const { data: detached, error: detachErr } = await admin.rpc('admin_detach_user', {
            p_user_id: targetId,
            p_email: targetEmail,
        });
        if (detachErr) {
            console.error('[delete-user] admin_detach_user failed:', targetId, detachErr.message);
            return json({ error: 'Не удалось удалить пользователя' }, 500);
        }

        // 2) Удалить аккаунт. Шаг 1 безопасно повторяется, поэтому при сбое здесь
        //    достаточно нажать «Удалить» ещё раз.
        if (!authGone) {
            const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
            if (delErr) {
                console.error('[delete-user] deleteUser failed:', targetId, delErr.message);
                return json({ error: 'Не удалось удалить пользователя' }, 500);
            }
        }

        // Если аккаунта в auth уже нет, а запись spaces осталась — убираем её.
        if (authGone) {
            const { error: spDelErr } = await admin.from('spaces').delete().eq('user_id', targetId);
            if (spDelErr) console.error('[delete-user] spaces cleanup failed:', targetId, spDelErr.message);
        }

        console.log('[delete-user] deleted', targetId, targetEmail, 'by', caller.id,
            'detached cabinets:', detached ?? 0);
        return json({ ok: true, email: targetEmail, detached_cabinets: Number(detached) || 0 });
    } catch (e) {
        console.error('[delete-user] unexpected:', e);
        return json({ error: 'Не удалось удалить пользователя' }, 500);
    }
});
