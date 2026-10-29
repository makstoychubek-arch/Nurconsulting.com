-- Продолжение витрины dash_daily: добавляем продажи (sales_count) и переводим на неё dashboard_plan_cabinets
-- (раньше она сканировала rnp_daily_data по всем кабинетам, на «холодную» до 2,6 секунды).
-- Старая версия остаётся как dashboard_plan_cabinets_slow (откат: поменять имена обратно).

alter table public.dash_daily add column if not exists sales_cnt numeric not null default 0;

create or replace function public.dash_daily_refresh(p_from date, p_to date, p_cabinet uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_n integer;
begin
    delete from public.dash_daily
    where d between p_from and p_to
      and (p_cabinet is null or cabinet_id = p_cabinet);

    insert into public.dash_daily (cabinet_id, d, wb_sum, wb_cnt, wb_ret, funnel_cnt, sales_cnt, has_wb)
    select
        coalesce(w.cabinet_id, f.cabinet_id) as cabinet_id,
        coalesce(w.d, f.d) as d,
        coalesce(w.s, 0), coalesce(w.c, 0), coalesce(w.r, 0),
        f.cnt, coalesce(f.sales, 0),
        w.d is not null
    from (
        select cabinet_id, order_date as d,
               sum(price) filter (where not is_return) as s,
               count(*) filter (where not is_return) as c,
               count(*) filter (where is_return) as r
        from public.wb_orders
        where order_date between p_from and p_to
          and (p_cabinet is null or cabinet_id = p_cabinet)
        group by cabinet_id, order_date
    ) w
    full outer join (
        select cabinet_id::uuid as cabinet_id, date as d,
               sum(
                   case
                       when coalesce(basket_count, 0) > 0 and coalesce(funnel_order_conv, 0) > 0
                       then round(basket_count * funnel_order_conv / 100.0)::int
                       else coalesce(orders_count, 0)
                   end
               ) as cnt,
               sum(sales_count) as sales
        from public.rnp_daily_data
        where date between p_from and p_to
          and (p_cabinet is null or cabinet_id = p_cabinet::text)
        group by cabinet_id, date
    ) f on f.cabinet_id = w.cabinet_id and f.d = w.d;

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

revoke all on function public.dash_daily_refresh(date, date, uuid) from public, anon, authenticated;
grant execute on function public.dash_daily_refresh(date, date, uuid) to service_role;

select public.dash_daily_refresh('2000-01-01'::date, '2100-01-01'::date, null);

alter function public.dashboard_plan_cabinets(date, date) rename to dashboard_plan_cabinets_slow;

create or replace function public.dashboard_plan_cabinets(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
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
            coalesce(sum(funnel_cnt), 0) as orders,
            coalesce(sum(sales_cnt), 0) as sales
        from public.dash_daily
        where cabinet_id in (select id from cabs)
          and d between p_from and p_to
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
