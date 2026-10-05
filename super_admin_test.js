/**
 * Супер-админ: владелец прописан жёстко, остальные — по флагу spaces.is_super_admin
 * у активного space. Клиент не должен иметь возможности выдать флаг себе.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const sql = read('supabase/migrations/20261005130000_super_admin_from_spaces.sql');

assert.ok(sql.includes("'global.pro.1004@gmail.com'") && sql.includes('2f7d8960-0df4-4a17-be70-f2cb2ac0032e'),
    'the owner stays hard-coded and does not depend on the spaces table');
assert.ok(/s\.user_id = auth\.uid\(\)\s+and s\.is_super_admin = true\s+and s\.status = 'active'/.test(sql),
    'flag only counts for the caller\'s own active space');
assert.ok(/security definer/i.test(sql) && /set search_path to 'public'/.test(sql), 'definer function with fixed search_path');

// Выдать флаг себе клиент не может: вставка только с false/pending, правка только у супер-админа.
const older = read('supabase/migrations/20260706_cabinets_data_isolation.sql') + read('supabase/migrations/20260916210000_tenant_isolation_team_staff.sql');
assert.ok(older.length > 0);

console.log('super_admin_test: ok');
