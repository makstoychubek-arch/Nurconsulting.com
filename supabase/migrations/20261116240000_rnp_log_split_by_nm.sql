-- РНП, отдельный артикул: логистика по причинам из финотчёта WB, по дням и артикулам (раскрытие строки «Логистика»).
-- Та же раскладка, что у rnp_cabinet_log_split, только с разбивкой по nm_id.
create or replace function public.rnp_log_split_by_nm(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(
    d date, nm_id bigint,
    log_sale numeric, log_cancel_to numeric, log_cancel_from numeric, log_return numeric, log_other numeric
)
language sql
stable
set search_path to 'public'
as $function$
    with l as (
        select f.rr_dt as d, f.nm_id,
               case
                   when coalesce(f.bonus_type_name, '') = 'К клиенту при продаже'    then 'sale'
                   when coalesce(f.bonus_type_name, '') = 'К клиенту при отмене'     then 'cancel_to'
                   when coalesce(f.bonus_type_name, '') = 'От клиента при отмене'    then 'cancel_from'
                   when coalesce(f.bonus_type_name, '') = 'От клиента при возврате'  then 'return'
                   else 'other'
               end as k,
               coalesce(f.delivery_rub, 0) as v
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
          and coalesce(f.delivery_rub, 0) <> 0
          and f.nm_id is not null
          and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
    )
    select d, nm_id,
           round(coalesce(sum(v) filter (where k = 'sale'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'cancel_to'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'cancel_from'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'return'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'other'), 0), 2)
    from l group by d, nm_id order by 1, 2
$function$;
revoke all on function public.rnp_log_split_by_nm(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_log_split_by_nm(uuid, date, date, bigint[]) to authenticated, service_role;
