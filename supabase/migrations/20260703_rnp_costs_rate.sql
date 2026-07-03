-- ============================================================
-- NR Space — RNP Module: unit costs + dynamic WB exchange rate
-- Run once in Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS
-- ============================================================

-- ── 1. Per-unit costs on articles (сом) ─────────────────────
-- Логистика ед. (сом): baseline logistics estimate used when
-- the WB finance report has no logistics data for a day.
alter table rnp_articles add column if not exists logistics_unit numeric default 0;

-- Пр. косты ед. (сом): other per-unit costs (упаковка, фулфилмент и т.п.),
-- subtracted from profit per sold unit.
alter table rnp_articles add column if not exists other_costs_unit numeric default 0;
-- Legacy alias (if you created `other_costs` manually — safe to keep both):
alter table rnp_articles add column if not exists other_costs numeric default 0;

-- ── 2. Daily RUB→KGS rate from WB finance report ────────────
-- Derived per day from report rows (local-currency amount / rub amount).
-- 0 = unknown → frontend falls back to the static rate from settings.
alter table rnp_daily_data add column if not exists wb_rate numeric default 0;

-- ── Done ────────────────────────────────────────────────────
select 'RNP costs & rate ready' as status;
