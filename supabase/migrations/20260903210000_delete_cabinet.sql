-- Удаление кабинета: каскад по всем хвостам + RPC, чтобы токены не остались.

alter table public.wb_cache drop constraint if exists wb_cache_cabinet_id_fkey;
alter table public.wb_cache
  add constraint wb_cache_cabinet_id_fkey
  foreign key (cabinet_id) references public.cabinets(id) on delete cascade;

alter table public.wb_orders drop constraint if exists wb_orders_cabinet_id_fkey;
alter table public.wb_orders
  add constraint wb_orders_cabinet_id_fkey
  foreign key (cabinet_id) references public.cabinets(id) on delete cascade;

alter table public.wb_stocks drop constraint if exists wb_stocks_cabinet_id_fkey;
alter table public.wb_stocks
  add constraint wb_stocks_cabinet_id_fkey
  foreign key (cabinet_id) references public.cabinets(id) on delete cascade;

alter table public.ab_tests drop constraint if exists ab_tests_cabinet_id_fkey;
alter table public.ab_tests
  add constraint ab_tests_cabinet_id_fkey
  foreign key (cabinet_id) references public.cabinets(id) on delete cascade;

do $$
declare
  t text;
begin
  foreach t in array array[
    'agent_pending_actions',
    'raw_finance_report',
    'raw_storage',
    'rnp_sync_state'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format(
        'delete from public.%I a where a.cabinet_id is not null and not exists (select 1 from public.cabinets c where c.id = a.cabinet_id)',
        t
      );
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_cabinet_id_fkey');
      begin
        execute format(
          'alter table public.%I add constraint %I foreign key (cabinet_id) references public.cabinets(id) on delete cascade',
          t, t || '_cabinet_id_fkey'
        );
      exception when others then
        raise notice 'skip fk %: %', t, sqlerrm;
      end;
    end if;
  end loop;
end $$;

drop policy if exists "cabinets_delete_own" on public.cabinets;
create policy "cabinets_delete_own" on public.cabinets
  for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or public.is_team_member()
  );

create or replace function public.delete_cabinet(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if cid is null then
    raise exception 'cabinet id required';
  end if;
  if not public.can_access_cabinet(cid) then
    raise exception 'нет доступа к кабинету';
  end if;

  update public.cabinets
    set wb_token = null,
        wb_content_token = null,
        wb_token_analytics = null,
        wb_token_promotion = null,
        ozon_client_id = null,
        ozon_api_key = null
    where id = cid;

  -- РНП хранит cabinet_id как text — каскада нет.
  delete from public.rnp_daily_data where cabinet_id = cid::text;
  delete from public.rnp_date_notes where cabinet_id = cid::text;
  delete from public.rnp_articles where cabinet_id = cid::text;
  delete from public.rnp_settings where cabinet_id = cid::text;

  delete from public.cabinets where id = cid;
end;
$$;

revoke all on function public.delete_cabinet(uuid) from public;
grant execute on function public.delete_cabinet(uuid) to authenticated;

comment on function public.delete_cabinet(uuid) is
  'Стирает токены WB/Ozon и удаляет кабинет со всеми связанными данными.';
