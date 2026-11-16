-- Комиссия WB в процентах: считается от цены продавца (retail_price_withdisc_rub), а не от цены покупателя (retail_amount).
-- comm_base = цена продавца по продажам минус возвраты; comm_true = comm_base − эквайринг − к перечислению (без компенсаций).
drop function if exists public.rnp_fin_by_nm(uuid, date, date, bigint[]);
create or replace function public.rnp_fin_by_nm(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(d date, nm_id bigint, acquiring numeric, compensation numeric, comm_base numeric, comm_true numeric)
language sql
stable
set search_path to 'public'
as $function$
    with x as (
        select f.rr_dt, f.nm_id,
               sum(case f.supplier_oper_name when 'Продажа' then coalesce(f.acquiring_fee, 0)
                                             when 'Возврат' then -coalesce(f.acquiring_fee, 0) else 0 end) as acq,
               sum(case f.supplier_oper_name when 'Добровольная компенсация при возврате' then f.ppvz_for_pay else 0 end) as comp,
               sum(case f.supplier_oper_name when 'Продажа' then coalesce(f.retail_price_withdisc_rub, 0)
                                             when 'Возврат' then -coalesce(f.retail_price_withdisc_rub, 0) else 0 end) as base,
               sum(case f.supplier_oper_name when 'Продажа' then f.ppvz_for_pay
                                             when 'Возврат' then -f.ppvz_for_pay else 0 end) as pay
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to and f.nm_id is not null
          and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
        group by f.rr_dt, f.nm_id
    )
    select rr_dt, nm_id, round(coalesce(acq, 0), 2), round(coalesce(comp, 0), 2),
           round(coalesce(base, 0), 2), round(coalesce(base, 0) - coalesce(acq, 0) - coalesce(pay, 0), 2)
    from x order by 1, 2
$function$;
revoke all on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) to authenticated, service_role;

create or replace function public.rnp_cabinet_comm(p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null)
returns table(d date, comm_base numeric, comm_true numeric)
language sql
stable
set search_path to 'public'
as $function$
    select s.d, sum(s.comm_base), sum(s.comm_true) from public.rnp_fin_by_nm(p_cabinet, p_from, p_to, p_nm_ids) s group by s.d order by 1
$function$;
revoke all on function public.rnp_cabinet_comm(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_cabinet_comm(uuid, date, date, bigint[]) to authenticated, service_role;
