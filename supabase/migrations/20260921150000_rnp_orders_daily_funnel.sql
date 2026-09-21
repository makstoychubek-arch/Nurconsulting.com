-- РНП строка ЗАКАЗЫ = Excel «План/факт»: Корзина × Заказы%.
-- rnp_orders_daily раньше считал строки wb_orders (statistics-api),
-- поэтому в листе было 19 при 71 в план/факт. Клиент подмешивает
-- rnp_daily_data, но auto-sync затирал orders_count на днях старше 7.

create or replace function public.rnp_funnel_day_orders(
    p_basket_count numeric,
    p_funnel_order_conv numeric,
    p_clicks numeric default 0,
    p_impressions numeric default 0,
    p_basket_pct numeric default 0,
    p_orders_count numeric default 0
) returns integer
language sql
immutable
as $$
    select case
        when v_conv > 0 and v_cart > 0 then round(v_cart * v_conv / 100.0)::int
        when coalesce(p_orders_count, 0) > 0 then round(p_orders_count)::int
        else 0
    end
    from (
        select
            coalesce(p_funnel_order_conv, 0) as v_conv,
            case
                when coalesce(p_basket_count, 0) > 0 then p_basket_count
                when coalesce(p_basket_pct, 0) > 0 and coalesce(p_clicks, 0) > 0
                    then round(p_clicks * p_basket_pct / 100.0)
                when coalesce(p_basket_pct, 0) > 0 and coalesce(p_impressions, 0) > 0
                    then round(p_impressions * p_basket_pct / 100.0)
                else 0::numeric
            end as v_cart
    ) s;
$$;

revoke all on function public.rnp_funnel_day_orders(numeric, numeric, numeric, numeric, numeric, numeric) from public;
grant execute on function public.rnp_funnel_day_orders(numeric, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

create or replace function public.rnp_orders_daily(
    p_cabinet_id uuid,
    p_from date,
    p_to date
) returns jsonb
language sql
stable
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', nm_id,
        'order_date', order_date,
        'orders_count', orders_count,
        'orders_sum', orders_sum,
        'returns_count', returns_count,
        'spp_pct', spp_pct,
        'basket_count', basket_count,
        'funnel_order_conv', funnel_order_conv,
        'clicks', clicks,
        'impressions', impressions,
        'basket_pct', basket_pct
    ) order by order_date, nm_id), '[]'::jsonb)
    from (
        select
            coalesce(f.nm_id, s.nm_id) as nm_id,
            coalesce(f.d, s.order_date) as order_date,
            case
                when f.nm_id is not null then f.funnel_orders
                else coalesce(s.orders_count, 0)
            end as orders_count,
            coalesce(s.orders_sum, f.orders_sum, 0) as orders_sum,
            coalesce(s.returns_count, 0) as returns_count,
            coalesce(s.spp_pct, 0) as spp_pct,
            coalesce(f.basket_count, 0) as basket_count,
            coalesce(f.funnel_order_conv, 0) as funnel_order_conv,
            coalesce(f.clicks, 0) as clicks,
            coalesce(f.impressions, 0) as impressions,
            coalesce(f.basket_pct, 0) as basket_pct
        from (
            select
                nm_id,
                order_date,
                count(*) filter (where not is_return) as orders_count,
                coalesce(sum(price) filter (where not is_return), 0) as orders_sum,
                count(*) filter (where is_return) as returns_count,
                coalesce(avg(
                    case
                        when not is_return
                             and coalesce(nullif(data->>'spp', '')::numeric, nullif(data->>'Spp', '')::numeric, 0) > 0
                        then coalesce(nullif(data->>'spp', '')::numeric, nullif(data->>'Spp', '')::numeric)
                    end
                ), 0) as spp_pct
            from public.wb_orders
            where cabinet_id = p_cabinet_id
              and order_date >= p_from
              and order_date <= p_to
              and nm_id is not null
            group by nm_id, order_date
        ) s
        full outer join (
            select
                nm_id,
                date as d,
                basket_count,
                funnel_order_conv,
                clicks,
                impressions,
                basket_pct,
                orders_sum,
                public.rnp_funnel_day_orders(
                    basket_count,
                    funnel_order_conv,
                    clicks,
                    impressions,
                    basket_pct,
                    orders_count
                ) as funnel_orders
            from public.rnp_daily_data
            where cabinet_id = p_cabinet_id
              and date >= p_from
              and date <= p_to
        ) f on f.nm_id = s.nm_id and f.d = s.order_date
    ) t;
$$;

grant execute on function public.rnp_orders_daily(uuid, date, date) to authenticated;

select 'rnp_orders_daily uses WB funnel Корзина × Заказы%' as status;
