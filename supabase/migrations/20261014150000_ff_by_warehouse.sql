-- ФФ = склады продавца (FBS) из WB («АМАН ФФ 3» и т.п.), берутся автоматически из остатков.
-- Ручной список ФФ не нужен: подмены/отмены привязываются к названию склада.
alter table public.ff_adjustments add column if not exists ff_name text;
alter table public.ff_adjustments drop column if exists ff_id;
drop table if exists public.ff_providers;
