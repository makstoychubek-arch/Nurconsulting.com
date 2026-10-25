-- «В консалтинг»: кабинет клиента переходит к команде (владелец аккаунта = супер-админ, который нажал кнопку),
-- а сам клиент становится владельцем кабинета (cabinet_viewers, роль owner): видит кабинет, токены ведёт команда.

create or replace function public.admin_move_to_consulting(p_cabinet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cab record; me uuid := auth.uid();
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    select c.id, c.name, c.user_id into cab from public.cabinets c where c.id = p_cabinet;
    if cab.id is null then raise exception 'no_cabinet' using errcode = '22023'; end if;
    if cab.user_id = me then raise exception 'already' using errcode = '22023'; end if;
    update public.cabinets set user_id = me, nr_managed = true where id = p_cabinet;
    insert into public.cabinet_viewers (user_id, cabinet_id, sections, granted_by, role)
    values (cab.user_id, p_cabinet, array['all'], me, 'owner')
    on conflict (user_id, cabinet_id) do update set role = 'owner', sections = array['all'];
    insert into public.admin_audit (actor, actor_email, action, target, detail)
    values (me, (select email from auth.users where id = me), 'moved_to_consulting', cab.name, (select email from auth.users where id = cab.user_id));
    return jsonb_build_object('status', 'moved');
end $$;
revoke all on function public.admin_move_to_consulting(uuid) from public, anon;
grant execute on function public.admin_move_to_consulting(uuid) to authenticated;
