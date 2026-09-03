-- Автобиддер v2: схема из docs/autobidder.md §§5 и 11.1.
-- Не применяет токены в таблицах — только adv_token_secret_id (Vault).
-- Существующие таблицы не меняет, кроме ALTER TABLE cabinets.

create extension if not exists pg_trgm with schema extensions;

-- 11.1: группы кабинетов — до колонки cabinets.adv_group_id
create table if not exists public.cabinet_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  adv_daily_budget_cap numeric
);

-- 11.1: колонки кабинетов (единственная существующая таблица, которую меняем)
alter table public.cabinets add column if not exists adv_token_secret_id uuid;
alter table public.cabinets add column if not exists adv_token_valid boolean default true;
alter table public.cabinets add column if not exists adv_token_checked_at timestamptz;
alter table public.cabinets add column if not exists adv_daily_budget_cap numeric;
alter table public.cabinets add column if not exists adv_group_id uuid;

create table if not exists public.user_cabinet_access (
  user_id uuid not null,
  cabinet_id uuid not null references public.cabinets(id) on delete cascade,
  role text not null check (role in ('owner', 'ads_manager', 'viewer')),
  primary key (user_id, cabinet_id)
);

create table if not exists public.adv_campaigns (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.cabinets(id),
  wb_campaign_id bigint not null,
  nm_id bigint not null,
  campaign_type text not null check (campaign_type in ('manual_bid', 'auto_bid')),
  name text,
  status text not null default 'active',
  synced_at timestamptz,
  unique (cabinet_id, wb_campaign_id)
);

create table if not exists public.adv_clusters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.adv_campaigns(id) on delete cascade,
  cluster_key text not null,
  is_active boolean default true,
  tier text default 'no_data' check (tier in ('orders', 'carts', 'impressions', 'no_data')),
  tier_updated_at timestamptz,
  unique (campaign_id, cluster_key)
);

create table if not exists public.autobidder_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  config jsonb not null
);

-- §5 + template_id из §11.1.
-- Имя занято MVP-таблицей из 20260903200000_autobidder.sql (другая схема).
-- Эти миграции её не переименовывают и не ALTER — CREATE IF NOT EXISTS
-- создаст v2-таблицу только если имени ещё нет.
create table if not exists public.autobidder_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.adv_campaigns(id) on delete cascade,
  cluster_id uuid references public.adv_clusters(id),
  strategy text not null default 'min_sufficient'
    check (strategy in ('min_sufficient', 'max_visibility', 'fixed_position', 'target_drr')),
  target_pos_from int not null default 1,
  target_pos_to int not null default 20,
  max_bid numeric,
  min_bid_floor numeric not null default 0,
  step_pct numeric not null default 0.07,
  hysteresis numeric not null default 0.03,
  outbid_step numeric not null default 1,
  organic_skip_threshold int default 5,
  target_drr_pct numeric,
  schedule jsonb,
  is_active boolean default true,
  template_id uuid references public.autobidder_templates(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bid_history (
  id bigserial primary key,
  rule_id uuid not null references public.autobidder_rules(id) on delete cascade,
  old_bid numeric,
  new_bid numeric not null,
  observed_pos int,
  organic_pos int,
  source text,
  reason text,
  applied boolean default true,
  created_at timestamptz default now()
);

create index if not exists bid_history_rule_created_idx
  on public.bid_history (rule_id, created_at desc);

create table if not exists public.serp_position_snapshots (
  id bigserial primary key,
  campaign_id uuid not null references public.adv_campaigns(id) on delete cascade,
  cluster_key text not null,
  ad_position int,
  organic_position int,
  captured_at timestamptz default now()
);

create index if not exists serp_position_snapshots_camp_cluster_idx
  on public.serp_position_snapshots (campaign_id, cluster_key, captured_at desc);

create table if not exists public.auction_snapshots (
  id bigserial primary key,
  cluster_key text not null,
  payload jsonb not null,
  captured_at timestamptz default now()
);

-- §5: cluster_key NULL = вся кампания. PRIMARY KEY (campaign_id, cluster_key, date)
-- сделал бы cluster_key NOT NULL, поэтому уникальность через NULLS NOT DISTINCT.
create table if not exists public.adv_daily_stats (
  campaign_id uuid not null references public.adv_campaigns(id) on delete cascade,
  cluster_key text,
  date date not null,
  spend numeric default 0,
  impressions int default 0,
  clicks int default 0,
  carts int default 0,
  orders int default 0,
  revenue numeric default 0
);

create unique index if not exists adv_daily_stats_campaign_cluster_date_uidx
  on public.adv_daily_stats (campaign_id, cluster_key, date) nulls not distinct;

create or replace view public.adv_daily_stats_v
with (security_invoker = true) as
select
  s.*,
  case when s.impressions > 0 then s.clicks::numeric / s.impressions else 0 end as ctr,
  case when s.clicks > 0 then s.spend / s.clicks else 0 end as cpc,
  case when s.revenue > 0 then s.spend / s.revenue else 0 end as drr
from public.adv_daily_stats s;

comment on table public.adv_campaigns is 'Кампании WB автобиддера v2 (не advertising_campaigns).';
comment on column public.cabinets.adv_token_secret_id is 'Vault secret_id токена «Продвижение», не сам токен.';
comment on column public.adv_daily_stats.cluster_key is 'NULL = статистика по всей кампании.';
