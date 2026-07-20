-- Детальный отчёт по А/Б-тестам: точный лог окон показа каждого варианта
-- (started_at/ended_at) + персистентные агрегаты по варианту/источнику
-- (реклама/воронка), плюс поддержка уведомления в Telegram-канал по
-- завершении теста (test_id в notification_log, отдельный event_type).
-- Ничего из существующих таблиц не меняем, кроме одного nullable-столбца.

create table if not exists public.ab_test_rotations (
    id bigint generated always as identity primary key,
    test_id uuid not null references public.ab_tests(id) on delete cascade,
    variant_id uuid references public.ab_test_variants(id) on delete cascade,
    variant_label text not null,
    started_at timestamptz not null,
    ended_at timestamptz
);
create index if not exists ab_test_rotations_test_idx on public.ab_test_rotations (test_id, started_at);
create index if not exists ab_test_rotations_open_idx on public.ab_test_rotations (test_id) where ended_at is null;

create table if not exists public.ab_test_variant_stats (
    id bigint generated always as identity primary key,
    test_id uuid not null references public.ab_tests(id) on delete cascade,
    variant_id uuid not null references public.ab_test_variants(id) on delete cascade,
    source text not null check (source in ('ads', 'funnel')),
    impressions bigint default 0,
    clicks bigint default 0,
    ctr numeric default 0,
    cr numeric default 0,
    orders bigint default 0,
    cart_adds bigint default 0,
    spend numeric default 0,
    updated_at timestamptz not null default now(),
    unique (test_id, variant_id, source)
);

alter table public.ab_test_rotations enable row level security;
alter table public.ab_test_variant_stats enable row level security;

alter table public.notification_log add column if not exists test_id uuid references public.ab_tests(id) on delete cascade;

select 'ab_test_rotations / ab_test_variant_stats ready' as status;
