-- ============================================================
-- Админский холст («карта системы», как Obsidian/Miro).
--
-- Узлы: функции Supabase, cron-задачи, таблицы, функции базы, секреты (только имена),
-- внешние сервисы, боты, агенты, клиенты и кабинеты, свободные заметки.
-- Связи: кто кого вызывает, читает и пишет.
--
-- Видит и меняет ТОЛЬКО супер-админ (public.is_super_admin(): проверка в базе, не в интерфейсе).
-- Автоматические узлы (auto = true) наполняет скрипт scripts/system-map/sync.js и edge-функция
-- admin-canvas; расположение (x, y), пометки и ручные узлы и связи принадлежат владельцу и
-- повторной оцифровкой не перезаписываются. Ничего из системы эта карта не удаляет: пометка
-- «к удалению» это только отметка для решения владельца.
-- Safe to re-run.
-- ============================================================

create table if not exists public.admin_map_nodes (
    id          uuid primary key default gen_random_uuid(),
    ref         text not null unique,               -- стабильный ключ: fn:slug, cron:имя, tbl:имя, secret:ИМЯ, client:uid, note:uuid
    kind        text not null check (kind in (
        'client', 'cabinet', 'function', 'sqlfn', 'cron', 'table', 'secret',
        'service', 'bot', 'agent', 'site', 'note'
    )),
    title       text not null,
    subtitle    text,
    district    text,                               -- район карты (реклама, отзывы, РНП...)
    status      text not null default 'ok' check (status in ('ok', 'warn', 'bad', 'unused', 'unknown')),
    reasons     text[] not null default '{}',       -- почему такой статус, человеческим языком
    meta        jsonb not null default '{}'::jsonb, -- подробности для панели (без секретов и токенов!)
    x           double precision not null default 0,
    y           double precision not null default 0,
    auto        boolean not null default true,      -- false = создан владельцем руками
    hidden      boolean not null default false,
    mark        text check (mark in ('keep', 'review', 'delete')),
    mark_note   text,
    seen_at     timestamptz,                        -- когда оцифровка последний раз видела узел
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create table if not exists public.admin_map_edges (
    id          uuid primary key default gen_random_uuid(),
    source      uuid not null references public.admin_map_nodes(id) on delete cascade,
    target      uuid not null references public.admin_map_nodes(id) on delete cascade,
    kind        text not null default 'link',       -- schedules, calls, uses, reads, fk, webhook, runs, trigger, link
    label       text,
    weak        boolean not null default false,     -- слабая связь рисуется только при выборе узла
    auto        boolean not null default true,
    created_at  timestamptz not null default now(),
    unique (source, target, kind)
);

create table if not exists public.admin_map_meta (
    key         text primary key,
    value       jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

create index if not exists admin_map_nodes_kind_idx on public.admin_map_nodes (kind);
create index if not exists admin_map_edges_source_idx on public.admin_map_edges (source);
create index if not exists admin_map_edges_target_idx on public.admin_map_edges (target);

create or replace function public.admin_map_touch()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists admin_map_nodes_touch on public.admin_map_nodes;
create trigger admin_map_nodes_touch
    before update on public.admin_map_nodes
    for each row execute function public.admin_map_touch();

alter table public.admin_map_nodes enable row level security;
alter table public.admin_map_edges enable row level security;
alter table public.admin_map_meta enable row level security;

drop policy if exists "super_admin_all" on public.admin_map_nodes;
create policy "super_admin_all" on public.admin_map_nodes
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists "super_admin_all" on public.admin_map_edges;
create policy "super_admin_all" on public.admin_map_edges
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

drop policy if exists "super_admin_all" on public.admin_map_meta;
create policy "super_admin_all" on public.admin_map_meta
    for all to authenticated
    using (public.is_super_admin())
    with check (public.is_super_admin());

revoke all on public.admin_map_nodes, public.admin_map_edges, public.admin_map_meta from anon;
