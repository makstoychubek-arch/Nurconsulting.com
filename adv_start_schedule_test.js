/**
 * Планировщик запуска РК: таблица, крон, тик. Живые кампании не стартуем.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20260917120000_adv_start_schedule.sql'), 'utf8');
const fn = fs.readFileSync(path.join(root, 'supabase/functions/adv-start-schedule/index.ts'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'supabase/functions/_shared/adv-start-schedule.ts'), 'utf8');

assert.ok(mig.includes('create table if not exists public.adv_start_schedule'), 'schedule table');
assert.ok(mig.includes("status = 'pending'"), 'client insert is pending only');
assert.ok(mig.includes("'adv_start_schedule'"), 'minute cron job name');
assert.ok(mig.includes('* * * * *'), 'tick every minute');
assert.ok(mig.includes('functions/v1/adv-start-schedule'), 'cron hits the tick function');
assert.ok(mig.includes("body    := '{}'::jsonb"), 'cron body is empty — not dry_run');
assert.ok(!mig.includes('advert-api.wildberries.ru'), 'cron posts to our function, not WB');
assert.ok(mig.includes('Bearer ([A-Za-z0-9._-]+)'), 'copies Bearer from an existing cron, no key in git');

assert.ok(fn.includes('isServiceAuthorized'), 'tick accepts cron JWT');
assert.ok(fn.includes('readAdvTokenFromVault'), 'token from Vault, not the row');
assert.ok(fn.includes("start(ctx, { id: advertId })"), 'due rows go to GET /adv/v0/start');
assert.ok(fn.includes('parseScheduleDryRun'), 'explicit dry_run only');
assert.ok(fn.includes("eq('id', cabinetId)"), '401 marks that cabinet, not all tokens');

assert.ok(shared.includes("action: 'would_start'"), 'dry_run reports would_start');
assert.ok(shared.includes('if (deps.dryRun)'), 'dry_run returns before claim/start');

console.log('adv_start_schedule_test: ok');
