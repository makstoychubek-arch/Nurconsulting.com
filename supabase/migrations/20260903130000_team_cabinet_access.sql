-- ============================================================
-- NR Space — доступ команды (allowed_users) к данным кабинетов
--
-- Сотрудники из allowed_users видели кабинеты (whitelist_only_cabinets),
-- но таблицы РНП / рекламы / планов проверяли только владельца
-- (cabinets.user_id = auth.uid()). В итоге у сотрудника РНП падал с 403
-- на rnp_articles / rnp_settings / manual_data и показывал
-- «Нет активных артикулов». Вводим единое правило доступа к кабинету:
--   владелец  ИЛИ  супер-админ  ИЛИ  сотрудник из allowed_users.
-- Safe to re-run.
-- ============================================================

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.allowed_users
        where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

create or replace function public.can_access_cabinet(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_super_admin()
        or public.is_team_member()
        or exists (select 1 from public.cabinets where id = cid and user_id = auth.uid());
$$;

create or replace function public.can_access_cabinet(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select case
        when cid ~ '^[0-9a-fA-F-]{36}$' then public.can_access_cabinet(cid::uuid)
        else false
    end;
$$;

-- own_cabinet() используется существующими политиками own_cabinet_data —
-- расширяем его, не трогая сами политики.
create or replace function public.own_cabinet(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.can_access_cabinet(cid);
$$;

create or replace function public.own_cabinet(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.can_access_cabinet(cid);
$$;

-- ab_experiments_own опирается на этот список.
create or replace function public.current_user_cabinet_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select id from public.cabinets
    where public.is_super_admin() or public.is_team_member() or user_id = auth.uid();
$$;

-- Таблицы, где была только inline-проверка владельца — добавляем политику
-- доступа команды рядом (политики складываются по ИЛИ).
do $$
declare t text;
begin
    foreach t in array array[
        'advertising_campaigns', 'advertising_daily_stats',
        'rnp_date_notes', 'rnp_plans',
        'wb_cluster_cache', 'wb_cluster_stats_history',
        'rnp_articles', 'rnp_daily_data', 'rnp_settings'
    ] loop
        execute format('drop policy if exists team_cabinet_access on public.%I', t);
        execute format(
            'create policy team_cabinet_access on public.%I for all using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id))',
            t
        );
    end loop;
end $$;
