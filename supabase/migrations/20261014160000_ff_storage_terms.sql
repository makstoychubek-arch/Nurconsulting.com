-- Хранение у ФФ по остатку: ставка за 1 шт в сутки × остаток FBS за день, но не больше суточного лимита.
-- Действует вместо тарифа «за артикул» на дни, которые покрывает период.
create table if not exists public.ff_storage_terms (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    rate        numeric not null check (rate >= 0),
    daily_cap   numeric check (daily_cap is null or daily_cap >= 0),
    date_from   date not null,
    date_to     date,
    created_at  timestamptz not null default now()
);
create index if not exists ff_storage_terms_cab_idx on public.ff_storage_terms (cabinet_id, date_from);
alter table public.ff_storage_terms enable row level security;
drop policy if exists ff_storage_terms_sel on public.ff_storage_terms;
create policy ff_storage_terms_sel on public.ff_storage_terms for select to authenticated
    using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_storage_terms_ins on public.ff_storage_terms;
create policy ff_storage_terms_ins on public.ff_storage_terms for insert to authenticated
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_storage_terms_upd on public.ff_storage_terms;
create policy ff_storage_terms_upd on public.ff_storage_terms for update to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_storage_terms_del on public.ff_storage_terms;
create policy ff_storage_terms_del on public.ff_storage_terms for delete to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.ff_storage_terms to authenticated;
grant all on public.ff_storage_terms to service_role;

-- Как договорились: Zevina 1 (ИП Уркунбаев) — 0,40 ₽ за штуку в сутки, не больше 6000 ₽ в сутки, с 14.10.2026.
insert into public.ff_storage_terms (cabinet_id, rate, daily_cap, date_from)
select '21cffafa-bca2-4984-b5f8-5c426e6f538b', 0.40, 6000, date '2026-10-14'
where exists (select 1 from public.cabinets where id = '21cffafa-bca2-4984-b5f8-5c426e6f538b')
  and not exists (select 1 from public.ff_storage_terms where cabinet_id = '21cffafa-bca2-4984-b5f8-5c426e6f538b');
