-- Актуальные остатки FBO / FBS на дашборде.
-- FBO = склады WB (Analytics wb-warehouses).
-- FBS = склады продавца (Marketplace /api/v3/stocks).
-- Старые строки без схемы считаем FBO — так их и писал старый синк.

alter table public.wb_stocks
    add column if not exists stock_scheme text not null default 'fbo';

update public.wb_stocks
    set stock_scheme = 'fbo'
    where stock_scheme is null or stock_scheme = '';

create index if not exists wb_stocks_cab_scheme_idx
    on public.wb_stocks (cabinet_id, stock_scheme);

create or replace function public.dashboard_summary(
    p_cabinet_id uuid,
    p_from date,
    p_to date,
    p_prev_from date,
    p_prev_to date
) returns jsonb
language sql
stable
as $$
    select jsonb_build_object(
        'stock_total', coalesce((
            select sum(quantity) from public.wb_stocks where cabinet_id = p_cabinet_id
        ), 0),
        'stock_fbo', coalesce((
            select sum(quantity) from public.wb_stocks
            where cabinet_id = p_cabinet_id
              and coalesce(nullif(stock_scheme, ''), 'fbo') = 'fbo'
        ), 0),
        'stock_fbs', coalesce((
            select sum(quantity) from public.wb_stocks
            where cabinet_id = p_cabinet_id
              and stock_scheme = 'fbs'
        ), 0),
        'stock_by_warehouse', coalesce((
            select jsonb_agg(jsonb_build_object(
                'warehouse_name', warehouse_name,
                'qty', qty,
                'scheme', scheme
            ))
            from (
                select
                    coalesce(warehouse_name, 'Неизвестно') as warehouse_name,
                    coalesce(nullif(stock_scheme, ''), 'fbo') as scheme,
                    sum(quantity) as qty
                from public.wb_stocks
                where cabinet_id = p_cabinet_id
                group by 1, 2
                order by 3 desc
            ) w
        ), '[]'::jsonb),
        'cur', jsonb_build_object(
            'orders_count', coalesce((
                select count(*) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_from and order_date <= p_to and not is_return
            ), 0),
            'orders_sum', coalesce((
                select sum(price) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_from and order_date <= p_to and not is_return
            ), 0),
            'returns_count', coalesce((
                select count(*) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_from and order_date <= p_to and is_return
            ), 0)
        ),
        'prev', jsonb_build_object(
            'orders_count', coalesce((
                select count(*) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_prev_from and order_date <= p_prev_to and not is_return
            ), 0),
            'orders_sum', coalesce((
                select sum(price) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_prev_from and order_date <= p_prev_to and not is_return
            ), 0),
            'returns_count', coalesce((
                select count(*) from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_prev_from and order_date <= p_prev_to and is_return
            ), 0)
        ),
        'cur_daily', coalesce((
            select jsonb_agg(jsonb_build_object('date', d, 'sum', s, 'count', c, 'returns', r) order by d)
            from (
                select order_date as d,
                       sum(price) filter (where not is_return) as s,
                       count(*) filter (where not is_return) as c,
                       count(*) filter (where is_return) as r
                from public.wb_orders
                where cabinet_id = p_cabinet_id and order_date >= p_from and order_date <= p_to
                group by order_date
            ) day_rows
        ), '[]'::jsonb)
    );
$$;

grant execute on function public.dashboard_summary(uuid, date, date, date, date) to authenticated;

select 'wb_stocks FBO/FBS + dashboard_summary ready' as status;
