/**
 * У таблиц А/Б-теста включён RLS, поэтому без политик браузер не может ни создать,
 * ни прочитать тест (так и сломался запуск 04.10). Миграция должна давать доступ
 * только своему кабинету и не открывать таблицы анонимам.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261005120000_ab_tests_rls_policies.sql'), 'utf8');

assert.ok(/create policy "cabinet_access" on public\.ab_tests\s+for all to authenticated\s+using \(cabinet_id in \(select public\.current_user_cabinet_ids\(\)\)\)\s+with check \(cabinet_id in \(select public\.current_user_cabinet_ids\(\)\)\)/.test(sql),
    'ab_tests: only own cabinets, both read and write');
for (const t of ['ab_test_variants', 'ab_test_rotation_log', 'ab_test_rotations', 'ab_test_variant_stats']) {
    assert.ok(sql.includes(`'${t}'`), `${t}: child table gets the policy`);
}
assert.ok(sql.includes('using (test_id in (') && sql.includes('with check (test_id in ('),
    'child tables are reached through the owning test');
assert.ok(!/using\s*\(\s*true\s*\)/i.test(sql) && !/with check\s*\(\s*true\s*\)/i.test(sql), 'no permissive policy');
assert.ok(/revoke all on[\s\S]*ab_tests[\s\S]*from anon/.test(sql), 'anonymous role has no access to test tables');

// Создание теста на фронте при любой ошибке удаляет тест — значит, нужна запись при создании.
const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
assert.ok(html.includes("from('ab_tests').insert({"), 'the dashboard creates tests from the browser (needs insert policy)');

console.log('ab_tests_rls_test: ok');
