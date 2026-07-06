-- Таблица логов синхронизации WB
create table if not exists public.sync_log (
  id           bigserial primary key,
  cabinet_id   uuid references public.cabinets on delete cascade,
  cabinet_name text,
  synced_at    timestamptz default now(),
  stocks_count integer default 0,
  orders_count integer default 0,
  finance_rows integer default 0,
  status       text default 'pending',
  error_msg    text,
  duration_ms  integer
);

alter table public.sync_log enable row level security;

drop policy if exists "whitelist_read_sync_log" on public.sync_log;
create policy "whitelist_read_sync_log" on public.sync_log
  for select to authenticated
  using (
    exists (
      select 1 from public.allowed_users
      where allowed_users.email = auth.jwt()->>'email'
    )
    or public.is_super_admin()
    or cabinet_id in (select id from public.cabinets where user_id = auth.uid())
  );

create index if not exists idx_sync_log_cabinet_synced
  on public.sync_log (cabinet_id, synced_at desc);
