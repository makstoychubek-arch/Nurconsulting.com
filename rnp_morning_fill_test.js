/**
 * Утренний крон РНП: вчера+сегодня по кабинетам, Карина в тим.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const fn = fs.readFileSync(path.join(root, 'supabase/functions/rnp-morning-fill/index.ts'), 'utf8');
const auto = fs.readFileSync(path.join(root, 'supabase/functions/auto-sync/index.ts'), 'utf8');
const fin = fs.readFileSync(path.join(root, 'supabase/functions/rnp-finance-sync/index.ts'), 'utf8');
const routing = fs.readFileSync(path.join(root, 'supabase/functions/_shared/telegram-routing.ts'), 'utf8');
const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20260905123000_rnp_morning_fill_cron.sql'), 'utf8');

assert.ok(fn.includes('isServiceAuthorized'), 'morning fill must accept cron JWT');
assert.ok(fn.includes("group: 'zevina'|'baza'|'elium'") || fn.includes('GROUPS'), 'three cabinet groups');
assert.ok(fn.includes('yesterdayBishkek'), 'fill date is yesterday in Bishkek');
assert.ok(fn.includes('supplier/orders'), 'pulls WB orders for the day');
assert.ok(fn.includes('order_date: dayStr'), 'stores WB flag=1 day, not ISO timestamp');
assert.ok(fn.includes('rnp_daily_data'), 'writes article metrics');
assert.ok(fn.includes('sales-funnel/products/history'), 'refreshes funnel for all articles');
assert.ok(fn.includes('Я Карина, начинаю заполнять РНП'), 'start message is Karina');
assert.ok(fn.includes("getTelegramChatId('team')"), 'posts to the team group');
assert.ok(fn.includes('KARINA_BOT_TOKEN'), 'prefers Karina bot token');

assert.ok(routing.includes("team: 'Тим'"), 'team channel exists');
assert.ok(routing.includes("team: '-1004460164885'"), 'team chat fallback');
assert.ok(routing.includes('TEAM_TELEGRAM_CHAT_ID'), 'team secret');

assert.ok(auto.includes('yesterday') && auto.includes('addDaysStr(today, -1)'),
    'auto-sync Pass B must fetch yesterday, not only today');

assert.ok(fin.includes('isServiceAuthorized'), 'night finance cron must not 401 on key drift');

assert.ok(mig.includes('rnp-morning-zevina-06-bishkek') && mig.includes("'0 0 * * *'"),
    'Zevina cron at 06:00 Bishkek');
assert.ok(mig.includes('rnp-morning-baza-07-bishkek') && mig.includes("'15 1 * * *'"),
    'Baza cron at 07:15 Bishkek');
assert.ok(mig.includes('rnp-morning-elium-08-bishkek') && mig.includes("'0 2 * * *'"),
    'Elium cron at 08:00 Bishkek');
assert.ok(mig.includes('rnp-daily-bish'), 'old afternoon rnp-daily-bish is replaced');

console.log('rnp_morning_fill_test: ok');
