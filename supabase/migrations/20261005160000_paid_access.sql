-- ============================================================
-- Платный доступ: бесплатно только Акылай, остальные разделы — по тарифу.
--
-- spaces.tariff_plan: start (бесплатный, только Акылай) | basic | business | premium | vip.
-- Платными считаются basic, business, premium, vip. spaces.plan_until — срок тарифа
-- (например, подарочный VIP на месяц); пусто = без срока, истёк = снова бесплатный.
-- Сотрудники команды и супер-админы имеют полный доступ всегда.
--
-- paid_access_for(uid) — единственное место, где решается «платно/бесплатно».
-- Её вызывают edge-функции (service role), а браузер — через has_paid_access().
-- Safe to re-run.
-- ============================================================

alter table public.spaces add column if not exists plan_until timestamptz;

alter table public.spaces drop constraint if exists spaces_tariff_plan_check;
alter table public.spaces add constraint spaces_tariff_plan_check
    check (tariff_plan = any (array['start', 'basic', 'business', 'premium', 'vip']::text[]));

create or replace function public.paid_access_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
    select
        p_user = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'::uuid
        or exists (
            select 1 from public.spaces s
            where s.user_id = p_user and s.is_super_admin = true and s.status = 'active'
        )
        or exists (
            select 1 from public.team_staff t
            join auth.users u on lower(u.email) = lower(t.email)
            where u.id = p_user
        )
        or exists (
            select 1 from public.spaces s
            where s.user_id = p_user
              and s.status = 'active'
              and s.tariff_plan in ('basic', 'business', 'premium', 'vip')
              and (s.plan_until is null or s.plan_until > now())
        );
$$;

create or replace function public.has_paid_access()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
    select coalesce(public.paid_access_for(auth.uid()), false);
$$;

revoke all on function public.paid_access_for(uuid) from public, anon, authenticated;
grant execute on function public.paid_access_for(uuid) to service_role;
revoke all on function public.has_paid_access() from public, anon;
grant execute on function public.has_paid_access() to authenticated, service_role;

-- Загрузка истории (очередь) — платная функция.
create or replace function public.request_backfill(p_cabinet uuid, p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_days int;
begin
    if auth.uid() is null or not (p_cabinet in (select public.current_user_cabinet_ids())) then
        return jsonb_build_object('state', 'forbidden');
    end if;
    if not public.has_paid_access() then
        return jsonb_build_object('state', 'locked');
    end if;
    if not exists (select 1 from public.cabinets where id = p_cabinet and coalesce(wb_token, '') <> '') then
        return jsonb_build_object('state', 'no_token');
    end if;

    -- Клиент грузит до 90 дней, команда — до 400.
    v_days := case when public.is_super_admin() or public.is_team_member()
                   then least(greatest(coalesce(p_days, 90), 8), 400)
                   else least(greatest(coalesce(p_days, 90), 8), 90) end;

    -- Повторный запрос: окна, что закончились ошибкой, ставим в очередь заново.
    update public.sync_jobs
       set status = 'queued', attempts = 0, next_run_at = now(), error = null, finished_at = null
     where cabinet_id = p_cabinet and status = 'error';

    perform public.plan_cabinet_backfill(p_cabinet, v_days);
    return public.sync_progress(p_cabinet);
end;
$$;
revoke all on function public.request_backfill(uuid, int) from public, anon;
grant execute on function public.request_backfill(uuid, int) to authenticated, service_role;
