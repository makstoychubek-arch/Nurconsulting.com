-- Супер-админ может назначить и снять другого супер-админа по почте.
-- Нельзя: назначить того, кто ещё не заходил на сайт; снять корневого владельца; снять самого себя.
-- Назначенный сразу добавляется в команду (team_staff), чтобы работать с любым кабинетом во всех функциях сайта.

create or replace function public.admin_set_super_admin(p_email text, p_on boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare mail text := lower(trim(coalesce(p_email, ''))); sp record; me uuid := auth.uid();
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;
    select s.user_id, s.email into sp from public.spaces s where lower(s.email) = mail limit 1;
    if sp.user_id is null then raise exception 'no_user' using errcode = '22023'; end if;
    if not p_on then
        if mail = 'global.pro.1004@gmail.com' or sp.user_id = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'::uuid then raise exception 'root' using errcode = '22023'; end if;
        if sp.user_id = me then raise exception 'self' using errcode = '22023'; end if;
    end if;
    update public.spaces set is_super_admin = p_on, status = case when p_on then 'active' else status end, updated_at = now() where user_id = sp.user_id;
    if p_on then
        insert into public.team_staff (email, note) values (mail, 'суперадмин') on conflict (email) do nothing;
    end if;
    insert into public.admin_audit (actor, actor_email, action, target, detail)
    values (me, (select email from auth.users where id = me), case when p_on then 'super_admin_on' else 'super_admin_off' end, mail, null);
    return jsonb_build_object('status', case when p_on then 'granted' else 'revoked' end);
end $$;
revoke all on function public.admin_set_super_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_super_admin(text, boolean) to authenticated;
