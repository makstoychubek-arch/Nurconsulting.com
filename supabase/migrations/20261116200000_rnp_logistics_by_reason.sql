-- РНП «Общий»: логистика по причинам из финотчёта WB (раскрытие строки «Логистика»).
-- Основа та же, что у rnp_cabinet_totals: дата отчёта rr_dt, выбранные артикулы (p_nm_ids).
-- Сумма причин = строке «Логистика» (delivery_rub), «коррекция логистики» и возвраты брака уходят в log_other.
create or replace function public.rnp_cabinet_log_split(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(
    d date,
    log_sale numeric, log_cancel_to numeric, log_cancel_from numeric, log_return numeric, log_other numeric
)
language sql
stable
set search_path to 'public'
as $function$
    with l as (
        select f.rr_dt as d,
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
          and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
    )
    select d,
           round(coalesce(sum(v) filter (where k = 'sale'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'cancel_to'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'cancel_from'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'return'), 0), 2),
           round(coalesce(sum(v) filter (where k = 'other'), 0), 2)
    from l group by d order by 1
$function$;
revoke all on function public.rnp_cabinet_log_split(uuid, date, date, bigint[]) from public, anon;
grant execute on function public.rnp_cabinet_log_split(uuid, date, date, bigint[]) to authenticated, service_role;
