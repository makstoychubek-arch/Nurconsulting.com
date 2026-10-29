-- dashboard_summary теперь читает витрину dash_daily (см. 20261029120000), а не сканирует wb_orders и rnp_daily_data.
-- Старая версия остаётся как dashboard_summary_slow для сверки и быстрого отката:
--   alter function public.dashboard_summary(uuid,date,date,date,date) rename to dashboard_summary_fast;
--   alter function public.dashboard_summary_slow(uuid,date,date,date,date) rename to dashboard_summary;

alter function public.dashboard_summary(uuid, date, date, date, date) rename to dashboard_summary_slow;

create or replace function public.dashboard_summary(p_cabinet_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_result jsonb;
begin
    if not public.can_view_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    with dd as (
        select d, wb_sum, wb_cnt, wb_ret, funnel_cnt
        from public.dash_daily
        where cabinet_id = p_cabinet_id
          and d >= least(p_from, p_prev_from)
          and d <= greatest(p_to, p_prev_to)
    ),
    totals as (
        select
            coalesce(sum(funnel_cnt) filter (where d between p_from and p_to), 0) as cur_cnt,
            sum(wb_sum) filter (where d between p_from and p_to) as cur_sum,
            coalesce(sum(wb_ret) filter (where d between p_from and p_to), 0) as cur_ret,
            coalesce(sum(funnel_cnt) filter (where d between p_prev_from and p_prev_to), 0) as prev_cnt,
            sum(wb_sum) filter (where d between p_prev_from and p_prev_to) as prev_sum,
            coalesce(sum(wb_ret) filter (where d between p_prev_from and p_prev_to), 0) as prev_ret
        from dd
    ),
    daily as (
        select jsonb_agg(jsonb_build_object(
            'date', x.d, 'sum', x.wb_sum, 'count', coalesce(x.funnel_cnt, x.wb_cnt, 0), 'returns', x.wb_ret
        ) order by x.d) as rows
        from dd x
        where x.d between p_from and p_to
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
