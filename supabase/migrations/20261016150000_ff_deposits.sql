-- Депозит у ФФ: сумма, которая лежит у фулфилмента на дату (₽). С этой даты со депозита списываются
-- отправки, хранение, подмены и отмены (штрафы WB) — остаток считает дашборд.
create table if not exists public.ff_deposits (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    ff_name     text not null,
    amount      numeric not null check (amount >= 0),   -- ₽ на дату as_of
    as_of       date not null,
    note        text,
    created_at  timestamptz not null default now()
);
create index if not exists ff_deposits_cab_idx on public.ff_deposits (cabinet_id, ff_name, as_of);
alter table public.ff_deposits enable row level security;
drop policy if exists ff_deposits_sel on public.ff_deposits;
create policy ff_deposits_sel on public.ff_deposits for select to authenticated using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_deposits_ins on public.ff_deposits;
create policy ff_deposits_ins on public.ff_deposits for insert to authenticated with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_deposits_upd on public.ff_deposits;
create policy ff_deposits_upd on public.ff_deposits for update to authenticated using (cabinet_id in (select public.current_user_cabinet_ids())) with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_deposits_del on public.ff_deposits;
create policy ff_deposits_del on public.ff_deposits for delete to authenticated using (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.ff_deposits to authenticated;
grant all on public.ff_deposits to service_role;
