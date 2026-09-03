-- ============================================================
-- NR Space — РНП: серверный конвейер финотчёта и платного хранения
--
-- Идея (см. ТЗ «РНП — перенос в NR Space»):
--   * WB API дёргается только edge-функцией rnp-finance-sync (кнопка
--     «Обновить» или ночной cron), фронт читает только из БД;
--   * сырые строки отчётов лежат в raw_* (по одной на запись ответа API,
--     только нужные поля), период фиксируется в rnp_sync_state — повторно
--     тот же период не запрашиваем;
--   * свод по артикулу×дню считает rnp_recompute_finance() и пишет в
--     rnp_daily_data, включая коэффициент сверки хранения:
--       коэфф = Σ storage_fee (финотчёт) / Σ warehousePrice (отчёт хранения)
--       хранение по артикулу = сырое × коэфф;
--   * курс ₽→сом — отдельная таблица exchange_rates (дата, курс, источник),
--     не пересчитывается при обновлении РНП.
-- Safe to re-run.
-- ============================================================

-- ── 1. Сырые строки финансового отчёта (reportDetailByPeriod v5) ──────────
create table if not exists public.raw_finance_report (
    cabinet_id                uuid        not null,
    rrd_id                    bigint      not null,
    realizationreport_id      bigint,
    rr_dt                     date,
    sale_dt                   date,
    nm_id                     bigint,
    sa_name                   text,
    doc_type_name             text,
    supplier_oper_name        text,
    quantity                  numeric     default 0,
    retail_amount             numeric     default 0,
    retail_price_withdisc_rub numeric     default 0,
    ppvz_for_pay              numeric     default 0,
    delivery_rub              numeric     default 0,
    penalty                   numeric     default 0,
    storage_fee               numeric     default 0,
    deduction                 numeric     default 0,
    acceptance                numeric     default 0,
    currency_name             text,
    fetched_at                timestamptz not null default now(),
    primary key (cabinet_id, rrd_id)
);
create index if not exists raw_finance_report_cab_date_idx on public.raw_finance_report (cabinet_id, sale_dt);
create index if not exists raw_finance_report_cab_nm_date_idx on public.raw_finance_report (cabinet_id, nm_id, sale_dt);

-- ── 2. Сырые строки отчёта «Платное хранение» (paid_storage, детально) ────
create table if not exists public.raw_storage (
    id              bigserial   primary key,
    cabinet_id      uuid        not null,
    date            date        not null,
    nm_id           bigint,
    vendor_code     text,
    barcode         text,
    chrt_id         bigint,
    warehouse       text,
    warehouse_coef  numeric,
    volume          numeric,
    calc_type       text,
    warehouse_price numeric     default 0,
    fetched_at      timestamptz not null default now()
);
create index if not exists raw_storage_cab_date_idx on public.raw_storage (cabinet_id, date);
create index if not exists raw_storage_cab_nm_date_idx on public.raw_storage (cabinet_id, nm_id, date);

-- ── 3. Курс валют — отдельно и намертво ────────────────────────────────────
create table if not exists public.exchange_rates (
    pair       text        not null default 'RUB_KGS',
    date       date        not null,
    rate       numeric     not null,
    source     text        not null default 'manual',   -- manual | wb_report | nbkr | cbr
    created_at timestamptz not null default now(),
    primary key (pair, date)
);

-- ── 4. Состояние синка по периодам (кэш: тот же период не тянем дважды) ───
create table if not exists public.rnp_sync_state (
    cabinet_id  uuid        not null,
    source      text        not null,           -- finance | storage
    period_from date        not null,
    period_to   date        not null,
    status      text        not null default 'pending', -- pending | done | error
    task_id     text,                           -- id async-задачи WB (paid_storage)
    rows        integer     default 0,
    error       text,
    fetched_at  timestamptz,
    updated_at  timestamptz not null default now(),
    primary key (cabinet_id, source, period_from, period_to)
);

-- ── 5. Новые поля свода ────────────────────────────────────────────────────
alter table public.rnp_daily_data add column if not exists realization   numeric default 0; -- реализация (продажи − возвраты, retail_amount)
alter table public.rnp_daily_data add column if not exists penalty_sum   numeric default 0; -- штрафы
alter table public.rnp_daily_data add column if not exists delivery_sum  numeric default 0; -- доставка (delivery_rub)
alter table public.rnp_daily_data add column if not exists deduction_sum numeric default 0; -- прочие удержания
alter table public.rnp_daily_data add column if not exists storage_raw   numeric default 0; -- хранение по отчёту хранения (до сверки)
alter table public.rnp_daily_data add column if not exists storage_coef  numeric default 0; -- коэффициент сверки периода

-- ── 6. RLS ────────────────────────────────────────────────────────────────
alter table public.raw_finance_report enable row level security;
alter table public.raw_storage        enable row level security;
alter table public.rnp_sync_state     enable row level security;
alter table public.exchange_rates     enable row level security;

drop policy if exists team_cabinet_access on public.raw_finance_report;
create policy team_cabinet_access on public.raw_finance_report
    for all using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));

drop policy if exists team_cabinet_access on public.raw_storage;
create policy team_cabinet_access on public.raw_storage
    for all using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));

drop policy if exists team_cabinet_access on public.rnp_sync_state;
create policy team_cabinet_access on public.rnp_sync_state
    for all using (public.can_access_cabinet(cabinet_id)) with check (public.can_access_cabinet(cabinet_id));

drop policy if exists exchange_rates_read on public.exchange_rates;
create policy exchange_rates_read on public.exchange_rates
    for select to authenticated using (true);
drop policy if exists exchange_rates_write on public.exchange_rates;
create policy exchange_rates_write on public.exchange_rates
    for all to authenticated
    using (public.is_super_admin() or public.is_team_member())
    with check (public.is_super_admin() or public.is_team_member());

-- ── 7. Пересчёт свода по артикулу × дню из сырых таблиц ───────────────────
-- Возвращает jsonb: {rows, coef, fin_storage, raw_storage}
create or replace function public.rnp_recompute_finance(p_cabinet uuid, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_fin_sto numeric := 0;
    v_raw_sto numeric := 0;
    v_coef    numeric := 1;
    v_rows    integer := 0;
    v_now     timestamptz := now();
    v_c_from  date;
    v_c_to    date;
begin
    -- Коэффициент сверки хранения: Σ «Хранение» финотчёта / Σ «Сумма хранения»
    -- детального отчёта. Финотчёт отстаёт на несколько дней, поэтому считаем
    -- по датам, где есть оба отчёта, иначе коэффициент занижен.
    select greatest(p_from, coalesce(min(f.d), p_from), coalesce(min(s.d), p_from)),
           least(p_to, coalesce(max(f.d), p_to), coalesce(max(s.d), p_to))
      into v_c_from, v_c_to
      from (select coalesce(sale_dt, rr_dt) d from raw_finance_report
             where cabinet_id = p_cabinet and storage_fee <> 0
               and coalesce(sale_dt, rr_dt) between p_from and p_to) f
      full join (select date d from raw_storage
                  where cabinet_id = p_cabinet and date between p_from and p_to) s on false;
    if v_c_from is null or v_c_to is null or v_c_from > v_c_to then
        v_c_from := p_from; v_c_to := p_to;
    end if;
    select coalesce(sum(storage_fee), 0) into v_fin_sto
      from raw_finance_report
     where cabinet_id = p_cabinet and coalesce(sale_dt, rr_dt) between v_c_from and v_c_to;
    select coalesce(sum(warehouse_price), 0) into v_raw_sto
      from raw_storage
     where cabinet_id = p_cabinet and date between v_c_from and v_c_to;
    if v_raw_sto > 0 and v_fin_sto > 0 then
        v_coef := v_fin_sto / v_raw_sto;
    end if;

    with fin as (
        select nm_id,
               coalesce(sale_dt, rr_dt) as d,
               sum(case when lower(doc_type_name) = 'продажа' then quantity else 0 end)                       as sc,
               sum(case when lower(doc_type_name) = 'возврат' then quantity else 0 end)                       as rc,
               sum(case when lower(doc_type_name) = 'продажа' then retail_amount
                        when lower(doc_type_name) = 'возврат' then -abs(retail_amount) else 0 end)          as realization,
               sum(case when lower(doc_type_name) = 'продажа' then retail_price_withdisc_rub * quantity else 0 end) as ss,
               sum(ppvz_for_pay)  as tt,
               sum(delivery_rub)  as log,
               sum(penalty)       as pen,
               sum(storage_fee)   as sto_rep,
               sum(deduction)     as ded
          from raw_finance_report
         where cabinet_id = p_cabinet
           and coalesce(sale_dt, rr_dt) between p_from and p_to
           and nm_id is not null and nm_id > 0
         group by nm_id, coalesce(sale_dt, rr_dt)
    ),
    sto as (
        select nm_id, date as d, sum(warehouse_price) as raw_sto
          from raw_storage
         where cabinet_id = p_cabinet and date between p_from and p_to
           and nm_id is not null and nm_id > 0
         group by nm_id, date
    ),
    merged as (
        select coalesce(f.nm_id, s.nm_id) as nm_id,
               coalesce(f.d, s.d)         as d,
               coalesce(f.sc, 0) sc, coalesce(f.rc, 0) rc, coalesce(f.realization, 0) realization,
               coalesce(f.ss, 0) ss, coalesce(f.tt, 0) tt, coalesce(f.log, 0) log, coalesce(f.pen, 0) pen,
               coalesce(f.sto_rep, 0) sto_rep, coalesce(f.ded, 0) ded,
               coalesce(s.raw_sto, 0) raw_sto
          from fin f
          full join sto s on s.nm_id = f.nm_id and s.d = f.d
    ),
    calc as (
        -- Хранение по артикулу: детальный отчёт × коэффициент; если детального
        -- отчёта за период нет — то, что финотчёт привязал к артикулу (обычно 0).
        select nm_id, d, sc, rc, realization, ss, tt, log, pen, ded, raw_sto,
               case when v_raw_sto > 0 then raw_sto * v_coef else sto_rep end as sto_adj
          from merged
    ),
    ins as (
        insert into rnp_daily_data as t (
            cabinet_id, nm_id, date,
            sales_count, sales_sum, returns_count, buyout_pct, return_pct,
            to_transfer, to_transfer_unit,
            logistics_per_unit, logistics_pct,
            storage_sum, storage_pct, commission_pct,
            realization, penalty_sum, delivery_sum, deduction_sum, storage_raw, storage_coef,
            updated_at
        )
        select p_cabinet::text, nm_id, d,
               sc, ss, rc,
               case when sc + rc > 0 then sc / (sc + rc) * 100 else 0 end,
               case when sc + rc > 0 then rc / (sc + rc) * 100 else 0 end,
               tt, case when sc > 0 then tt / sc else 0 end,
               case when sc > 0 then log / sc else 0 end,
               case when ss > 0 then log / ss * 100 else 0 end,
               sto_adj, case when ss > 0 then sto_adj / ss * 100 else 0 end,
               case when ss > 0 then (ss - tt) / ss * 100 else 0 end,
               realization, pen, log, ded, raw_sto, v_coef,
               v_now
          from calc
        on conflict (cabinet_id, nm_id, date) do update set
            sales_count        = excluded.sales_count,
            sales_sum          = excluded.sales_sum,
            returns_count      = excluded.returns_count,
            buyout_pct         = excluded.buyout_pct,
            return_pct         = excluded.return_pct,
            to_transfer        = excluded.to_transfer,
            to_transfer_unit   = excluded.to_transfer_unit,
            logistics_per_unit = excluded.logistics_per_unit,
            logistics_pct      = excluded.logistics_pct,
            storage_sum        = excluded.storage_sum,
            storage_pct        = excluded.storage_pct,
            commission_pct     = excluded.commission_pct,
            realization        = excluded.realization,
            penalty_sum        = excluded.penalty_sum,
            delivery_sum       = excluded.delivery_sum,
            deduction_sum      = excluded.deduction_sum,
            storage_raw        = excluded.storage_raw,
            storage_coef       = excluded.storage_coef,
            updated_at         = excluded.updated_at
        returning 1
    )
    select count(*) into v_rows from ins;

    -- Курс из отчёта WB намеренно НЕ пишем: для отчёта в KGS отношение
    -- retail_amount / retail_price_withdisc_rub — это не валютный курс, а доля
    -- после скидок WB. Курс — только exchange_rates (вручную/НБКР) и настройки.
    return jsonb_build_object('rows', v_rows, 'coef', v_coef, 'coef_from', v_c_from, 'coef_to', v_c_to,
                              'fin_storage', v_fin_sto, 'raw_storage', v_raw_sto);
end;
$$;

-- Курс на дату: ручной/НБКР из exchange_rates, иначе последний известный ≤ даты
create or replace function public.rnp_rate_for(p_date date, p_pair text default 'RUB_KGS')
returns numeric
language sql
stable
security definer
set search_path = public
as $$
    select rate from exchange_rates
     where pair = p_pair and date <= p_date
     order by date desc limit 1;
$$;
