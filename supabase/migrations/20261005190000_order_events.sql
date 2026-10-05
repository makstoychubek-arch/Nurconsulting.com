-- ============================================================
-- События новых заказов FBS для звукового сигнала на сайте.
--
-- Edge-функция orders-watch раз в несколько секунд читает у WB метод «новые заказы» (marketplace-api
-- /api/v3/orders/new) по кабинетам команды и записывает каждый заказ один раз (уникально по кабинету и
-- номеру заказа). Сайт подписан на вставки через Realtime и играет звук для выбранных артикулов.
--
-- silent = true: первая загрузка кабинета (уже висящие «новые» заказы) — без звука, чтобы не было залпа.
-- Видят таблицу только сотрудники команды (is_staff) и только по своим кабинетам; писать может только сервер.
-- Safe to re-run.
-- ============================================================

create table if not exists public.order_events (
    id          bigint generated always as identity primary key,
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    ext_id      text not null,
    nm_id       bigint,
    article     text,
    order_at    timestamptz,
    silent      boolean not null default false,
    created_at  timestamptz not null default now(),
    unique (cabinet_id, ext_id)
);

create index if not exists order_events_cabinet_created_idx on public.order_events (cabinet_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists "order_events_staff_read" on public.order_events;
create policy "order_events_staff_read" on public.order_events
    for select to authenticated
    using (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()));

revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;

-- Realtime: вставки доезжают до открытых страниц.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events'
    ) then
        alter publication supabase_realtime add table public.order_events;
    end if;
end $$;
