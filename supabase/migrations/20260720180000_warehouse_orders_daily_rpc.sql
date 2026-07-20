-- Детализация склада в "Продажи по складам": заказы/возвраты по дням для
-- одного склада отправки. Открывается кликом по строке склада. Агрегат
-- целиком на стороне базы (как sales_by_warehouse).
create or replace function public.warehouse_orders_daily(
    p_cabinet_id uuid,
    p_warehouse text,
    p_from date,
    p_to date
) returns jsonb
language sql
stable
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'date', d,
        'orders_count', orders_count,
        'orders_sum', orders_sum,
        'returns_count', returns_count
    ) order by d), '[]'::jsonb)
    from (
        select order_date as d,
               count(*) filter (where not is_return) as orders_count,
               coalesce(sum(price) filter (where not is_return), 0) as orders_sum,
               count(*) filter (where is_return) as returns_count
        from public.wb_orders
        where cabinet_id = p_cabinet_id
          and order_date >= p_from and order_date <= p_to
          and coalesce(data->>'warehouseName', 'Неизвестно') = p_warehouse
        group by order_date
    ) t;
$$;

grant execute on function public.warehouse_orders_daily(uuid, text, date, date) to authenticated;

select 'warehouse_orders_daily RPC ready' as status;
