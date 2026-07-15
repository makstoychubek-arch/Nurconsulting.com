-- ============================================================
-- NR Space — RNP planning ("Планирование")
-- Задача 3: Планирование и автоматическая интеграция в РНП
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Dedicated normalized table (not jsonb-per-article) so planning scales to
-- large article/date volumes and edits stay fast: one narrow row per
-- cabinet+article+day, upserted in bulk from the "Планирование" tab, and
-- read straight by rnp-module.js (RNP) to compute plan_orders_pct /
-- plan_sales_pct / plan_fulfillment_pct — no manual copy step between the
-- two screens. Superseses the old per-article `manual_data.plans` jsonb
-- blob that rnp_articles used for the same purpose.
--
-- Orders and sales get separate plan columns because RNP already tracks
-- them as separate % metrics (plan_orders_pct vs plan_sales_pct). The
-- other three legacy plan metrics from RNP (показы/клики/ДРР/расход РК)
-- get their own columns too, so nothing that already worked is lost.
-- ============================================================

create table if not exists public.rnp_plans (
    id                    bigint generated always as identity primary key,
    cabinet_id            uuid not null references public.cabinets(id) on delete cascade,
    nm_id                 bigint not null,
    plan_date             date not null,

    planned_orders        numeric,  -- План заказов, шт
    planned_sales         numeric,  -- План продаж, шт
    planned_impressions   numeric,  -- План показов
    planned_clicks        numeric,  -- План кликов из РК
    planned_drr           numeric,  -- ДРР % план
    planned_ad_spend      numeric,  -- Расход РК план, ₽

    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),

    unique (cabinet_id, nm_id, plan_date)
);

create index if not exists idx_rnp_plans_cabinet_date
    on public.rnp_plans (cabinet_id, plan_date);

create index if not exists idx_rnp_plans_cabinet_nm
    on public.rnp_plans (cabinet_id, nm_id);

alter table public.rnp_plans enable row level security;

drop policy if exists "rnp_plans_own" on public.rnp_plans;
create policy "rnp_plans_own" on public.rnp_plans
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

select 'rnp_plans ready' as status;
