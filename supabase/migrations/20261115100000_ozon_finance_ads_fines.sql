-- РНП Ozon: реклама (РК), штрафы, хранение и прочие удержания.
-- Источник: ozon_cashflow.detail (финотчёт Ozon по полумесяцам, раздел services). По дням и товарам их нет,
-- поэтому берём долю расхода от суммы начислений за полумесяц и применяем её к продажам каждого дня и артикула.
-- «К перечислению» как у WB: до логистики, хранения, штрафов и рекламы (их вычитает формула прибыли), удержания внутри.
-- Валюта не важна: доля считается внутри самого финотчёта.
create or replace function public.ozon_finance_daily(p_cabinet uuid, p_from date, p_to date, p_logi_pct numeric default 0.179) returns jsonb
language sql stable security definer set search_path = public as $$
    with auth as (select public.can_view_cabinet(p_cabinet::text) ok),
    prod as (
        select public.ozon_base_offer(offer_id) base, avg(commission_fbo_pct) comm, avg(acquiring / nullif(price, 0)) acq_pct
        from public.ozon_products where cabinet_id::text = p_cabinet::text group by 1
    ),
    per as (
        select c.period_begin pb,
               s.ad / nullif((c.summary->>'orders_amount')::numeric, 0) ad_pct,
               s.fine / nullif((c.summary->>'orders_amount')::numeric, 0) fine_pct,
               s.stor / nullif((c.summary->>'orders_amount')::numeric, 0) stor_pct,
               s.ded / nullif((c.summary->>'orders_amount')::numeric, 0) ded_pct
        from public.ozon_cashflow c
        cross join lateral (
            select -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike '%PromotionWithCostPerOrder%' or it->>'name' ilike '%CostPerClick%' or it->>'name' ilike '%Promotion%Paid%'), 0) ad,
                   -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike 'Fines%'), 0) fine,
                   -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike '%StorageItem%'), 0) stor,
                   -coalesce(sum((it->>'price')::numeric) filter (where (it->>'price')::numeric < 0
                        and it->>'name' not ilike '%PromotionWithCostPerOrder%' and it->>'name' not ilike '%CostPerClick%' and it->>'name' not ilike 'Fines%'
                        and it->>'name' not ilike '%StorageItem%' and it->>'name' not ilike '%Acquiring%' and it->>'name' not ilike '%AgencyFee%'
                        and it->>'name' not ilike '%DeliveryToHandover%'), 0) ded
            from jsonb_array_elements(coalesce(c.detail->'services'->'items', '[]'::jsonb)) it
        ) s
        where c.cabinet_id::text = p_cabinet::text
    ),
    items as (
        select o.created_at::date d, o.status, public.ozon_base_offer(i.item->>'offer_id') base,
               coalesce((i.item->>'quantity')::int, 1) q,
               coalesce(case when jsonb_typeof(i.item->'price') = 'object' then (i.item->'price'->>'amount')::numeric else (i.item->>'price')::numeric end, 0) price
        from public.ozon_postings o, auth
        cross join lateral (select jsonb_array_elements(o.items) item) i
        where auth.ok and o.cabinet_id::text = p_cabinet::text and o.created_at::date between p_from and p_to
    ),
    t as (
        select d, base, coalesce(sum(q) filter (where status <> 'cancelled'), 0) orders, coalesce(sum(q * price) filter (where status <> 'cancelled'), 0) orders_sum,
               coalesce(sum(q) filter (where status in ('delivered','delivering')), 0) sales, coalesce(sum(q * price) filter (where status in ('delivered','delivering')), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels
        from items group by d, base
    ),
    x as (
        select t.*, p.comm, p.acq_pct,
               coalesce(pp.ad_pct, 0) ad_pct, coalesce(pp.fine_pct, 0) fine_pct, coalesce(pp.stor_pct, 0) stor_pct, coalesce(pp.ded_pct, 0) ded_pct
        from t left join prod p on p.base = t.base
        left join lateral (
            select * from per where per.pb <= t.d order by per.pb desc limit 1
        ) pp on true
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'cabinet_id', p_cabinet, 'nm_id', public.ozon_pseudo_nm(base), 'date', d,
        'orders_count', orders, 'orders_sum', orders_sum, 'sales_count', sales, 'sales_sum', sales_sum,
        'returns_count', 0, 'cancels_count', cancels, 'realization', sales_sum,
        'commission_pct', round(coalesce(comm, 21), 2),
        'to_transfer', round(sales_sum * (1 - coalesce(comm, 21) / 100.0 - coalesce(acq_pct, 0.01) - ded_pct), 2),
        'delivery_sum', round(sales_sum * p_logi_pct, 2),
        'storage_sum', round(sales_sum * stor_pct, 2), 'penalty_sum', round(sales_sum * fine_pct, 2), 'deduction_sum', round(sales_sum * ded_pct, 2),
        'buyout_pct', case when orders > 0 then round(sales * 100.0 / orders, 2) else 0 end,
        'spp_pct', 0, 'ad_spend', round(sales_sum * ad_pct, 2), 'ad_clicks', 0, 'ad_impressions', 0
    ) order by d, base), '[]'::jsonb)
    from x;
$$;
grant execute on function public.ozon_finance_daily(uuid, date, date, numeric) to authenticated;
