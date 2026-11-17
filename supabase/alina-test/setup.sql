-- Схема ТОЛЬКО для отдельного тестового проекта Supabase. В рабочий проект не применять.
-- Таблица заявок: то же, что дают миграции 20261117152500, 20261117160000 и 20261117180000.
create table if not exists public.alina_manager_questions (
  group_id bigint not null,
  group_message_id bigint not null,
  client_chat_id bigint not null,
  business_connection_id text not null,
  delivery_state text not null default 'pending'
    constraint alina_manager_questions_delivery_state_check
    check (delivery_state in ('pending', 'sending', 'sent', 'unconfirmed')),
  created_at timestamptz not null default now(),
  client_login text,
  group_text text,
  reminded_at timestamptz,
  answered_by bigint,
  answered_by_name text,
  primary key (group_id, group_message_id)
);
-- Пустая заглушка: тестовый вход читает токен из секрета функции, если здесь строки нет.
create table if not exists public.telegram_bot_secrets (bot_id text primary key, token text);
-- Один update_id обрабатывается один раз.
create table if not exists public.alina_test_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);
alter table public.alina_manager_questions enable row level security;
alter table public.telegram_bot_secrets enable row level security;
alter table public.alina_test_updates enable row level security;
revoke all on public.alina_manager_questions, public.telegram_bot_secrets, public.alina_test_updates from public, anon, authenticated;
grant select, insert, update on public.alina_manager_questions to service_role;
grant select on public.telegram_bot_secrets to service_role;
grant select, insert on public.alina_test_updates to service_role;
