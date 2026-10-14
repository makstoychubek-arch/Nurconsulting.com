-- Тарифы по каждому ФФ (складу продавца): у каждого ФФ своя цена отправки и своё хранение, по периодам.
-- Заменяет тарифы «за артикул» (manual_data.fbs_rates) и ff_storage_terms.
create table if not exists public.ff_terms (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    ff_name     text not null,
    kind        text not null check (kind in ('ship', 'storage')),
    value       numeric not null check (value >= 0),   -- ship: ₽ за 1 заказ; storage: ₽ за 1 шт в сутки
    daily_cap   numeric check (daily_cap is null or daily_cap >= 0),   -- только storage: лимит ₽ в сутки на ФФ
    date_from   date not null,
    date_to     date,
    created_at  timestamptz not null default now()
);
create index if not exists ff_terms_cab_idx on public.ff_terms (cabinet_id, ff_name, kind, date_from);
alter table public.ff_terms enable row level security;
drop policy if exists ff_terms_sel on public.ff_terms;
create policy ff_terms_sel on public.ff_terms for select to authenticated using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_terms_ins on public.ff_terms;
create policy ff_terms_ins on public.ff_terms for insert to authenticated with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_terms_upd on public.ff_terms;
create policy ff_terms_upd on public.ff_terms for update to authenticated using (cabinet_id in (select public.current_user_cabinet_ids())) with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_terms_del on public.ff_terms;
create policy ff_terms_del on public.ff_terms for delete to authenticated using (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.ff_terms to authenticated;
grant all on public.ff_terms to service_role;

-- Перенос договорённости «0,40 ₽ за шт в сутки с 14.10.2026» (Zevina 1) на каждый её ФФ.
insert into public.ff_terms (cabinet_id, ff_name, kind, value, daily_cap, date_from)
select distinct s.cabinet_id, s.warehouse_name, 'storage', 0.40, null::numeric, date '2026-10-14'
from public.wb_stocks s
where s.cabinet_id = '21cffafa-bca2-4984-b5f8-5c426e6f538b' and s.stock_scheme = 'fbs' and s.warehouse_name is not null
  and not exists (select 1 from public.ff_terms t where t.cabinet_id = s.cabinet_id);

drop table if exists public.ff_storage_terms;
