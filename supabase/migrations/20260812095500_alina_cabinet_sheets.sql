-- Таблицы раздач по кабинетам (у каждого кабинета свой Google Sheet).

create table if not exists public.alina_cabinet_sheets (
  id           uuid primary key default gen_random_uuid(),
  cabinet_key  text not null unique,  -- elium | baza | saai | zevina1 ...
  cabinet_name text,
  sheet_id     text not null,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.alina_cabinet_sheets enable row level security;
drop policy if exists "alina_cabinet_sheets_deny" on public.alina_cabinet_sheets;
create policy "alina_cabinet_sheets_deny" on public.alina_cabinet_sheets
  for all using (false) with check (false);

-- Текущий активный кабинет для ответов клиентам (один «сейчас в раздаче»)
alter table public.alina_campaign
  add column if not exists cabinet_key text,
  add column if not exists sheet_id text;

-- Уже известная таблица Elium (можно выключить, когда смените на новую)
insert into public.alina_cabinet_sheets (cabinet_key, cabinet_name, sheet_id, is_active, notes)
values (
  'elium',
  'Elium',
  '1xPfL_KIhaHqBYehuC3DN-AHY40ull5yc8gW5Y4ylIhE',
  true,
  'Кэшбэки / Выкупы Элиум'
)
on conflict (cabinet_key) do update set
  sheet_id = excluded.sheet_id,
  updated_at = now();
