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

// Сегодняшний день: финансовые показатели «ещё не пришли» (прочерк), а не 0; показы РК — из advertising_daily_stats.
assert.ok(js.includes('const FINANCE_DAY_KEYS = new Set([') && js.includes("const financePending = isDay && isToday && FINANCE_DAY_KEYS.has(m.key) && !(Number(val) > 0);"),
    'today finance cells show a dash until WB closes the day');
assert.ok(js.includes('Финансовый отчёт WB придёт после закрытия дня'), 'the dash is explained');
assert.ok(js.includes('async function _syncAdStats(_nmId) {\n        return 0;\n    }'), 'the per-article ad copy in rnp_daily_data is retired');
assert.ok(js.includes("{ op: 'eq', column: 'cabinet_id', value: _cab },\n                { op: 'gte', column: 'stat_date'") || js.includes("'advertising_daily_stats'"),
    'ads are read from advertising_daily_stats');

// Показы РК по артикулам вне РНП не теряются молча.
assert.ok(js.includes('function _updateAdOutsideNotice()') && js.includes("opts?.trackOutside") && js.includes('{ trackOutside: true }'),
    'ad views of articles outside the active RNP set are counted on a full load');
assert.ok(js.includes('Показы РК по артикулам вне РНП') && js.includes('rnp-ad-outside-'), 'the warning about ad views outside RNP goes to the bell, not over the table');

// Настройки РНП: без «Основных настроек», кнопок «Обновить артикулы»/«Из заказов» и колонок затрат; новая группа — без prompt().
const settingsRow = js.slice(js.indexOf('function _settingsArticleRowHtml'), js.indexOf('function _activeArticleCount'));
assert.ok(!settingsRow.includes('RNP.setCost') && !settingsRow.includes('RNP.setLogisticsUnit') && !settingsRow.includes('RNP.setOtherCosts'),
    'cost columns are gone from RNP settings (cost lives in Товары)');
assert.ok(!js.includes('RNP.refreshArticles()" id="rnp-refresh-arts-btn"') && !js.includes('RNP.syncArts()" id="rnp-sync-btn"'), 'manual article buttons are gone from settings');
assert.ok(!js.includes("prompt('Название новой категории/группы:'") && js.includes('function _startNewCategoryInput(nmId)'),
    'a new group is typed in the cell: the browser prompt() is blocked in the app');

// Старый кэш шапки (с тремя списками) стирается; ряд вкладок не меняет высоту при выборе группы.
assert.ok(js.includes("const RNP_UI_VERSION = '5';") && js.includes("indexedDB.deleteDatabase('nr-rnp-lock')"), 'stale cached RNP chrome is purged once');
assert.ok(js.includes('bar.querySelector(\'[data-bar-v="5"]\')'), 'cached bars from the old layout are rebuilt');
const dash = read('dashboard.html');
assert.ok(/\.rnp-sheet-tabs \{[^}]*min-height: 46px; align-items: center;/.test(dash), 'the tab row keeps its height, the table does not shift when a group opens');

// Закреплённая шапка артикула не меняет размер и без тени; вкладки и значки в одном ряду.
assert.ok(!/\.rnp-article-panel--wide\.is-pinned \.rnp-head-wide \{/.test(dash), 'pinned head no longer shrinks (FBO/FBS stays fully visible)');
assert.ok(/\.rnp-article-panel--wide\.is-pinned \{\s*box-shadow: none;\s*\}/.test(dash) && !/rgba\(0, 0, 0, 0\.18\)/.test(dash.slice(dash.indexOf('.rnp-article-panel--wide.is-pinned'), dash.indexOf('.rnp-article-panel--wide.is-pinned') + 400)), 'no dark shadow under the pinned head');
assert.ok(dash.includes('.rnp-workspace > .rnp-sheet-tabs { grid-column: 1;') && dash.includes('.rnp-workspace > #rnp-action-bar-wrap { grid-column: 2;'), 'tabs and the plan/fact + settings icons share one row on desktop');
assert.ok(dash.includes('#nr-sync-banner:empty { display: none; margin: 0; }'), 'an empty load banner takes no space');

// Фотогалерея в шапке артикула не укорачивается при прокрутке (раньше при закреплении сжималась до 72 px).
assert.ok(js.includes('const capH = MARQUEE_CARD_MAX_H;') && !js.includes('pinned ? MARQUEE_PINNED_H : MARQUEE_CARD_MAX_H'),
    'gallery height does not depend on the pinned state');

// Единая раскладка страниц по образцу РНП и скруглённая левая панель.
assert.ok(dash.includes('.main-content { padding: 4px 6px 12px !important; }'), 'all pages share the RNP page padding');
assert.ok(/\.sidebar-rail \{\s*margin: 10px 0 10px 10px; width: 184px;[^}]*border-radius: 18px;/.test(dash), 'the left panel is a rounded floating card like the blocks on the right');
assert.ok(dash.includes('header.glass.app-header { left: 200px; right: 6px; }') && dash.includes('.main-rail:has(#tab-dashboard.active) { padding-top: 76px; }'),
    'header and content share the same edges and the same top offset on every page');

console.log('funnel_orders_test: ok');

// Без «прыжка» при загрузке (05.10.2026)
{
    const h = require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8');
    const ok = require('assert').ok;
    ok(h.includes('window.__nrSkipViewTransition') && h.includes('!window.__nrSkipViewTransition'), 'initial tab is painted without a view transition');
    ok(h.includes('nr_ui_names_v1'), 'user/cabinet names are painted from cache on first frame');
    ok(h.includes(".main-content{padding:4px 6px 12px}"), 'early padding equals final padding');
}

// Заметки по дням: кнопка в панели, состояние помнится, строка заметок появляется сразу
{
    const js = require('fs').readFileSync(require('path').join(__dirname, 'rnp-module.js'), 'utf8');
    const ok = require('assert').ok;
    ok(js.includes('rnp-head-notes-btn') && js.includes('RNP.toggleNotes(!RNP.notesVisible())') && js.includes('function _buildHeadMetaHtml'), 'responsible, status and the notes button live in the header corner');
    ok(js.includes("_notesVisible = localStorage.getItem('rnp_notes_visible') === '1'"), 'notes visibility is remembered');
    ok(js.includes('liveTable.tHead.rows.length !== nextTable.tHead.rows.length) return false'), 'notes row forces a real re-render, not a cell patch');
    ok(js.includes("if (error) throw error;") && js.includes('пустой текст очищает заметку дня'), 'notes save reports DB errors and can be cleared');
}

// Мини-окно заметки при наведении
{
    const js = require('fs').readFileSync(require('path').join(__dirname, 'rnp-module.js'), 'utf8');
    const h = require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8');
    const ok = require('assert').ok;
    ok(js.includes('function _showNotePop') && js.includes("closest('.rnp-note-input')") && js.includes('data-nm="${nmId}"'), 'hovering a note opens an enlarged mini window');
    ok(h.includes('.rnp-note-pop-text') && h.includes('pointer-events: none'), 'the note pop is a read-only card');
}

// Дашборд: финансовый результат как у Raskpro и себестоимость из карточек товаров
{
    const h = require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8');
    const ok = require('assert').ok;
    ok(h.includes('id="dash-pnl"') && h.includes('function renderPnl') && h.includes('renderPnl(metrics);'), 'P&L block: Реализация → Услуги → Налоги и затраты → Операционная прибыль');
    ok(h.includes('async function loadCostOfGoodsMap') && h.includes('settings.costOfGoods = await loadCostOfGoodsMap'), 'dashboard profit uses cost of goods from article cards');
}

// Нижний ряд как у Raskpro: Заказы, Продажи, Логистика, Реклама, Все услуги + «Динамика показателей»
{
    const h = require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8');
    const ok = require('assert').ok;
    ok(h.includes('function renderPnlDaily') && h.includes("card('Все услуги'") && !h.includes("card('Услуги ЕАЭС'"), 'the row ends with «Все услуги», no EAEU card');
    ok(h.includes('id="pnl-chart"') && h.includes("label: 'Прибыль'"), 'stacked daily chart: orders, sales, profit');
}
