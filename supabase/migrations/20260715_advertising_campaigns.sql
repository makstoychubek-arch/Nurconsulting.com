-- ============================================================
-- NR Space — Advertising campaign status ("Контроль РК")
-- Задача 6 (продолжение) — карточки кабинетов + статус кампаний
--
-- WB's GET /adv/v3/fullstats (used by advertising-sync to populate
-- advertising_daily_stats) is a STATS endpoint and does not return
-- campaign status. Campaign status/type is only available from
-- GET /adv/v1/promotion/count, which advertising-sync already calls
-- (fetchCampaignIds) to enumerate campaign ids. This table stores that
-- same response's status/type per campaign so the dashboard can compute
-- "active campaigns" counts and per-cabinet status without extra WB calls.
--
-- Run once in Supabase Dashboard → SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.advertising_campaigns (
    id            uuid primary key default gen_random_uuid(),
    cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
    campaign_id   bigint not null,
    campaign_name text,
    status        smallint,   -- WB: -1 удалена, 4 готова к запуску, 7 завершена, 8 отклонена, 9 активна, 11 на паузе
    payment_type  text,       -- 'cpm' | 'cpc'
    type          smallint,   -- WB campaign type code (см. adv/v1/promotion/count группировку)
    updated_at    timestamptz not null default now(),

    unique (cabinet_id, campaign_id)
);

create index if not exists idx_advertising_campaigns_cabinet
    on public.advertising_campaigns (cabinet_id);

alter table public.advertising_campaigns enable row level security;

drop policy if exists "advertising_campaigns_own" on public.advertising_campaigns;
create policy "advertising_campaigns_own" on public.advertising_campaigns
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

select 'advertising_campaigns ready' as status;
