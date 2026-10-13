-- РНП «Общий»: раскладка «Штрафы» и «Прочие удержания» по видам.
-- Та же основа, что у rnp_cabinet_totals: дата отчёта rr_dt; штрафы — по выбранным артикулам (p_nm_ids),
-- удержания — по кабинету целиком. Сумма видов = строке «Штрафы» / «Прочие удержания».

create or replace function public.rnp_cabinet_fin_split(
    p_cabinet uuid, p_from date, p_to date, p_nm_ids bigint[] default null
)
returns table(
    d date,
    pen_dims numeric, pen_accept numeric, pen_sub numeric, pen_cancel numeric,
    pen_pvz numeric, pen_supply numeric, pen_other numeric,
    ded_adv numeric, ded_jam numeric, ded_util numeric, ded_other numeric
)
language sql
stable
set search_path to 'public'
as $function$
    with pen as (
        select f.rr_dt as d,
               case
                   when coalesce(f.bonus_type_name, '') ilike '%габарит%'                       then 'dims'
                   when coalesce(f.bonus_type_name, '') ilike '%расхождения в карточке%'        then 'accept'
                   when coalesce(f.bonus_type_name, '') ilike '%отличного от заявленного%'
                     or coalesce(f.bonus_type_name, '') ilike '%подмена товара%'                then 'sub'
                   when coalesce(f.bonus_type_name, '') ilike '%невыполненный заказ%'           then 'cancel'
                   when coalesce(f.bonus_type_name, '') ilike '%возвратов на пвз%'              then 'pvz'
                   when coalesce(f.bonus_type_name, '') ilike '%недовоз%'                       then 'supply'
                   else 'other'
               end as k,
               coalesce(f.penalty, 0) as v
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
          and coalesce(f.penalty, 0) <> 0
          and (p_nm_ids is null or f.nm_id = any(p_nm_ids))
    ), ded as (
        select f.rr_dt as d,
               case
                   when coalesce(f.bonus_type_name, '') ilike '%продвижени%'    then 'adv'
                   when coalesce(f.bonus_type_name, '') ilike '%джем%'           then 'jam'
                   when coalesce(f.bonus_type_name, '') ilike '%утилизир%'       then 'util'
                   else 'other'
               end as k,
               coalesce(f.deduction, 0) as v
        from raw_finance_report f
        where f.cabinet_id = p_cabinet and f.rr_dt between p_from and p_to
          and coalesce(f.deduction, 0) <> 0
    ), pa as (
        select d,
               sum(v) filter (where k = 'dims')   as pen_dims,
               sum(v) filter (where k = 'accept') as pen_accept,
               sum(v) filter (where k = 'sub')    as pen_sub,
               sum(v) filter (where k = 'cancel') as pen_cancel,
               sum(v) filter (where k = 'pvz')    as pen_pvz,
               sum(v) filter (where k = 'supply') as pen_supply,
               sum(v) filter (where k = 'other')  as pen_other
        from pen group by d
    ), da as (
        select d,
               sum(v) filter (where k = 'adv')   as ded_adv,
               sum(v) filter (where k = 'jam')   as ded_jam,
               sum(v) filter (where k = 'util')  as ded_util,
               sum(v) filter (where k = 'other') as ded_other
        from ded group by d
    )
    select coalesce(pa.d, da.d),
           round(coalesce(pa.pen_dims, 0), 2), round(coalesce(pa.pen_accept, 0), 2),
           round(coalesce(pa.pen_sub, 0), 2), round(coalesce(pa.pen_cancel, 0), 2),
           round(coalesce(pa.pen_pvz, 0), 2), round(coalesce(pa.pen_supply, 0), 2),
           round(coalesce(pa.pen_other, 0), 2),
           round(coalesce(da.ded_adv, 0), 2), round(coalesce(da.ded_jam, 0), 2),
           round(coalesce(da.ded_util, 0), 2), round(coalesce(da.ded_other, 0), 2)
    from pa full join da on da.d = pa.d
    order by 1
$function$;

grant execute on function public.rnp_cabinet_fin_split(uuid, date, date, bigint[]) to authenticated;
