/**
 * РНП: период — общим выбором дат в шапке (как в Дашборде и Контроле РК), без трёх списков;
 * выбор применяется сам после второй даты, без кнопки «Применить»; уведомления — в колокольчике.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const html = read('dashboard.html');
const js = read('rnp-module.js');

// РНП: списки «Все секции», «План → неделя/месяц» и месяц убраны.
const bar = js.slice(js.indexOf('function _buildActionBar(active) {'), js.indexOf('function _summaryRowHtml'));
assert.ok(!bar.includes('<select'), 'RNP action bar has no select lists');
assert.ok(js.includes("return '';\n    }\n\n    function _buildActionBar"), 'phone settings no longer carry the three selects');
assert.ok(js.includes("_planPeriod = 'week'") && js.includes("_sectionView = 'all'"), 'fixed week/all mode');

// Период — из шапки, не больше 62 дней.
assert.ok(js.includes('async function setDateRange(from, to, opts)') && js.includes('const RNP_MAX_RANGE_DAYS = 62;'), 'RNP takes a date range');
assert.ok(js.includes('if (_extRange) {\n            const cur = new Date(_extRange.from'), 'calendar columns follow the chosen range');
assert.ok(/return \{ init, initCore, ensureReady, setDateRange,/.test(js), 'setDateRange is exported');
assert.ok(html.includes("const DATE_FILTER_TABS = new Set(['dashboard', 'summary', 'advertising', 'logistics', 'planning', 'rnp']);"), 'the shared date chip shows on RNP too');
assert.ok(html.includes("else if (name === 'rnp') { const rnp = getRnp(); if (rnp && rnp.setDateRange)"), 'applying a range updates RNP');
assert.ok(html.includes('rnp.setDateRange(activeDateFrom, activeDateTo)'), 'opening RNP uses the current shared range');

// Выбор дат: без кнопок «Применить/Сбросить», применяется сам.
assert.ok(!html.includes('onclick="applyPicker()"') && !html.includes('onclick="resetPicker()"'), 'no apply/reset buttons in the date picker');
assert.ok(html.includes('if (pickerState.fromDate && pickerState.toDate) applyPicker();'), 'the range applies itself after the second date');
assert.ok(html.includes('applyPicker(); // быстрый выбор тоже применяется сразу'), 'quick ranges apply at once');

// Уведомления — в колокольчик.
assert.ok(html.includes("window.NrNotify.push({ title: 'Данные загружены'"), '«Данные загружены» goes to the bell');
assert.ok(!html.includes('<b>Данные загружены</b> — 100%.'), 'no banner for a finished load');

// У каждой вкладки своя память периода: выбор в Дашборде не меняет РНП.
assert.ok(html.includes("const DATE_RANGE_BY_TAB_KEY = 'nr_date_range_by_tab_v1';") && html.includes('map[rangeTabKey()] = { from: activeDateFrom, to: activeDateTo };'),
    'the chosen period is stored per tab');
assert.ok(html.includes('function loadDateRangeForTab(tab)') && html.includes("if (DATE_FILTER_TABS.has(name)) loadDateRangeForTab(name);"),
    'switching tabs loads that tab\'s own period before it loads data');
assert.ok(html.includes("if (tab === 'rnp') return { from: monthStartIso(), to: monthEndIso() };"), 'RNP defaults to the whole month (plan columns for future days)');

console.log('rnp_date_range_test: ok');
