-- «Планирование → План продаж»: блоки по артикулам и недели. Одна строка на кабинет, всё содержимое листа в data.
-- «План вывода денег» считается на сайте из этих блоков и в базе не хранится.
create table if not exists public.rnp_plan_sheet (
    cabinet_id uuid primary key references public.cabinets(id) on delete cascade,
    data jsonb not null default '{}'::jsonb,
    start_week date,
    updated_by uuid,
    updated_at timestamptz not null default now()
);
alter table public.rnp_plan_sheet enable row level security;
drop policy if exists rnp_plan_sheet_own on public.rnp_plan_sheet;
create policy rnp_plan_sheet_own on public.rnp_plan_sheet for all to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));
