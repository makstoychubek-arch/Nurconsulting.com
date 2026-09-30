/**
 * Замок на публичные разделы кабинета.
 *
 * Клиент видит только разделы из APPROVED_PUBLIC. Всё остальное — BETA-модули,
 * Контент-завод, внутренние страницы — только команде (team_staff / суперадмин).
 *
 * ВЫВОД РАЗДЕЛА В ОБЩИЙ ПОКАЗ — ТОЛЬКО С РАЗРЕШЕНИЯ ВЛАДЕЛЬЦА.
 * Чтобы открыть раздел клиентам, нужно одновременно:
 *   1) добавить его в PUBLIC_TABS и __nrPublic в dashboard.html;
 *   2) добавить его сюда, в APPROVED_PUBLIC, с датой и тем, кто разрешил.
 * Без второго шага этот тест упадёт, и изменение не пройдёт npm test.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const APPROVED_PUBLIC = [
    'dashboard',     // Дашборд
    'settings',      // Настройки
    'rnp',           // РНП
    'rnp-settings',  // настройки РНП
    'advertising',   // Контроль РК
    'ab-testing',    // А/Б тесты
    'goods-groups',  // Товары
    'akylai',        // Агенты (страница клиента с Акылай)
    'summary',       // Сводный отчёт
];

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');

const listFrom = (re, label) => {
    const m = html.match(re);
    assert.ok(m, `${label} not found`);
    return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
};

const publicTabs = listFrom(/const PUBLIC_TABS = new Set\(\[([^\]]*)\]\)/, 'PUBLIC_TABS');
const earlyPublic = listFrom(/var __nrPublic = \[([^\]]*)\];/, '__nrPublic');
const liveTabs = listFrom(/const LIVE_TABS = new Set\(\[([^\]]*)\]\)/, 'LIVE_TABS');

assert.deepStrictEqual([...publicTabs].sort(), [...APPROVED_PUBLIC].sort(),
    'PUBLIC_TABS changed without owner approval — update APPROVED_PUBLIC only after the owner allows it');
assert.deepStrictEqual([...earlyPublic].sort(), [...APPROVED_PUBLIC].sort(),
    'early <head> list (__nrPublic) must match PUBLIC_TABS');

assert.ok(!publicTabs.includes('content-factory'), 'Контент-завод is staff-only');
for (const t of publicTabs) {
    assert.ok(liveTabs.includes(t), `${t}: a BETA (non-live) module can never be public`);
}
for (const t of ['agents', 'telegram-bots', 'seo', 'marking', 'logistics', 'dds', 'calculator', 'tariffs', 'ozon', 'planning']) {
    assert.ok(!publicTabs.includes(t), `${t} stays staff-only`);
}

// Шлагбаумы: меню, прямая ссылка, ранний <head>, смена роли.
assert.ok(html.includes("if (!isStaff && !PUBLIC_TABS.has(name)) {\n            showTab('dashboard');"),
    'showTab blocks non-public modules for clients');
assert.ok(html.includes("else if (!isStaff && !PUBLIC_TABS.has(getCurrentActiveTab())) showTab('dashboard');"),
    'role check moves a client off a non-public module');
assert.ok(html.includes("} else if (__nrTab && __nrPublic.indexOf(__nrTab) === -1) {"),
    'direct link to a BETA module never paints for a client');
assert.ok(html.includes('function applyModuleVisibility(root)') &&
    html.includes("if (!PUBLIC_TABS.has(tab)) el.setAttribute('data-staff-only', '1');") &&
    html.includes('applyModuleVisibility();\n        resolveStaffRole()') &&
    html.includes('applyModuleVisibility(body);'),
    'menu items of non-public modules are marked staff-only (desktop and phone menu)');
assert.ok(html.includes('html:not([data-staff="1"]) [data-staff-only] { display: none !important; }'),
    'staff-only items are hidden for clients by CSS');

console.log('public_modules_test: ok');
