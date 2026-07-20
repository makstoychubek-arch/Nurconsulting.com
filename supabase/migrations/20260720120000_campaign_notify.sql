-- Изолированные таблицы для фоновой проверки статусов РК и баланса кабинета
-- с уведомлениями в Telegram. Ничего из существующих таблиц не меняем.

create table if not exists public.campaign_states (
    id bigint generated always as identity primary key,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    campaign_id bigint not null,
    last_status int,
    last_checked_at timestamptz not null default now(),
    unique (cabinet_id, campaign_id)
);

create table if not exists public.cabinet_balance_states (
    cabinet_id uuid primary key references public.cabinets(id) on delete cascade,
    last_balance numeric,
    last_checked_at timestamptz not null default now()
);

create table if not exists public.notification_log (
    id bigint generated always as identity primary key,
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    campaign_id bigint,
    event_type text not null,
    message_text text,
    sent_at timestamptz not null default now()
);
create index if not exists notification_log_dedup_idx
    on public.notification_log (cabinet_id, campaign_id, event_type, sent_at desc);

alter table public.campaign_states enable row level security;
alter table public.cabinet_balance_states enable row level security;
alter table public.notification_log enable row level security;

-- Эти таблицы читает/пишет только service_role (edge function по pg_cron),
-- обычным пользователям туда обращаться не нужно — политик для anon/authenticated не создаём.

select 'campaign_states / cabinet_balance_states / notification_log ready' as status;
