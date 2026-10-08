-- РНП: заказы и продажи с разбивкой на FBO (склад WB) и FBS (склад продавца).
-- Заказы берём из wb_orders (warehouseType), продажи — из новой таблицы wb_sales (статистика WB /supplier/sales).
create table if not exists public.wb_sales (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    sale_id text not null,
    srid text,
    sale_date date not null,
    nm_id bigint,
    warehouse_type text,
    is_return boolean not null default false,
    price numeric,
    updated_at timestamptz not null default now(),
    primary key (cabinet_id, sale_id)
);
create index if not exists wb_sales_cab_date_idx on public.wb_sales (cabinet_id, sale_date);
alter table public.wb_sales enable row level security;
drop policy if exists cabinet_access on public.wb_sales;
create policy cabinet_access on public.wb_sales for select
    using (cabinet_id in (select current_user_cabinet_ids()));
revoke all on public.wb_sales from anon;
grant select on public.wb_sales to authenticated;

create or replace function public.rnp_fbs_split(p_cabinet uuid, p_from date, p_to date)
returns table (nm_id bigint, d date, orders_fbs integer, sales_fbs integer)
language sql
stable
security invoker
set search_path = public
as $$
    select x.nm_id, x.d, sum(x.o)::int orders_fbs, sum(x.s)::int sales_fbs
    from (
        select o.nm_id, o.order_date d, 1 o, 0 s
        from wb_orders o
        where o.cabinet_id = p_cabinet and o.order_date between p_from and p_to
          and not coalesce(o.is_return, false)
          and o.data->>'warehouseType' = 'Склад продавца'
        union all
        select w.nm_id, w.sale_date d, 0, 1
        from wb_sales w
        where w.cabinet_id = p_cabinet and w.sale_date between p_from and p_to
          and not w.is_return and w.warehouse_type = 'Склад продавца'
    ) x
    where x.nm_id is not null
    group by x.nm_id, x.d
$$;
revoke all on function public.rnp_fbs_split(uuid, date, date) from public, anon;
grant execute on function public.rnp_fbs_split(uuid, date, date) to authenticated, service_role;
