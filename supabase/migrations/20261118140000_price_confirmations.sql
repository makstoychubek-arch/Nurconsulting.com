-- Коды подтверждения для крупных снижений цен (сотрудники и суперадмин). Таблица закрыта для сайта: читает и пишет только сервер.
create table if not exists public.price_confirmations (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  text        not null,
    user_id     uuid        not null,
    items_hash  text        not null,
    code_hash   text        not null,
    attempts    int         not null default 0,
    expires_at  timestamptz not null,
    used_at     timestamptz,
    created_at  timestamptz not null default now()
);
create index if not exists price_confirmations_user_idx on public.price_confirmations (user_id, created_at desc);
alter table public.price_confirmations enable row level security;
revoke all on public.price_confirmations from anon, authenticated;
