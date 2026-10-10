-- Доступ «только просмотр» к кабинету: владелец (суперадмин) выдаёт пользователю кабинеты и разделы.
-- Наблюдатель только читает: для него добавлены отдельные SELECT-политики, изменять данные он не может
-- (политики на запись по-прежнему через current_user_cabinet_ids()). Токены WB (таблица cabinets) ему не видны —
-- список своих кабинетов он получает через viewer_cabinets() (только id и название).
create table if not exists public.cabinet_viewers (
    user_id    uuid not null references auth.users(id) on delete cascade,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    sections   text[] not null default array['all'],
    granted_by uuid,
    created_at timestamptz not null default now(),
    primary key (user_id, cabinet_id)
);
alter table public.cabinet_viewers enable row level security;
drop policy if exists cabinet_viewers_read on public.cabinet_viewers;
create policy cabinet_viewers_read on public.cabinet_viewers for select
    using (user_id = auth.uid() or public.is_super_admin());
revoke all on public.cabinet_viewers from anon;
grant select on public.cabinet_viewers to authenticated;

create or replace function public.current_user_view_cabinet_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
    select id from public.current_user_cabinet_ids() id
    union
    select v.cabinet_id from public.cabinet_viewers v where v.user_id = auth.uid()
$$;
revoke all on function public.current_user_view_cabinet_ids() from public, anon;
grant execute on function public.current_user_view_cabinet_ids() to authenticated, service_role;

create or replace function public.viewer_cabinets()
returns table (id uuid, name text, sections text[])
language sql stable security definer set search_path = public
as $$
    select c.id, c.name, v.sections
    from public.cabinet_viewers v join public.cabinets c on c.id = v.cabinet_id
    where v.user_id = auth.uid()
    order by c.name
$$;
revoke all on function public.viewer_cabinets() from public, anon;
grant execute on function public.viewer_cabinets() to authenticated, service_role;

-- Наблюдателю открыты платные разделы (без своих кабинетов это только просмотр выданных).
create or replace function public.has_paid_access()
returns boolean
language sql stable security definer set search_path = public
as $$
    select coalesce(public.paid_access_for(auth.uid()), false)
        or exists (select 1 from public.cabinet_viewers v where v.user_id = auth.uid())
$$;

-- SELECT-политики для наблюдателя: копия существующего условия, но по current_user_view_cabinet_ids().
do $$
declare r record;
begin
    for r in
        select tablename, policyname, qual from pg_policies
        where schemaname = 'public' and cmd in ('ALL', 'SELECT')
          and qual like '%current_user_cabinet_ids()%'
          and tablename in ('ab_experiment_periods','ab_experiments','ab_test_adv_snapshots','ab_test_rotation_log','ab_test_rotations',
              'ab_test_variant_stats','ab_test_variants','ab_tests','advertising_campaigns','advertising_daily_stats','autobidder_log',
              'goods_daily_stocks','order_events','raw_finance_report','raw_storage','report_rows','report_uploads','rnp_articles',
              'rnp_daily_data','rnp_date_notes','rnp_plans','rnp_settings','rnp_sync_state','sync_log','wb_balance_daily',
              'wb_cache','wb_cluster_cache','wb_cluster_stats_history','wb_orders','wb_restock_questions','wb_sales','wb_stocks')
    loop
        execute format('drop policy if exists %I on public.%I', r.policyname || '_viewer', r.tablename);
        execute format('create policy %I on public.%I for select using (%s)', r.policyname || '_viewer', r.tablename,
                       replace(r.qual, 'current_user_cabinet_ids()', 'current_user_view_cabinet_ids()'));
    end loop;
end $$;
