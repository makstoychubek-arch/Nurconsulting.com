-- Онбординг клиента консалтинга: чек-лист документов и данных по кабинету.
-- Видит и правит только команда (is_staff).
create table if not exists public.cabinet_onboarding (
    cabinet_id uuid primary key references public.cabinets(id) on delete cascade,
    manager text,
    client_contact text,
    drive_url text,
    items jsonb not null default '{}'::jsonb,
    notes text,
    updated_at timestamptz not null default now(),
    updated_by uuid default auth.uid()
);
alter table public.cabinet_onboarding enable row level security;
drop policy if exists cabinet_onboarding_staff on public.cabinet_onboarding;
create policy cabinet_onboarding_staff on public.cabinet_onboarding
    for all using (public.is_staff()) with check (public.is_staff());
revoke all on public.cabinet_onboarding from anon;
grant select, insert, update, delete on public.cabinet_onboarding to authenticated;
