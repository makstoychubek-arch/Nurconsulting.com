-- Утреннее приветствие команды в тимчате (ротация стартера + hop-реакции).
-- is_active = false по умолчанию: включать вручную на нужный chat_id.

create table if not exists public.agent_morning_greetings (
    id                  uuid primary key default gen_random_uuid(),
    chat_id             bigint not null,
    is_active           boolean not null default false,
    -- порядок, кто начинает день (по кругу)
    rotation_order      text[] not null default array[
        'karina', 'saule', 'amina', 'anton', 'alina', 'muha'
    ]::text[],
    last_started_agent  text,
    last_run_on         date,
    run_hour            smallint not null default 8
        check (run_hour between 0 and 23),
    run_minute          smallint not null default 0
        check (run_minute between 0 and 59),
    timezone            text not null default 'Asia/Bishkek',
    weather_locations   text[] not null default array['Bishkek']::text[],
    note                text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create unique index if not exists agent_morning_greetings_chat_uidx
    on public.agent_morning_greetings (chat_id);

create index if not exists agent_morning_greetings_active_idx
    on public.agent_morning_greetings (is_active, run_hour, run_minute);

alter table public.agent_morning_greetings enable row level security;

drop policy if exists "agent_morning_greetings_deny" on public.agent_morning_greetings;
create policy "agent_morning_greetings_deny" on public.agent_morning_greetings
    for all using (false) with check (false);

-- pg_cron: job name agent-morning-greeting-5min, schedule */5 * * * *
-- POST https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/agent-morning-greeting-runner
-- Authorization: Bearer <service_role>
-- (как agent-ad-schedule-5min / daily-sales-report)
