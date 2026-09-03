-- Автобиддер: правила и журнал ставок WB в разделе «Контроль РК».

alter table public.advertising_campaigns
  add column if not exists current_bids jsonb;

create table if not exists public.autobidder_rules (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.cabinets(id) on delete cascade,
  campaign_id bigint not null,
  enabled boolean not null default false,
  target_metric text not null default 'drr'
    check (target_metric in ('drr', 'ctr', 'cpc')),
  target_value numeric not null check (target_value > 0),
  min_bid_kopecks integer not null default 500 check (min_bid_kopecks >= 100),
  max_bid_kopecks integer not null default 15000 check (max_bid_kopecks >= 100),
  constraint autobidder_rules_bid_range check (min_bid_kopecks < max_bid_kopecks),
  step_kopecks integer not null default 50 check (step_kopecks >= 10),
  interval_minutes integer not null default 60 check (interval_minutes >= 15),
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cabinet_id, campaign_id)
);

create index if not exists autobidder_rules_cabinet_idx
  on public.autobidder_rules (cabinet_id, enabled);

create table if not exists public.autobidder_log (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.cabinets(id) on delete cascade,
  campaign_id bigint not null,
  rule_id uuid references public.autobidder_rules(id) on delete set null,
  action text not null,
  metric text,
  metric_value numeric,
  target_value numeric,
  old_bid_kopecks integer,
  new_bid_kopecks integer,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists autobidder_log_campaign_idx
  on public.autobidder_log (cabinet_id, campaign_id, created_at desc);

alter table public.autobidder_rules enable row level security;
alter table public.autobidder_log enable row level security;

drop policy if exists "autobidder_rules_all" on public.autobidder_rules;
create policy "autobidder_rules_all" on public.autobidder_rules
  for all to authenticated
  using (public.can_access_cabinet(cabinet_id))
  with check (public.can_access_cabinet(cabinet_id));

drop policy if exists "autobidder_log_select" on public.autobidder_log;
create policy "autobidder_log_select" on public.autobidder_log
  for select to authenticated
  using (public.can_access_cabinet(cabinet_id));

drop policy if exists "autobidder_log_insert" on public.autobidder_log;
create policy "autobidder_log_insert" on public.autobidder_log
  for insert to authenticated
  with check (public.can_access_cabinet(cabinet_id));

grant select, insert, update, delete on public.autobidder_rules to authenticated;
grant select, insert on public.autobidder_log to authenticated;
grant all on public.autobidder_rules to service_role;
grant all on public.autobidder_log to service_role;

comment on table public.autobidder_rules is
  'Правила автобиддера WB: целевая метрика и коридор ставки в копейках.';
comment on table public.autobidder_log is
  'Журнал изменений ставок автобиддером.';
