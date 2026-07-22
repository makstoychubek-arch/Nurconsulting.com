-- RNP: агрегация заказов на стороне БД — фронт не тянет сырые wb_orders/data.

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
        'spp_pct', spp_pct
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
            ), 0) as spp_pct
        from public.wb_orders
        where cabinet_id = p_cabinet_id
          and order_date >= p_from
          and order_date <= p_to
          and nm_id is not null
        group by nm_id, order_date
    ) t;
$$;

create or replace function public.cabinet_wb_nm_ids(p_cabinet_id uuid)
returns bigint[]
language sql
stable
as $$
    select coalesce(array_agg(distinct nm_id order by nm_id), '{}'::bigint[])
    from (
        select nm_id from public.wb_orders
        where cabinet_id = p_cabinet_id and nm_id is not null
        union
        select nm_id from public.wb_stocks
        where cabinet_id = p_cabinet_id and nm_id is not null
    ) u;
$$;

grant execute on function public.rnp_orders_daily(uuid, date, date) to authenticated;
grant execute on function public.cabinet_wb_nm_ids(uuid) to authenticated;

select 'rnp_orders_daily RPC ready' as status;
