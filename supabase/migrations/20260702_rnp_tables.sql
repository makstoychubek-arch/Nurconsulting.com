-- ============================================================
-- NR Space — RNP Module tables
-- Run once in Supabase Dashboard → SQL Editor
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS
-- ============================================================

-- ── 1. rnp_settings ─────────────────────────────────────────
create table if not exists rnp_settings (
    id                    bigint generated always as identity primary key,
    cabinet_id            text not null unique,
    exchange_rate         numeric default 13.5,
    calc_period           int    default 7,
    promotion_api_token   text   default '',
    updated_at            timestamptz default now()
);

alter table rnp_settings enable row level security;

drop policy if exists "rnp_settings_own" on rnp_settings;
create policy "rnp_settings_own" on rnp_settings
    using (
        cabinet_id::uuid in (
            select id from cabinets where user_id = auth.uid()
        )
    );

-- ── 2. rnp_articles ─────────────────────────────────────────
create table if not exists rnp_articles (
    id          bigint generated always as identity primary key,
    cabinet_id  text    not null,
    nm_id       bigint  not null,
    name        text    default '',
    photo_url   text    default '',
    is_active   boolean default false,
    cost_price  numeric default 0,
    manual_data jsonb   default '{}',
    created_at  timestamptz default now(),
    unique (cabinet_id, nm_id)
);

alter table rnp_articles enable row level security;

drop policy if exists "rnp_articles_own" on rnp_articles;
create policy "rnp_articles_own" on rnp_articles
    using (
        cabinet_id::uuid in (
            select id from cabinets where user_id = auth.uid()
        )
    );

-- ── 3. rnp_daily_data ───────────────────────────────────────
create table if not exists rnp_daily_data (
    id                  bigint generated always as identity primary key,
    cabinet_id          text   not null,
    nm_id               bigint not null,
    date                date   not null,

    -- Orders (from wb_orders)
    orders_count        int     default 0,
    orders_sum          numeric default 0,
    avg_check           numeric default 0,

    -- Stocks
    stock_warehouse     int     default 0,
    stock_transit       int     default 0,
    stock_total         int     default 0,

    -- Sales & returns (from finance report)
    sales_count         int     default 0,
    sales_sum           numeric default 0,
    returns_count       int     default 0,
    buyout_pct          numeric default 0,
    return_pct          numeric default 0,

    -- Finance
    to_transfer         numeric default 0,
    to_transfer_unit    numeric default 0,
    logistics_per_unit  numeric default 0,
    logistics_pct       numeric default 0,
    storage_sum         numeric default 0,
    storage_pct         numeric default 0,
    commission_pct      numeric default 0,

    -- Advertising (from Promotion API)
    ad_impressions      bigint  default 0,
    ad_clicks           int     default 0,
    ad_ctr              numeric default 0,
    ad_spend            numeric default 0,
    ad_cpc              numeric default 0,
    ad_orders           int     default 0,
    ad_basket           int     default 0,
    ad_cro              numeric default 0,

    updated_at          timestamptz default now(),

    unique (cabinet_id, nm_id, date)
);

alter table rnp_daily_data enable row level security;

drop policy if exists "rnp_daily_data_own" on rnp_daily_data;
create policy "rnp_daily_data_own" on rnp_daily_data
    using (
        cabinet_id::uuid in (
            select id from cabinets where user_id = auth.uid()
        )
    );

-- ── 4. Funnel columns (Analytics API) ───────────────────────
alter table rnp_daily_data add column if not exists spp_pct numeric default 0;
alter table rnp_daily_data add column if not exists impressions bigint default 0;
alter table rnp_daily_data add column if not exists clicks int default 0;
alter table rnp_daily_data add column if not exists ctr_pct numeric default 0;
alter table rnp_daily_data add column if not exists basket_count int default 0;
alter table rnp_daily_data add column if not exists basket_pct numeric default 0;
alter table rnp_daily_data add column if not exists funnel_order_conv numeric default 0;

-- Stock by size support
alter table wb_stocks add column if not exists tech_size text default '';

-- ── 5. Date notes (with history) ───────────────────────────
create table if not exists rnp_date_notes (
    id          bigint generated always as identity primary key,
    cabinet_id  text not null,
    nm_id       bigint not null,
    note_date   date not null,
    note        text not null default '',
    author      text default '',
    created_at  timestamptz default now()
);

create index if not exists rnp_date_notes_lookup
    on rnp_date_notes (cabinet_id, nm_id, note_date desc);

alter table rnp_date_notes enable row level security;

drop policy if exists "rnp_date_notes_own" on rnp_date_notes;
create policy "rnp_date_notes_own" on rnp_date_notes
    using (
        cabinet_id::uuid in (
            select id from cabinets where user_id = auth.uid()
        )
    );

-- ── Done ────────────────────────────────────────────────────
select 'RNP tables ready' as status;
