-- Ускорение РНП (владелец, 24 ноября 2026): запросы WB шли с проверкой доступа к каждой строке (RLS), поэтому занимали 1–4 секунды вместо долей секунды,
-- а в часы нагрузки выходили за таймаут (пустая таблица). Теперь проверка доступа одна на запрос (как у запросов Ozon): прежние функции переименованы в *_raw,
-- а под прежними именами и с теми же параметрами стоят обёртки, которые проверяют can_view_cabinet и вызывают их. Результат тот же.

-- rnp_orders_daily
do $$ begin if exists (select 1 from pg_proc where proname = 'rnp_orders_daily' and pronamespace = 'public'::regnamespace) and not exists (select 1 from pg_proc where proname = 'rnp_orders_daily_raw' and pronamespace = 'public'::regnamespace) then alter function public.rnp_orders_daily(p_cabinet_id uuid, p_from date, p_to date) rename to rnp_orders_daily_raw; end if; end $$;
revoke all on function public.rnp_orders_daily_raw(p_cabinet_id uuid, p_from date, p_to date) from public, anon, authenticated;
create or replace function public.rnp_orders_daily(p_cabinet_id uuid, p_from date, p_to date)
 returns jsonb
 language sql stable security definer set search_path to 'public'
as $f$
    select case when public.can_view_cabinet(p_cabinet_id::text) then public.rnp_orders_daily_raw(p_cabinet_id, p_from, p_to) else '[]'::jsonb end
$f$;
revoke all on function public.rnp_orders_daily(p_cabinet_id uuid, p_from date, p_to date) from public;
grant execute on function public.rnp_orders_daily(p_cabinet_id uuid, p_from date, p_to date) to anon, authenticated, service_role;

-- rnp_cabinet_totals
do $$ begin if exists (select 1 from pg_proc where proname = 'rnp_cabinet_totals' and pronamespace = 'public'::regnamespace) and not exists (select 1 from pg_proc where proname = 'rnp_cabinet_totals_raw' and pronamespace = 'public'::regnamespace) then alter function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[]) rename to rnp_cabinet_totals_raw; end if; end $$;
revoke all on function public.rnp_cabinet_totals_raw(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[]) from public, anon, authenticated;
create or replace function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] DEFAULT NULL::bigint[])
 returns TABLE(d date, realization numeric, to_transfer numeric, delivery numeric, storage numeric, penalty numeric, deduction numeric, acceptance numeric, to_withdraw numeric, ad_spend numeric, balance_current numeric, balance_for_withdraw numeric, acquiring numeric, compensation numeric, additional numeric)
 language sql stable security definer set search_path to 'public'
as $f$
    select * from public.rnp_cabinet_totals_raw(p_cabinet, p_from, p_to, p_nm_ids) where public.can_view_cabinet(p_cabinet::text)
$f$;
revoke all on function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[]) from public;
grant execute on function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[]) to authenticated, service_role;

-- rnp_cabinet_payouts
do $$ begin if exists (select 1 from pg_proc where proname = 'rnp_cabinet_payouts' and pronamespace = 'public'::regnamespace) and not exists (select 1 from pg_proc where proname = 'rnp_cabinet_payouts_raw' and pronamespace = 'public'::regnamespace) then alter function public.rnp_cabinet_payouts(p_cabinet uuid, p_weeks integer) rename to rnp_cabinet_payouts_raw; end if; end $$;
revoke all on function public.rnp_cabinet_payouts_raw(p_cabinet uuid, p_weeks integer) from public, anon, authenticated;
create or replace function public.rnp_cabinet_payouts(p_cabinet uuid, p_weeks integer DEFAULT 8)
 returns TABLE(week_start date, week_end date, pay_date date, to_withdraw numeric, closed boolean)
 language sql stable security definer set search_path to 'public'
as $f$
    select * from public.rnp_cabinet_payouts_raw(p_cabinet, p_weeks) where public.can_view_cabinet(p_cabinet::text)
$f$;
revoke all on function public.rnp_cabinet_payouts(p_cabinet uuid, p_weeks integer) from public;
grant execute on function public.rnp_cabinet_payouts(p_cabinet uuid, p_weeks integer) to authenticated, service_role;

-- rnp_cabinet_health
do $$ begin if exists (select 1 from pg_proc where proname = 'rnp_cabinet_health' and pronamespace = 'public'::regnamespace) and not exists (select 1 from pg_proc where proname = 'rnp_cabinet_health_raw' and pronamespace = 'public'::regnamespace) then alter function public.rnp_cabinet_health(p_cabinet uuid, p_from date, p_to date) rename to rnp_cabinet_health_raw; end if; end $$;
revoke all on function public.rnp_cabinet_health_raw(p_cabinet uuid, p_from date, p_to date) from public, anon, authenticated;
create or replace function public.rnp_cabinet_health(p_cabinet uuid, p_from date, p_to date)
 returns TABLE(nm_id bigint, art text, category text, is_active boolean, cost numeric, orders integer, orders_sum numeric, sales integer, returns integer, cancels integer, to_transfer numeric, realization numeric, delivery numeric, storage numeric, penalty numeric, clicks integer, baskets integer, ad_spend numeric, ad_views numeric, ad_clicks numeric, stock integer)
 language sql stable security definer set search_path to 'public'
as $f$
    select * from public.rnp_cabinet_health_raw(p_cabinet, p_from, p_to) where public.can_view_cabinet(p_cabinet::text)
$f$;
revoke all on function public.rnp_cabinet_health(p_cabinet uuid, p_from date, p_to date) from public;
grant execute on function public.rnp_cabinet_health(p_cabinet uuid, p_from date, p_to date) to authenticated, service_role;

-- rnp_fbs_split
do $$ begin if exists (select 1 from pg_proc where proname = 'rnp_fbs_split' and pronamespace = 'public'::regnamespace) and not exists (select 1 from pg_proc where proname = 'rnp_fbs_split_raw' and pronamespace = 'public'::regnamespace) then alter function public.rnp_fbs_split(p_cabinet uuid, p_from date, p_to date) rename to rnp_fbs_split_raw; end if; end $$;
revoke all on function public.rnp_fbs_split_raw(p_cabinet uuid, p_from date, p_to date) from public, anon, authenticated;
create or replace function public.rnp_fbs_split(p_cabinet uuid, p_from date, p_to date)
 returns TABLE(nm_id bigint, d date, orders_fbs integer, sales_fbs integer)
 language sql stable security definer set search_path to 'public'
as $f$
    select * from public.rnp_fbs_split_raw(p_cabinet, p_from, p_to) where public.can_view_cabinet(p_cabinet::text)
$f$;
revoke all on function public.rnp_fbs_split(p_cabinet uuid, p_from date, p_to date) from public;
grant execute on function public.rnp_fbs_split(p_cabinet uuid, p_from date, p_to date) to authenticated, service_role;
