-- ============================================================
-- NR Space SaaS — indexes, multi-tenancy helpers, A/B tests v2
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ============================================================

-- ── Performance indexes (RNP financial queries) ───────────────
create index if not exists idx_wb_orders_cab_date_nm
    on wb_orders (cabinet_id, order_date desc, nm_id);

create index if not exists idx_wb_orders_cab_nm_date
    on wb_orders (cabinet_id, nm_id, order_date desc);

create index if not exists idx_rnp_daily_cab_date_nm
    on rnp_daily_data (cabinet_id, date desc, nm_id);

create index if not exists idx_rnp_daily_cab_nm_date
    on rnp_daily_data (cabinet_id, nm_id, date desc);

create index if not exists idx_wb_stocks_cab_nm
    on wb_stocks (cabinet_id, nm_id);

create index if not exists idx_rnp_articles_cab_active
    on rnp_articles (cabinet_id, is_active, nm_id);

-- ── Tenant isolation helper ───────────────────────────────────
create or replace function public.current_user_cabinet_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
    select id from cabinets where user_id = auth.uid();
$$;

create or replace function public.assert_cabinet_access(p_cabinet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from cabinets
        where id = p_cabinet_id and user_id = auth.uid()
    );
$$;

-- ── A/B tests v2 (ads + content) ──────────────────────────────
create table if not exists ab_experiments (
    id                  uuid primary key default gen_random_uuid(),
    cabinet_id          uuid not null references cabinets(id) on delete cascade,
    nm_id               bigint not null,
    product_name        text default '',
    test_type           text not null check (test_type in ('ad_cpm', 'content_photo')),
    status              text not null default 'draft'
                        check (status in ('draft', 'running', 'paused', 'finished')),
    -- Ad test config
    period_a_days       int default 3,
    period_b_days       int default 3,
    cpm_a               numeric,
    cpm_b               numeric,
    advert_id           bigint,
    -- Content test config
    photo_index_a       int default 1,
    photo_index_b       int default 2,
    -- Results summary (computed)
    winner              text check (winner in ('a', 'b', 'tie', null)),
    delta_profit_pct    numeric,
    delta_cpo_pct       numeric,
    notes               text default '',
    created_at          timestamptz default now(),
    updated_at          timestamptz default now(),
    started_at          timestamptz,
    finished_at         timestamptz
);

create index if not exists idx_ab_experiments_cab_status
    on ab_experiments (cabinet_id, status, created_at desc);

create index if not exists idx_ab_experiments_cab_nm
    on ab_experiments (cabinet_id, nm_id);

create table if not exists ab_experiment_periods (
    id                  uuid primary key default gen_random_uuid(),
    experiment_id       uuid not null references ab_experiments(id) on delete cascade,
    period_label        text not null check (period_label in ('a', 'b')),
    date_from           date not null,
    date_to             date not null,
    -- Metrics snapshot
    ad_spend            numeric default 0,
    impressions         bigint default 0,
    clicks              int default 0,
    ctr_pct             numeric default 0,
    orders              int default 0,
    sales_sum           numeric default 0,
    profit              numeric default 0,
    cpo                 numeric default 0,
    photo_url           text default '',
    config_json         jsonb default '{}',
    created_at          timestamptz default now(),
    unique (experiment_id, period_label)
);

create index if not exists idx_ab_periods_experiment
    on ab_experiment_periods (experiment_id, period_label);

alter table ab_experiments enable row level security;
alter table ab_experiment_periods enable row level security;

drop policy if exists "ab_experiments_own" on ab_experiments;
create policy "ab_experiments_own" on ab_experiments
    for all using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

drop policy if exists "ab_periods_own" on ab_experiment_periods;
create policy "ab_periods_own" on ab_experiment_periods
    for all using (
        experiment_id in (
            select id from ab_experiments
            where cabinet_id in (select public.current_user_cabinet_ids())
        )
    )
    with check (
        experiment_id in (
            select id from ab_experiments
            where cabinet_id in (select public.current_user_cabinet_ids())
        )
    );

-- Legacy photo rotation tables (keep compatible)
create table if not exists ab_tests (
    id                      bigint generated always as identity primary key,
    cabinet_id              text not null,
    nm_id                   bigint not null,
    product_name            text default '',
    status                  text default 'active',
    rotation_interval_min   int default 60,
    max_rotations           int default 10,
    current_variant_index   int default 0,
    rotation_count          int default 0,
    started_at              timestamptz,
    last_rotated_at         timestamptz,
    finished_at             timestamptz,
    created_at              timestamptz default now()
);

create index if not exists idx_ab_tests_cab_status
    on ab_tests (cabinet_id, status);

select 'SaaS indexes + A/B v2 ready' as status;
