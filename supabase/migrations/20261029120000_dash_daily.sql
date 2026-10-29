-- Маленькая «витрина» итогов дашборда: по дню и кабинету заказы, суммы, возвраты и воронка.
-- Раньше dashboard_summary каждый раз сканировала сотни тысяч строк wb_orders и rnp_daily_data, которые вытесняются из кэша базы
-- (на «холодную» первый вызов шёл до 19 секунд). Теперь итоги читают эту таблицу (несколько тысяч строк, всегда в памяти).

create table if not exists public.dash_daily (
    cabinet_id uuid not null,
    d date not null,
    wb_sum numeric not null default 0,      -- сумма заказов без возвратов (wb_orders.price)
    wb_cnt integer not null default 0,      -- число заказов без возвратов
    wb_ret integer not null default 0,      -- число возвратов
    funnel_cnt numeric,                     -- заказы по воронке (rnp_daily_data), null если за день строк нет
    has_wb boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (cabinet_id, d)
);

alter table public.dash_daily enable row level security;
revoke all on public.dash_daily from anon, authenticated, public;

-- Пересчёт витрины за период (по всем кабинетам или по одному). Строка дня есть, если за него есть заказы или строки воронки.
create or replace function public.dash_daily_refresh(p_from date, p_to date, p_cabinet uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_n integer;
begin
    delete from public.dash_daily
    where d between p_from and p_to
      and (p_cabinet is null or cabinet_id = p_cabinet);

    insert into public.dash_daily (cabinet_id, d, wb_sum, wb_cnt, wb_ret, funnel_cnt, has_wb)
    select
        coalesce(w.cabinet_id, f.cabinet_id) as cabinet_id,
        coalesce(w.d, f.d) as d,
        coalesce(w.s, 0), coalesce(w.c, 0), coalesce(w.r, 0),
        f.cnt,
        w.d is not null
    from (
        select cabinet_id, order_date as d,
               sum(price) filter (where not is_return) as s,
               count(*) filter (where not is_return) as c,
               count(*) filter (where is_return) as r
        from public.wb_orders
        where order_date between p_from and p_to
          and (p_cabinet is null or cabinet_id = p_cabinet)
        group by cabinet_id, order_date
    ) w
    full outer join (
        select cabinet_id::uuid as cabinet_id, date as d,
               sum(
                   case
                       when coalesce(basket_count, 0) > 0 and coalesce(funnel_order_conv, 0) > 0
                       then round(basket_count * funnel_order_conv / 100.0)::int
                       else coalesce(orders_count, 0)
                   end
               ) as cnt
        from public.rnp_daily_data
        where date between p_from and p_to
          and (p_cabinet is null or cabinet_id = p_cabinet::text)
        group by cabinet_id, date
    ) f on f.cabinet_id = w.cabinet_id and f.d = w.d;

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

revoke all on function public.dash_daily_refresh(date, date, uuid) from public, anon, authenticated;
grant execute on function public.dash_daily_refresh(date, date, uuid) to service_role;

-- Первичное заполнение: вся история.
select public.dash_daily_refresh('2000-01-01'::date, '2100-01-01'::date, null);

-- Свежие дни пересчитываются каждую минуту (дашборд видит новые заказы почти сразу), вся история раз в ночь.
select cron.unschedule(jobid) from cron.job where jobname in ('dash-daily-recent', 'dash-daily-full');
select cron.schedule('dash-daily-recent', '* * * * *',
    $c$select public.dash_daily_refresh(((now() at time zone 'Asia/Bishkek')::date - 2), ((now() at time zone 'Asia/Bishkek')::date + 1), null)$c$);
select cron.schedule('dash-daily-full', '40 21 * * *',
    $c$select public.dash_daily_refresh('2000-01-01'::date, '2100-01-01'::date, null)$c$);
