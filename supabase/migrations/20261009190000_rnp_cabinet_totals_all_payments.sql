-- РНП «Общий»: все платежи и удержания WB отдельными статьями — эквайринг, компенсации, доплаты.
-- «К выводу» = «Итого к оплате» WB: к перечислению + доплаты − доставка − хранение − обработка − штрафы − прочие удержания.
drop function if exists public.rnp_cabinet_totals(uuid, date, date);
create or replace function public.rnp_cabinet_totals(p_cabinet uuid, p_from date, p_to date)
returns table (
    d date, realization numeric, to_transfer numeric, delivery numeric, storage numeric,
    penalty numeric, deduction numeric, acceptance numeric, to_withdraw numeric, ad_spend numeric,
    balance_current numeric, balance_for_withdraw numeric,
    acquiring numeric, compensation numeric, additional numeric
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
               sum(case f.supplier_oper_name when 'Продажа' then coalesce(f.acquiring_fee, 0)
                                             when 'Возврат' then -coalesce(f.acquiring_fee, 0) else 0 end) as acquiring,
               sum(case f.supplier_oper_name when 'Добровольная компенсация при возврате' then f.ppvz_for_pay else 0 end) as compensation,
               sum(coalesce(f.additional_payment, 0)) as additional,
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
           round(coalesce(fin.to_transfer, 0) + coalesce(fin.additional, 0) - coalesce(fin.delivery, 0) - coalesce(fin.storage, 0)
                 - coalesce(fin.penalty, 0) - coalesce(fin.deduction, 0) - coalesce(fin.acceptance, 0), 2),
           round(coalesce(ads.ad_spend, 0), 2),
           bal.current, bal.for_withdraw,
           round(coalesce(fin.acquiring, 0), 2), round(coalesce(fin.compensation, 0), 2), round(coalesce(fin.additional, 0), 2)
    from days
    left join fin on fin.d = days.d
    left join ads on ads.d = days.d
    left join bal on bal.d = days.d
    order by 1
$$;
revoke all on function public.rnp_cabinet_totals(uuid, date, date) from public, anon;
grant execute on function public.rnp_cabinet_totals(uuid, date, date) to authenticated, service_role;
