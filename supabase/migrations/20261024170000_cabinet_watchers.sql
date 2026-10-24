-- До 5 «знакомых» на кабинет: смотрят кабинет в режиме просмотра (роль viewer).
-- Добавлять и убирать может супер-админ, владелец кабинета (роль owner) и хозяин кабинета (cabinets.user_id).

create or replace function public.can_manage_watchers(p_cabinet uuid) returns boolean
language sql stable security definer set search_path = public as $$
    select public.is_super_admin()
        or exists (select 1 from public.cabinets c where c.id = p_cabinet and c.user_id = auth.uid())
        or exists (select 1 from public.cabinet_viewers v where v.cabinet_id = p_cabinet and v.user_id = auth.uid() and v.role = 'owner')
$$;
revoke all on function public.can_manage_watchers(uuid) from public, anon;
grant execute on function public.can_manage_watchers(uuid) to authenticated;

create or replace function public.cabinet_watchers(p_cabinet uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    if not public.can_manage_watchers(p_cabinet) then
        return jsonb_build_object('can_manage', false, 'limit', 5, 'items', '[]'::jsonb);
    end if;
    return jsonb_build_object('can_manage', true, 'limit', 5, 'items', coalesce((
        select jsonb_agg(x order by x->>'since') from (
            select jsonb_build_object('email', u.email, 'status', 'active', 'since', v.created_at) as x
            from public.cabinet_viewers v join auth.users u on u.id = v.user_id
            where v.cabinet_id = p_cabinet and v.role = 'viewer'
            union all
            select jsonb_build_object('email', i.email, 'status', 'invited', 'since', i.created_at)
            from public.cabinet_invites i
            where i.cabinet_id = p_cabinet and i.role = 'viewer' and i.claimed_at is null
        ) t
    ), '[]'::jsonb));
end $$;
revoke all on function public.cabinet_watchers(uuid) from public, anon;
grant execute on function public.cabinet_watchers(uuid) to authenticated;

create or replace function public.cabinet_watcher_add(p_cabinet uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare mail text := lower(trim(coalesce(p_email, ''))); uid uuid; n integer;
begin
    if not public.can_manage_watchers(p_cabinet) then raise exception 'forbidden' using errcode = '42501'; end if;
    if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;
    select id into uid from auth.users where lower(email) = mail limit 1;
    if exists (select 1 from public.cabinet_viewers v where v.cabinet_id = p_cabinet and v.user_id = uid and v.role = 'owner')
       or exists (select 1 from public.cabinets c where c.id = p_cabinet and c.user_id = uid)
       or exists (select 1 from public.cabinet_invites i where i.cabinet_id = p_cabinet and lower(i.email) = mail and i.role = 'owner' and i.claimed_at is null) then
        raise exception 'already_owner' using errcode = '22023';
    end if;
    select count(*) into n from (
        select u.email from public.cabinet_viewers v join auth.users u on u.id = v.user_id where v.cabinet_id = p_cabinet and v.role = 'viewer'
        union
        select i.email from public.cabinet_invites i where i.cabinet_id = p_cabinet and i.role = 'viewer' and i.claimed_at is null
    ) t where lower(t.email) <> mail;
    if n >= 5 then raise exception 'limit' using errcode = '22023'; end if;
    insert into public.cabinet_invites (cabinet_id, email, role, created_by)
    values (p_cabinet, mail, 'viewer', auth.uid())
    on conflict (cabinet_id, email) do update set role = 'viewer', claimed_at = null, claimed_by = null, created_by = auth.uid();
    if uid is not null then
        perform public.claim_cabinet_invites_for(uid, mail);
        return jsonb_build_object('status', 'assigned');
    end if;
    return jsonb_build_object('status', 'invited');
end $$;
revoke all on function public.cabinet_watcher_add(uuid, text) from public, anon;
grant execute on function public.cabinet_watcher_add(uuid, text) to authenticated;

create or replace function public.cabinet_watcher_remove(p_cabinet uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare mail text := lower(trim(coalesce(p_email, '')));
begin
    if not public.can_manage_watchers(p_cabinet) then raise exception 'forbidden' using errcode = '42501'; end if;
    delete from public.cabinet_invites where cabinet_id = p_cabinet and lower(email) = mail and role = 'viewer';
    delete from public.cabinet_viewers v using auth.users u
    where v.cabinet_id = p_cabinet and v.user_id = u.id and lower(u.email) = mail and v.role = 'viewer';
end $$;
revoke all on function public.cabinet_watcher_remove(uuid, text) from public, anon;
grant execute on function public.cabinet_watcher_remove(uuid, text) to authenticated;
