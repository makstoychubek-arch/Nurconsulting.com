-- РНП: отказы (невыкуп) из финотчёта — строки логистики «От клиента при отмене».
alter table public.rnp_daily_data add column if not exists cancels_count integer;

CREATE OR REPLACE FUNCTION public.rnp_recompute_finance(p_cabinet uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               sum(case when lower(doc_type_name) = 'продажа' and coalesce(supplier_oper_name, '') not ilike '%компенсац%' then quantity else 0 end) as sc,
               sum(case when lower(doc_type_name) = 'возврат' then quantity else 0 end)                       as rc,
               sum(case when lower(doc_type_name) = 'продажа' then retail_amount
                        when lower(doc_type_name) = 'возврат' then -abs(retail_amount) else 0 end)          as realization,
               sum(case when lower(doc_type_name) = 'продажа' and coalesce(supplier_oper_name, '') not ilike '%компенсац%' then retail_price_withdisc_rub * quantity else 0 end) as ss,
               -- WB отдаёт сумму возврата положительной: в «к перечислению» её вычитаем
               sum(case when lower(doc_type_name) = 'возврат' then -abs(ppvz_for_pay) else ppvz_for_pay end) as tt,
               sum(delivery_rub)  as log,
               -- Доставка до ПВЗ покупателя: «К клиенту при продаже» и «К клиенту при отмене» (невыкуп)
               sum(case when supplier_oper_name = 'Логистика' and bonus_type_name ilike 'К клиенту%' then delivery_rub else 0 end) as log_cl,
               count(*) filter (where supplier_oper_name = 'Логистика' and bonus_type_name ilike 'К клиенту%' and delivery_rub > 0) as log_cl_n,
               -- Отказ: товар вернулся от покупателя, не выкупившего заказ (строка логистики «От клиента при отмене»)
               count(*) filter (where supplier_oper_name = 'Логистика' and bonus_type_name ilike 'От клиента при отмене%') as cn,
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
               coalesce(f.log_cl, 0) log_cl, coalesce(f.log_cl_n, 0) log_cl_n, coalesce(f.cn, 0) cn,
               coalesce(s.raw_sto, 0) raw_sto
          from fin f
          full join sto s on s.nm_id = f.nm_id and s.d = f.d
    ),
    calc as (
        -- Хранение по артикулу: детальный отчёт × коэффициент; если детального
        -- отчёта за период нет — то, что финотчёт привязал к артикулу (обычно 0).
        select nm_id, d, sc, rc, realization, ss, tt, log, pen, ded, raw_sto, log_cl, log_cl_n, cn,
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
            log_to_client_sum, log_to_client_cnt, cancels_count,
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
               log_cl, log_cl_n, cn,
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
            log_to_client_sum  = excluded.log_to_client_sum,
            log_to_client_cnt  = excluded.log_to_client_cnt,
            cancels_count      = excluded.cancels_count,
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
$function$;

revoke execute on function public.rnp_recompute_finance(uuid, date, date) from public, anon, authenticated;
grant execute on function public.rnp_recompute_finance(uuid, date, date) to service_role;
