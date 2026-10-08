-- Окно «Кабинеты», v3: период из общего выбора дат в шапке (p_from..p_to) и заказы из воронки WB
-- (rnp_daily_data, те же цифры, что в РНП и в кабинете WB). Таблица wb_orders недосчитывала заказы.
create or replace function public.cabinets_hub(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with cabs as (
    select c.id, c.name, c.nr_managed, c.wb_token_set, c.adv_token_valid from cabinets c
),
per as (
    select (p_to - p_from + 1) len
),
rate as (
    select coalesce((select rate from exchange_rates where pair = 'RUB_KGS' and date <= p_to order by date desc limit 1), 1) as r
),
daily as (
    select r.cabinet_id::text cab, r.date d, sum(r.orders_count) cnt, sum(r.orders_sum) amt,
           sum(r.sales_count) scnt, sum(r.sales_sum) samt
    from rnp_daily_data r
    where r.date between least(p_from, p_to - 13) - (p_to - p_from + 1) and p_to
    group by 1, 2
),
ads as (
    select s.cabinet_id, sum(s.spend) spend, sum(s.orders) orders, sum(s.sum_price) revenue
    from advertising_daily_stats s where s.stat_date between p_from and p_to group by 1
),
camp as (
    select c.cabinet_id, c.campaign_id, c.campaign_name, c.status, c.payment_type, c.budget_total,
           coalesce(s.spend, 0) spend, coalesce(s.orders, 0) orders, coalesce(s.sum_price, 0) revenue
    from advertising_campaigns c
    left join (
        select cabinet_id, campaign_id, sum(spend) spend, sum(orders) orders, sum(sum_price) sum_price
        from advertising_daily_stats where stat_date between p_from and p_to group by 1, 2
    ) s on s.cabinet_id = c.cabinet_id and s.campaign_id = c.campaign_id
    where c.status = 9 or coalesce(s.spend, 0) > 0
),
plan as (
    select p.cabinet_id::text cab, sum(p.planned_orders) planned
    from rnp_plans p where p.plan_date between p_from and p_to group by 1
),
stock_day as (
    select g.cabinet_id, max(g.date) d from goods_daily_stocks g where g.date <= p_to + 1 group by 1
),
stock as (
    select g.cabinet_id, g.nm_id, sum(g.qty) qty
    from goods_daily_stocks g join stock_day sd on sd.cabinet_id = g.cabinet_id and sd.d = g.date
    group by 1, 2
),
velocity as (
    select r.cabinet_id::text cab, r.nm_id, sum(r.orders_count) / 7.0 per_day
    from rnp_daily_data r where r.date between p_to - 6 and p_to group by 1, 2
),
risk as (
    select v.cab, v.nm_id, coalesce(s.qty, 0) qty, round(v.per_day, 1) per_day,
           round(coalesce(s.qty, 0) / nullif(v.per_day, 0), 1) days,
           (select a.name from rnp_articles a where a.cabinet_id::text = v.cab and a.nm_id = v.nm_id limit 1) art_name
    from velocity v left join stock s on s.cabinet_id::text = v.cab and s.nm_id = v.nm_id
    where v.per_day >= 1 and coalesce(s.qty, 0) / v.per_day < 7
),
pen as (
    select f.cabinet_id::text cab, sum(f.penalty) amt
    from raw_finance_report f
    where coalesce(f.sale_dt, f.rr_dt) between p_from and p_to and f.penalty <> 0
    group by 1
)
select coalesce(jsonb_agg(row_to_json(x) order by x.name), '[]'::jsonb)
from (
    select c.id, c.name, c.nr_managed, c.wb_token_set, c.adv_token_valid,
           (select r from rate) rate,
           (select len from per) days,
           coalesce((select sum(cnt) from daily where cab = c.id::text and d between p_from and p_to), 0) orders_cnt,
           coalesce((select sum(amt) from daily where cab = c.id::text and d between p_from and p_to), 0) orders_rub,
           coalesce((select sum(cnt) from daily where cab = c.id::text and d between p_from - (p_to - p_from + 1) and p_from - 1), 0) orders_prev_cnt,
           (select sum(scnt) from daily where cab = c.id::text and d between p_from and p_to) sales_cnt,
           (select sum(samt) from daily where cab = c.id::text and d between p_from and p_to) sales_rub,
           (select coalesce(jsonb_agg(jsonb_build_object('d', gs::date, 'cnt', coalesce(dl.cnt, 0), 'amt', coalesce(dl.amt, 0)) order by gs), '[]'::jsonb)
              from generate_series(least(p_from, p_to - 13), p_to, interval '1 day') gs
              left join daily dl on dl.cab = c.id::text and dl.d = gs::date) series,
           (select planned from plan where plan.cab = c.id::text) plan_orders,
           coalesce((select spend from ads where ads.cabinet_id = c.id), 0) ad_spend,
           coalesce((select orders from ads where ads.cabinet_id = c.id), 0) ad_orders,
           coalesce((select revenue from ads where ads.cabinet_id = c.id), 0) ad_revenue,
           (select coalesce(jsonb_agg(jsonb_build_object('id', k.campaign_id, 'name', k.campaign_name,
                    'status', k.status, 'pay', k.payment_type, 'budget', k.budget_total,
                    'spend', k.spend, 'orders', k.orders, 'revenue', k.revenue) order by k.status, k.spend desc), '[]'::jsonb)
              from camp k where k.cabinet_id = c.id) campaigns,
           (select coalesce(jsonb_agg(jsonb_build_object('nm', r.nm_id, 'name', r.art_name, 'qty', r.qty,
                    'per_day', r.per_day, 'days', r.days) order by r.days), '[]'::jsonb)
              from risk r where r.cab = c.id::text) stock_risk,
           coalesce((select amt from pen where pen.cab = c.id::text), 0) penalties_rub,
           (select count(*) from rnp_articles a where a.cabinet_id::text = c.id::text and a.is_active) arts_total,
           (select count(*) from rnp_articles a where a.cabinet_id::text = c.id::text and a.is_active and a.cost_price > 0) arts_cost,
           (select to_jsonb(ob) - 'cabinet_id' from cabinet_onboarding ob where ob.cabinet_id = c.id) onboarding
    from cabs c
) x
$$;

revoke all on function public.cabinets_hub(date, date) from public, anon;
grant execute on function public.cabinets_hub(date, date) to authenticated, service_role;
