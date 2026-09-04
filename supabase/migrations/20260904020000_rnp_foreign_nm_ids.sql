-- РНП: nm_id на WB уникален для одного продавца. Одна и та же карточка
-- в двух кабинетах — утечка (чужой каталог). Отдаём список таких nm_id
-- даже если RLS чужие строки не показывает.

create or replace function public.rnp_foreign_nm_ids(p_cabinet_id text, p_nm_ids bigint[])
returns bigint[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_cabinet_id is null or p_nm_ids is null then
    return '{}'::bigint[];
  end if;
  if not public.can_access_cabinet(p_cabinet_id) then
    raise exception 'нет доступа к кабинету';
  end if;
  return coalesce((
    select array_agg(distinct a.nm_id)
    from public.rnp_articles a
    where a.cabinet_id is distinct from p_cabinet_id
      and a.nm_id = any(p_nm_ids)
  ), '{}'::bigint[]);
end;
$$;

revoke all on function public.rnp_foreign_nm_ids(text, bigint[]) from public;
grant execute on function public.rnp_foreign_nm_ids(text, bigint[]) to authenticated;

comment on function public.rnp_foreign_nm_ids(text, bigint[]) is
  'nm_id из списка, которые уже лежат в другом кабинете РНП.';

-- Elium: кимоно Zevina 2 и старые рубашки попали 2026-07-15. Идемпотентно.
delete from public.rnp_daily_data
 where cabinet_id = 'cc14ccd5-454d-46d3-87cc-adc2ffcd84fc'
   and nm_id in (898111994, 898111996, 1035983378, 1035977849, 1035983379, 1035983380);
delete from public.rnp_date_notes
 where cabinet_id = 'cc14ccd5-454d-46d3-87cc-adc2ffcd84fc'
   and nm_id in (898111994, 898111996, 1035983378, 1035977849, 1035983379, 1035983380);
delete from public.rnp_plans
 where cabinet_id = 'cc14ccd5-454d-46d3-87cc-adc2ffcd84fc'
   and nm_id in (898111994, 898111996, 1035983378, 1035977849, 1035983379, 1035983380);
delete from public.rnp_articles
 where cabinet_id = 'cc14ccd5-454d-46d3-87cc-adc2ffcd84fc'
   and nm_id in (898111994, 898111996, 1035983378, 1035977849, 1035983379, 1035983380);
