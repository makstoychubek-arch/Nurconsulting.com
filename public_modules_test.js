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
    'tariffs',       // Тарифы — 30.09.2026, разрешила владелец: «вместо Ещё — Тарифы»
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
for (const t of ['agents', 'telegram-bots', 'seo', 'marking', 'logistics', 'dds', 'calculator', 'ozon', 'planning']) {
    assert.ok(!publicTabs.includes(t), `${t} stays staff-only`);
}

// Шлагбаумы: меню, прямая ссылка, ранний <head>, смена роли.
assert.ok(html.includes("if (!isStaff && !PUBLIC_TABS.has(name)) {\n            showTab(hasPaid ? 'dashboard' : 'akylai');"),
    'showTab blocks non-public modules for clients');
assert.ok(html.includes("else if (!isStaff && !PUBLIC_TABS.has(getCurrentActiveTab())) showTab('dashboard');"),
    'role check moves a client off a non-public module');
assert.ok(html.includes("} else if (__nrTab && __nrPublic.indexOf(__nrTab) === -1) {"),
    'direct link to a BETA module never paints for a client');
assert.ok(html.includes('function applyModuleVisibility(root)') &&
    html.includes("if (!PUBLIC_TABS.has(tab)) el.setAttribute('data-staff-only', '1');") &&
    html.includes('applyModuleVisibility();\n        resolveStaffRole().then(() => resolvePaidAccess())') &&
    html.includes('applyModuleVisibility(body);'),
    'menu items of non-public modules are marked staff-only (desktop and phone menu)');
assert.ok(html.includes('html:not([data-staff="1"]) [data-staff-only] { display: none !important; }'),
    'staff-only items are hidden for clients by CSS');

// Платный доступ (05.10.2026, решение владельца): бесплатно только Акылай, настройки и тарифы;
// РНП, Дашборд, Реклама, А/Б-тесты, Товары, Сводный отчёт видны с замком и открываются по тарифу.
const freeTabs = listFrom(/const FREE_TABS = new Set\(\[([^\]]*)\]\)/, 'FREE_TABS');
assert.deepStrictEqual([...freeTabs].sort(), ['akylai', 'settings', 'tariffs'],
    'free tabs changed without owner approval: only Akylai, settings and tariffs are free');
for (const t of freeTabs) assert.ok(publicTabs.includes(t), `${t}: a free tab must be public`);
assert.ok(html.includes('function isTabLocked(tab)') && html.includes('!isStaff && !hasPaid && PUBLIC_TABS.has(tab) && !FREE_TABS.has(tab)'),
    'a tab is locked for a client without a paid plan');
assert.ok(html.includes('if (isTabLocked(name)) {') && html.includes('openPaywall(name, el);'), 'showTab shows the paywall for locked tabs');
assert.ok(html.includes("supabase.rpc('has_paid_access')"), 'the plan is decided by the database, not by the page');
assert.ok(html.includes("localStorage.getItem('nr_paid') !== '1' && ['akylai', 'settings', 'tariffs'].indexOf(__nrTab) === -1"),
    'a locked tab never paints early for a free client');
assert.ok(html.includes("el.classList.toggle('nr-locked', isTabLocked(tab));"), 'locked menu items get a lock');

assert.ok(html.includes('|| res.status === 402;'), 'a paywall answer (402) from the server is silent, not an error popup');

// Сервер: платные функции проверяют тариф сами (замок не только в интерфейсе).
const fnSrc = (n) => fs.readFileSync(path.join(__dirname, 'supabase/functions', n, 'index.ts'), 'utf8');
for (const n of ['wb-proxy', 'rnp-finance-sync', 'wb-clusters']) {
    const code = fnSrc(n);
    assert.ok(code.includes("rpc('paid_access_for', { p_user:") && code.includes("code: 'PAYWALL' }, 402"),
        `${n}: checks the paid plan on the server`);
}

const mig = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261005160000_paid_access.sql'), 'utf8');
assert.ok(mig.includes("s.tariff_plan in ('basic', 'business', 'premium', 'vip')") && mig.includes('s.plan_until is null or s.plan_until > now()'),
    'paid plans and their expiry decide paid access');
assert.ok(mig.includes('revoke all on function public.paid_access_for(uuid) from public, anon, authenticated;'),
    'a client cannot ask about anyone\'s plan: paid_access_for is server-only');
assert.ok(mig.includes("return jsonb_build_object('state', 'locked')"), 'history loading is a paid feature');

console.log('public_modules_test: ok');
