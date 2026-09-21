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
assert.ok(fn.includes('srid-check'), 'does not move an srid onto another day');
assert.ok(fn.includes('rnp_daily_data'), 'writes article metrics');
assert.ok(fn.includes('funnelDayMetricFields'), 'funnel writes WB orderCount into orders_count');
assert.ok(fn.includes('applyKeepFunnelOrders'),
    'morning rebuild must keep WB card funnel orders_count, not overwrite with wb_orders');
assert.ok(fn.includes('upsertDateRange'),
    'morning rebuild keeps funnel ЗАКАЗЫ on every filled day, not only last 7');
assert.ok(fn.includes('moscowYmd'),
    'morning funnel window is Moscow calendar like the WB seller card');
assert.ok(fn.includes('funnel_only'),
    'later morning pass can refresh funnel without orders or Telegram');
assert.ok(fn.includes("notify = funnelOnly || groupAll ? false"),
    'funnel_only / group=all must not spam the team chat');
assert.ok(fn.includes("wantFunnel = funnelOnly || body.funnel === true"),
    '06/07/08 skip funnel so Karina can say готово before the edge timeout');
assert.ok(fn.includes('finally'),
    'Karina must send готово even if orders/funnel throw after начинаю');
assert.ok(fn.includes('уркунбаев') && fn.includes('айлин') && fn.includes('бейшеев') && fn.includes('айзада'),
    'morning groups match legal IP names, not only Baza/Elium/Zevina latin');
assert.ok(fn.includes('auto-sync-4h'),
    'Zevina schedule documents the 00:00 UTC collision with auto-sync');
assert.ok(fn.includes("group: 'zevina'|'baza'|'elium'|'all'"),
    'catch-up can pass group=all for a silent funnel refresh');
assert.ok(fn.includes('orders: WB вернул не массив'), 'empty/non-array WB payload must not wipe the day');
assert.ok(fn.includes("mode: 'stocks'") && fn.includes('syncStocksViaAutoSync'),
    'morning fill must refresh size-level stocks for the same cabinet group');
assert.ok(!fn.includes("rpc('snapshot_goods_daily_stocks'"),
    'morning fill must not lock the daily stock column before sales close');
assert.ok(fn.includes('goods-daily-eod') && fn.includes('03:00'),
    'morning fill documents the 03:00 Bishkek / 00:00 MSK end-of-day snapshot');
assert.ok(fn.includes('остатки по размерам'), 'Karina reports stocks in the done message');
assert.ok(auto.includes('techSize || s.wbSize || s.sizeName || meta?.techSize'),
    'FBO stocks must get tech_size from the WB card so the RNP size grid is filled');
assert.ok(auto.includes('/^\\d{6,}$/.test(sku)'),
    'FBO must treat a numeric barcode as chrtId when WB omits chrtId');
assert.ok(fn.includes('ordersFailed'),
    'morning fill must still refresh size stocks if orders fail');
assert.ok(fn.includes('i += 20') && fn.includes('fetchFunnelChunk'), 'funnel is chunked by WB 20-nmId limit');
assert.ok(fn.includes('datesIn') && fn.includes('wantFunnel'), 'catch-up can pass dates and skip funnel');
assert.ok(fn.includes('Я Карина, начинаю заполнять РНП'), 'start message is Karina');
assert.ok(fn.includes("getTelegramChatId('team')"), 'posts to the team group');
assert.ok(fn.includes('KARINA_BOT_TOKEN'), 'prefers Karina bot token');

assert.ok(routing.includes("team: 'Тим'"), 'team channel exists');
assert.ok(routing.includes("team: '-1004460164885'"), 'team chat fallback');
assert.ok(routing.includes('TEAM_TELEGRAM_CHAT_ID'), 'team secret');

assert.ok(auto.includes('yesterday') && auto.includes('addDaysStr(today, -1)'),
    'auto-sync Pass B must fetch yesterday, not only today');
assert.ok(auto.includes('order_date: dayStr'),
    'auto-sync stores WB flag=1 day, not the UTC timestamp');
assert.ok(auto.includes('moscowYmd'),
    'auto-sync Pass B uses Moscow calendar like the WB funnel');
assert.ok(auto.includes('funnelDayMetricFields'),
    'auto-sync funnel must copy WB Заказы (orderCount) into orders_count');
assert.ok(auto.includes('applyKeepFunnelOrders'),
    'auto-sync must not let wb_orders overwrite funnel ЗАКАЗЫ');
assert.ok(auto.includes('preserveFunnelOrders'),
    'auto-sync stats rebuild loads existing basket×% before upsert');
assert.ok(auto.includes('upsertDateRange'),
    'auto-sync keeps funnel orders for every rebuilt day, not only last 7');
assert.ok(auto.includes('allowMoveSrid: true'),
    'Pass B may move an srid onto the WB flag=1 day to fix UTC holes');

assert.ok(fin.includes('isServiceAuthorized'), 'night finance cron must not 401 on key drift');
assert.ok(fin.includes('/api/finance/v1/sales-reports/detailed'), 'night finance uses the official Finance API successor');
assert.ok(fin.includes("period: 'daily'"), 'finance sync asks WB for daily rows, not the weekly default');
assert.ok(!fin.includes('statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod'),
    'deprecated statistics-api reportDetailByPeriod URL must stay out of rnp-finance-sync');
assert.ok(!fin.includes('sales-reports/list'), 'KG cabinets must not use list + reportId for RNP finance');

assert.ok(mig.includes('rnp-morning-zevina-06-bishkek') && mig.includes("'0 0 * * *'"),
    'Zevina cron at 06:00 Bishkek');
assert.ok(mig.includes('rnp-morning-baza-07-bishkek') && mig.includes("'15 1 * * *'"),
    'Baza cron at 07:15 Bishkek');
assert.ok(mig.includes('rnp-morning-elium-08-bishkek') && mig.includes("'0 2 * * *'"),
    'Elium cron at 08:00 Bishkek');
assert.ok(mig.includes('rnp-daily-bish'), 'old afternoon rnp-daily-bish is replaced');

const funnelMig = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260916120000_rnp_morning_funnel_refresh.sql'),
    'utf8',
);
assert.ok(funnelMig.includes('rnp-morning-funnel-zevina-09-bishkek') && funnelMig.includes("'0 3 * * *'"),
    'legacy 09:00 Bishkek funnel cron is still in the 09 migration file');
assert.ok(funnelMig.includes('"funnel_only":true') && funnelMig.includes('"notify":false'),
    '09:00 funnel pass must not post to Telegram');

const funnel11 = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260921110000_rnp_funnel_lock_11_bishkek.sql'),
    'utf8',
);
assert.ok(funnel11.includes('rnp-morning-funnel-zevina-11-bishkek') && funnel11.includes("'0 5 * * *'"),
    'Zevina funnel lock at 11:00 Bishkek');
assert.ok(funnel11.includes('rnp-morning-funnel-baza-11-bishkek') && funnel11.includes("'15 5 * * *'"),
    'Baza funnel lock at 11:15 Bishkek');
assert.ok(funnel11.includes('rnp-morning-funnel-elium-11-bishkek') && funnel11.includes("'30 5 * * *'"),
    'Elium funnel lock at 11:30 Bishkek');
assert.ok(funnel11.includes('rnp-morning-funnel-zevina-09-bishkek'),
    '11:00 cron unschedules the early 09:00 funnel pass');

const zevinaShift = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260916140000_rnp_morning_zevina_off_autosync.sql'),
    'utf8',
);
assert.ok(zevinaShift.includes('rnp-morning-zevina-0620-bishkek') && zevinaShift.includes("'20 0 * * *'"),
    'Zevina morning fill at 06:20 Bishkek, after auto-sync-4h');
assert.ok(zevinaShift.includes('rnp-morning-zevina-06-bishkek'),
    'old 06:00 Zevina cron is unscheduled');
assert.ok(zevinaShift.includes('"funnel":false'),
    '06:20 Zevina does not wait on the WB funnel before Telegram');

console.log('rnp_morning_fill_test: ok');
