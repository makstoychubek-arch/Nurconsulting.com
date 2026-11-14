-- Реклама Ozon в РНП: реальные показы, клики, заказы и расход по дням из ozon_ads_daily (Performance API), разложенные по артикулам
-- пропорционально продажам дня; расход рублей переводится в сомы по курсу дня. Пока рекламных данных нет, остаётся оценка из финотчёта.
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
               s.ded / nullif((c.summary->>'orders_amount')::numeric, 0) ded_pct,
               -(c.summary->>'item_delivery_and_return_amount')::numeric / nullif((c.summary->>'orders_amount')::numeric, 0) logi_pct,
               -(c.summary->>'commission_amount')::numeric / nullif((c.summary->>'orders_amount')::numeric, 0) comm_pct,
               s.acq / nullif((c.summary->>'orders_amount')::numeric, 0) acq_pct
        from public.ozon_cashflow c
        cross join lateral (
            select -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike '%Acquiring%'), 0) acq,
                   -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike '%PromotionWithCostPerOrder%' or it->>'name' ilike '%CostPerClick%' or it->>'name' ilike '%Promotion%Paid%'), 0) ad,
                   -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike 'Fines%'), 0) fine,
                   -coalesce(sum((it->>'price')::numeric) filter (where it->>'name' ilike '%StorageItem%'), 0) stor,
                   -coalesce(sum((it->>'price')::numeric) filter (where (it->>'price')::numeric < 0
                        and it->>'name' not ilike '%PromotionWithCostPerOrder%' and it->>'name' not ilike '%CostPerClick%' and it->>'name' not ilike 'Fines%'
                        and it->>'name' not ilike '%StorageItem%' and it->>'name' not ilike '%Acquiring%' and it->>'name' not ilike '%AgencyFee%'
                        and it->>'name' not ilike '%DeliveryToHandover%'), 0) ded
            from jsonb_array_elements(coalesce(c.detail->'services'->'items', '[]'::jsonb) || coalesce(c.detail->'others'->'items', '[]'::jsonb)) it
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
        select d, base, coalesce(sum(q), 0) orders, coalesce(sum(q * price), 0) orders_sum,
               coalesce(sum(q) filter (where status in ('delivered','delivering')), 0) sales, coalesce(sum(q * price) filter (where status in ('delivered','delivering')), 0) sales_sum,
               coalesce(sum(q) filter (where status = 'cancelled'), 0) cancels
        from items group by d, base
    ),
    fn as (
        select f.d, public.ozon_base_offer(pr.offer_id) base, sum(f.views) views, sum(f.views_pdp) pdp, sum(f.tocart) tocart
        from public.ozon_funnel_daily f
        join (select distinct on (sku) sku, offer_id from public.ozon_products where cabinet_id::text = p_cabinet::text order by sku, updated_at desc nulls last) pr on pr.sku = f.sku
        where f.cabinet_id::text = p_cabinet::text and f.d between p_from and p_to and exists (select 1 from auth where auth.ok)
        group by 1, 2
    ),
    rt as (
        select r.d, public.ozon_base_offer(r.offer_id) base, sum(r.qty) cnt, sum(r.qty * r.price) sm
        from public.ozon_returns r, auth
        where auth.ok and r.cabinet_id::text = p_cabinet::text and r.type = 'ClientReturn' and r.d between p_from and p_to
        group by 1, 2
    ),
    keys as (select d, base from t union select d, base from fn union select d, base from rt),
    adr as (
        select a.d, sum(a.spend * coalesce((select e.rate from public.exchange_rates e where e.pair = 'RUB_KGS' and e.date <= a.d order by e.date desc limit 1), 1)) sp,
               sum(a.impressions) im, sum(a.clicks) cl, sum(a.orders) od,
               sum(a.orders_sum * coalesce((select e.rate from public.exchange_rates e where e.pair = 'RUB_KGS' and e.date <= a.d order by e.date desc limit 1), 1)) rv
        from public.ozon_ads_daily a, auth
        where auth.ok and a.cabinet_id::text = p_cabinet::text and a.d between p_from and p_to group by a.d
    ),
    adm as (select min(d) m from public.ozon_ads_daily where cabinet_id::text = p_cabinet::text),
    x as (
        select k.d, k.base, coalesce(t.orders, 0) orders, coalesce(t.orders_sum, 0) orders_sum, coalesce(t.sales, 0) sales, coalesce(t.sales_sum, 0) sales_sum, coalesce(t.cancels, 0) cancels,
               coalesce(fn.views, 0) views, coalesce(fn.pdp, 0) pdp, coalesce(fn.tocart, 0) tocart, coalesce(rt.cnt, 0) ret_cnt, p.comm, p.acq_pct,
               coalesce(pp.ad_pct, 0) ad_pct, sum(coalesce(t.sales_sum, 0)) over (partition by k.d) day_sales, adr.sp, adr.im, adr.cl, adr.od, adr.rv, (select m from adm) ad_from, coalesce(pp.fine_pct, 0) fine_pct, coalesce(pp.stor_pct, 0) stor_pct, coalesce(pp.ded_pct, 0) ded_pct, pp.logi_pct, pp.comm_pct, pp.acq_pct acq_real
        from keys k left join t on t.d = k.d and t.base = k.base left join fn on fn.d = k.d and fn.base = k.base left join rt on rt.d = k.d and rt.base = k.base left join adr on adr.d = k.d
        left join prod p on p.base = k.base
        left join lateral (
            select * from per where per.pb <= k.d order by per.pb desc limit 1
        ) pp on true
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'cabinet_id', p_cabinet, 'nm_id', public.ozon_pseudo_nm(base), 'date', d,
        'orders_count', orders, 'orders_sum', orders_sum, 'sales_count', sales, 'sales_sum', sales_sum,
        'returns_count', ret_cnt, 'cancels_count', cancels, 'realization', sales_sum,
        'commission_pct', round(coalesce(comm_pct * 100, comm, 21), 2),
        'to_transfer', round(sales_sum * (1 - coalesce(comm_pct, comm / 100.0, 0.21) - coalesce(acq_real, acq_pct, 0.01) - ded_pct), 2),
        'delivery_sum', round(sales_sum * coalesce(logi_pct, p_logi_pct), 2),
        'storage_sum', round(sales_sum * stor_pct, 2), 'penalty_sum', round(sales_sum * fine_pct, 2), 'deduction_sum', round(sales_sum * ded_pct, 2),
        'buyout_pct', case when orders > 0 then round(sales * 100.0 / orders, 2) else 0 end,
        'spp_pct', 0,
        'ad_spend', case when ad_from is not null and d >= ad_from then round(coalesce(sp, 0) * sales_sum / nullif(day_sales, 0), 2) else round(sales_sum * ad_pct, 2) end,
        'ad_clicks', case when ad_from is not null and d >= ad_from then round(coalesce(cl, 0) * sales_sum / nullif(day_sales, 0), 2) else 0 end,
        'ad_impressions', case when ad_from is not null and d >= ad_from then round(coalesce(im, 0) * sales_sum / nullif(day_sales, 0), 2) else 0 end,
        'ad_revenue', case when ad_from is not null and d >= ad_from then round(coalesce(rv, 0) * sales_sum / nullif(day_sales, 0), 2) else 0 end,
        'ad_orders', case when ad_from is not null and d >= ad_from then round(coalesce(od, 0) * sales_sum / nullif(day_sales, 0), 2) else 0 end,
        'impressions', views, 'clicks', pdp, 'basket_count', tocart, 'basket_pct', case when pdp > 0 then round(tocart * 100.0 / pdp, 2) else 0 end
    ) order by d, base), '[]'::jsonb)
    from x;
$$;
grant execute on function public.ozon_finance_daily(uuid, date, date, numeric) to authenticated;

