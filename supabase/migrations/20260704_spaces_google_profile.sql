-- ============================================================
-- NR Space — Google profile fields on spaces (sign-in logging)
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run
-- ============================================================

alter table public.spaces add column if not exists first_name text default '';
alter table public.spaces add column if not exists last_name text default '';
alter table public.spaces add column if not exists full_name text default '';
alter table public.spaces add column if not exists avatar_url text default '';
alter table public.spaces add column if not exists last_sign_in_at timestamptz;

create index if not exists spaces_last_sign_in_idx on public.spaces (last_sign_in_at desc nulls last);

-- ── Extract names from auth.users metadata ────────────────────
create or replace function public._meta_text(meta jsonb, keys text[])
returns text
language sql
immutable
as $$
    select coalesce(
        (
            select nullif(trim(both from meta ->> k), '')
            from unnest(keys) as k
            where nullif(trim(both from meta ->> k), '') is not null
            limit 1
        ),
        ''
    );
$$;

-- ── Upsert space + profile on every Google sign-in ────────────
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
        last_sign_in_at, status, is_super_admin, tariff_plan
    )
    values (
        v_uid,
        v_email,
        coalesce(p_first_name, ''),
        coalesce(p_last_name, ''),
        coalesce(p_full_name, ''),
        coalesce(p_avatar_url, ''),
        now(),
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
        is_super_admin = excluded.is_super_admin,
        updated_at = now();
        -- status intentionally NOT overwritten — pending/active/blocked preserved

    if v_is_admin then
        insert into public.allowed_users (email)
        select v_email
        where not exists (
            select 1 from public.allowed_users a where lower(a.email) = lower(v_email)
        );
    end if;
end;
$$;

grant execute on function public.upsert_space_sign_in(text, text, text, text) to authenticated;

-- ── Trigger: populate profile on first Google signup ──────────
create or replace function public.handle_new_user_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_admin boolean;
    v_status text;
    v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    v_first text;
    v_last text;
    v_full text;
    v_avatar text;
begin
    v_is_admin := lower(coalesce(new.email, '')) = 'global.pro.1004@gmail.com';
    v_status := case when v_is_admin then 'active' else 'pending' end;

    v_first := public._meta_text(v_meta, array['given_name', 'first_name']);
    v_last := public._meta_text(v_meta, array['family_name', 'last_name']);
    v_full := public._meta_text(v_meta, array['full_name', 'name']);
    if v_full = '' and (v_first <> '' or v_last <> '') then
        v_full := trim(both from v_first || ' ' || v_last);
    end if;
    v_avatar := public._meta_text(v_meta, array['avatar_url', 'picture']);

    insert into public.spaces (
        user_id, email, first_name, last_name, full_name, avatar_url,
        last_sign_in_at, status, is_super_admin, tariff_plan
    )
    values (
        new.id,
        coalesce(new.email, ''),
        v_first,
        v_last,
        v_full,
        v_avatar,
        now(),
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
        is_super_admin = excluded.is_super_admin,
        updated_at = now();

    if v_is_admin then
        insert into public.allowed_users (email)
        select new.email
        where not exists (
            select 1 from public.allowed_users a where lower(a.email) = lower(new.email)
        );
    end if;

    return new;
end;
$$;

-- ── Backfill profile fields from auth.users ───────────────────
update public.spaces s
set
    first_name = coalesce(nullif(s.first_name, ''), public._meta_text(u.raw_user_meta_data, array['given_name', 'first_name'])),
    last_name = coalesce(nullif(s.last_name, ''), public._meta_text(u.raw_user_meta_data, array['family_name', 'last_name'])),
    full_name = coalesce(
        nullif(s.full_name, ''),
        public._meta_text(u.raw_user_meta_data, array['full_name', 'name']),
        trim(both from
            public._meta_text(u.raw_user_meta_data, array['given_name', 'first_name']) || ' ' ||
            public._meta_text(u.raw_user_meta_data, array['family_name', 'last_name'])
        )
    ),
    avatar_url = coalesce(nullif(s.avatar_url, ''), public._meta_text(u.raw_user_meta_data, array['avatar_url', 'picture']))
from auth.users u
where u.id = s.user_id
  and (
    s.full_name = '' or s.first_name = '' or s.last_name = '' or s.avatar_url = ''
  );
