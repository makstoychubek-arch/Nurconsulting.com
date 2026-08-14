-- Ежедневный сводный отчёт FBS → Telegram (07:00 Бишкек = 01:00 UTC).
-- Активные кабинеты — через fbs_active_cabinets (сейчас только Zevina 1).

create table if not exists public.fbs_active_cabinets (
    cabinet      text primary key,
    is_active    boolean not null default false,
    activated_at timestamptz
);

insert into public.fbs_active_cabinets (cabinet, is_active, activated_at)
values
    ('Zevina 1', true, now()),
    ('Zevina 2', false, null),
    ('SAAI', false, null),
    ('Baza', false, null),
    ('Elium', false, null)
on conflict (cabinet) do nothing;

create table if not exists public.fbs_daily_orders (
    id               uuid primary key default gen_random_uuid(),
    report_date      date not null,
    marketplace      text not null,
    cabinet          text not null,
    order_id         text,
    nm_id            bigint,
    barcode          text not null,
    article          text,
    product_name     text not null,
    size             text,
    qty              int not null default 1,
    order_created_at timestamptz not null,
    synced_at        timestamptz not null default now()
);

create index if not exists idx_fbs_daily_orders_report_date
    on public.fbs_daily_orders (report_date);

create index if not exists idx_fbs_daily_orders_cabinet_date
    on public.fbs_daily_orders (cabinet, report_date);

create unique index if not exists idx_fbs_daily_orders_dedup
    on public.fbs_daily_orders (report_date, marketplace, cabinet, order_id)
    where order_id is not null;

create table if not exists public.fbs_report_log (
    id           uuid primary key default gen_random_uuid(),
    report_date  date not null,
    status       text not null,
    rows_count   int not null default 0,
    cabinets     jsonb,
    errors       jsonb,
    message      text,
    created_at   timestamptz not null default now()
);

create index if not exists idx_fbs_report_log_created
    on public.fbs_report_log (created_at desc);

alter table public.fbs_active_cabinets enable row level security;
alter table public.fbs_daily_orders enable row level security;
alter table public.fbs_report_log enable row level security;

drop policy if exists "fbs_active_cabinets_deny_all" on public.fbs_active_cabinets;
create policy "fbs_active_cabinets_deny_all" on public.fbs_active_cabinets
    for all using (false) with check (false);

drop policy if exists "fbs_daily_orders_deny_all" on public.fbs_daily_orders;
create policy "fbs_daily_orders_deny_all" on public.fbs_daily_orders
    for all using (false) with check (false);

drop policy if exists "fbs_report_log_deny_all" on public.fbs_report_log;
create policy "fbs_report_log_deny_all" on public.fbs_report_log
    for all using (false) with check (false);

-- Cron: 01:00 UTC = 07:00 Бишкек. JWT подставляется при деплое агентом.
do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'daily-fbs-report-07-bishkek'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'daily-fbs-report-07-bishkek',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/daily-fbs-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
