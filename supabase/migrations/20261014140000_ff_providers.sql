-- Несколько фулфилментов (ФФ) в одном кабинете: у каждого свои товары, тарифы, подмены и отмены.
-- Товар привязывается к ФФ через rnp_articles.manual_data.ff_id (выбор в «Товары → FBS»).

create table if not exists public.ff_providers (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    name        text not null,
    created_at  timestamptz not null default now()
);
create index if not exists ff_providers_cab_idx on public.ff_providers (cabinet_id);

alter table public.ff_providers enable row level security;
drop policy if exists ff_providers_sel on public.ff_providers;
create policy ff_providers_sel on public.ff_providers for select to authenticated
    using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_providers_ins on public.ff_providers;
create policy ff_providers_ins on public.ff_providers for insert to authenticated
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_providers_upd on public.ff_providers;
create policy ff_providers_upd on public.ff_providers for update to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_providers_del on public.ff_providers;
create policy ff_providers_del on public.ff_providers for delete to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.ff_providers to authenticated;
grant all on public.ff_providers to service_role;

alter table public.ff_adjustments
    add column if not exists ff_id uuid references public.ff_providers(id) on delete set null;
