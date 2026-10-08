-- Окно «Кабинеты», v2: добавлены покрытие себестоимостью и чек-лист онбординга.
-- security invoker: каждая таблица фильтруется своими правилами RLS, чужие кабинеты не попадают.
create or replace function public.cabinets_hub(p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with cabs as (
    select c.id, c.name, c.nr_managed, c.wb_token_set, c.adv_token_valid
    from cabinets c
),
rate as (
    select coalesce((select rate from exchange_rates where pair = 'RUB_KGS' and date <= p_date order by date desc limit 1), 1) as r
),
ord as (
    select o.cabinet_id, o.order_date d, count(*) cnt, coalesce(sum(o.price), 0) amt
    from wb_orders o
    where o.order_date between p_date - 13 and p_date and not coalesce(o.is_return, false)
    group by 1, 2
),
ads as (
    select s.cabinet_id, coalesce(sum(s.spend), 0) spend, coalesce(sum(s.orders), 0) orders, coalesce(sum(s.sum_price), 0) revenue
    from advertising_daily_stats s
    where s.stat_date = p_date
    group by 1
),
camp as (
    select c.cabinet_id, c.campaign_id, c.campaign_name, c.status, c.payment_type, c.budget_total,
           coalesce(s.spend, 0) spend, coalesce(s.orders, 0) orders, coalesce(s.sum_price, 0) revenue
    from advertising_campaigns c
    left join (
        select cabinet_id, campaign_id, sum(spend) spend, sum(orders) orders, sum(sum_price) sum_price
        from advertising_daily_stats where stat_date = p_date group by 1, 2
    ) s on s.cabinet_id = c.cabinet_id and s.campaign_id = c.campaign_id
    where c.status = 9 or coalesce(s.spend, 0) > 0
),
plan as (
    select p.cabinet_id::text cab, sum(p.planned_orders) planned
    from rnp_plans p where p.plan_date = p_date group by 1
),
sales as (
    select r.cabinet_id::text cab, sum(r.sales_count) cnt, sum(r.sales_sum) amt
    from rnp_daily_data r where r.date = p_date group by 1
),
stock_day as (
    select g.cabinet_id, max(g.date) d from goods_daily_stocks g where g.date <= p_date + 1 group by 1
),
stock as (
    select g.cabinet_id, g.nm_id, sum(g.qty) qty
    from goods_daily_stocks g join stock_day sd on sd.cabinet_id = g.cabinet_id and sd.d = g.date
    group by 1, 2
),
velocity as (
    select o.cabinet_id, o.nm_id, count(*) / 7.0 per_day
    from wb_orders o
    where o.order_date between p_date - 6 and p_date and not coalesce(o.is_return, false)
    group by 1, 2
),
risk as (
    select v.cabinet_id, v.nm_id, coalesce(s.qty, 0) qty, round(v.per_day, 1) per_day,
           round(coalesce(s.qty, 0) / nullif(v.per_day, 0), 1) days,
           (select a.name from rnp_articles a where a.cabinet_id::text = v.cabinet_id::text and a.nm_id = v.nm_id limit 1) art_name
    from velocity v left join stock s on s.cabinet_id = v.cabinet_id and s.nm_id = v.nm_id
    where v.per_day >= 1 and coalesce(s.qty, 0) / v.per_day < 7
),
pen as (
    select f.cabinet_id::text cab, coalesce(sum(f.penalty), 0) amt
    from raw_finance_report f
    where coalesce(f.sale_dt, f.rr_dt) between p_date - 6 and p_date and f.penalty <> 0
    group by 1
)
select coalesce(jsonb_agg(row_to_json(x) order by x.name), '[]'::jsonb)
from (
    select c.id, c.name, c.nr_managed, c.wb_token_set, c.adv_token_valid,
           (select r from rate) rate,
           coalesce((select cnt from ord where ord.cabinet_id = c.id and ord.d = p_date), 0) orders_cnt,
           coalesce((select amt from ord where ord.cabinet_id = c.id and ord.d = p_date), 0) orders_rub,
           coalesce((select cnt from ord where ord.cabinet_id = c.id and ord.d = p_date - 1), 0) orders_prev_cnt,
           coalesce((select cnt from ord where ord.cabinet_id = c.id and ord.d = p_date - 7), 0) orders_week_cnt,
           (select coalesce(jsonb_agg(jsonb_build_object('d', gs::date,
                    'cnt', coalesce(o.cnt, 0), 'amt', coalesce(o.amt, 0)) order by gs), '[]'::jsonb)
              from generate_series(p_date - 13, p_date, interval '1 day') gs
              left join ord o on o.cabinet_id = c.id and o.d = gs::date) series,
           (select planned from plan where plan.cab = c.id::text) plan_orders,
           (select cnt from sales where sales.cab = c.id::text) sales_cnt,
           (select amt from sales where sales.cab = c.id::text) sales_rub,
           coalesce((select spend from ads where ads.cabinet_id = c.id), 0) ad_spend,
           coalesce((select orders from ads where ads.cabinet_id = c.id), 0) ad_orders,
           coalesce((select revenue from ads where ads.cabinet_id = c.id), 0) ad_revenue,
           (select coalesce(jsonb_agg(jsonb_build_object('id', k.campaign_id, 'name', k.campaign_name,
                    'status', k.status, 'pay', k.payment_type, 'budget', k.budget_total,
                    'spend', k.spend, 'orders', k.orders, 'revenue', k.revenue) order by k.status, k.spend desc), '[]'::jsonb)
              from camp k where k.cabinet_id = c.id) campaigns,
           (select coalesce(jsonb_agg(jsonb_build_object('nm', r.nm_id, 'name', r.art_name, 'qty', r.qty,
                    'per_day', r.per_day, 'days', r.days) order by r.days), '[]'::jsonb)
              from risk r where r.cabinet_id = c.id) stock_risk,
           coalesce((select amt from pen where pen.cab = c.id::text), 0) penalties_7d_rub,
           (select count(*) from rnp_articles a where a.cabinet_id::text = c.id::text and a.is_active) arts_total,
           (select count(*) from rnp_articles a where a.cabinet_id::text = c.id::text and a.is_active and a.cost_price > 0) arts_cost,
           (select to_jsonb(ob) - 'cabinet_id' from cabinet_onboarding ob where ob.cabinet_id = c.id) onboarding
    from cabs c
) x
$$;

revoke all on function public.cabinets_hub(date) from public, anon;
grant execute on function public.cabinets_hub(date) to authenticated, service_role;
