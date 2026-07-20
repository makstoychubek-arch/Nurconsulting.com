-- Оптимизация производительности главного дашборда/страницы "РК":
-- loadFromDB() раньше тянул ВСЕ строки wb_orders (за период + предыдущий
-- период) и ВСЕ строки wb_stocks постраничными кусками по 1000 (через
-- fetchAllRows), чтобы на клиенте просуммировать буквально несколько чисел
-- (сумма/кол-во заказов, сумма остатков, разбивка по складам). Это давало
-- десятки отдельных HTTP-запросов и тысячи сырых строк ради пары агрегатов.
--
-- Функция ниже считает всё то же самое одним SQL-запросом на стороне базы
-- и отдаёт клиенту компактный jsonb. SECURITY INVOKER (по умолчанию) —
-- функция выполняется с правами вызывающей роли, поэтому существующие RLS-
-- политики на wb_orders/wb_stocks продолжают действовать без изменений,
-- прав доступа это не расширяет.

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
        'stock_by_warehouse', coalesce((
            select jsonb_agg(jsonb_build_object('warehouse_name', warehouse_name, 'qty', qty))
            from (
                select coalesce(warehouse_name, 'Неизвестно') as warehouse_name, sum(quantity) as qty
                from public.wb_stocks
                where cabinet_id = p_cabinet_id
                group by 1
                order by 2 desc
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
        -- Дневная разбивка за текущий период — для графиков на дашборде
        -- (раньше графики строились на клиенте из тех же сырых wb_orders,
        -- которые мы теперь не тянем целиком; агрегируем по дням сразу в SQL).
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

-- Индексы под точечные WHERE cabinet_id + order_date, чтобы агрегаты считались
-- быстро даже на больших объёмах (если такого индекса ещё нет).
create index if not exists wb_orders_cabinet_date_idx on public.wb_orders (cabinet_id, order_date);
create index if not exists wb_stocks_cabinet_idx on public.wb_stocks (cabinet_id);

select 'dashboard_summary RPC ready' as status;
