-- ============================================================
-- NR Space — Cabinet / orders / stocks data isolation (RLS)
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run
-- ============================================================

-- Super Admin: email OR fixed UUID
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'global.pro.1004@gmail.com'
        or auth.uid() = '2f7d8960-0df4-4a17-be70-f2cb2ac0032e'::uuid;
$$;

-- ── cabinets ──────────────────────────────────────────────────
alter table public.cabinets enable row level security;

drop policy if exists "anon_all" on public.cabinets;
drop policy if exists "own_cabinets" on public.cabinets;
drop policy if exists "cabinets_select_own" on public.cabinets;
drop policy if exists "cabinets_insert_own" on public.cabinets;
drop policy if exists "cabinets_update_own" on public.cabinets;
drop policy if exists "cabinets_delete_own" on public.cabinets;
drop policy if exists "cabinets_select_admin" on public.cabinets;

create policy "cabinets_select_own" on public.cabinets
    for select using (user_id = auth.uid() or public.is_super_admin());

create policy "cabinets_insert_own" on public.cabinets
    for insert with check (user_id = auth.uid() or public.is_super_admin());

create policy "cabinets_update_own" on public.cabinets
    for update using (user_id = auth.uid() or public.is_super_admin());

create policy "cabinets_delete_own" on public.cabinets
    for delete using (user_id = auth.uid() or public.is_super_admin());

-- ── wb_orders ─────────────────────────────────────────────────
alter table public.wb_orders enable row level security;

drop policy if exists "wb_orders_own" on public.wb_orders;
create policy "wb_orders_own" on public.wb_orders
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );

-- ── wb_stocks ─────────────────────────────────────────────────
alter table public.wb_stocks enable row level security;

drop policy if exists "wb_stocks_own" on public.wb_stocks;
create policy "wb_stocks_own" on public.wb_stocks
    for all using (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    )
    with check (
        cabinet_id in (select id from public.cabinets where user_id = auth.uid())
        or public.is_super_admin()
    );
