-- ============================================================
-- NR Space — раздел "Кластеры" (/wb-clusters)
-- Полностью новые, изолированные таблицы. НЕ трогают существующие таблицы
-- кампаний/АБ-тестов (advertising_daily_stats, advertising_campaigns,
-- ab_tests, ab_test_variants и т.п.) — раздел "РК" остаётся без изменений.
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
-- ============================================================

-- Кэш ответов wb-clusters edge function на 3 минуты (лимиты WB
-- normquery — 3-5 запросов/сек), ключ = action:cabinet:campaign:from:to.
create table if not exists public.wb_cluster_cache (
    cache_key   text primary key,
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    payload     jsonb not null,
    fetched_at  timestamptz not null default now()
);

create index if not exists idx_wb_cluster_cache_cabinet
    on public.wb_cluster_cache (cabinet_id);

alter table public.wb_cluster_cache enable row level security;

drop policy if exists "wb_cluster_cache_own" on public.wb_cluster_cache;
create policy "wb_cluster_cache_own" on public.wb_cluster_cache
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

-- История по дням для трендов/графика на странице кластеров.
create table if not exists public.wb_cluster_stats_history (
    id             bigint generated always as identity primary key,
    cabinet_id     uuid not null references public.cabinets(id) on delete cascade,
    campaign_id    bigint not null,
    cluster_phrase text not null,
    date           date not null,

    impressions    bigint  default 0,
    clicks         bigint  default 0,
    ctr            numeric default 0,
    spend          numeric default 0,
    orders         bigint  default 0,

    created_at     timestamptz not null default now(),

    unique (cabinet_id, campaign_id, cluster_phrase, date)
);

create index if not exists idx_wb_cluster_history_cabinet_campaign
    on public.wb_cluster_stats_history (cabinet_id, campaign_id, date desc);

alter table public.wb_cluster_stats_history enable row level security;

drop policy if exists "wb_cluster_stats_history_own" on public.wb_cluster_stats_history;
create policy "wb_cluster_stats_history_own" on public.wb_cluster_stats_history
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

select 'wb_clusters tables ready' as status;
