-- Точность РНП Ozon: заказы считаются все (как у WB, отменённые тоже), логистика, комиссия и эквайринг берутся из финотчёта Ozon
-- по доле от начислений за полумесяц, возвраты клиентов (ClientReturn) из ozon_returns.
create table if not exists public.ozon_returns (
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    id bigint not null,
    type text,
    schema text,
    d date,
    offer_id text,
    sku bigint,
    qty numeric not null default 1,
    price numeric not null default 0,
    reason text,
    posting_number text,
    synced_at timestamptz not null default now(),
    primary key (cabinet_id, id)
);
alter table public.ozon_returns enable row level security;
drop policy if exists ozon_returns_read on public.ozon_returns;
create policy ozon_returns_read on public.ozon_returns for select to authenticated using (public.can_view_cabinet(cabinet_id::text));

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
               sum(q) orders,
               coalesce(sum(q * price), 0) orders_sum,
               coalesce(sum(q) filter (where status in ('delivered','delivering')), 0) sales,
               coalesce(sum(q * price) filter (where status in ('delivered','delivering')), 0) sales_sum,
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
    x as (
        select k.d, k.base, coalesce(t.orders, 0) orders, coalesce(t.orders_sum, 0) orders_sum, coalesce(t.sales, 0) sales, coalesce(t.sales_sum, 0) sales_sum, coalesce(t.cancels, 0) cancels,
               coalesce(fn.views, 0) views, coalesce(fn.pdp, 0) pdp, coalesce(fn.tocart, 0) tocart, coalesce(rt.cnt, 0) ret_cnt, p.comm, p.acq_pct,
               coalesce(pp.ad_pct, 0) ad_pct, coalesce(pp.fine_pct, 0) fine_pct, coalesce(pp.stor_pct, 0) stor_pct, coalesce(pp.ded_pct, 0) ded_pct, pp.logi_pct, pp.comm_pct, pp.acq_pct acq_real
        from keys k left join t on t.d = k.d and t.base = k.base left join fn on fn.d = k.d and fn.base = k.base left join rt on rt.d = k.d and rt.base = k.base
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
        'spp_pct', 0, 'ad_spend', round(sales_sum * ad_pct, 2), 'ad_clicks', 0, 'ad_impressions', 0,
        'impressions', views, 'clicks', pdp, 'basket_count', tocart, 'basket_pct', case when pdp > 0 then round(tocart * 100.0 / pdp, 2) else 0 end
    ) order by d, base), '[]'::jsonb)
    from x;
$$;
grant execute on function public.ozon_finance_daily(uuid, date, date, numeric) to authenticated;

create or replace function public.ozon_dashboard_summary(p_cabinet uuid, p_from date, p_to date, p_prev_from date, p_prev_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
    if not public.can_view_cabinet(p_cabinet::text) then raise exception 'Нет доступа к кабинету' using errcode = '42501'; end if;
    with days as (
        select o.created_at::date d, coalesce(sum((i->>'quantity')::int), 0) cnt,
               coalesce(sum(coalesce((i->>'quantity')::int, 1) * coalesce(case when jsonb_typeof(i->'price') = 'object' then (i->'price'->>'amount')::numeric else (i->>'price')::numeric end, 0)), 0) sm
        from public.ozon_postings o cross join lateral jsonb_array_elements(o.items) i
        where o.cabinet_id::text = p_cabinet::text
          and o.created_at::date between least(p_from, p_prev_from) and greatest(p_to, p_prev_to)
        group by 1
    ),
    st as (
        select coalesce(nullif(scheme, ''), 'fbo') sch, sum(present) q from public.ozon_stocks where cabinet_id::text = p_cabinet::text group by 1
    )
    select jsonb_build_object(
        'stock_total', coalesce((select sum(q) from st), 0),
        'stock_fbo', coalesce((select sum(q) from st where sch = 'fbo'), 0),
        'stock_fbs', coalesce((select sum(q) from st where sch = 'fbs'), 0),
        'stock_by_warehouse', coalesce((select jsonb_agg(jsonb_build_object('warehouse_name', 'Ozon ' || upper(sch), 'qty', q, 'scheme', sch) order by q desc) from st), '[]'::jsonb),
        'cur', jsonb_build_object('orders_count', coalesce((select sum(cnt) from days where d between p_from and p_to), 0), 'orders_sum', coalesce((select sum(sm) from days where d between p_from and p_to), 0), 'returns_count', 0),
        'prev', jsonb_build_object('orders_count', coalesce((select sum(cnt) from days where d between p_prev_from and p_prev_to), 0), 'orders_sum', coalesce((select sum(sm) from days where d between p_prev_from and p_prev_to), 0), 'returns_count', 0),
        'cur_daily', coalesce((select jsonb_agg(jsonb_build_object('date', d, 'sum', sm, 'count', cnt, 'returns', 0) order by d) from days where d between p_from and p_to), '[]'::jsonb)
    ) into v;
    return v;
end;
$$;

grant execute on function public.ozon_orders_daily(uuid, date, date), public.ozon_finance_daily(uuid, date, date, numeric), public.ozon_dashboard_summary(uuid, date, date, date, date) to authenticated;
