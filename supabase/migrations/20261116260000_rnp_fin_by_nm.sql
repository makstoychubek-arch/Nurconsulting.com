-- РНП, отдельный артикул: эквайринг и компенсации по дням и артикулам из финотчёта WB (для строк «Комиссия» и «Эквайринг»).
-- Формулы те же, что у rnp_cabinet_totals.
create or replace function public.rnp_fin_by_nm(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(d date, nm_id bigint, acquiring numeric, compensation numeric)
language sql
stable
set search_path to 'public'
as $function$
    select f.rr_dt, f.nm_id,
           round(coalesce(sum(case f.supplier_oper_name when 'Продажа' then coalesce(f.acquiring_fee, 0)
                                                        when 'Возврат' then -coalesce(f.acquiring_fee, 0) else 0 end), 0), 2),
           round(coalesce(sum(case f.supplier_oper_name when 'Добровольная компенсация при возврате' then f.ppvz_for_pay else 0 end), 0), 2)
    from raw_finance_report f
    where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to and f.nm_id is not null
      and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
    group by f.rr_dt, f.nm_id
    order by 1, 2
$function$;
revoke all on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_fin_by_nm(uuid, date, date, bigint[]) to authenticated, service_role;
