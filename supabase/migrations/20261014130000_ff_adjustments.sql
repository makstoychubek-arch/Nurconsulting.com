-- Фулфилмент: подмены (МП, не FBW) и отмены, за которые ФФ возмещает нам штрафы WB.
-- Вводятся вручную, учитываются в блоке «Фулфилмент» на дашборде: Выплатить = хранение + отправка − подмены − отмены.

create table if not exists public.ff_adjustments (
    id          uuid primary key default gen_random_uuid(),
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    kind        text not null check (kind in ('swap', 'cancel')),
    amount      numeric not null check (amount >= 0),
    adj_date    date not null default current_date,
    note        text not null default '',
    created_by  uuid default auth.uid(),
    created_at  timestamptz not null default now()
);

create index if not exists ff_adjustments_cab_date_idx on public.ff_adjustments (cabinet_id, adj_date);

alter table public.ff_adjustments enable row level security;

drop policy if exists ff_adjustments_sel on public.ff_adjustments;
create policy ff_adjustments_sel on public.ff_adjustments for select to authenticated
    using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_adjustments_ins on public.ff_adjustments;
create policy ff_adjustments_ins on public.ff_adjustments for insert to authenticated
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_adjustments_upd on public.ff_adjustments;
create policy ff_adjustments_upd on public.ff_adjustments for update to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_adjustments_del on public.ff_adjustments;
create policy ff_adjustments_del on public.ff_adjustments for delete to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()));

grant select, insert, update, delete on public.ff_adjustments to authenticated;
grant all on public.ff_adjustments to service_role;
