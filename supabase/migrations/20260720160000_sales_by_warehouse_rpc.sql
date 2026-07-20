-- Подраздел "Продажи по складам" в разделе "Логистика" (вынесен из BETA
-- в левую полку). Считает продажи/возвраты по складу отправки одним
-- SQL-запросом (агрегат на стороне базы, без выгрузки сырых wb_orders на
-- клиент — тот же подход, что и в dashboard_summary).
create or replace function public.sales_by_warehouse(
    p_cabinet_id uuid,
    p_from date,
    p_to date
) returns jsonb
language sql
stable
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'warehouse_name', warehouse_name,
        'orders_count', orders_count,
        'orders_sum', orders_sum,
        'returns_count', returns_count
    ) order by orders_sum desc), '[]'::jsonb)
    from (
        select coalesce(data->>'warehouseName', 'Неизвестно') as warehouse_name,
               count(*) filter (where not is_return) as orders_count,
               coalesce(sum(price) filter (where not is_return), 0) as orders_sum,
               count(*) filter (where is_return) as returns_count
        from public.wb_orders
        where cabinet_id = p_cabinet_id and order_date >= p_from and order_date <= p_to
        group by 1
    ) t;
$$;

grant execute on function public.sales_by_warehouse(uuid, date, date) to authenticated;

select 'sales_by_warehouse RPC ready' as status;
