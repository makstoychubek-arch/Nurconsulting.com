-- ============================================================
-- NR Space — дашборд берёт финансы из базы, а не из WB на каждой загрузке
--
-- Дашборд запрашивал детальный финотчёт напрямую у WB из браузера. У этого
-- метода лимит один запрос в минуту на продавца, и дашборд просил сразу два
-- периода, поэтому один запрос гарантированно получал 429, а прибыль и маржа
-- на экране не появлялись вовсе.
--
-- Отчёт уже собирается ночью в raw_finance_report. Не хватало четырёх полей,
-- которые нужны расчёту метрик, — добавляем их и отдаём строки через RPC.
-- Safe to re-run.
-- ============================================================

alter table public.raw_finance_report
    add column if not exists retail_price numeric,
    add column if not exists additional_payment numeric,
    add column if not exists acquiring_fee numeric,
    add column if not exists bonus_type_name text,
    add column if not exists subject_name text,
    add column if not exists brand_name text;

create index if not exists raw_finance_report_cab_sale_dt_idx
    on public.raw_finance_report (cabinet_id, sale_dt);

-- Строки финотчёта за период в том же виде, в каком их ждёт
-- WBFormulas.calculateMetrics. Доступ к кабинету проверяем один раз, иначе
-- RLS вызывала бы проверку на каждую из десятков тысяч строк.
create or replace function public.dashboard_finance_rows(
    p_cabinet_id uuid,
    p_from date,
    p_to date
)
returns table (
    rrd_id bigint,
    rr_dt date,
    sale_dt date,
    nm_id bigint,
    sa_name text,
    doc_type_name text,
    supplier_oper_name text,
    quantity numeric,
    retail_amount numeric,
    retail_price numeric,
    retail_price_withdisc_rub numeric,
    ppvz_for_pay numeric,
    delivery_rub numeric,
    penalty numeric,
    storage_fee numeric,
    deduction numeric,
    acceptance numeric,
    additional_payment numeric,
    acquiring_fee numeric,
    bonus_type_name text,
    subject_name text,
    brand_name text,
    currency_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.can_access_cabinet(p_cabinet_id) then
        raise exception 'Нет доступа к кабинету' using errcode = '42501';
    end if;

    return query
    select f.rrd_id, f.rr_dt, f.sale_dt, f.nm_id, f.sa_name, f.doc_type_name,
           f.supplier_oper_name, f.quantity, f.retail_amount, f.retail_price,
           f.retail_price_withdisc_rub, f.ppvz_for_pay, f.delivery_rub, f.penalty,
           f.storage_fee, f.deduction, f.acceptance, f.additional_payment,
           f.acquiring_fee, f.bonus_type_name, f.subject_name, f.brand_name,
           f.currency_name
    from public.raw_finance_report f
    where f.cabinet_id = p_cabinet_id
      and coalesce(f.sale_dt, f.rr_dt) between p_from and p_to;
end;
$$;

revoke all on function public.dashboard_finance_rows(uuid, date, date) from public;
grant execute on function public.dashboard_finance_rows(uuid, date, date) to authenticated, service_role;

-- Насколько кеш покрывает период: чтобы дашборд честно сказал «данные
-- собираются», а не показывал неполную картину как полную.
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
        'rows', count(*),
        'from', min(coalesce(sale_dt, rr_dt)),
        'to', max(coalesce(sale_dt, rr_dt)),
        'fetched_at', max(fetched_at)
    )
    into v
    from public.raw_finance_report
    where cabinet_id = p_cabinet_id;

    return v;
end;
$$;

revoke all on function public.dashboard_finance_coverage(uuid) from public;
grant execute on function public.dashboard_finance_coverage(uuid) to authenticated, service_role;
