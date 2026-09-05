-- ============================================================
-- NR Space — убрать «дырявые» RLS-политики (qual = true)
--
-- На cabinets / wb_orders / wb_stocks / wb_cache рядом с политиками
-- «только свой кабинет» остались старые auth_only_* с условием true.
-- Политики в Postgres складываются по ИЛИ, поэтому любой залогиненный
-- пользователь (даже со статусом pending) видел и мог менять все кабинеты,
-- включая WB-токены, и все заказы/остатки. Убираем permissive-политики;
-- владельцы работают через *_own / own_cabinet(), супер-админ — через
-- is_super_admin(), edge-функции — через service role (RLS не касается).
-- whitelist_only_* (allowed_users) не трогаем.
-- Safe to re-run.
-- ============================================================

drop policy if exists "auth_only_cabinets" on public.cabinets;
drop policy if exists "Авторизованные видят кабинеты" on public.cabinets;

drop policy if exists "auth_only_wb_orders" on public.wb_orders;

drop policy if exists "auth_only_wb_stocks" on public.wb_stocks;

drop policy if exists "auth_only_wb_cache" on public.wb_cache;
drop policy if exists "wb_cache_own" on public.wb_cache;
create policy "wb_cache_own" on public.wb_cache
    for all using (
        public.own_cabinet(cabinet_id) or public.is_super_admin()
    )
    with check (
        public.own_cabinet(cabinet_id) or public.is_super_admin()
    );
