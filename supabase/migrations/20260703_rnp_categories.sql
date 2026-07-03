-- ============================================================
-- NR Space — RNP Module: article categories/groups
-- Run once in Supabase Dashboard → SQL Editor
-- Safe to re-run: uses IF NOT EXISTS
-- ============================================================

-- ── 1. Category column (e.g. "Рубашки", "Кимоно", "Рубашка принт") ──
alter table rnp_articles add column if not exists category text default '';

create index if not exists rnp_articles_category
    on rnp_articles (cabinet_id, category);

-- ── Done ────────────────────────────────────────────────────
select 'RNP categories ready' as status;
