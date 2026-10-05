'use strict';
// Пересбор заказов за 30 дней: функция только добавляет, расписание без ключей в репозитории.
const assert = require('assert');
const fs = require('fs');
const fn = fs.readFileSync(__dirname + '/supabase/functions/orders-rescan/index.ts', 'utf8');
assert.ok(fn.includes("upsert(rows.slice(i, i + 500), { onConflict: 'cabinet_id,srid' })"), 'rescan upserts by srid');
assert.ok(!/\.delete\(\)/.test(fn), 'rescan never deletes orders');
assert.ok(fn.includes('isServiceAuthorized'), 'only the service role can run it');
assert.ok(fn.includes('if (!res.ok) continue;'), '429 and errors leave the cursor where it was');
const cron = fs.readFileSync(__dirname + '/supabase/migrations/20261005201000_orders_rescan_cron.sql', 'utf8');
assert.ok(cron.includes('REPLACE_ME_SERVICE_ROLE_KEY') && !/eyJ[A-Za-z0-9_-]{20}/.test(cron), 'no keys in the repo');
assert.ok(cron.includes("'5,15,25,35,45,55 * * * *'"), 'every 10 minutes, offset from auto-sync');
console.log('orders_rescan_test: ok');
