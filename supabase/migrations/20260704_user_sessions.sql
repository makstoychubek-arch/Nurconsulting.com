-- ============================================================
-- NR Space — Active sessions tracking (Security settings)
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run
-- ============================================================

create table if not exists user_sessions (
    id                    uuid primary key default gen_random_uuid(),
    user_id               uuid not null references auth.users(id) on delete cascade,
    current_session_token text not null,
    device_name           text default '',
    browser               text default '',
    os_name               text default '',
    device_type           text default 'desktop',
    ip_address            text default '',
    geo_city              text default '',
    geo_country           text default '',
    last_active           timestamptz default now(),
    created_at            timestamptz default now(),
    unique (user_id, current_session_token)
);

create index if not exists user_sessions_user_id_idx on user_sessions (user_id);
create index if not exists user_sessions_last_active_idx on user_sessions (last_active desc);

alter table user_sessions enable row level security;

drop policy if exists "user_sessions_select_own" on user_sessions;
create policy "user_sessions_select_own" on user_sessions
    for select using (auth.uid() = user_id);

drop policy if exists "user_sessions_insert_own" on user_sessions;
create policy "user_sessions_insert_own" on user_sessions
    for insert with check (auth.uid() = user_id);

drop policy if exists "user_sessions_update_own" on user_sessions;
create policy "user_sessions_update_own" on user_sessions
    for update using (auth.uid() = user_id);

drop policy if exists "user_sessions_delete_own" on user_sessions;
create policy "user_sessions_delete_own" on user_sessions
    for delete using (auth.uid() = user_id);
