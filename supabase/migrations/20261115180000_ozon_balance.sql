-- Баланс Ozon по дням: /v1/finance/balance (closing_balance на конец периода). Заполняет ozon-sync (часть balance).
create table if not exists public.ozon_balance_daily (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    d date not null,
    closing numeric not null default 0,
    opening numeric not null default 0,
    currency text not null default 'RUB',
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, d)
);
alter table public.ozon_balance_daily enable row level security;
drop policy if exists ozon_balance_daily_read on public.ozon_balance_daily;
create policy ozon_balance_daily_read on public.ozon_balance_daily for select to authenticated using (public.can_view_cabinet(cabinet_id::text));
