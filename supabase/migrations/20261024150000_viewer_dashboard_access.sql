-- Владелец и гость кабинета (cabinet_viewers) видят дашборд: функции сводки проверяли только «свой кабинет»,
-- поэтому у них вместо цифр оставались пустые карточки. Меняем проверку только в функциях ЧТЕНИЯ дашборда.
-- Права на запись не трогаем: can_access_cabinet остаётся прежним.

create or replace function public.can_view_cabinet(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select public.can_access_cabinet(cid)
        or exists (select 1 from public.cabinet_viewers v where v.cabinet_id = cid and v.user_id = auth.uid())
$$;
create or replace function public.can_view_cabinet(cid text) returns boolean
language sql stable security definer set search_path = public as $$
    select case when cid ~ '^[0-9a-fA-F-]{36}$' then public.can_view_cabinet(cid::uuid) else false end
$$;
revoke all on function public.can_view_cabinet(uuid) from public, anon;
revoke all on function public.can_view_cabinet(text) from public, anon;
grant execute on function public.can_view_cabinet(uuid) to authenticated, service_role;
grant execute on function public.can_view_cabinet(text) to authenticated, service_role;

do $$
declare r record; def text;
begin
    for r in
        select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('dashboard_summary', 'dashboard_finance_rows', 'dashboard_finance_coverage', 'dashboard_plan_cabinets', 'dashboard_plan_skus', 'dashboard_ff_penalties')
    loop
        def := pg_get_functiondef(r.oid);
        if def like '%can_access_cabinet(%' then
            execute replace(def, 'can_access_cabinet(', 'can_view_cabinet(');
        end if;
    end loop;
end $$;
