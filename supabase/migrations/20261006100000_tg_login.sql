-- Вход и регистрация через Telegram (бот Акылай присылает код, сайт проверяет его в функции tg-login).
create table if not exists public.tg_login_tokens (
    id           uuid primary key default gen_random_uuid(),
    token_hash   text not null unique,
    code_hash    text,
    tg_id        bigint,
    tg_username  text,
    tg_name      text,
    attempts     integer not null default 0,
    status       text not null default 'pending',      -- pending → code_sent → used
    created_at   timestamptz not null default now(),
    code_sent_at timestamptz
);
create index if not exists tg_login_tokens_created_idx on public.tg_login_tokens (created_at);

create table if not exists public.tg_identities (
    tg_id       bigint primary key,
    user_id     uuid not null references auth.users(id) on delete cascade,
    username    text,
    full_name   text,
    created_at  timestamptz not null default now(),
    last_login  timestamptz
);
create unique index if not exists tg_identities_user_idx on public.tg_identities (user_id);

-- Только сервер (service role): клиентам обе таблицы недоступны.
alter table public.tg_login_tokens enable row level security;
alter table public.tg_identities enable row level security;
revoke all on public.tg_login_tokens from anon, authenticated;
revoke all on public.tg_identities from anon, authenticated;
