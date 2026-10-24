-- Владелец кабинета назначается по Google-почте: человек заходит на сайт, и система сама находит приглашение.
-- Если аккаунт уже есть, доступ выдаётся сразу; если нет, приглашение ждёт первого входа (триггер на auth.users).
-- Владелец видит только свой кабинет (через cabinet_viewers, режим просмотра). Назначать и снимать может только супер-админ.

alter table public.cabinet_viewers add column if not exists role text not null default 'viewer';
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'cabinet_viewers_role_chk') then
        alter table public.cabinet_viewers add constraint cabinet_viewers_role_chk check (role in ('viewer', 'owner'));
    end if;
end $$;

create table if not exists public.cabinet_invites (
    id         uuid primary key default gen_random_uuid(),
    cabinet_id uuid not null references public.cabinets(id) on delete cascade,
    email      text not null,
    role       text not null default 'owner' check (role in ('viewer', 'owner')),
    created_by uuid,
    created_at timestamptz not null default now(),
    claimed_at timestamptz,
    claimed_by uuid,
    unique (cabinet_id, email)
);
alter table public.cabinet_invites enable row level security;
drop policy if exists cabinet_invites_read on public.cabinet_invites;
create policy cabinet_invites_read on public.cabinet_invites for select to authenticated using (public.is_super_admin());
revoke all on public.cabinet_invites from anon;
grant select on public.cabinet_invites to authenticated;

-- Применить приглашения для человека: выдать доступ и открыть аккаунт, если он ждал одобрения.
create or replace function public.claim_cabinet_invites_for(p_user uuid, p_email text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
    if coalesce(p_email, '') = '' then return 0; end if;
    insert into public.cabinet_viewers (user_id, cabinet_id, sections, granted_by, role)
    select p_user, i.cabinet_id, array['all'], i.created_by, i.role
    from public.cabinet_invites i
    where lower(i.email) = lower(p_email) and i.claimed_at is null
    on conflict (user_id, cabinet_id) do update set role = excluded.role;
    get diagnostics n = row_count;
    if n > 0 then
        update public.cabinet_invites set claimed_at = now(), claimed_by = p_user where lower(email) = lower(p_email) and claimed_at is null;
        update public.spaces set status = 'active' where user_id = p_user and status = 'pending';
    end if;
    return n;
end $$;
revoke all on function public.claim_cabinet_invites_for(uuid, text) from public, anon, authenticated;

-- Новый аккаунт появился: проверить приглашения (срабатывает после создания «спейса»: имя триггера идёт позже по алфавиту).
create or replace function public.claim_invites_on_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
    begin
        perform public.claim_cabinet_invites_for(new.id, new.email);
    exception when others then
        raise warning 'claim_invites_on_signup: %', sqlerrm;
    end;
    return new;
end $$;
drop trigger if exists zz_claim_cabinet_invites on auth.users;
create trigger zz_claim_cabinet_invites after insert on auth.users for each row execute function public.claim_invites_on_signup();

create or replace function public.admin_assign_owner(p_cabinet uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare mail text := lower(trim(coalesce(p_email, ''))); uid uuid;
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;
    if not exists (select 1 from public.cabinets where id = p_cabinet) then raise exception 'no_cabinet' using errcode = '22023'; end if;
    insert into public.cabinet_invites (cabinet_id, email, role, created_by)
    values (p_cabinet, mail, 'owner', auth.uid())
    on conflict (cabinet_id, email) do update set role = 'owner', claimed_at = null, claimed_by = null, created_by = auth.uid();
    select id into uid from auth.users where lower(email) = mail limit 1;
    if uid is not null then
        perform public.claim_cabinet_invites_for(uid, mail);
        return jsonb_build_object('status', 'assigned');
    end if;
    return jsonb_build_object('status', 'invited');
end $$;
revoke all on function public.admin_assign_owner(uuid, text) from public, anon;
grant execute on function public.admin_assign_owner(uuid, text) to authenticated;

create or replace function public.admin_unassign_owner(p_cabinet uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare mail text := lower(trim(coalesce(p_email, '')));
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    delete from public.cabinet_invites where cabinet_id = p_cabinet and lower(email) = mail;
    delete from public.cabinet_viewers v using auth.users u
    where v.cabinet_id = p_cabinet and v.user_id = u.id and lower(u.email) = mail and v.role = 'owner';
end $$;
revoke all on function public.admin_unassign_owner(uuid, text) from public, anon;
grant execute on function public.admin_unassign_owner(uuid, text) to authenticated;

-- Сводка админа: роль у людей с доступом и ожидающие приглашения.
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
    if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    select jsonb_build_object(
        'db_bytes', pg_database_size(current_database()),
        'cabinets', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', c.id, 'name', c.name, 'user_id', c.user_id,
                'owner_email', (select u.email from auth.users u where u.id = c.user_id),
                'nr_managed', coalesce(c.nr_managed, false),
                'has_wb', coalesce(c.wb_token, '') <> '',
                'adv_ok', c.adv_token_valid,
                'articles', (select count(*) from public.rnp_articles a where a.cabinet_id = c.id::text),
                'daily_rows', (select count(*) from public.rnp_daily_data d where d.cabinet_id = c.id::text),
                'daily_bytes', (select coalesce(sum(pg_column_size(d.*)), 0) from public.rnp_daily_data d where d.cabinet_id = c.id::text),
                'last_sync', (select max(j.finished_at) from public.sync_jobs j where j.cabinet_id = c.id and j.status = 'done'),
                'sync_error', (select j.error from public.sync_jobs j where j.cabinet_id = c.id and j.status = 'error' order by j.finished_at desc nulls last limit 1),
                'features', (select coalesce(jsonb_agg(jsonb_build_object('feature', f.feature, 'enabled', f.enabled, 'status', f.last_status, 'error', f.last_error, 'at', f.last_run_at)), '[]'::jsonb) from public.cabinet_features f where f.cabinet_id = c.id)
            ) order by c.name)
            from public.cabinets c
        ), '[]'::jsonb),
        'viewers', coalesce((
            select jsonb_agg(jsonb_build_object('cabinet_id', v.cabinet_id, 'user_id', v.user_id, 'email', u.email, 'sections', v.sections, 'created_at', v.created_at, 'role', v.role))
            from public.cabinet_viewers v join auth.users u on u.id = v.user_id
        ), '[]'::jsonb),
        'invites', coalesce((
            select jsonb_agg(jsonb_build_object('cabinet_id', i.cabinet_id, 'email', i.email, 'role', i.role, 'created_at', i.created_at))
            from public.cabinet_invites i where i.claimed_at is null
        ), '[]'::jsonb),
        'staff', coalesce((
            select jsonb_agg(jsonb_build_object('email', s.email, 'note', s.note, 'created_at', s.created_at,
                'last_sign_in', (select u.last_sign_in_at from auth.users u where lower(u.email) = lower(s.email) limit 1)) order by s.created_at)
            from public.team_staff s
        ), '[]'::jsonb)
    ) into res;
    return res;
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
