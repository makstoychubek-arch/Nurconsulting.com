-- Ozon: точные начисления по каждому отправлению (новый метод /v1/finance/accrual/postings; старый /v3/finance/transaction/list отключён 8.09.2026).
-- Одна строка = одно начисление: тип (комиссия, логистика, эквайринг, подписка…), дата, сумма в рублях, цена продавца, sku, штуки.
create table if not exists public.ozon_accrual_types (
    id int primary key,
    name text not null,
    description text,
    synced_at timestamptz not null default now()
);
alter table public.ozon_accrual_types enable row level security;
drop policy if exists ozon_accrual_types_read on public.ozon_accrual_types;
create policy ozon_accrual_types_read on public.ozon_accrual_types for select to authenticated using (true);

create table if not exists public.ozon_accruals (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    posting_number text not null,
    ord int not null,                -- порядковый номер начисления внутри отправления (одинаковые типы бывают по несколько раз)
    type_id int not null,
    accrual_date date,
    sku bigint,
    quantity numeric not null default 1,
    amount numeric not null default 0,        -- начислено, ₽ (расход со знаком «минус»)
    seller_price numeric,                      -- цена продавца в начислении за продажу/возврат (у остальных пусто)
    currency text,
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, posting_number, ord)
);
create index if not exists ozon_accruals_date_idx on public.ozon_accruals (cabinet_id, accrual_date);
create index if not exists ozon_accruals_type_idx on public.ozon_accruals (cabinet_id, type_id);
alter table public.ozon_accruals enable row level security;
drop policy if exists ozon_accruals_read on public.ozon_accruals;
create policy ozon_accruals_read on public.ozon_accruals for select to authenticated using (public.can_view_cabinet(cabinet_id::text));
