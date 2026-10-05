/**
 * Звук при новом заказе (только команда): сервер пишет новые заказы FBS в order_events, страница играет
 * звук для выбранных артикулов; мини-настройки в РНП.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const html = read('dashboard.html');
const rnp = read('rnp-module.js');
const sql = read('supabase/migrations/20261005190000_order_events.sql');
const fn = read('supabase/functions/orders-watch/index.ts');
const cron = read('supabase/migrations/20261005191000_orders_watch_cron.sql');

// Звуковой файл на месте.
assert.ok(fs.existsSync(path.join(__dirname, 'sounds/order-dolphin.m4a')) && fs.statSync(path.join(__dirname, 'sounds/order-dolphin.m4a')).size > 5000, 'sound file is shipped');
assert.ok(html.includes("var SRC = '/sounds/order-dolphin.m4a';"), 'the page plays the shipped file');

// База: уникальные заказы, только команда видит, писать может сервер, Realtime включён.
assert.ok(sql.includes('unique (cabinet_id, ext_id)'), 'each order is stored once per cabinet');
assert.ok(sql.includes('using (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()))'), 'only staff read order events of their cabinets');
assert.ok(sql.includes('revoke all on public.order_events from anon, authenticated;') && sql.includes('grant select on public.order_events to authenticated;'), 'clients cannot write');
assert.ok(sql.includes('alter publication supabase_realtime add table public.order_events'), 'inserts are pushed to open pages');

// Сервер: только service role, только кабинеты команды, ответ сразу, опрос в фоне, ключ не в репозитории.
assert.ok(fn.includes('isServiceAuthorized(req, serviceKey)') && fn.includes(".eq('nr_managed', true)"), 'worker is service-only and watches team cabinets only');
assert.ok(fn.includes('EdgeRuntime.waitUntil(work)') && fn.includes('/api/v3/orders/new'), 'answers pg_net at once and polls WB in the background');
assert.ok(cron.includes("'orders-watch-1m'") && cron.includes('REPLACE_ME_SERVICE_ROLE_KEY') && !/eyJ[A-Za-z0-9_-]{20,}/.test(cron), 'cron every minute, no real key committed');

// Страница: подписка, фильтр по выбранным артикулам, «тихие» события без звука, окно настроек.
assert.ok(html.includes("table: 'order_events'") && html.includes("event: 'INSERT'"), 'the page subscribes to inserts');
assert.ok(html.includes('if (!row || row.silent) return;') && html.includes('st.nms.indexOf(Number(row.nm_id)) === -1'), 'silent rows and unselected articles make no sound');
assert.ok(html.includes("if (isStaff && window.NrOrderSound) window.NrOrderSound.start();"), 'only the team subscribes');
assert.ok(html.includes('id="nros-enabled"') && html.includes('data-nros-group') && html.includes('data-nros-nm') && html.includes('id="nros-test"'), 'settings: master switch, groups, articles, test button');

// РНП: колокольчик только для команды и список артикулов для настроек.
assert.ok(rnp.includes('rnp-order-sound-btn" data-staff-only="1"') && rnp.includes('NrOrderSound.openSettings()'), 'the bell in the RNP toolbar is staff-only');
assert.ok(rnp.includes('listArticles: _listArticlesForSound'), 'RNP exposes its articles for the sound settings');

console.log('order_sound_test: ok');
