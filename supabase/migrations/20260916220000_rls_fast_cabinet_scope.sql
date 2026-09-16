-- ============================================================
-- NR Space — RLS перестаёт быть тормозом дашборда
--
-- Политики вида `using (can_access_cabinet(cabinet_id))` вызывают функцию
-- на КАЖДУЮ строку. dashboard_summary делает 13 проходов по wb_orders и
-- wb_stocks, поэтому один вызов превращался в сотни тысяч вызовов функции:
--   без RLS  —    5 мс
--   с RLS    — 2207 мс
--
-- Плюс на большинстве таблиц лежало по 2-3 перекрывающиеся политики, и
-- Postgres вычислял их все.
--
-- Заменяем на одну политику с проверкой по множеству:
--   cabinet_id in (select public.current_user_cabinet_ids())
-- Такой подзапрос не зависит от строки, поэтому считается один раз за
-- запрос. Права не меняются: current_user_cabinet_ids() — это ровно
-- «супер-админ ИЛИ сотрудник ИЛИ владелец кабинета», то есть объединение
-- всего, что разрешали снятые политики. Образец уже был в ab_experiments_own.
-- Safe to re-run.
-- ============================================================

-- Снимаем старые политики по именам, которые накопились в проекте.
do $$
declare
    t text;
    p text;
    tables text[] := array[
        'advertising_campaigns', 'advertising_daily_stats', 'autobidder_log',
        'autobidder_rules_legacy_mvp', 'goods_daily_stocks', 'raw_finance_report',
        'raw_storage', 'rnp_articles', 'rnp_daily_data', 'rnp_date_notes',
        'rnp_plans', 'rnp_settings', 'rnp_sync_state', 'sync_log',
        'telegram_channel_mutes', 'wb_cache', 'wb_cluster_cache',
        'wb_cluster_stats_history', 'wb_orders', 'wb_restock_questions', 'wb_stocks'
    ];
begin
    foreach t in array tables loop
        foreach p in array array[
            'own_cabinet_data', 'team_cabinet_access', 'cabinet_access',
            'cabinet_access_select', 'cabinet_access_insert',
            t || '_own', t || '_all', t || '_select', t || '_read', t || '_insert',
            'sync_log_read', 'telegram_mutes_all'
        ] loop
            execute format('drop policy if exists %I on public.%I', p, t);
        end loop;
    end loop;
end $$;

drop policy if exists wb_cache_own on public.wb_cache;
drop policy if exists autobidder_rules_legacy_mvp_all on public.autobidder_rules_legacy_mvp;

-- Полный доступ к данным своих кабинетов: cabinet_id типа uuid.
do $$
declare
    t text;
begin
    foreach t in array array[
        'advertising_campaigns', 'advertising_daily_stats', 'autobidder_rules_legacy_mvp',
        'raw_finance_report', 'raw_storage', 'rnp_plans', 'rnp_sync_state',
        'telegram_channel_mutes', 'wb_cache', 'wb_cluster_cache',
        'wb_cluster_stats_history', 'wb_orders', 'wb_stocks'
    ] loop
        execute format(
            'create policy cabinet_access on public.%I for all '
            || 'using (cabinet_id in (select public.current_user_cabinet_ids())) '
            || 'with check (cabinet_id in (select public.current_user_cabinet_ids()))',
            t
        );
    end loop;
end $$;

-- РНП-таблицы держат cabinet_id текстом, приведение уже было в прежних политиках.
do $$
declare
    t text;
begin
    foreach t in array array['rnp_articles', 'rnp_daily_data', 'rnp_date_notes', 'rnp_settings'] loop
        execute format(
            'create policy cabinet_access on public.%I for all '
            || 'using (cabinet_id::uuid in (select public.current_user_cabinet_ids())) '
            || 'with check (cabinet_id::uuid in (select public.current_user_cabinet_ids()))',
            t
        );
    end loop;
end $$;

-- Таблицы, куда клиент только читает: пишет их сервис по service_role.
do $$
declare
    t text;
begin
    foreach t in array array['goods_daily_stocks', 'sync_log', 'wb_restock_questions'] loop
        execute format(
            'create policy cabinet_access on public.%I for select '
            || 'using (cabinet_id in (select public.current_user_cabinet_ids()))',
            t
        );
    end loop;
end $$;

-- autobidder_log: чтение своих кабинетов, запись только в свои.
create policy cabinet_access_select on public.autobidder_log for select
    using (cabinet_id in (select public.current_user_cabinet_ids()));
create policy cabinet_access_insert on public.autobidder_log for insert
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

-- dashboard_summary проходит по wb_orders и wb_stocks 13 раз. Проверять права
-- на каждую строку каждого прохода бессмысленно: кабинет в запросе один.
-- Проверяем доступ к нему один раз и дальше считаем без RLS.
create or replace function public.dashboard_summary(
    p_cabinet_id uuid,
    p_from date,
    p_to date,
    p_prev_from date,
    p_prev_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_result jsonb;
begin
    if not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    -- Один проход по заказам вместо семи и один по остаткам вместо четырёх.
    with orders as (
        select order_date, price, is_return
        from public.wb_orders
        where cabinet_id = p_cabinet_id
          and order_date >= least(p_from, p_prev_from)
          and order_date <= greatest(p_to, p_prev_to)
    ),
    totals as (
        select
            count(*) filter (where not is_return and order_date between p_from and p_to) as cur_cnt,
            sum(price) filter (where not is_return and order_date between p_from and p_to) as cur_sum,
            count(*) filter (where is_return and order_date between p_from and p_to) as cur_ret,
            count(*) filter (where not is_return and order_date between p_prev_from and p_prev_to) as prev_cnt,
            sum(price) filter (where not is_return and order_date between p_prev_from and p_prev_to) as prev_sum,
            count(*) filter (where is_return and order_date between p_prev_from and p_prev_to) as prev_ret
        from orders
    ),
    daily as (
        select jsonb_agg(jsonb_build_object('date', d, 'sum', s, 'count', c, 'returns', r) order by d) as rows
        from (
            select order_date as d,
                   sum(price) filter (where not is_return) as s,
                   count(*) filter (where not is_return) as c,
                   count(*) filter (where is_return) as r
            from orders
            where order_date between p_from and p_to
            group by order_date
        ) day_rows
    ),
    stock_rows as (
        select
            coalesce(warehouse_name, 'Неизвестно') as warehouse_name,
            coalesce(nullif(stock_scheme, ''), 'fbo') as scheme,
            sum(quantity) as qty
        from public.wb_stocks
        where cabinet_id = p_cabinet_id
        group by 1, 2
    ),
    stocks as (
        select
            coalesce(sum(qty), 0) as total,
            coalesce(sum(qty) filter (where scheme = 'fbo'), 0) as fbo,
            coalesce(sum(qty) filter (where scheme = 'fbs'), 0) as fbs,
            coalesce((
                select jsonb_agg(jsonb_build_object(
                    'warehouse_name', warehouse_name, 'qty', qty, 'scheme', scheme
                ) order by qty desc)
                from stock_rows
            ), '[]'::jsonb) as by_warehouse
        from stock_rows
    )
    select jsonb_build_object(
        'stock_total', stocks.total,
        'stock_fbo', stocks.fbo,
        'stock_fbs', stocks.fbs,
        'stock_by_warehouse', stocks.by_warehouse,
        'cur', jsonb_build_object(
            'orders_count', coalesce(totals.cur_cnt, 0),
            'orders_sum', coalesce(totals.cur_sum, 0),
            'returns_count', coalesce(totals.cur_ret, 0)
        ),
        'prev', jsonb_build_object(
            'orders_count', coalesce(totals.prev_cnt, 0),
            'orders_sum', coalesce(totals.prev_sum, 0),
            'returns_count', coalesce(totals.prev_ret, 0)
        ),
        'cur_daily', coalesce(daily.rows, '[]'::jsonb)
    )
    into v_result
    from totals, daily, stocks;

    return v_result;
end;
$$;

revoke all on function public.dashboard_summary(uuid, date, date, date, date) from public;
grant execute on function public.dashboard_summary(uuid, date, date, date, date) to authenticated, service_role;
