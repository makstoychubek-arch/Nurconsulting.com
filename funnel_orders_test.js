/**
 * Заказы в РНП расходились с WB по дням: orders_count подменялся на «Корзина × Заказы %»
 * (процент целый, при малых числах теряются заказы; у свежих дней воронка неполная).
 * Этап 1: настоящий orderCount из воронки хранится отдельно (funnel_orders) для сверки,
 * расчёт РНП не меняется. Этап 2 (после сверки с кабинетом WB) переключит источник.
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
assert.ok(js.includes('if (u.orders_count != null) row.orders_count = u.orders_count;') &&
    js.includes('if (funnelOrders != null) rec.orders_count = funnelOrders;'), 'stage 1 does not change how orders_count is computed');

console.log('funnel_orders_test: ok');
