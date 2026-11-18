-- РНП и дашборд для Ozon: те же формы строк, что у WB (rnp_orders_daily, rnp_daily_data, rnp_articles, wb_stocks),
-- чтобы РНП работал по дням без отдельного кода. Источник: ozon_postings, ozon_products, ozon_stocks (их заполняет ozon-sync).
-- «Артикул» Ozon = товар без размера (костюм_укороченный_чёрный); nm_id для него считается из названия (8e9 + хэш), с WB не пересекается.
-- Логистика и возвраты Ozon в заказах не видны: оцениваем 17,9% от суммы продаж (так вышло по финотчёту Ozon за 1 августа – 13 ноября 2026).

create or replace function public.ozon_base_offer(p_offer text) returns text
language sql immutable as $$
    select btrim(regexp_replace(regexp_replace(lower(coalesce(p_offer, '')), '[_ ]*(\d{2}(-\d{2})?|xxl|xl|xs|l|m|s)$', '', 'i'), '[_ ]*\d{2}$', ''), '_ ');
$$;

create or replace function public.ozon_pseudo_nm(p_base text) returns bigint
language sql immutable as $$
    select 8000000000 + abs(hashtext(coalesce(p_base, '')))::bigint;
$$;

-- артикулы (товары без размера)
create or replace function public.ozon_rnp_articles(p_cabinet uuid) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok),
    prod as (
        select public.ozon_base_offer(p.offer_id) base, min(p.name) title, min(p.product_id) pid,
               min(p.width_mm) w, min(p.height_mm) h, min(p.depth_mm) d, round(avg(p.weight_g)) g, bool_and(coalesce(p.archived, false)) archived
        from public.ozon_products p, auth where auth.ok and p.cabinet_id::text = p_cabinet::text group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', 'ozon-' || base, 'cabinet_id', p_cabinet, 'nm_id', public.ozon_pseudo_nm(base), 'name', base, 'card_title', title,
        'category', title, 'subject_name', title, 'photo_url', null, 'is_active', not archived, 'sort_order', 0,
        'cost_price', coalesce((
            select round(avg(a.cost_price))::numeric from public.rnp_articles a
            where a.cabinet_id::text = p_cabinet::text and coalesce(a.cost_price, 0) > 0 and (
                (base like 'свитер%' and lower(a.name) like 'свитер%') or
                (base like 'костюм_укороч%' and lower(a.name) like 'укороч%') or
                (base like 'костюм_оверсайз%' and lower(a.name) like 'костюм_оверсайз%') or
                (base like 'спорт_рич%' and lower(a.name) like 'спорт_костюм_sport_rich%') or
                (base like 'пиджак_оверсайз%' and lower(a.name) like 'пиджак%'))
        ), 0),
        'logistics_unit', 0, 'other_costs', 0, 'other_costs_unit', 0, 'manual_data', '{}'::jsonb,
        'dim_l_cm', round(d / 10.0), 'dim_w_cm', round(w / 10.0), 'dim_h_cm', round(h / 10.0), 'weight_kg', round(g / 1000.0, 2), 'imt_id', null
    ) order by base), '[]'::jsonb)
    from prod;
$$;

-- заказы по дням (форма rnp_orders_daily + продажи и отмены)
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
               coalesce(sum(q) filter (where status = 'delivered'), 0) sales,
               coalesce(sum(q * price) filter (where status = 'delivered'), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels,
               coalesce(avg(price) filter (where price > 0), 0) price_avg
        from items group by d, base
    ) t;
$$;

-- финансы по дням (форма rnp_daily_data, только то, что знаем): комиссия и эквайринг по карточке, логистика оценкой
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
               coalesce(sum(q) filter (where status = 'delivered'), 0) sales, coalesce(sum(q * price) filter (where status = 'delivered'), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels
        from items group by d, base
    ) t left join prod p on p.base = t.base;
$$;

-- остатки Ozon в форме wb_stocks
create or replace function public.ozon_stock_rows(p_cabinet uuid) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok)
    select coalesce(jsonb_agg(jsonb_build_object(
        'nm_id', public.ozon_pseudo_nm(public.ozon_base_offer(s.offer_id)), 'tech_size',
        coalesce(substring(s.offer_id from '(\d{2}(-\d{2})?|XXL|XL|XS|L|M|S)$'), ''), 'quantity', s.present, 'in_way_to_client', 0, 'in_way_from_client', 0,
        'warehouse_name', 'Ozon', 'stock_scheme', coalesce(s.scheme, 'fbo')
    )), '[]'::jsonb)
    from public.ozon_stocks s, auth where auth.ok and s.cabinet_id::text = p_cabinet::text;
$$;

grant execute on function public.ozon_rnp_articles(uuid), public.ozon_orders_daily(uuid, date, date), public.ozon_finance_daily(uuid, date, date, numeric), public.ozon_stock_rows(uuid) to authenticated;
