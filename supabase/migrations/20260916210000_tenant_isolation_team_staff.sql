-- ============================================================
-- NR Space — изоляция клиентов друг от друга
--
-- Проблема: allowed_users использовался сразу для двух разных вещей —
-- «пустить на сайт» и «показать все кабинеты». admin-space activate
-- добавлял туда КАЖДОГО активированного клиента, поэтому любой клиент
-- становился сотрудником и читал кабинеты, заказы и остатки всех остальных.
--
-- Решение: сотрудники живут в отдельной таблице team_staff, и только они
-- работают с чужими кабинетами. Доступ на сайт остаётся за spaces.status.
--
-- Состав команды переносится из текущих активных allowed_users, поэтому
-- сегодняшние сотрудники доступ не теряют.
-- Safe to re-run.
-- ============================================================

create table if not exists public.team_staff (
    email text primary key,
    note text not null default '',
    created_at timestamptz not null default now()
);

alter table public.team_staff enable row level security;

drop policy if exists team_staff_super_admin on public.team_staff;
create policy team_staff_super_admin on public.team_staff for all
    using (public.is_super_admin())
    with check (public.is_super_admin());

-- Перенос текущей команды: активные пользователи из allowed_users.
insert into public.team_staff (email, note)
select lower(a.email), 'перенос из allowed_users'
from public.allowed_users a
join public.spaces s on lower(s.email) = lower(a.email)
where s.status = 'active'
on conflict (email) do nothing;

insert into public.team_staff (email, note)
values ('global.pro.1004@gmail.com', 'владелец')
on conflict (email) do nothing;

-- Сотрудник — это team_staff с активным спейсом. Заблокированный сотрудник
-- теряет доступ к данным, а не только к интерфейсу.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.team_staff t
        join public.spaces s on lower(s.email) = lower(t.email)
        where lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          and s.status = 'active'
    );
$$;

-- Политики whitelist_only_* пускали к строке любого, кто есть в allowed_users,
-- без привязки к кабинету. Владелец и сотрудник и так проходят через
-- own_cabinet() / can_access_cabinet(), поэтому политики просто снимаем.
drop policy if exists whitelist_only_cabinets on public.cabinets;
drop policy if exists whitelist_only_wb_cache on public.wb_cache;
drop policy if exists whitelist_only_wb_orders on public.wb_orders;
drop policy if exists whitelist_only_wb_stocks on public.wb_stocks;

-- У cabinets нет cabinet_id, поэтому доступ команды описываем отдельно.
drop policy if exists cabinets_team_access on public.cabinets;
create policy cabinets_team_access on public.cabinets for all
    using (public.is_team_member())
    with check (public.is_team_member());

drop policy if exists whitelist_read_sync_log on public.sync_log;
drop policy if exists sync_log_read on public.sync_log;
create policy sync_log_read on public.sync_log for select
    using (public.can_access_cabinet(cabinet_id));

-- allowed_users читал любой авторизованный, то есть весь список клиентских
-- почт был публичным. Оставляем таблицу только супер-админу.
drop policy if exists allow_read_allowed_users on public.allowed_users;
drop policy if exists auth_only_allowed_users on public.allowed_users;
drop policy if exists allowed_users_super_admin on public.allowed_users;
create policy allowed_users_super_admin on public.allowed_users for all
    using (public.is_super_admin())
    with check (public.is_super_admin());
