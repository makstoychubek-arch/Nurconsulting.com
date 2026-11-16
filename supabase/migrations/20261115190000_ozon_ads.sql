-- Реклама Ozon (Performance API): ключ рекламного кабинета и дневная статистика кампаний.
-- Секрет читается только edge-функциями (service role), браузер видит client_id и признак ozon_perf_set.
alter table public.cabinets
  add column if not exists ozon_perf_client_id text,
  add column if not exists ozon_perf_secret text,
  add column if not exists ozon_perf_set boolean generated always as (coalesce(length(ozon_perf_secret), 0) > 0) stored;
grant select (ozon_perf_client_id, ozon_perf_set) on public.cabinets to authenticated;

create table if not exists public.ozon_ads_daily (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    d date not null,
    campaign_id text not null,
    title text,
    impressions numeric not null default 0,
    clicks numeric not null default 0,
    spend numeric not null default 0,
    orders numeric not null default 0,
    orders_sum numeric not null default 0,
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, d, campaign_id)
);
alter table public.ozon_ads_daily enable row level security;
drop policy if exists ozon_ads_daily_read on public.ozon_ads_daily;
create policy ozon_ads_daily_read on public.ozon_ads_daily for select to authenticated using (public.can_view_cabinet(cabinet_id::text));
