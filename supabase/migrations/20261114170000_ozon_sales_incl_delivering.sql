-- Ozon: «продажей» считаем и заказ «в доставке» (товар уже у покупателя в пути и почти наверняка будет выкуплен), а не только уже доставленный.
-- Иначе продажи и % выкупа в РНП сильно занижены из-за задержки доставки. Заказы в ожидании сборки и отгрузки продажей не считаются.

create or replace function public.ozon_orders_daily(p_cabinet uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok),
    items as (
        select o.created_at::date d, o.status, public.ozon_base_offer(i.item->>'offer_id') base,
               coalesce((i.item->>'quantity')::int, 1) q,
               coalesce(case when jsonb_typeof(i.item->'price') = 'object' then (i.item->'price'->>'amount')::numeric else (i.item->>'price')::numeric end, 0) price
        from public.ozon_postings o, auth
        cross join lateral (select jsonb_array_elements(o.items) item) i
        where auth.ok and o.cabinet_id::text = p_cabinet::text and o.created_at::date between p_from and p_to
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', public.ozon_pseudo_nm(base), 'order_date', d,
        'orders_count', orders, 'orders_sum', orders_sum, 'returns_count', 0,
        'spp_pct', 0, 'price_base', 0, 'price_disc', price_avg, 'price_spp', price_avg, 'disc_pct', 0,
        'sales_count', sales, 'sales_sum', sales_sum, 'cancels_count', cancels
    ) order by d, base), '[]'::jsonb)
    from (
        select d, base,
               sum(q) filter (where status <> 'cancelled') orders,
               coalesce(sum(q * price) filter (where status <> 'cancelled'), 0) orders_sum,
               coalesce(sum(q) filter (where status in ('delivered', 'delivering')), 0) sales,
               coalesce(sum(q * price) filter (where status in ('delivered', 'delivering')), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels,
               coalesce(avg(price) filter (where price > 0), 0) price_avg
        from items group by d, base
    ) t;
$$;

create or replace function public.ozon_finance_daily(p_cabinet uuid, p_from date, p_to date, p_logi_pct numeric default 0.179) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok),
    prod as (
        select public.ozon_base_offer(offer_id) base, avg(commission_fbo_pct) comm, avg(acquiring / nullif(price, 0)) acq_pct
        from public.ozon_products where cabinet_id::text = p_cabinet::text group by 1
    ),
    items as (
        select o.created_at::date d, o.status, public.ozon_base_offer(i.item->>'offer_id') base,
               coalesce((i.item->>'quantity')::int, 1) q,
               coalesce(case when jsonb_typeof(i.item->'price') = 'object' then (i.item->'price'->>'amount')::numeric else (i.item->>'price')::numeric end, 0) price
        from public.ozon_postings o, auth
        cross join lateral (select jsonb_array_elements(o.items) item) i
        where auth.ok and o.cabinet_id::text = p_cabinet::text and o.created_at::date between p_from and p_to
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'cabinet_id', p_cabinet, 'nm_id', public.ozon_pseudo_nm(t.base), 'date', t.d,
        'orders_count', t.orders, 'orders_sum', t.orders_sum, 'sales_count', t.sales, 'sales_sum', t.sales_sum,
        'returns_count', 0, 'cancels_count', t.cancels, 'realization', t.sales_sum,
        'commission_pct', round(coalesce(p.comm, 21), 2),
        'to_transfer', round(t.sales_sum * (1 - coalesce(p.comm, 21) / 100.0 - coalesce(p.acq_pct, 0.01) - p_logi_pct), 2),
        'delivery_sum', round(t.sales_sum * p_logi_pct, 2), 'storage_sum', 0, 'penalty_sum', 0, 'deduction_sum', 0,
        'buyout_pct', case when t.orders > 0 then round(t.sales * 100.0 / t.orders, 2) else 0 end,
        'spp_pct', 0, 'ad_spend', 0, 'ad_clicks', 0, 'ad_impressions', 0
    ) order by t.d, t.base), '[]'::jsonb)
    from (
        select d, base, coalesce(sum(q) filter (where status <> 'cancelled'), 0) orders, coalesce(sum(q * price) filter (where status <> 'cancelled'), 0) orders_sum,
               coalesce(sum(q) filter (where status in ('delivered', 'delivering')), 0) sales, coalesce(sum(q * price) filter (where status in ('delivered', 'delivering')), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels
        from items group by d, base
    ) t left join prod p on p.base = t.base;
$$;

grant execute on function public.ozon_orders_daily(uuid, date, date), public.ozon_finance_daily(uuid, date, date, numeric) to authenticated;
