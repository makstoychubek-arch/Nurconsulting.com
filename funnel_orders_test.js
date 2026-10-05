/**
 * Заказы в РНП расходились с WB по дням: orders_count подменялся на «Корзина × Заказы %»
 * (процент целый, при малых числах теряются заказы; у свежих дней воронка неполная).
 * Сверено с кабинетом WB 05.10.2026 (артикул 1544472467: 12, 11, 17, 22, 26, 31, 5 = 124):
 * настоящий orderCount воронки совпадает с «Динамикой продаж», а «Корзина × %» врёт на единицу.
 * Поэтому orderCount главнее, расчёт по корзине — запасной вариант.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const js = read('rnp-module.js');
const sql = read('supabase/migrations/20261005170000_rnp_funnel_orders.sql');

assert.ok(sql.includes('add column if not exists funnel_orders integer'), 'raw funnel orders column');
assert.ok(js.includes("const rawOrders = _funnelPickNum(day, ['orderCount', 'ordersCount', 'orders', 'order_count']);") &&
    js.includes('rec.funnel_orders = Math.round(rawOrders);'), 'the sync stores the real orderCount from the funnel');
assert.ok(js.includes('if (fromField != null) return fromField;\n        return _funnelImpliedOrders(day);'),
    'stage 2: the real funnel orderCount wins, cart × % is only a fallback');
assert.ok(js.includes('orderCount: row.funnel_orders ?? row.orderCount'), 'stored real orderCount is used when the sheet loads');

const helper = read('supabase/functions/_shared/wb-funnel-day.ts');
assert.ok(helper.includes('if (fromField != null) return fromField;\n    return funnelImpliedOrders(day);'), 'server helper: real orderCount first');
assert.ok(helper.includes('fields.funnel_orders = Math.round(rawOrders);'), 'server stores the real orderCount');
assert.ok(helper.includes('const raw = existing?.funnel_orders;'), 'a stored real orderCount is never overwritten by statistics-api counts');

const fill = read('supabase/functions/rnp-morning-fill/index.ts');
assert.ok(fill.includes("'nm_id, date, basket_count, funnel_order_conv, funnel_orders'"), 'preserve step reads the stored real orderCount');
assert.ok(fill.includes('saved += upserts.length;'), 'funnel sync saves per chunk (a timeout does not lose the rest)');

const cron = read('supabase/migrations/20261005180000_rnp_funnel_crons.sql');
for (const name of ['rnp-morning-funnel-zevina-11-bishkek', 'rnp-morning-funnel-baza-11-bishkek', 'rnp-morning-funnel-evening-zevina', 'rnp-morning-funnel-evening-baza']) {
    assert.ok(cron.includes(`'${name}'`), `${name} is scheduled`);
}
assert.ok(cron.includes('REPLACE_ME_SERVICE_ROLE_KEY') && !/eyJ[A-Za-z0-9_-]{20,}/.test(cron), 'no real key committed');

console.log('funnel_orders_test: ok');
