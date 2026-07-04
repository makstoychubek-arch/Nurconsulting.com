-- ============================================================
-- NR Space — OAuth sign-in attempt counter
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run
-- ============================================================

alter table public.spaces add column if not exists sign_in_attempts int not null default 0;

create or replace function public.upsert_space_sign_in(
    p_first_name text default '',
    p_last_name text default '',
    p_full_name text default '',
    p_avatar_url text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_email text := coalesce(auth.jwt() ->> 'email', '');
    v_is_admin boolean;
    v_status text;
begin
    if v_uid is null then
        raise exception 'not authenticated';
    end if;

    v_is_admin := lower(v_email) = 'global.pro.1004@gmail.com';
    v_status := case when v_is_admin then 'active' else 'pending' end;

    insert into public.spaces (
        user_id, email, first_name, last_name, full_name, avatar_url,
        last_sign_in_at, sign_in_attempts, status, is_super_admin, tariff_plan
    )
    values (
        v_uid,
        v_email,
        coalesce(p_first_name, ''),
        coalesce(p_last_name, ''),
        coalesce(p_full_name, ''),
        coalesce(p_avatar_url, ''),
        now(),
        1,
        v_status,
        v_is_admin,
        case when v_is_admin then 'vip' else 'start' end
    )
    on conflict (user_id) do update set
        email = excluded.email,
        first_name = coalesce(nullif(excluded.first_name, ''), spaces.first_name),
        last_name = coalesce(nullif(excluded.last_name, ''), spaces.last_name),
        full_name = coalesce(nullif(excluded.full_name, ''), spaces.full_name),
        avatar_url = coalesce(nullif(excluded.avatar_url, ''), spaces.avatar_url),
        last_sign_in_at = now(),
        sign_in_attempts = spaces.sign_in_attempts + 1,
        is_super_admin = excluded.is_super_admin,
        updated_at = now();

    if v_is_admin then
        insert into public.allowed_users (email)
        select v_email
        where not exists (
            select 1 from public.allowed_users a where lower(a.email) = lower(v_email)
        );
    end if;
end;
$$;

-- Backfill: at least 1 attempt if user ever signed in
update public.spaces
set sign_in_attempts = greatest(sign_in_attempts, 1)
where last_sign_in_at is not null and sign_in_attempts = 0;
