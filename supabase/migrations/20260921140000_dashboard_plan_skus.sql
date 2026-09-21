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
        where cabinet_id = p_cabinet_id
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
        on a.cabinet_id = p_cabinet_id and a.nm_id = p.nm_id;

    return v_result;
end;
$$;

revoke all on function public.dashboard_plan_skus(uuid, date, date) from public;
grant execute on function public.dashboard_plan_skus(uuid, date, date) to authenticated, service_role;
