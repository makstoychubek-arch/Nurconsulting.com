-- ============================================================
-- NR Space — Advertising daily cache ("Контроль РК")
-- Задача 6: Кэширование данных рекламы
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Stores one row per (cabinet, campaign, day) so the dashboard reads
-- advertising history straight from the DB instead of calling the WB
-- Promotion API on every page open. Populated by the advertising-sync
-- edge function (manual "Обновить" button + pg_cron background job).
-- ============================================================

create table if not exists public.advertising_daily_stats (
    id            bigint generated always as identity primary key,
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    campaign_id   bigint not null,
    campaign_name text default '',
    stat_date     date not null,

    -- Metrics as returned per-day by WB's GET /adv/v3/fullstats
    views         bigint  default 0,  -- показы
    clicks        bigint  default 0,  -- клики
    ctr           numeric default 0,  -- CTR, %
    cpc           numeric default 0,  -- цена клика, ₽
    spend         numeric default 0,  -- расход за день, ₽ (WB "sum")
    atbs          bigint  default 0,  -- добавлено в корзину
    orders        bigint  default 0,  -- заказы
    cr            numeric default 0,  -- конверсия в заказ, %
    shks          bigint  default 0,  -- заказано шт.
    sum_price     numeric default 0,  -- сумма заказов, ₽

    data          jsonb,              -- raw WB day-object for this campaign+date (future-proofing)
    updated_at    timestamptz not null default now(),

    unique (cabinet_id, campaign_id, stat_date)
);

create index if not exists idx_adv_daily_cabinet_date
    on public.advertising_daily_stats (cabinet_id, stat_date desc);

create index if not exists idx_adv_daily_cabinet_campaign
    on public.advertising_daily_stats (cabinet_id, campaign_id);

alter table public.advertising_daily_stats enable row level security;

drop policy if exists "advertising_daily_stats_own" on public.advertising_daily_stats;
create policy "advertising_daily_stats_own" on public.advertising_daily_stats
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

select 'advertising_daily_stats ready' as status;
