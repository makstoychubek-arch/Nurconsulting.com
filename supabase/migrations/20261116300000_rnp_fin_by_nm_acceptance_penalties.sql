-- РНП, отдельный артикул: приёмка и штрафы по видам (те же виды, что у rnp_cabinet_fin_split) по дням и артикулам.
drop function if exists public.rnp_fin_by_nm(uuid, date, date, bigint[]);
create or replace function public.rnp_fin_by_nm(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(
    d date, nm_id bigint, acquiring numeric, compensation numeric, comm_base numeric, comm_true numeric,
    acceptance numeric,
    pen_dims numeric, pen_accept numeric, pen_sub numeric, pen_cancel numeric, pen_pvz numeric, pen_supply numeric, pen_other numeric
)
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
                                             when 'Возврат' then -f.ppvz_for_pay else 0 end) as pay,
               sum(coalesce(f.acceptance, 0)) as acc,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%габарит%' then coalesce(f.penalty, 0) else 0 end) as p_dims,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%расхождения в карточке%' then coalesce(f.penalty, 0) else 0 end) as p_accept,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%отличного от заявленного%' or coalesce(f.bonus_type_name, '') ilike '%подмена товара%' then coalesce(f.penalty, 0) else 0 end) as p_sub,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%невыполненный заказ%' then coalesce(f.penalty, 0) else 0 end) as p_cancel,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%возвратов на пвз%' then coalesce(f.penalty, 0) else 0 end) as p_pvz,
               sum(case when coalesce(f.bonus_type_name, '') ilike '%недовоз%' then coalesce(f.penalty, 0) else 0 end) as p_supply,
               sum(coalesce(f.penalty, 0)) as p_all
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to and f.nm_id is not null
          and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
        group by f.rr_dt, f.nm_id
    )
    select rr_dt, nm_id, round(coalesce(acq, 0), 2), round(coalesce(comp, 0), 2),
           round(coalesce(base, 0), 2), round(coalesce(base, 0) - coalesce(acq, 0) - coalesce(pay, 0), 2),
           round(coalesce(acc, 0), 2),
           round(coalesce(p_dims, 0), 2), round(coalesce(p_accept, 0), 2), round(coalesce(p_sub, 0), 2), round(coalesce(p_cancel, 0), 2),
           round(coalesce(p_pvz, 0), 2), round(coalesce(p_supply, 0), 2),
           round(coalesce(p_all, 0) - coalesce(p_dims, 0) - coalesce(p_accept, 0) - coalesce(p_sub, 0) - coalesce(p_cancel, 0) - coalesce(p_pvz, 0) - coalesce(p_supply, 0), 2)
    from x order by 1, 2
$function$;
revoke all on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) to authenticated, service_role;
