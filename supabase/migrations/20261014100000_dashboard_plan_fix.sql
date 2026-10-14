-- Исправление: rnp_daily_data и rnp_articles хранят cabinet_id как text, а функции сравнивали его с uuid
-- (ERROR 42883 text = uuid). Те же функции с явными приведениями.

-- План/факт по SKU текущего кабинета для дашборда.
-- Факт = воронка WB (Корзина × Заказы%), как в Excel «План/факт».

create or replace function public.dashboard_plan_skus(
    p_cabinet_id uuid,
    p_from date,
    p_to date
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
    if p_cabinet_id is null or p_from is null or p_to is null then
        raise exception 'Нужен кабинет и период' using errcode = '22023';
    end if;
    if not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    with plans as (
        select
            nm_id,
            coalesce(sum(planned_orders), 0) as plan_orders
        from public.rnp_plans
        where cabinet_id = p_cabinet_id
          and plan_date between p_from and p_to
        group by nm_id
        having coalesce(sum(planned_orders), 0) > 0
    ),
    fact as (
        select
            nm_id,
            coalesce(sum(
                case
                    when coalesce(basket_count, 0) > 0
                     and coalesce(funnel_order_conv, 0) > 0
                    then round(basket_count * funnel_order_conv / 100.0)::int
                    else coalesce(orders_count, 0)
                end
            ), 0) as orders
        from public.rnp_daily_data
        where cabinet_id = p_cabinet_id::text
          and date between p_from and p_to
        group by nm_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', p.nm_id,
        'name', coalesce(
            nullif(trim(a.manual_data->>'seller_article'), ''),
            nullif(trim(a.manual_data->>'sa_name'), ''),
            nullif(trim(a.name), ''),
            p.nm_id::text
        ),
        'photo_url', coalesce(a.photo_url, ''),
        'plan_orders', p.plan_orders,
        'orders', coalesce(f.orders, 0)
    ) order by (coalesce(f.orders, 0)::numeric / nullif(p.plan_orders, 0)) desc nulls last, p.nm_id), '[]'::jsonb)
    into v_result
    from plans p
    left join fact f on f.nm_id = p.nm_id
    left join public.rnp_articles a
        on a.cabinet_id = p_cabinet_id::text and a.nm_id = p.nm_id;

    return v_result;
end;
$$;

revoke all on function public.dashboard_plan_skus(uuid, date, date) from public;
grant execute on function public.dashboard_plan_skus(uuid, date, date) to authenticated, service_role;


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
        where cabinet_id in (select id::text from cabs)
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
    left join fact f on f.cabinet_id = c.id::text;

    return v_result;
end;
$$;

revoke all on function public.dashboard_plan_cabinets(date, date) from public;
grant execute on function public.dashboard_plan_cabinets(date, date) to authenticated, service_role;
