-- Настройки Алины с сайта («Продвижение → Алина»): ключ → значение. Читает Алина (service_role) с кэшем 30 секунд,
-- пишет и читает команда (staff). Журнал изменений для отката. Идемпотентно.
create table if not exists public.alina_settings (
    key         text primary key,
    value       jsonb not null,
    updated_by  uuid default auth.uid(),
    updated_at  timestamptz not null default now()
);

create table if not exists public.alina_settings_log (
    id          bigint generated always as identity primary key,
    key         text not null,
    old_value   jsonb,
    new_value   jsonb,
    changed_by  uuid default auth.uid(),
    changed_at  timestamptz not null default now()
);
create index if not exists alina_settings_log_at_idx on public.alina_settings_log (changed_at desc);

alter table public.alina_settings enable row level security;
alter table public.alina_settings_log enable row level security;

drop policy if exists "alina_settings_staff_all" on public.alina_settings;
create policy "alina_settings_staff_all" on public.alina_settings
    for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "alina_settings_log_staff" on public.alina_settings_log;
create policy "alina_settings_log_staff" on public.alina_settings_log
    for all to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.alina_settings, public.alina_settings_log from public, anon, authenticated;
grant select, insert, update on public.alina_settings to authenticated;
grant select, insert on public.alina_settings_log to authenticated;
grant select on public.alina_settings to service_role;
