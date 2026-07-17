-- Доп. поля для детального отчёта А/Б теста (как у конкурента):
-- атбс (добавления в корзину) и расход на рекламу по каждому варианту,
-- плюс причина завершения теста для бейджа в UI.
alter table public.ab_test_variants add column if not exists atbs bigint default 0;
alter table public.ab_test_variants add column if not exists ad_spend numeric default 0;
alter table public.ab_tests add column if not exists finish_reason text;

select 'ab_tests report fields ready' as status;
