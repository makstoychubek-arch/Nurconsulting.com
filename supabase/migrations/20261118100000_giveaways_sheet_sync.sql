-- «Раздачи» как лист Google: колонки как в таблице, постоянный номер строки, состояние обмена, привязка кабинета к листу.
-- Идемпотентно. Существующие строки не меняются.
alter table public.giveaways
    add column if not exists model          text,            -- ТОВАР
    add column if not exists requisites2    text,            -- второй «Реквизиты»
    add column if not exists payout_date    date,            -- Фактическая дата выплаты
    add column if not exists payout_planned date,            -- Планируемая дата выплаты (значение из листа)
    add column if not exists row_id         text,            -- постоянный номер строки (колонка «ID» в листе)
    add column if not exists sheet_hash     text,            -- состояние строки листа при последнем обмене
    add column if not exists synced_at      timestamptz;     -- когда строка последний раз сверена с листом

create unique index if not exists giveaways_cabinet_rowid_uidx on public.giveaways (cabinet_id, row_id) where row_id is not null;

-- Какой кабинет какой лист показывает. Только эти кабинеты обмениваются с Google.
create table if not exists public.giveaway_sheets (
    cabinet_id   uuid primary key references public.cabinets(id) on delete cascade,
    sheet_id     text not null,
    tab          text not null default 'Раздачи',
    enabled      boolean not null default true,
    last_sync_at timestamptz,
    last_error   text,
    last_stats   jsonb
);

-- Одновременные правки одной ячейки на сайте и в Google: побеждает лист, расхождение остаётся здесь.
create table if not exists public.giveaway_conflicts (
    id           bigint generated always as identity primary key,
    cabinet_id   uuid not null references public.cabinets(id) on delete cascade,
    row_id       text not null,
    fields       text[] not null,
    site_values  jsonb,
    sheet_values jsonb,
    created_at   timestamptz not null default now(),
    resolved     boolean not null default false
);
create index if not exists giveaway_conflicts_open_idx on public.giveaway_conflicts (cabinet_id, created_at desc) where not resolved;

alter table public.giveaway_sheets enable row level security;
alter table public.giveaway_conflicts enable row level security;

drop policy if exists "giveaway_sheets_staff_read" on public.giveaway_sheets;
create policy "giveaway_sheets_staff_read" on public.giveaway_sheets
    for select to authenticated using (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists "giveaway_conflicts_staff" on public.giveaway_conflicts;
create policy "giveaway_conflicts_staff" on public.giveaway_conflicts
    for all to authenticated
    using (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()))
    with check (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()));

revoke all on public.giveaway_sheets, public.giveaway_conflicts from public, anon, authenticated;
grant select on public.giveaway_sheets to authenticated;
grant select, update on public.giveaway_conflicts to authenticated;
grant all on public.giveaway_sheets, public.giveaway_conflicts to service_role;
