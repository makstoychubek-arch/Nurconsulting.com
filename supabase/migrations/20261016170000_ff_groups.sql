-- Объединение ФФ: несколько складов (АМАН ФФ, АМАН ФФ 2…5) — один и тот же ФФ. member_name → group_name.
-- Штрафы, отправки, хранение, депозит и тарифы считаются под именем группы. Safe to re-run.
create table if not exists public.ff_groups (
    cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
    ff_name     text not null,        -- склад, который входит в группу
    group_name  text not null,        -- под каким ФФ его считать
    created_at  timestamptz not null default now(),
    primary key (cabinet_id, ff_name)
);
alter table public.ff_groups enable row level security;
drop policy if exists ff_groups_sel on public.ff_groups;
create policy ff_groups_sel on public.ff_groups for select to authenticated using (cabinet_id in (select public.current_user_view_cabinet_ids()));
drop policy if exists ff_groups_ins on public.ff_groups;
create policy ff_groups_ins on public.ff_groups for insert to authenticated with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_groups_upd on public.ff_groups;
create policy ff_groups_upd on public.ff_groups for update to authenticated using (cabinet_id in (select public.current_user_cabinet_ids())) with check (cabinet_id in (select public.current_user_cabinet_ids()));
drop policy if exists ff_groups_del on public.ff_groups;
create policy ff_groups_del on public.ff_groups for delete to authenticated using (cabinet_id in (select public.current_user_cabinet_ids()));
grant select, insert, update, delete on public.ff_groups to authenticated;
grant all on public.ff_groups to service_role;
