-- Сторож баланса РК: ставит кампанию на паузу, когда баланс упал до порога, и снова включает в заданный час (UTC).
create table if not exists public.ad_balance_guards (
    cabinet_id      uuid not null references public.cabinets(id) on delete cascade,
    campaign_id     bigint not null,
    pause_below     integer not null,
    resume_hour_utc integer not null check (resume_hour_utc between 0 and 23),
    state           text not null default 'idle',
    state_date      date,
    active          boolean not null default true,
    primary key (cabinet_id, campaign_id)
);
alter table public.ad_balance_guards enable row level security;
drop policy if exists "cabinet_access" on public.ad_balance_guards;
create policy "cabinet_access" on public.ad_balance_guards for all to authenticated
    using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));
revoke all on public.ad_balance_guards from anon;
