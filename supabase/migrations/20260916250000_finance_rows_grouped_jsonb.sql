-- ============================================================
-- NR Space — финотчёт дашборду одним jsonb вместо SETOF
--
-- dashboard_finance_rows возвращала SETOF, а PostgREST отдаёт максимум 1000
-- строк. У кабинета Zevina 1 за 30 дней в отчёте 12 606 строк, то есть
-- прибыль, маржа и комиссия считались по 8% отчёта — молча, без всякого
-- признака обрезки. Одно jsonb-значение под это ограничение не попадает.
--
-- Заодно схлопываем строки: расчёт на клиенте только суммирует, а цены
-- умножает на количество, поэтому группируем по тому, что должно остаться
-- постоянным (тип документа, артикул, день, обе цены), и складываем деньги и
-- количество. 12 606 строк превращаются в ~2.5 тыс. — при тех же цифрах.
--
-- supplier_oper_name и bonus_type_name нужны только чтобы отсеять удержания
-- за ВБ.Продвижение (их считает advertising_daily_stats). В остальных строках
-- они лишь плодят группы номерами документов, поэтому там их не переносим.
-- Safe to re-run.
-- ============================================================

drop function if exists public.dashboard_finance_rows(uuid, date, date);

create or replace function public.dashboard_finance_rows(
    p_cabinet_id uuid,
    p_from date,
    p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v jsonb;
begin
    if not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'sale_dt', g.sale_dt,
        'nm_id', g.nm_id,
        'sa_name', g.sa_name,
        'subject_name', g.subject_name,
        'brand_name', g.brand_name,
        'doc_type_name', g.doc_type_name,
        'supplier_oper_name', g.oper_name,
        'bonus_type_name', g.bonus_name,
        'quantity', g.quantity,
        'retail_price', g.retail_price,
        'retail_price_withdisc_rub', g.retail_price_withdisc_rub,
        'retail_amount', g.retail_amount,
        'ppvz_for_pay', g.ppvz_for_pay,
        'delivery_rub', g.delivery_rub,
        'storage_fee', g.storage_fee,
        'penalty', g.penalty,
        'deduction', g.deduction,
        'acceptance', g.acceptance,
        'additional_payment', g.additional_payment,
        'acquiring_fee', g.acquiring_fee,
        'currency_name', g.currency_name
    )), '[]'::jsonb)
    into v
    from (
        select
            coalesce(f.sale_dt, f.rr_dt) as sale_dt,
            f.nm_id,
            min(f.sa_name) as sa_name,
            min(f.subject_name) as subject_name,
            min(f.brand_name) as brand_name,
            f.doc_type_name,
            case when f.deduction <> 0 then f.supplier_oper_name end as oper_name,
            case when f.deduction <> 0 then f.bonus_type_name end as bonus_name,
            f.retail_price,
            f.retail_price_withdisc_rub,
            min(f.currency_name) as currency_name,
            sum(f.quantity) as quantity,
            sum(f.retail_amount) as retail_amount,
            sum(f.ppvz_for_pay) as ppvz_for_pay,
            sum(f.delivery_rub) as delivery_rub,
            sum(f.storage_fee) as storage_fee,
            sum(f.penalty) as penalty,
            sum(f.deduction) as deduction,
            sum(f.acceptance) as acceptance,
            sum(f.additional_payment) as additional_payment,
            sum(f.acquiring_fee) as acquiring_fee
        from public.raw_finance_report f
        where f.cabinet_id = p_cabinet_id
          and coalesce(f.sale_dt, f.rr_dt) between p_from and p_to
        group by 1, 2, 6, 7, 8, 9, 10
    ) g;

    return v;
end;
$$;

revoke all on function public.dashboard_finance_rows(uuid, date, date) from public;
grant execute on function public.dashboard_finance_rows(uuid, date, date) to authenticated, service_role;
