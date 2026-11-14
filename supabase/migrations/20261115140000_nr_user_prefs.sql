-- Настройки пользователя (виджеты дашборда и др.): телефон и компьютер видят одно и то же.
create table if not exists public.nr_user_prefs (
    user_id uuid primary key references auth.users(id) on delete cascade,
    prefs jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.nr_user_prefs enable row level security;
drop policy if exists nr_user_prefs_own on public.nr_user_prefs;
create policy nr_user_prefs_own on public.nr_user_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
