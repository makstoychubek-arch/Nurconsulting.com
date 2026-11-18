-- Ключи интеграций, которыми управляют из «Настройки → Боты и ключи» (ключ OpenAI, сервисный аккаунт Google).
-- Читает только сервис (service_role), с сайта значения не видны никому: наружу уходит только маска и метаданные.
-- Токены Telegram-ботов лежат в telegram_bot_secrets. Если значения в таблице нет, действует переменная окружения.
create table if not exists public.integration_secrets (
    key         text primary key,
    value       text not null,
    meta        jsonb not null default '{}'::jsonb,
    updated_by  uuid,
    updated_at  timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from public, anon, authenticated;
grant all on public.integration_secrets to service_role;
