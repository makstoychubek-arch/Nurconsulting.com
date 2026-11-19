-- Закрытие данных кабинетов от анонимов и от чужих пользователей (проверено на рабочей базе 19.11.2026).
-- Причина: проверки доступа в функциях дашборда писались как «IF NOT can_view_cabinet(...)», а для вызова без входа проверка давала NULL
-- (false OR NULL OR false = NULL), и условие не срабатывало: анонимный запрос с публичным ключом сайта получал финансовые строки любого кабинета.
-- Функции Ozon (ozon_*) вообще не проверяли доступ. Что меняем:
--  1. helper-проверки возвращают только true или false (coalesce);
--  2. право вызова данных кабинета у роли anon отозвано;
--  3. ozon_dashboard_finance_rows, единственная функция без проверки внутри, получает проверку доступа к кабинету (владелец, команда, суперадмин, гость кабинета; вызовы сервера и cron проходят).
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
    select coalesce(
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'global.pro.1004@gmail.com'
        or auth.uid() = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'::uuid
        or exists (select 1 from public.spaces s where s.user_id = auth.uid() and s.is_super_admin = true and s.status = 'active'),
        false);
$$;
create or replace function public.is_team_member() returns boolean language sql stable security definer set search_path to 'public' as $$
    select coalesce(exists (
        select 1 from public.team_staff t
        join public.spaces s on lower(s.email) = lower(t.email)
        where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and s.status = 'active'), false);
$$;
create or replace function public.can_access_cabinet(cid uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
    select coalesce(public.is_super_admin(), false) or coalesce(public.is_team_member(), false)
        or coalesce(exists (select 1 from public.cabinets where id = cid and user_id = auth.uid()), false);
$$;
create or replace function public.can_view_cabinet(cid uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
    -- вызовы сервера (service_role), cron и прямые подключения идут без пользовательского токена и проходят; anon и вошедшие проверяются
    select coalesce(auth.role(), '') not in ('anon', 'authenticated')
        or coalesce(public.can_access_cabinet(cid), false)
        or coalesce(exists (select 1 from public.cabinet_viewers v where v.cabinet_id = cid and v.user_id = auth.uid()), false);
$$;
create or replace function public.nr_can_read_cabinet(cid uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
    select coalesce(public.can_view_cabinet(cid), false);
$$;
revoke all on function public.nr_can_read_cabinet(uuid) from public, anon;
grant execute on function public.nr_can_read_cabinet(uuid) to authenticated, service_role;


alter function public.ozon_dashboard_finance_rows(uuid, date, date) rename to ozon_dashboard_finance_rows__impl;
revoke all on function public.ozon_dashboard_finance_rows__impl(uuid, date, date) from public, anon, authenticated;
create function public.ozon_dashboard_finance_rows(p_cabinet uuid, p_from date, p_to date) returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
    if not public.nr_can_read_cabinet(p_cabinet) then
        raise exception 'access denied' using errcode = '42501';
    end if;
    return public.ozon_dashboard_finance_rows__impl(p_cabinet => p_cabinet, p_from => p_from, p_to => p_to);
end;
$$;






do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_ff_penalties' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_finance_coverage' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_finance_rows' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_plan_cabinets' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_plan_cabinets_slow' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_plan_skus' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_summary' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='dashboard_summary_slow' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_dashboard_summary' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_unit_rows' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='delete_cabinet' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='rnp_foreign_nm_ids' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='log_client_errors' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_dashboard_coverage' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_dashboard_finance_rows' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_finance_daily' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_offers_of_base' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_orders_daily' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_rnp_articles' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_stock_rows' loop execute 'revoke all on function '||f||' from public, anon'; execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_dashboard_coverage' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_dashboard_finance_rows' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_finance_daily' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_offers_of_base' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_orders_daily' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_rnp_articles' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
do $$ declare f regprocedure; begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname='ozon_stock_rows' loop execute 'grant execute on function '||f||' to authenticated, service_role'; end loop; end $$;
