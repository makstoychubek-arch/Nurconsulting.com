-- РНП «Общий», новая шапка:
--   1) rnp_cabinet_totals: необязательный фильтр по артикулам (включённые в РНП). Суммы по товарам считаются только
--      по ним; удержания без артикула, «К выводу» и баланс — всегда по всему кабинету.
--   2) rnp_logistics_split: логистика по причинам (к клиенту при продаже/отмене, от клиента…).
--   3) rnp_cabinet_health: по каждому артикулу кабинета (все, включая скрытые) — для «Состояния кабинета» и «Что улучшить».
--   4) rnp_cabinet_payouts: «Итого к оплате» по неделям (пн–вс) и дата выплаты (понедельник через неделю после закрытия).
drop function if exists public.rnp_cabinet_totals(uuid, date, date);
create or replace function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null)
returns table (
    d date, realization numeric, to_transfer numeric, delivery numeric, storage numeric,
    penalty numeric, deduction numeric, acceptance numeric, to_withdraw numeric, ad_spend numeric,
    balance_current numeric, balance_for_withdraw numeric,
    acquiring numeric, compensation numeric, additional numeric
)
language sql stable security invoker set search_path = public
as $$
    with rows_all as (
        select f.* from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
    ), fin as (
        select f.rr_dt as d,
               sum(case f.supplier_oper_name when 'Продажа' then f.retail_amount
                                             when 'Возврат' then -f.retail_amount else 0 end) as realization,
               sum(case f.supplier_oper_name when 'Продажа' then f.ppvz_for_pay
                                             when 'Возврат' then -f.ppvz_for_pay
                                             when 'Добровольная компенсация при возврате' then f.ppvz_for_pay
                                             else 0 end) as to_transfer,
               sum(case f.supplier_oper_name when 'Продажа' then coalesce(f.acquiring_fee, 0)
                                             when 'Возврат' then -coalesce(f.acquiring_fee, 0) else 0 end) as acquiring,
               sum(case f.supplier_oper_name when 'Добровольная компенсация при возврате' then f.ppvz_for_pay else 0 end) as compensation,
               sum(coalesce(f.additional_payment, 0)) as additional,
               sum(coalesce(f.delivery_rub, 0)) as delivery,
               sum(coalesce(f.storage_fee, 0)) as storage,
               sum(coalesce(f.penalty, 0)) as penalty,
               sum(coalesce(f.acceptance, 0)) as acceptance
        from rows_all f
        where p_nm_ids is null or f.nm_id = any(p_nm_ids)
        group by f.rr_dt
    ), cab as (
        select f.rr_dt as d,
               sum(coalesce(f.deduction, 0)) as deduction,
               sum(case f.supplier_oper_name when 'Продажа' then f.ppvz_for_pay
                                             when 'Возврат' then -f.ppvz_for_pay
                                             when 'Добровольная компенсация при возврате' then f.ppvz_for_pay
                                             else 0 end)
                 + sum(coalesce(f.additional_payment, 0)) - sum(coalesce(f.delivery_rub, 0)) - sum(coalesce(f.storage_fee, 0))
                 - sum(coalesce(f.penalty, 0)) - sum(coalesce(f.deduction, 0)) - sum(coalesce(f.acceptance, 0)) as to_withdraw
        from rows_all f
        group by f.rr_dt
    ), ads as (
        select a.stat_date as d, sum(coalesce(a.spend, 0)) as ad_spend
        from advertising_daily_stats a
        where a.cabinet_id = p_cabinet and a.stat_date between p_from and p_to
        group by a.stat_date
    ), bal as (
        select b.date as d, b.current, b.for_withdraw
        from wb_balance_daily b
        where b.cabinet_id = p_cabinet and b.date between p_from and p_to
    ), days as (
        select d from cab union select d from ads union select d from bal
    )
    select days.d,
           round(coalesce(fin.realization, 0), 2), round(coalesce(fin.to_transfer, 0), 2),
           round(coalesce(fin.delivery, 0), 2), round(coalesce(fin.storage, 0), 2),
           round(coalesce(fin.penalty, 0), 2), round(coalesce(cab.deduction, 0), 2),
           round(coalesce(fin.acceptance, 0), 2), round(coalesce(cab.to_withdraw, 0), 2),
           round(coalesce(ads.ad_spend, 0), 2),
           bal.current, bal.for_withdraw,
           round(coalesce(fin.acquiring, 0), 2), round(coalesce(fin.compensation, 0), 2), round(coalesce(fin.additional, 0), 2)
    from days
    left join fin on fin.d = days.d
    left join cab on cab.d = days.d
    left join ads on ads.d = days.d
    left join bal on bal.d = days.d
    order by 1
$$;
revoke all on function public.rnp_cabinet_totals(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_cabinet_totals(uuid, date, date, bigint[]) to authenticated, service_role;

create or replace function public.rnp_logistics_split(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null)
returns table (reason text, amount numeric)
language sql stable security invoker set search_path = public
as $$
    select coalesce(nullif(f.bonus_type_name, ''), 'Прочая логистика'), round(sum(f.delivery_rub), 2)
    from raw_finance_report f
    where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
      and coalesce(f.delivery_rub, 0) <> 0
      and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
    group by 1
    order by 2 desc
$$;
revoke all on function public.rnp_logistics_split(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_logistics_split(uuid, date, date, bigint[]) to authenticated, service_role;

create or replace function public.rnp_cabinet_health(p_cabinet uuid, p_from date, p_to date)
returns table (
    nm_id bigint, art text, category text, is_active boolean, cost numeric,
    orders integer, orders_sum numeric, sales integer, returns integer, cancels integer,
    to_transfer numeric, delivery numeric, storage numeric, penalty numeric,
    clicks integer, baskets integer, ad_spend numeric, ad_views numeric, ad_clicks numeric, stock integer
)
language sql stable security invoker set search_path = public
as $$
    with v as (
        select a.nm_id, coalesce(nullif(a.manual_data->>'seller_article', ''), nullif(a.manual_data->>'vendor_code', ''), a.name) art,
               coalesce(nullif(trim(a.category), ''), 'Без категории') category, a.is_active,
               coalesce(a.cost_price, 0) + coalesce(a.other_costs_unit, 0) cost
        from rnp_articles a where a.cabinet_id = p_cabinet::text
    ), d as (
        select r.nm_id, sum(r.orders_count) ord, sum(r.orders_sum) os, sum(r.sales_count) sales, sum(r.returns_count) ret,
               sum(r.cancels_count) can, sum(r.to_transfer) tr, sum(r.delivery_sum) dl, sum(r.storage_sum) st,
               sum(r.penalty_sum) pen, sum(r.clicks) clk, sum(r.basket_count) bsk
        from rnp_daily_data r
        where r.cabinet_id = p_cabinet::text and r.date between p_from and p_to
        group by r.nm_id
    ), ad as (
        select (n->>'nmId')::bigint nm, sum(coalesce((n->>'sum')::numeric, 0)) s,
               sum(coalesce((n->>'views')::numeric, 0)) vw, sum(coalesce((n->>'clicks')::numeric, 0)) cl
        from advertising_daily_stats s, jsonb_array_elements(coalesce(s.data->'apps', '[]'::jsonb)) app,
             jsonb_array_elements(coalesce(app->'nms', '[]'::jsonb)) n
        where s.cabinet_id = p_cabinet and s.stat_date between p_from and p_to
        group by 1
    ), st as (
        select z.nm_id, sum(z.quantity) qty
        from (select distinct on (w.nm_id, w.warehouse_name, w.tech_size) w.nm_id, w.quantity
              from wb_stocks w where w.cabinet_id = p_cabinet
              order by w.nm_id, w.warehouse_name, w.tech_size, w.synced_at desc) z
        group by z.nm_id
    )
    select v.nm_id, v.art, v.category, v.is_active, v.cost,
           coalesce(d.ord, 0)::int, round(coalesce(d.os, 0), 2), coalesce(d.sales, 0)::int, coalesce(d.ret, 0)::int,
           coalesce(d.can, 0)::int, round(coalesce(d.tr, 0), 2), round(coalesce(d.dl, 0), 2), round(coalesce(d.st, 0), 2),
           round(coalesce(d.pen, 0), 2), coalesce(d.clk, 0)::int, coalesce(d.bsk, 0)::int,
           round(coalesce(ad.s, 0), 2), coalesce(ad.vw, 0), coalesce(ad.cl, 0), coalesce(st.qty, 0)::int
    from v
    left join d on d.nm_id = v.nm_id
    left join ad on ad.nm = v.nm_id
    left join st on st.nm_id = v.nm_id
$$;
revoke all on function public.rnp_cabinet_health(uuid, date, date) from public, anon;
grant execute on function public.rnp_cabinet_health(uuid, date, date) to authenticated, service_role;

create or replace function public.rnp_cabinet_payouts(p_cabinet uuid, p_weeks integer default 8)
returns table (week_start date, week_end date, pay_date date, to_withdraw numeric, closed boolean)
language sql stable security invoker set search_path = public
as $$
    with bounds as (
        select (date_trunc('week', (now() at time zone 'Asia/Bishkek')::date) - make_interval(weeks => p_weeks))::date as d0,
               (now() at time zone 'Asia/Bishkek')::date as today
    ), w as (
        select date_trunc('week', f.rr_dt)::date ws,
               sum(case f.supplier_oper_name when 'Продажа' then f.ppvz_for_pay
                                             when 'Возврат' then -f.ppvz_for_pay
                                             when 'Добровольная компенсация при возврате' then f.ppvz_for_pay
                                             else 0 end)
                 + sum(coalesce(f.additional_payment, 0)) - sum(coalesce(f.delivery_rub, 0)) - sum(coalesce(f.storage_fee, 0))
                 - sum(coalesce(f.penalty, 0)) - sum(coalesce(f.deduction, 0)) - sum(coalesce(f.acceptance, 0)) amt
        from raw_finance_report f, bounds b
        where f.cabinet_id = p_cabinet and f.rr_dt >= b.d0
        group by 1
    )
    select w.ws, (w.ws + 6), (w.ws + 14), round(w.amt, 2), (w.ws + 6) < b.today
    from w, bounds b
    order by w.ws desc
$$;
revoke all on function public.rnp_cabinet_payouts(uuid, integer) from public, anon;
grant execute on function public.rnp_cabinet_payouts(uuid, integer) to authenticated, service_role;
