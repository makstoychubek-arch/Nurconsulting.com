-- Ежедневный автозапуск/пауза РК по расписанию (Амина в тимчате).

create table if not exists public.agent_ad_schedules (
    id              uuid primary key default gen_random_uuid(),
    chat_id         bigint not null,
    agent_key       text not null default 'amina',
    action_type     text not null default 'advert_start',
    -- advert_start | advert_pause
    cabinet_id      uuid not null references public.cabinets(id) on delete cascade,
    cabinet_name    text,
    campaign_ids    bigint[] not null default '{}',
    campaign_names  text[] not null default '{}',
    run_hour        smallint not null check (run_hour between 0 and 23),
    run_minute      smallint not null check (run_minute between 0 and 59),
    timezone        text not null default 'Asia/Bishkek',
    is_active       boolean not null default true,
    last_run_on     date,
    created_by_tg   bigint,
    note            text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists agent_ad_schedules_active_idx
    on public.agent_ad_schedules (is_active, run_hour, run_minute);

create index if not exists agent_ad_schedules_chat_idx
    on public.agent_ad_schedules (chat_id, is_active);

alter table public.agent_ad_schedules enable row level security;

drop policy if exists "agent_ad_schedules_deny" on public.agent_ad_schedules;
create policy "agent_ad_schedules_deny" on public.agent_ad_schedules
    for all using (false) with check (false);

-- pg_cron: см. apply через Dashboard или скрипт с service_role
-- (как check-campaigns-notify-10min). Job name: agent-ad-schedule-5min
-- schedule: */5 * * * *
-- POST /functions/v1/agent-ad-schedule-runner
