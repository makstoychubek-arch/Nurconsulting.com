-- dashboard_finance_rows: условие по дате через coalesce() не использовало индекс
-- (seq scan ~4 с, Зевина 1 упиралась в 8-секундный таймаут → пустой дашборд).
-- Теперь sargable OR по sale_dt / rr_dt — тот же результат, ~1 с.

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
          and (f.sale_dt between p_from and p_to
               or (f.sale_dt is null and f.rr_dt between p_from and p_to))
        group by 1, 2, 6, 7, 8, 9, 10
    ) g;

    return v;
end;
$$;

revoke all on function public.dashboard_finance_rows(uuid, date, date) from public;
grant execute on function public.dashboard_finance_rows(uuid, date, date) to authenticated, service_role;

-- Покрытие отчёта: раньше count(*)+min/max(coalesce) читали весь кабинет
-- (340 тыс. строк, ~9 с). Теперь min/max по индексам (cabinet_id, sale_dt/rr_dt).
create or replace function public.dashboard_finance_coverage(p_cabinet_id uuid)
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

    select jsonb_build_object(
        'from', least(
            (select min(sale_dt) from public.raw_finance_report where cabinet_id = p_cabinet_id),
            (select min(rr_dt) from public.raw_finance_report where cabinet_id = p_cabinet_id)
        ),
        'to', greatest(
            (select max(sale_dt) from public.raw_finance_report where cabinet_id = p_cabinet_id),
            (select max(rr_dt) from public.raw_finance_report where cabinet_id = p_cabinet_id)
        )
    ) into v;

    return v;
end;
$$;

revoke all on function public.dashboard_finance_coverage(uuid) from public;
grant execute on function public.dashboard_finance_coverage(uuid) to authenticated, service_role;
