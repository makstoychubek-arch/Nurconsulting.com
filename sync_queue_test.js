/**
 * Очередь загрузки истории из WB: клиент видит проценты и оставшееся время,
 * сервер грузит окна по одному на кабинет, клиент не пишет в очередь напрямую.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const sql = read('supabase/migrations/20261005150000_sync_queue.sql');

assert.ok(sql.includes('unique (cabinet_id, period_from, period_to)'), 'one job per cabinet window');
assert.ok(/status in \('queued', 'running', 'done', 'error'\)/.test(sql), 'job lifecycle');
assert.ok(/for select to authenticated\s+using \(cabinet_id in \(select public\.current_user_cabinet_ids\(\)\)\)/.test(sql), 'client reads only own jobs');
assert.ok(sql.includes('revoke all on public.sync_jobs from anon, authenticated;') && sql.includes('grant select on public.sync_jobs to authenticated;'),
    'client has no write access to the queue');
assert.ok(sql.includes('revoke all on function public.claim_sync_jobs(int) from public, anon, authenticated;') &&
    sql.includes('grant execute on function public.claim_sync_jobs(int) to service_role;'), 'only the worker can claim jobs');
assert.ok(sql.includes('revoke all on function public.plan_cabinet_backfill(uuid, int) from public, anon, authenticated;'), 'planning is server-only');
assert.ok(/not in \(\s*select b\.cabinet_id from public\.sync_jobs b\s+where b\.status = 'running'/.test(sql), 'at most one running job per cabinet (WB limits requests per token)');
assert.ok(sql.includes('interval \'8 minutes\''), 'a stuck job is picked up again');
assert.ok(sql.includes('v_to := v_today - (i * 8);') && sql.includes('v_from := v_to - 7;'), 'windows of 8 days (WB storage limit), newest first');
assert.ok(sql.includes("least(greatest(coalesce(p_days, 90), 8), 90)"), 'a client loads at most 90 days; the team up to 400');
assert.ok(sql.includes("if auth.uid() is null or not (p_cabinet in (select public.current_user_cabinet_ids()))"), 'request_backfill checks cabinet access');
assert.ok(sql.includes("'eta_minutes'") && sql.includes("'percent'"), 'progress has percent and time left');

const fn = read('supabase/functions/sync-queue-tick/index.ts');
assert.ok(fn.includes('isServiceAuthorized(req, serviceKey)'), 'worker is service-only');
assert.ok(fn.includes("rpc('claim_sync_jobs'") && fn.includes('/functions/v1/rnp-finance-sync'), 'worker claims a job and runs the existing sync');
assert.ok(fn.includes('EdgeRuntime.waitUntil(work)'), 'worker answers pg_net within its 5 s limit and finishes jobs in the background');
assert.ok(!/error\s*:\s*String\(e/.test(fn), 'no raw error text leaves the worker');

const cron = read('supabase/migrations/20261005151000_sync_queue_cron.sql');
assert.ok(cron.includes("'sync-queue-tick-1m'") && cron.includes("'* * * * *'") && cron.includes('REPLACE_ME_SERVICE_ROLE_KEY'), 'cron every minute, no real key committed');

const html = read('dashboard.html');
assert.ok(html.includes("rpc('request_backfill'") && html.includes("rpc('sync_progress'"), 'dashboard asks for progress');
assert.ok(html.includes('осталось') && html.includes('Загружаем данные из Wildberries') && html.includes('Можно закрыть страницу'), 'client sees percent, time left and that closing the page is fine');
assert.ok(html.includes('window.nrSyncProgress.watch(currentCabinetId)'), 'RNP tab starts watching the cabinet');
assert.ok(!/eta_minutes[^\n]*\.error/.test(html), 'technical errors are not shown to the client');

console.log('sync_queue_test: ok');
