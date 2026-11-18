-- Дашборд для Ozon: те же формы ответа, что у dashboard_summary / dashboard_finance_rows / dashboard_finance_coverage (WB),
-- чтобы дашборд рисовал тот же каркас, а при переключении площадки менялись только числа.

create or replace function public.ozon_dashboard_summary(p_cabinet uuid, p_from date, p_to date, p_prev_from date, p_prev_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
    if not public.can_view_cabinet(p_cabinet::text) then raise exception 'Нет доступа к кабинету' using errcode = '42501'; end if;
    with days as (
        select o.created_at::date d, coalesce(sum((i->>'quantity')::int), 0) cnt,
               coalesce(sum(coalesce((i->>'quantity')::int, 1) * coalesce(case when jsonb_typeof(i->'price') = 'object' then (i->'price'->>'amount')::numeric else (i->>'price')::numeric end, 0)), 0) sm
        from public.ozon_postings o cross join lateral jsonb_array_elements(o.items) i
        where o.cabinet_id::text = p_cabinet::text and o.status <> 'cancelled'
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

create or replace function public.ozon_dashboard_finance_rows(p_cabinet uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object(
        'sale_dt', x->>'date', 'nm_id', (x->>'nm_id')::bigint, 'sa_name', nm.name, 'subject_name', nm.name, 'brand_name', 'Ozon',
        'doc_type_name', 'Продажа', 'supplier_oper_name', null, 'bonus_type_name', null,
        'quantity', (x->>'sales_count')::numeric,
        'retail_price', case when (x->>'sales_count')::numeric > 0 then round((x->>'sales_sum')::numeric / (x->>'sales_count')::numeric, 2) else 0 end,
        'retail_price_withdisc_rub', case when (x->>'sales_count')::numeric > 0 then round((x->>'sales_sum')::numeric / (x->>'sales_count')::numeric, 2) else 0 end,
        'retail_amount', (x->>'sales_sum')::numeric,
        'ppvz_for_pay', round((x->>'to_transfer')::numeric + (x->>'deduction_sum')::numeric, 2),
        'delivery_rub', (x->>'delivery_sum')::numeric, 'storage_fee', (x->>'storage_sum')::numeric,
        'penalty', (x->>'penalty_sum')::numeric, 'deduction', (x->>'deduction_sum')::numeric,
        'acceptance', 0, 'additional_payment', 0,
        'acquiring_fee', greatest(0, round((x->>'sales_sum')::numeric * (1 - (x->>'commission_pct')::numeric / 100.0) - ((x->>'to_transfer')::numeric + (x->>'deduction_sum')::numeric), 2)),
        'currency_name', 'KGS'
    ) order by x->>'date'), '[]'::jsonb)
    from jsonb_array_elements(public.ozon_finance_daily(p_cabinet, p_from, p_to)) x
    left join lateral (select max(a->>'name') name from jsonb_array_elements(public.ozon_rnp_articles(p_cabinet)) a where (a->>'nm_id')::bigint = (x->>'nm_id')::bigint) nm on true
    where (x->>'sales_count')::numeric > 0;
$$;

create or replace function public.ozon_dashboard_coverage(p_cabinet uuid) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object('from', min(created_at)::date, 'to', max(created_at)::date)
    from public.ozon_postings where cabinet_id::text = p_cabinet::text and public.can_view_cabinet(p_cabinet::text);
$$;

grant execute on function public.ozon_dashboard_summary(uuid, date, date, date, date), public.ozon_dashboard_finance_rows(uuid, date, date), public.ozon_dashboard_coverage(uuid) to authenticated;
