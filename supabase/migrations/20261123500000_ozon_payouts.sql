-- Выплаты Ozon (вносятся вручную в РНП, строка «Выплата Ozon» в блоке «Баланс Ozon»): дата отправки выплаты и сумма в сомах.
create table if not exists public.ozon_payouts (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    d date not null,
    amount numeric not null default 0,
    updated_at timestamptz not null default now(),
    primary key (cabinet_id, d)
);
alter table public.ozon_payouts enable row level security;
drop policy if exists ozon_payouts_read on public.ozon_payouts;
create policy ozon_payouts_read on public.ozon_payouts for select to authenticated using (public.can_view_cabinet(cabinet_id::text));
drop policy if exists ozon_payouts_write on public.ozon_payouts;
create policy ozon_payouts_write on public.ozon_payouts for all to authenticated
    using (cabinet_id in (select id from public.cabinets where user_id = auth.uid()) or public.is_super_admin())
    with check (cabinet_id in (select id from public.cabinets where user_id = auth.uid()) or public.is_super_admin());
