-- Баланс продавца WB по дням: снимок раз в сутки (write-once), чтобы строить историю.
-- Источник: GET finance-api.wildberries.ru/api/v1/account/balance (токен категории «Финансы»).
create table if not exists public.wb_balance_daily (
    cabinet_id   uuid not null references public.cabinets(id) on delete cascade,
    date         date not null,
    currency     text,
    current      numeric not null,
    for_withdraw numeric,
    fetched_at   timestamptz not null default now(),
    primary key (cabinet_id, date)
);
alter table public.wb_balance_daily enable row level security;
drop policy if exists cabinet_access on public.wb_balance_daily;
create policy cabinet_access on public.wb_balance_daily for select
    using (cabinet_id in (select current_user_cabinet_ids()));
revoke all on public.wb_balance_daily from anon;
grant select on public.wb_balance_daily to authenticated;
comment on table public.wb_balance_daily is 'Write-once daily WB seller balance snapshot (current / for_withdraw).';

-- Итоги кабинета за день + баланс на конец дня.
drop function if exists public.rnp_cabinet_totals(uuid, date, date);
create or replace function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date)
returns table (
    d date, realization numeric, to_transfer numeric, delivery numeric, storage numeric,
    penalty numeric, deduction numeric, acceptance numeric, to_withdraw numeric, ad_spend numeric,
    balance_current numeric, balance_for_withdraw numeric
)
language sql stable security invoker set search_path = public
as $$
    with fin as (
        select f.rr_dt as d,
               sum(case f.supplier_oper_name when 'Продажа' then f.retail_amount
                                             when 'Возврат' then -f.retail_amount else 0 end) as realization,
               sum(case f.supplier_oper_name when 'Продажа' then f.ppvz_for_pay
                                             when 'Возврат' then -f.ppvz_for_pay
                                             when 'Добровольная компенсация при возврате' then f.ppvz_for_pay
                                             else 0 end) as to_transfer,
               sum(coalesce(f.delivery_rub, 0)) as delivery,
               sum(coalesce(f.storage_fee, 0)) as storage,
               sum(coalesce(f.penalty, 0)) as penalty,
               sum(coalesce(f.deduction, 0)) as deduction,
               sum(coalesce(f.acceptance, 0)) as acceptance
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
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
        select d from fin union select d from ads union select d from bal
    )
    select days.d,
           round(coalesce(fin.realization, 0), 2), round(coalesce(fin.to_transfer, 0), 2),
           round(coalesce(fin.delivery, 0), 2), round(coalesce(fin.storage, 0), 2),
           round(coalesce(fin.penalty, 0), 2), round(coalesce(fin.deduction, 0), 2),
           round(coalesce(fin.acceptance, 0), 2),
           round(coalesce(fin.to_transfer, 0) - coalesce(fin.delivery, 0) - coalesce(fin.storage, 0)
                 - coalesce(fin.penalty, 0) - coalesce(fin.deduction, 0) - coalesce(fin.acceptance, 0), 2),
           round(coalesce(ads.ad_spend, 0), 2),
           bal.current, bal.for_withdraw
    from days
    left join fin on fin.d = days.d
    left join ads on ads.d = days.d
    left join bal on bal.d = days.d
    order by 1
$$;
revoke all on function public.rnp_cabinet_totals(uuid, date, date) from public, anon;
grant execute on function public.rnp_cabinet_totals(uuid, date, date) to authenticated, service_role;

-- Причины удержаний и штрафов за период (по строкам финотчёта WB): «Оказание услуг WB Продвижение, документ №…» и т.п.
create or replace function public.rnp_cabinet_deductions(p_cabinet uuid, p_from date, p_to date, p_kind text default 'deduction')
returns table (d date, kind text, reason text, amount numeric, cnt integer)
language sql stable security invoker set search_path = public
as $$
    select f.rr_dt, coalesce(nullif(f.supplier_oper_name, ''), '—'),
           coalesce(nullif(f.bonus_type_name, ''), nullif(f.supplier_oper_name, ''), 'Причина не указана в отчёте'),
           round(sum(case when p_kind = 'penalty' then coalesce(f.penalty, 0) else coalesce(f.deduction, 0) end), 2),
           count(*)::int
    from raw_finance_report f
    where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
      and (case when p_kind = 'penalty' then coalesce(f.penalty, 0) else coalesce(f.deduction, 0) end) <> 0
    group by 1, 2, 3
    order by 1 desc, 4 desc
$$;
revoke all on function public.rnp_cabinet_deductions(uuid, date, date, text) from public, anon;
grant execute on function public.rnp_cabinet_deductions(uuid, date, date, text) to authenticated, service_role;
