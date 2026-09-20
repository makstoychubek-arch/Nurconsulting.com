-- План заказов по всем доступным кабинетам за период дашборда.
-- Один агрегат вместо тысяч строк rnp_plans / rnp_daily_data на клиенте.
-- Тот же процент, что в РНП: факт заказов / planned_orders.

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
            coalesce(sum(orders_count), 0) as orders,
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
