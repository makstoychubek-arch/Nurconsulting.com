-- «Вернуть клиенту»: кабинет возвращается владельцу-клиенту (его cabinet_viewers роль owner), консалтинг снимается.
create or replace function public.admin_return_cabinet(p_cabinet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cab record; ow record; me uuid := auth.uid();
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    select c.id, c.name into cab from public.cabinets c where c.id = p_cabinet;
    if cab.id is null then raise exception 'no_cabinet' using errcode = '22023'; end if;
    select v.user_id, u.email into ow from public.cabinet_viewers v join auth.users u on u.id = v.user_id
    where v.cabinet_id = p_cabinet and v.role = 'owner' order by v.created_at limit 1;
    if ow.user_id is null then raise exception 'no_owner' using errcode = '22023'; end if;
    update public.cabinets set user_id = ow.user_id, nr_managed = false where id = p_cabinet;
    delete from public.cabinet_viewers where cabinet_id = p_cabinet and user_id = ow.user_id;
    insert into public.admin_audit (actor, actor_email, action, target, detail)
    values (me, (select email from auth.users where id = me), 'returned_to_client', cab.name, ow.email);
    return jsonb_build_object('status', 'returned', 'email', ow.email);
end $$;
revoke all on function public.admin_return_cabinet(uuid) from public, anon;
grant execute on function public.admin_return_cabinet(uuid) to authenticated;
