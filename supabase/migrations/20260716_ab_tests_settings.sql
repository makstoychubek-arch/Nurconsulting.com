-- А/Б тесты: настройки теста (метрика победы, выбранные РК, платформы,
-- источники) раньше жили только в localStorage браузера создателя — сервер
-- (ab-test-rotate, работает по pg_cron) их вообще не видел и не мог считать
-- клики/показы по рекламе для теста. Переносим в БД, чтобы серверный расчёт
-- статистики был возможен независимо от браузера.
alter table public.ab_tests
    add column if not exists settings jsonb default '{}'::jsonb;

-- impressions/clicks на вариантах должны реально считаться (раньше всегда
-- оставались 0) — на случай, если колонок ещё нет в проде.
alter table public.ab_test_variants
    add column if not exists impressions bigint default 0;
alter table public.ab_test_variants
    add column if not exists clicks bigint default 0;

select 'ab_tests.settings + variants impressions/clicks ready' as status;
