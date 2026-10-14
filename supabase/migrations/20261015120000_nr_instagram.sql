-- Собственный Instagram NR Space (одна запись). Не привязан к кабинетам; доступ только через edge-функцию nr-ig-admin (service role).
create table if not exists public.nr_instagram (
    id boolean primary key default true check (id),
    ig_user_id text,
    page_id text,
    ig_username text,
    token_secret_id uuid,
    token_set_at timestamptz,
    settings jsonb not null default '{}'::jsonb,
    verified_at timestamptz,
    verify_error text,
    updated_at timestamptz not null default now()
);
alter table public.nr_instagram enable row level security;
revoke all on public.nr_instagram from anon, authenticated;
