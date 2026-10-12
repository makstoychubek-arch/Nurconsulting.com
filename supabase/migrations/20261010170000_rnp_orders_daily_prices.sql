-- РНП: цены по дням из заказов WB — до скидки, скидка продавца, со скидкой и с СПП (цена на сайте).
create or replace function public.rnp_orders_daily(p_cabinet_id uuid, p_from date, p_to date)
 returns jsonb
 language sql
 stable
as $function$
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', nm_id,
        'order_date', order_date,
        'orders_count', orders_count,
        'orders_sum', orders_sum,
        'returns_count', returns_count,
        'spp_pct', spp_pct,
        'price_base', price_base,
        'price_disc', price_disc,
        'price_spp', price_spp,
        'disc_pct', disc_pct
    ) order by order_date, nm_id), '[]'::jsonb)
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
            ), 0) as spp_pct,
            coalesce(avg(nullif(data->>'totalPrice', '')::numeric) filter (where not is_return and coalesce(nullif(data->>'totalPrice', '')::numeric, 0) > 0), 0) as price_base,
            coalesce(avg(nullif(data->>'priceWithDisc', '')::numeric) filter (where not is_return and coalesce(nullif(data->>'priceWithDisc', '')::numeric, 0) > 0), 0) as price_disc,
            coalesce(avg(nullif(data->>'finishedPrice', '')::numeric) filter (where not is_return and coalesce(nullif(data->>'finishedPrice', '')::numeric, 0) > 0), 0) as price_spp,
            coalesce(avg(nullif(data->>'discountPercent', '')::numeric) filter (where not is_return and coalesce(nullif(data->>'discountPercent', '')::numeric, 0) > 0), 0) as disc_pct
        from public.wb_orders
        where cabinet_id = p_cabinet_id
          and order_date >= p_from
          and order_date <= p_to
          and nm_id is not null
        group by nm_id, order_date
    ) t;
$function$;
