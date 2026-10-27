-- Кампании «Полки»: сайт сам исключает поисковые фразы, чтобы показы шли только на рекомендательных полках.
create table if not exists public.adv_shelves (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null,
  advert_id bigint not null,
  enabled boolean not null default true,
  interval_min integer not null default 10 check (interval_min in (5, 10, 30)),
  -- До этого момента фразы только показываем («исключил бы»), WB не трогаем.
  dry_run_until timestamptz,
  keep_phrases text[] not null default '{}',
  max_cpm_per_1000 numeric,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  excluded_total integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cabinet_id, advert_id)
);
create table if not exists public.adv_shelves_log (
  id bigserial primary key,
  cabinet_id uuid not null,
  advert_id bigint not null,
  nm_id bigint,
  phrase text not null,
  action text not null check (action in ('exclude', 'would_exclude', 'restore')),
  impressions integer,
  created_at timestamptz not null default now()
);
create index if not exists adv_shelves_log_cab_idx on public.adv_shelves_log (cabinet_id, advert_id, created_at desc);

alter table public.adv_shelves enable row level security;
alter table public.adv_shelves_log enable row level security;
drop policy if exists adv_shelves_select on public.adv_shelves;
create policy adv_shelves_select on public.adv_shelves for select using (cabinet_id in (select current_user_view_cabinet_ids()));
drop policy if exists adv_shelves_write on public.adv_shelves;
create policy adv_shelves_write on public.adv_shelves for all using (cabinet_id in (select current_user_cabinet_ids())) with check (cabinet_id in (select current_user_cabinet_ids()));
drop policy if exists adv_shelves_log_select on public.adv_shelves_log;
create policy adv_shelves_log_select on public.adv_shelves_log for select using (cabinet_id in (select current_user_view_cabinet_ids()));
drop policy if exists adv_shelves_log_write on public.adv_shelves_log;
create policy adv_shelves_log_write on public.adv_shelves_log for insert with check (cabinet_id in (select current_user_cabinet_ids()));

-- Запуск каждые 5 минут: копия рабочего задания автобиддера с другим адресом.
select cron.schedule('adv-shelves-tick-5m', '*/5 * * * *',
  replace((select command from cron.job where jobname = 'orders-rescan-10m'), '/functions/v1/orders-rescan', '/functions/v1/adv-shelves-tick'));
