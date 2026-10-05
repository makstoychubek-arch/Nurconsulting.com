-- ============================================================
-- А/Б-тест: вернуть политики доступа к своим тестам.
--
-- Симптом: «не получилось запустить А/Б-тест». У ab_tests, ab_test_variants,
-- ab_test_rotation_log, ab_test_rotations и ab_test_variant_stats включён RLS,
-- но ни одной политики нет (старые permissive-политики убрали при закрытии
-- «дырявых» политик, а новые не создали). Браузер при создании теста получал
-- «new row violates row-level security policy», а код создания при любой
-- ошибке удаляет тест — поэтому в базе не осталось следов запуска.
--
-- Правило то же, что у остальных таблиц кабинета: видит и меняет только
-- владелец кабинета, команда и супер-админ (current_user_cabinet_ids()).
-- Edge-функции (ab-test-rotate) работают через service role и RLS не касаются.
-- Safe to re-run.
-- ============================================================

drop policy if exists "cabinet_access" on public.ab_tests;
create policy "cabinet_access" on public.ab_tests
    for all to authenticated
    using (cabinet_id in (select public.current_user_cabinet_ids()))
    with check (cabinet_id in (select public.current_user_cabinet_ids()));

-- Дочерние таблицы: доступ через тест, которому они принадлежат.
do $$
declare
    t text;
begin
    foreach t in array array[
        'ab_test_variants',
        'ab_test_rotation_log',
        'ab_test_rotations',
        'ab_test_variant_stats'
    ] loop
        execute format('drop policy if exists "cabinet_access" on public.%I', t);
        execute format($p$
            create policy "cabinet_access" on public.%I
                for all to authenticated
                using (test_id in (
                    select id from public.ab_tests
                    where cabinet_id in (select public.current_user_cabinet_ids())
                ))
                with check (test_id in (
                    select id from public.ab_tests
                    where cabinet_id in (select public.current_user_cabinet_ids())
                ))
        $p$, t);
    end loop;
end $$;

-- Анонимному пользователю таблицы А/Б-тестов не нужны.
revoke all on public.ab_tests, public.ab_test_variants, public.ab_test_rotation_log,
    public.ab_test_rotations, public.ab_test_variant_stats from anon;
