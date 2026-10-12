-- Товары → «Логистика» (товары в пути в WB) и «Заказ на производство» (план пошива). Видны в РНП по размерам.
create table if not exists public.goods_shipments (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null,
  nm_id bigint not null,
  size text not null default '',
  qty integer not null default 0,
  sent_date date,
  eta_date date,
  status text not null default 'transit' check (status in ('transit', 'arrived')),
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goods_shipments_cab_idx on public.goods_shipments (cabinet_id, status);

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null,
  nm_id bigint not null,
  size text not null default '',
  qty integer not null default 0,
  order_date date,
  due_date date,
  status text not null default 'plan' check (status in ('plan', 'sewing', 'done')),
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists production_orders_cab_idx on public.production_orders (cabinet_id, status);

do $$
declare t text;
begin
  foreach t in array array['goods_shipments', 'production_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select using (cabinet_id in (select current_user_view_cabinet_ids()))', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('create policy %I on public.%I for insert with check (cabinet_id in (select current_user_cabinet_ids()))', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('create policy %I on public.%I for update using (cabinet_id in (select current_user_cabinet_ids())) with check (cabinet_id in (select current_user_cabinet_ids()))', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
    execute format('create policy %I on public.%I for delete using (cabinet_id in (select current_user_cabinet_ids()))', t || '_del', t);
  end loop;
end $$;
