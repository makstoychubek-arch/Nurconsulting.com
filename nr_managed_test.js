/**
 * Внутренние отчёты команды берут только кабинеты с nr_managed = true.
 * Иначе после одобрения клиента (admin-space переносит его токен в
 * cabinets.wb_token) его кабинет подхватили бы командные отчёты и автоответы.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

for (const name of ['daily-penalties-report', 'daily-sales-report', 'check-campaigns-notify', 'rnp-morning-fill', 'wb-restock-poll']) {
    const code = read(`supabase/functions/${name}/index.ts`);
    assert.ok(
        /\.from\('cabinets'\)\s*\.select\('id, name, wb_token'\)\s*\.not\('wb_token', 'is', null\)\s*\.gt\('wb_token', ''\)\s*\.eq\('nr_managed', true\)/.test(code),
        `${name}: the all-cabinets query must take only nr_managed = true`,
    );
}

const sql = read('supabase/migrations/20260930130000_cabinets_nr_managed.sql');
assert.ok(sql.includes('add column nr_managed boolean not null default false'), 'default is «no»');
assert.ok(/if not exists \(\s*select 1 from information_schema\.columns[\s\S]*?nr_managed[\s\S]*?\) then\s*alter table[\s\S]*?update public\.cabinets c\s*set nr_managed = true/.test(sql),
    'existing team cabinets are flagged once, only when the column is created (re-running never flags clients)');
assert.ok(/join public\.team_staff t on lower\(t\.email\) = lower\(s\.email\)/.test(sql), 'only cabinets owned by the team are flagged');
assert.ok(sql.includes('auth.uid() is not null and not public.is_super_admin()') &&
    sql.includes('new.nr_managed := old.nr_managed;') && sql.includes('new.nr_managed := false;'),
    'a client cannot switch the flag on for their own cabinet');

// Кабинет клиента получает токен в cabinets.wb_token только при одобрении — это и есть точка риска.
assert.ok(read('supabase/functions/admin-space/index.ts').includes("update({ wb_token: token })"),
    'approval moves the token into cabinets.wb_token (why the flag is needed)');

console.log('nr_managed_test: ok');
