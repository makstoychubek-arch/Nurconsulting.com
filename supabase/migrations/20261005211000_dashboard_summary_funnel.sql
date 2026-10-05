-- Дашборд: заказы и их сумма из воронки WB (rnp_daily_data.funnel_orders / funnel_orders_sum), где воронка уже есть;
-- для остальных дней — прежние заказы из wb_orders (statistics-api). Так «Заказы» сходятся с Аналитикой WB и Raskpro.
create or replace function public.dashboard_summary(
    p_cabinet_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
    v_result jsonb;
begin
    if not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    with orders as (
        select order_date, price, is_return
        from public.wb_orders
        where cabinet_id = p_cabinet_id
          and order_date >= least(p_from, p_prev_from)
          and order_date <= greatest(p_to, p_prev_to)
    ),
    stat_day as (
        select order_date as d,
               count(*) filter (where not is_return) as c,
               coalesce(sum(price) filter (where not is_return), 0) as s,
               count(*) filter (where is_return) as r
        from orders
        group by order_date
    ),
    funnel_day as (
        select date as d, sum(funnel_orders) as c, sum(funnel_orders_sum) as s
        from public.rnp_daily_data
        where cabinet_id::text = p_cabinet_id::text
          and date >= least(p_from, p_prev_from)
          and date <= greatest(p_to, p_prev_to)
          and funnel_orders is not null
          and funnel_orders_sum is not null
        group by date
    ),
    merged as (
        select coalesce(f.d, s.d) as d,
               coalesce(f.c, s.c, 0) as c,
               coalesce(f.s, s.s, 0) as s,
               coalesce(s.r, 0) as r
        from funnel_day f
        full join stat_day s on s.d = f.d
    ),
    totals as (
        select
            coalesce(sum(c) filter (where d between p_from and p_to), 0) as cur_cnt,
            coalesce(sum(s) filter (where d between p_from and p_to), 0) as cur_sum,
            coalesce(sum(r) filter (where d between p_from and p_to), 0) as cur_ret,
            coalesce(sum(c) filter (where d between p_prev_from and p_prev_to), 0) as prev_cnt,
            coalesce(sum(s) filter (where d between p_prev_from and p_prev_to), 0) as prev_sum,
            coalesce(sum(r) filter (where d between p_prev_from and p_prev_to), 0) as prev_ret
        from merged
    ),
    daily as (
        select jsonb_agg(jsonb_build_object('date', d, 'sum', s, 'count', c, 'returns', r) order by d) as rows
        from merged
        where d between p_from and p_to
    ),
    stock_rows as (
        select
            coalesce(warehouse_name, 'Неизвестно') as warehouse_name,
            coalesce(nullif(stock_scheme, ''), 'fbo') as scheme,
            sum(quantity) as qty
        from public.wb_stocks
        where cabinet_id = p_cabinet_id
        group by 1, 2
    ),
    stocks as (
        select
            coalesce(sum(qty), 0) as total,
            coalesce(sum(qty) filter (where scheme = 'fbo'), 0) as fbo,
            coalesce(sum(qty) filter (where scheme = 'fbs'), 0) as fbs,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'warehouse_name', warehouse_name, 'qty', qty, 'scheme', scheme
                ) order by qty desc)
                from stock_rows
            ), '[]'::jsonb) as by_warehouse
        from stock_rows
    )
    select jsonb_build_object(
        'stock_total', stocks.total,
        'stock_fbo', stocks.fbo,
        'stock_fbs', stocks.fbs,
        'stock_by_warehouse', stocks.by_warehouse,
        'cur', jsonb_build_object(
            'orders_count', totals.cur_cnt,
            'orders_sum', totals.cur_sum,
            'returns_count', totals.cur_ret
        ),
        'prev', jsonb_build_object(
            'orders_count', totals.prev_cnt,
            'orders_sum', totals.prev_sum,
            'returns_count', totals.prev_ret
        ),
        'cur_daily', coalesce(daily.rows, '[]'::jsonb)
    )
    into v_result
    from totals, daily, stocks;

    return v_result;
end;
$function$;
