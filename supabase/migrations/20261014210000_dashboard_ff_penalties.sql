-- Штрафы WB «по вине ФФ» из финотчёта: подмены МП (отправка товара, отличного от заявленного) и отмены продавцом.
-- «Подмена товара (с фото)» (FBW) сюда не входит. По артикулам, чтобы на дашборде разнести по ФФ.
create or replace function public.dashboard_ff_penalties(p_cabinet_id uuid, p_from date, p_to date)
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
    select coalesce(jsonb_agg(jsonb_build_object('nm_id', g.nm_id, 'kind', g.kind, 'amount', g.amount, 'cnt', g.cnt)), '[]'::jsonb)
    into v
    from (
        select f.nm_id,
               case when f.bonus_type_name ilike '%отправка товара отличного от заявленного%' then 'swap' else 'cancel' end as kind,
               sum(f.penalty) as amount,
               count(*) as cnt
        from public.raw_finance_report f
        where f.cabinet_id = p_cabinet_id
          and (f.sale_dt between p_from and p_to or (f.sale_dt is null and f.rr_dt between p_from and p_to))
          and f.penalty <> 0
          and f.bonus_type_name ilike 'Штраф МП. Невыполненный заказ%'
          and (f.bonus_type_name ilike '%отправка товара отличного от заявленного%' or f.bonus_type_name ilike '%отмена продавцом%')
        group by 1, 2
    ) g;
    return v;
end;
$$;
revoke all on function public.dashboard_ff_penalties(uuid, date, date) from public;
grant execute on function public.dashboard_ff_penalties(uuid, date, date) to authenticated, service_role;
