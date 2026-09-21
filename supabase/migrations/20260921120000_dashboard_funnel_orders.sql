-- Заказы на дашборде и в карточках плана = воронка WB (Корзина × Заказы%),
-- тот же факт, что в Excel «План/факт» и в строке ЗАКАЗЫ РНП.
-- Строки wb_orders оставляем только для суммы ₽ и возвратов.

create or replace function public.dashboard_summary(
    p_cabinet_id uuid,
    p_from date,
    p_to date,
    p_prev_from date,
    p_prev_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
    funnel as (
        select
            date as d,
            sum(
                case
                    when coalesce(basket_count, 0) > 0
                     and coalesce(funnel_order_conv, 0) > 0
                    then round(basket_count * funnel_order_conv / 100.0)::int
                    else coalesce(orders_count, 0)
                end
            ) as cnt
        from public.rnp_daily_data
        where cabinet_id = p_cabinet_id
          and date >= least(p_from, p_prev_from)
          and date <= greatest(p_to, p_prev_to)
        group by date
    ),
    totals as (
        select
            coalesce((select sum(cnt) from funnel where d between p_from and p_to), 0) as cur_cnt,
            sum(price) filter (where not is_return and order_date between p_from and p_to) as cur_sum,
            count(*) filter (where is_return and order_date between p_from and p_to) as cur_ret,
            coalesce((select sum(cnt) from funnel where d between p_prev_from and p_prev_to), 0) as prev_cnt,
            sum(price) filter (where not is_return and order_date between p_prev_from and p_prev_to) as prev_sum,
            count(*) filter (where is_return and order_date between p_prev_from and p_prev_to) as prev_ret
        from orders
    ),
    wb_daily as (
        select
            order_date as d,
            sum(price) filter (where not is_return) as s,
            count(*) filter (where not is_return) as c,
            count(*) filter (where is_return) as r
        from orders
        where order_date between p_from and p_to
        group by order_date
    ),
    daily as (
        select jsonb_agg(jsonb_build_object(
            'date', x.d, 'sum', x.s, 'count', x.c, 'returns', x.r
        ) order by x.d) as rows
        from (
            select
                coalesce(w.d, f.d) as d,
                coalesce(w.s, 0) as s,
                coalesce(f.cnt, w.c, 0) as c,
                coalesce(w.r, 0) as r
            from wb_daily w
            full outer join funnel f on f.d = w.d
            where coalesce(w.d, f.d) between p_from and p_to
        ) x
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
            'orders_count', coalesce(totals.cur_cnt, 0),
            'orders_sum', coalesce(totals.cur_sum, 0),
            'returns_count', coalesce(totals.cur_ret, 0)
        ),
        'prev', jsonb_build_object(
            'orders_count', coalesce(totals.prev_cnt, 0),
            'orders_sum', coalesce(totals.prev_sum, 0),
            'returns_count', coalesce(totals.prev_ret, 0)
        ),
        'cur_daily', coalesce(daily.rows, '[]'::jsonb)
    )
    into v_result
    from totals, daily, stocks;

    return v_result;
end;
$$;

revoke all on function public.dashboard_summary(uuid, date, date, date, date) from public;
grant execute on function public.dashboard_summary(uuid, date, date, date, date) to authenticated, service_role;

create or replace function public.dashboard_plan_cabinets(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin
    if p_from is null or p_to is null then
        raise exception 'Нужен период' using errcode = '22023';
    end if;

    with cabs as (
        select id from public.current_user_cabinet_ids() as id
    ),
    plans as (
        select
            cabinet_id,
            coalesce(sum(planned_orders), 0) as plan_orders,
            coalesce(sum(planned_sales), 0) as plan_sales,
            count(*) filter (
                where planned_orders is not null or planned_sales is not null
            ) as plan_rows
        from public.rnp_plans
        where cabinet_id in (select id from cabs)
          and plan_date between p_from and p_to
        group by cabinet_id
    ),
    fact as (
        select
            cabinet_id,
            coalesce(sum(
                case
                    when coalesce(basket_count, 0) > 0
                     and coalesce(funnel_order_conv, 0) > 0
                    then round(basket_count * funnel_order_conv / 100.0)::int
                    else coalesce(orders_count, 0)
                end
            ), 0) as orders,
            coalesce(sum(sales_count), 0) as sales
        from public.rnp_daily_data
        where cabinet_id in (select id from cabs)
          and date between p_from and p_to
        group by cabinet_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'cabinet_id', c.id,
        'plan_orders', coalesce(p.plan_orders, 0),
        'plan_sales', coalesce(p.plan_sales, 0),
        'has_plan', coalesce(p.plan_rows, 0) > 0,
        'orders', coalesce(f.orders, 0),
        'sales', coalesce(f.sales, 0)
    ) order by c.id), '[]'::jsonb)
    into v_result
    from cabs c
    left join plans p on p.cabinet_id = c.id
    left join fact f on f.cabinet_id = c.id;

    return v_result;
end;
$$;

revoke all on function public.dashboard_plan_cabinets(date, date) from public;
grant execute on function public.dashboard_plan_cabinets(date, date) to authenticated, service_role;
