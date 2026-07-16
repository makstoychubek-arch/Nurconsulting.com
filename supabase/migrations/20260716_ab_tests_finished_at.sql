-- ab_tests был создан вручную ДО миграции 20260703_saas_indexes_abtests.sql,
-- поэтому `create table if not exists` там не добавила недостающие колонки —
-- finished_at физически не существовала в проде. Это давало ошибку
-- PostgREST "Could not find the 'finished_at' column of 'ab_tests' in the
-- schema cache" при завершении теста (finishABTest/doClientRotation).
alter table public.ab_tests
    add column if not exists finished_at timestamptz;

notify pgrst, 'reload schema';

select 'ab_tests.finished_at ready' as status;
