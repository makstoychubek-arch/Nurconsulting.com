-- ============================================================
-- NR Space — Spaces moderation + Super Admin
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run
-- ============================================================

-- ── Super Admin helper (JWT email) ──────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select lower(coalesce(auth.jwt() ->> 'email', '')) = 'global.pro.1004@gmail.com';
$$;

-- ── Spaces (client accounts) ────────────────────────────────
create table if not exists public.spaces (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null unique references auth.users(id) on delete cascade,
    email         text not null,
    status        text not null default 'pending'
                  check (status in ('pending', 'active', 'blocked')),
    tariff_plan   text not null default 'start'
                  check (tariff_plan in ('start', 'business', 'premium', 'vip')),
    is_super_admin boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists spaces_status_idx on public.spaces (status);
create index if not exists spaces_email_idx on public.spaces (lower(email));

alter table public.spaces enable row level security;

drop policy if exists "spaces_select_own_or_admin" on public.spaces;
create policy "spaces_select_own_or_admin" on public.spaces
    for select using (auth.uid() = user_id or public.is_super_admin());

drop policy if exists "spaces_insert_own" on public.spaces;
create policy "spaces_insert_own" on public.spaces
    for insert with check (
        auth.uid() = user_id
        and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and status = 'pending'
        and is_super_admin = false
    );

drop policy if exists "spaces_update_admin" on public.spaces;
create policy "spaces_update_admin" on public.spaces
    for update using (public.is_super_admin());

-- ── Auto-create space on signup ───────────────────────────────
create or replace function public.handle_new_user_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_is_admin boolean;
    v_status text;
begin
    v_is_admin := lower(coalesce(new.email, '')) = 'global.pro.1004@gmail.com';
    v_status := case when v_is_admin then 'active' else 'pending' end;

    insert into public.spaces (user_id, email, status, is_super_admin, tariff_plan)
    values (
        new.id,
        coalesce(new.email, ''),
        v_status,
        v_is_admin,
        case when v_is_admin then 'vip' else 'start' end
    )
    on conflict (user_id) do update set
        email = excluded.email,
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

drop trigger if exists on_auth_user_created_space on auth.users;
create trigger on_auth_user_created_space
    after insert on auth.users
    for each row execute function public.handle_new_user_space();

-- ── Backfill existing auth users ──────────────────────────────
insert into public.spaces (user_id, email, status, is_super_admin, tariff_plan)
select
    u.id,
    coalesce(u.email, ''),
    case
        when lower(u.email) = 'global.pro.1004@gmail.com' then 'active'
        when exists (select 1 from public.allowed_users a where lower(a.email) = lower(u.email)) then 'active'
        else 'pending'
    end,
    lower(u.email) = 'global.pro.1004@gmail.com',
    case when lower(u.email) = 'global.pro.1004@gmail.com' then 'vip' else 'start' end
from auth.users u
on conflict (user_id) do nothing;

-- Super admin may read all sessions (developer sessions tab)
drop policy if exists "user_sessions_select_admin" on public.user_sessions;
create policy "user_sessions_select_admin" on public.user_sessions
    for select using (public.is_super_admin());

drop policy if exists "user_sessions_delete_admin" on public.user_sessions;
create policy "user_sessions_delete_admin" on public.user_sessions
    for delete using (public.is_super_admin());

-- Super admin may count all cabinets (spaces management table)
drop policy if exists "cabinets_select_admin" on public.cabinets;
create policy "cabinets_select_admin" on public.cabinets
    for select using (public.is_super_admin());
