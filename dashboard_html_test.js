/**
 * Smoke-test: dashboard.html script order and RNP/A/B wiring.
 * Catches the regression where Chart/supabase loaded too late, RNP bundle
 * ran after the app script, and the rail РНП button only opened a flyout.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body'));

assert.ok(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@4[^"]*"><\/script>/.test(head),
    'Chart.js must load in <head> so dashboard charts are not undefined'
);
assert.ok(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2"><\/script>/.test(head),
    'supabase-js must load in <head> before createClient'
);

const rnpTag = body.search(/<script src="\/(?:dist\/)?rnp-module(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/);
const createClient = body.indexOf('NrAuth.createClient');
assert.ok(rnpTag !== -1, 'rnp-module script tag missing');
assert.ok(createClient !== -1, 'NrAuth.createClient missing');
assert.ok(rnpTag < createClient, 'rnp-module must load before the dashboard inline script');

const chartsTag = body.search(/<script src="\/(?:dist\/)?dashboard-charts(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/);
assert.ok(chartsTag !== -1 && chartsTag < createClient, 'dashboard-charts must load before the inline app script');

const formulasTag = body.search(/<script src="\/(?:dist\/)?wb-formulas(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/);
assert.ok(formulasTag !== -1 && formulasTag < createClient, 'wb-formulas must load before the inline app script');

assert.ok(
    /class="rail-btn active"[^>]*data-tab="dashboard"/.test(html) || /data-tab="dashboard"[^>]*title="Дашборд"/.test(html),
    'Dashboard rail button must open the live dashboard tab'
);
assert.ok(
    !/data-tab="dashboard"[^>]*data-flyout/.test(html) && !html.includes('data-flyout="fly-ocr"'),
    'Dashboard must not open a second Оцифровка column'
);
assert.ok(html.includes('hideFlyouts(true)') && html.includes('window.closeSidebarMenus'),
    'opening Dashboard must force-close any leftover pinned flyout');
assert.ok(
    /class="rail-btn"[^>]*data-tab="rnp"/.test(html) && /<span class="rail-btn-lbl">РНП<\/span>/.test(html),
    'РНП must sit on the main rail as a live tab'
);
assert.ok(
    /class="rail-btn"[^>]*data-tab="advertising"/.test(html) && /<span class="rail-btn-lbl">РК<\/span>/.test(html),
    'РК must sit on the main rail as a live tab'
);
assert.ok(!/data-tab="rnp"[^>]*data-flyout/.test(html),
    'РНП rail button opens the module, not a second column');
assert.ok(!/<span class="rail-btn-lbl">А\/Б Тесты<\/span>/.test(html), 'А/Б Тесты must not stay on the main rail');
assert.ok(!/<span class="rail-btn-lbl">Тарифы<\/span>/.test(html), 'Тарифы must not stay on the main rail');
assert.ok(!html.includes('id="fly-ocr"') && !html.includes('id="fly-rnp"') && !html.includes('id="fly-tariffs"'),
    'ocr/rnp/tariffs flyouts must stay folded into BETA');
assert.ok(html.includes("const LIVE_TABS = new Set(['dashboard', 'settings', 'rnp', 'rnp-settings', 'advertising'])"),
    'dashboard, settings, RNP and advertising are live tabs');
assert.ok(html.includes('function openBetaStub') && html.includes('id="tab-beta-stub"'),
    'non-live modules must open the BETA stub instead of broken UIs');
assert.ok(html.includes('Сейчас работают Дашборд, РНП и Контроль РК'),
    'BETA stub must list the live modules');

const afterApp = html.slice(html.lastIndexOf('initSidebarFlyouts();'));
assert.ok(
    !/<script src="\/dist\/rnp-module\.[0-9a-f]+\.min\.js"><\/script>/.test(afterApp),
    'rnp-module must not be loaded a second time after the app script'
);

assert.ok(html.includes("if (name === 'ab-testing') loadABTests()"), 'A/B tab must always call loadABTests');
assert.ok(html.includes("else if (cur === 'ab-testing') loadABTests()"), 'init catch-up must reload A/B tests');
assert.ok(html.includes("if (curTab === 'ab-testing') loadABTests()"), 'cabinet switch must reload A/B tests');
assert.ok(html.includes('data-toast-key'), 'identical toasts must be deduped');
assert.ok(html.includes('humanizeProxyError'), 'WB proxy errors must be translated');
assert.ok(html.includes('_nrCabinetDeniedToast'), 'cabinet 403 must toast at most once');
assert.ok(
    /rail-logo-name/.test(html) && /NR Space/.test(html),
    'sidebar logo must show NR Space on the left'
);
assert.ok(html.includes('ab-create-btn'), 'A/B create button uses WBRadar-style control');
assert.ok(html.includes('rail-user-name'), 'sidebar shows user name like WBRadar');
assert.ok(!/<span class="rail-btn-lbl">Товары<\/span>/.test(html), 'Товары must not stay on the main rail');
assert.ok(!/<span class="rail-btn-lbl">Финансы<\/span>/.test(html), 'Финансы must not stay on the main rail');
assert.ok(!/<span class="rail-btn-lbl">Логистика<\/span>/.test(html), 'Логистика must not stay on the main rail');
assert.ok(!/<span class="rail-btn-lbl">Ещё<\/span>/.test(html), 'Ещё flyout must be removed from the rail');
assert.ok(!html.includes('id="fly-goods"') && !html.includes('id="fly-finance"') && !html.includes('id="fly-manage"'),
    'goods/finance/manage flyouts must be folded into BETA');
const betaFlyEnd = html.indexOf('id="date-picker"');
const betaFly = html.slice(html.indexOf('id="fly-beta"'), betaFlyEnd === -1 ? html.indexOf('<main') : betaFlyEnd);
assert.ok(
    betaFly.includes("showTab('summary'") &&
    betaFly.includes("showTab('summary-biz'") &&
    betaFly.includes("showTab('deductions'") &&
    betaFly.includes("showTab('plan-fact'"),
    'Оцифровка items move into BETA, not a dashboard submenu'
);
assert.ok(!betaFly.includes("showTab('rnp'"), 'РНП is not duplicated inside BETA');
assert.ok(!betaFly.includes("showTab('advertising'"), 'Контроль РК is not duplicated inside BETA');
assert.ok(betaFly.includes("showTab('ab-testing'"), 'BETA flyout lists А/Б Тесты');
assert.ok(betaFly.includes("showTab('tariffs'"), 'BETA flyout lists Тарифы');
assert.ok(betaFly.includes("showTab('cost'"), 'BETA flyout lists Товары');
assert.ok(betaFly.includes("showTab('dds'"), 'BETA flyout lists Финансы');
assert.ok(betaFly.includes("showTab('logistics'"), 'BETA flyout lists Логистика');
assert.ok(betaFly.includes("showTab('calculator'"), 'BETA flyout lists Калькулятор');
assert.ok(betaFly.includes('id="sidebar-user"'), 'BETA flyout keeps the user footer');
assert.ok(html.includes('id="nr-bottom-nav"'), 'mobile bottom nav must exist');
{
    const bn = html.slice(html.indexOf('id="nr-bottom-nav"'), html.indexOf('id="nr-beta-overlay"'));
    assert.ok(
        bn.indexOf('id="bn-settings"') < bn.indexOf('id="bn-rnp"') &&
        bn.indexOf('id="bn-rnp"') < bn.indexOf('id="bn-dash"') &&
        bn.indexOf('id="bn-dash"') < bn.indexOf('id="bn-rk"') &&
        bn.indexOf('id="bn-rk"') < bn.indexOf('id="bn-beta"'),
        'bottom nav order: settings, РНП, Дашборд, РК, BETA'
    );
    assert.ok(!bn.includes('id="bn-theme"') && !bn.includes('toggleTheme()'),
        'theme toggle is not on the bottom nav');
    assert.ok(bn.includes('M19.4 15a1.65'), 'bottom-nav settings uses a cog icon');
}
assert.ok(html.includes('bottom-nav-btn--home') && html.includes('id="bn-dash"'),
    'dashboard is the accent center item on the bottom nav');
assert.ok(
    html.includes('function toggleBetaSheet') &&
    html.includes('function openBetaSheet') &&
    html.includes('function closeBetaSheet') &&
    html.includes('function ensureBetaSheet'),
    'BETA opens as a bottom sheet cloned from fly-beta'
);
assert.ok(
    html.includes('bottom: env(safe-area-inset-bottom, 0)') &&
    html.includes('z-index: 9999') &&
    html.includes('transform: translateZ(0)') &&
    html.includes('will-change: transform'),
    'bottom nav is hard-fixed and does not follow visualViewport rubber-band'
);
assert.ok(
    !html.includes('function syncBottomNavViewport') &&
    !html.includes('function initBottomNavViewport'),
    'Safari visualViewport must not move the pinned bottom nav'
);
assert.ok(
    html.includes('</main>\n    </div>\n\n        <header') &&
    html.includes('</header>\n\n    <nav class="bottom-nav"'),
    'header and bottom nav are body siblings, not inside the overflow-hidden app shell'
);
{
    const shellStart = html.indexOf('id="dashboard-app-shell"');
    const headerAt = html.indexOf('<header class="glass');
    assert.ok(shellStart > 0 && headerAt > shellStart, 'header markup follows the app shell');
    const shell = html.slice(shellStart, headerAt);
    assert.ok(!shell.includes('app-header-main'), 'header must not live inside the overflow-hidden shell');
}
assert.ok(
    html.includes('padding-top: calc(28px + env(safe-area-inset-top, 0px)) !important;') &&
    html.includes('padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px)) !important;'),
    'page content reserves the compact pinned bars plus iPhone safe areas'
);
assert.ok(
    html.includes('header.glass.app-header {\n            position: fixed;') &&
    html.includes('z-index: 9998') &&
    html.includes('transform: translateZ(0)'),
    'header is hard-fixed like the bottom nav'
);
assert.ok(
    /\[data-theme="neon"\] \{[\s\S]*?--bg-card:\s*#2C2C2E/.test(html) &&
    html.includes('--bg-primary:') &&
    html.includes('--bg-secondary:'),
    'both themes expose --bg-primary / --bg-card aliases from the TZ'
);
assert.ok(
    html.includes('[data-theme="ios"] header.glass { background: var(--surface'),
    'ios header uses the theme surface, not hardcoded white'
);
assert.ok(html.includes('.mobile-menu-btn { display: none !important; }'),
    'hamburger stays hidden on mobile once the bottom nav is the entry');
assert.ok(
    html.includes('.bottom-nav-btn .bn-ico {\n                width: 18px; height: 18px;') &&
    html.includes('.app-header-main {\n                display: flex;') &&
    html.includes('height: 28px;'),
    'phone header and bottom nav are compact (~half the previous chrome)'
);
assert.ok(
    html.includes('class="beta-theme-row"') &&
    html.includes('flyout-sec">Оформление') &&
    html.includes('[data-theme="neon"] .beta-theme-ico-sun { display: none; }'),
    'theme toggle lives in BETA, with one visible sun/moon icon'
);
{
    const railIcons = html.slice(html.indexOf('class="rail-bottom-icons"'), html.indexOf('id="fly-beta"'));
    assert.ok(railIcons.includes('id="rail-settings-btn"') && !railIcons.includes('toggleTheme()'),
        'left rail keeps the settings gear and drops the theme switch');
    assert.ok(railIcons.includes('M19.4 15a1.65') && !railIcons.includes('M19.07 4.93l-1.41'),
        'rail settings icon is a cog, not the sun-ray mark');
}
assert.ok(
    html.includes("settings: 'bn-settings'") &&
    html.includes('querySelectorAll(\'.beta-theme-label\')'),
    'settings highlights the bottom-nav gear; theme labels update in BETA'
);
assert.ok(
    html.includes('.rnp-action-bar--phone') &&
    html.includes('.rnp-period-chip') &&
    html.includes('.rnp-action-bar--desktop { display: none !important; }'),
    'phone RNP bar is period + chevron + gear; desktop tools hide on mobile'
);
assert.ok(
    html.includes('dash-kpi-hero') &&
    html.includes('dash-charts'),
    'dashboard hero and charts have phone layout hooks'
);
assert.ok(
    !html.includes('dash-kpi-stock') &&
    !html.includes('id="m-stock-fbo"') &&
    !html.includes('id="m-stock-fbs"'),
    'FBO/FBS stock hero cards stay off the dashboard — they live in the warehouse chart'
);
assert.ok(
    html.includes('body.is-dash-phone .header-page-title') &&
    html.includes("document.body.classList.toggle('is-dash-phone'"),
    'iPhone dashboard hides the redundant title so the date range is readable'
);
assert.ok(
    html.includes('#tab-dashboard .dash-kpi-hero') &&
    html.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'),
    'iPhone dashboard KPIs sit in a 2×2 grid, not a single column stack'
);
assert.ok(
    html.includes('#date-picker .date-picker-cols') &&
    html.includes('class="date-picker-quick"') &&
    html.includes("window.innerWidth <= 768"),
    'date picker stacks and anchors under the header on the phone'
);
{
    const start = html.indexOf('const RU_MON_SHORT');
    const end = html.indexOf('function updateDateRangeLabel');
    assert.ok(start > 0 && end > start, 'compact date helpers must exist');
    const api = new Function(`${html.slice(start, end)}; return { fmtCompactDate, fmtCompactRange };`)();
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 8, 8);
    assert.strictEqual(api.fmtCompactRange(from, to), '1 янв – 8 сен');
    const same = new Date(2026, 8, 8);
    const sameLabel = api.fmtCompactRange(same, same);
    assert.ok(sameLabel === '8 сен' || sameLabel === '8 сен 26', 'same-day chip stays short');
    assert.strictEqual(api.fmtCompactRange(new Date(2025, 11, 1), new Date(2026, 1, 3)), '1 дек 25 – 3 фев 26');
}
assert.ok(
    !html.includes("from.split('-').reverse().join('.')}` — ${to.split('-').reverse()"),
    'loadFromDB must not overwrite the chip with 01.01.2026 — 08.09.2026'
);
assert.ok(html.includes('class="date-chip-chevron"'), 'date chip uses a small chevron, not a fat ▼');
assert.ok(
    /\[data-theme="neon"\] \{[\s\S]*?--sel:\s*#3A3A3C/.test(html),
    'dark theme must define --sel so KPI chips are not leftover #EDEDED'
);
assert.ok(
    html.includes('#modal-box { border: none !important; background: var(--surface-solid) !important;') &&
    html.includes('#date-picker { border: 1px solid var(--border) !important; background: var(--surface-solid) !important;') &&
    html.includes('.abtest-card { border: 1px solid var(--border) !important; box-shadow: none !important; background: var(--surface) !important;'),
    'modals, date picker and A/B cards follow the theme surface, not hardcoded white'
);
assert.ok(
    html.includes('.cabinet-dropdown-menu') &&
    html.includes('background: var(--surface-solid);') &&
    html.includes('.segment-tab.active { background: var(--surface-solid);'),
    'cabinet menu and segment tabs use theme surfaces'
);
assert.ok(html.includes('id="rail-settings-btn"'), 'settings must be a small button under the profile');
const settingsIdx = html.indexOf('id="rail-settings-btn"');
const userIdx = html.indexOf('id="rail-user-name"');
assert.ok(userIdx !== -1 && settingsIdx > userIdx, 'settings button must sit under the profile block');
assert.ok(!html.includes('id="rail-cabs"') && !html.includes('function renderRailCabs'),
    'sidebar must not duplicate the header cabinet picker as letter avatars');
{
    const backAt = html.indexOf('id="header-back-btn"');
    const backHtml = backAt >= 0 ? html.slice(backAt, backAt + 420) : '';
    assert.ok(backAt > 0 && backHtml.includes('<svg') && !backHtml.includes('Назад</'),
        'header back control is a chevron only, without the word Назад');
}
assert.ok(
    !html.includes("backBtn.textContent = isAdvDetail") &&
    html.includes("backBtn.setAttribute('aria-label', backLabel)"),
    'header back must keep the SVG and only update the accessible label'
);
assert.ok(
    html.includes('.rail-btn-lbl {\n            font-size: 13px; font-weight: 800') &&
    html.includes('.rail-user-name {\n            font-size: 13px; font-weight: 800'),
    'section labels and the user name share one 13px/800 size'
);
assert.ok(!/rail-settings-btn[\s\S]{0,400}<span>Настройки<\/span>/.test(html),
    'settings in the rail is an icon, not a second tall text row');
assert.ok(html.includes('--radius-card: 22px'), 'Apple-style cards use a 22px corner radius');
assert.ok(
    html.includes('family=Inter:wght@400;500;600') && html.includes('family=Poppins:wght@600;700'),
    'Inter and Poppins must load from Google Fonts'
);
assert.ok(
    html.includes('--font-ui: "Inter"') && html.includes('--font-display: "Poppins"'),
    'both themes expose --font-ui and --font-display'
);
assert.ok(
    html.includes('font-family: var(--font-ui)') &&
    !html.includes('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text"'),
    'UI text uses the theme Inter stack, not SF Pro'
);
assert.ok(
    html.includes('font-family: var(--font-display)') &&
    html.includes('.kpi-hero-value, .kpi-value, .card-title'),
    'headings and KPI values use Poppins via --font-display'
);
assert.ok(
    /table, \.data-table, \.label, \.value-small[\s\S]{0,180}font-variant-numeric:\s*tabular-nums/.test(html),
    'tables keep Inter tabular figures so sums and percents stay aligned'
);
assert.ok(
    html.includes('.rnp-sync-dot, .ui-status-dot') &&
    html.includes('"Apple Color Emoji", "Segoe UI Emoji"'),
    'status dots and emoji indicators keep the system/emoji stack'
);
assert.ok(
    html.includes('.rnp-workspace {') &&
    html.includes('border-radius: var(--radius-card)') &&
    /rnp-sheet-table th, \.rnp-sheet-table td \{\s*border: none/.test(html),
    'RNP sheet is one rounded card without cell dividers'
);
assert.ok(
    /main-content\.rnp-compact[\s\S]{0,120}padding:\s*4px 6px !important/.test(html),
    'RNP must beat the 28px Apple page padding so the card fills the pane'
);
assert.ok(
    html.includes('border: 1px solid rgba(17, 17, 17, 0.10)') &&
    !html.includes('height: calc(100vh - 118px)'),
    'RNP card is a thin almost-invisible rounded line, not a short box in a gray gutter'
);
assert.ok(html.includes('abtest-card-row'), 'A/B cards use WBRadar row layout');
assert.ok(html.includes('nr-early-tab-style'), 'early-tab CSS id must exist for settings boot');
assert.ok(
    html.includes("if (__nrTab === 'settings')") && html.includes('#tab-settings{display:block'),
    'early-tab CSS must not hide dashboard for BETA modules'
);
assert.ok(
    html.includes("if (savedTab === 'settings') showTab('settings', null)") &&
    html.includes('LIVE_TABS.has(savedTab)') &&
    html.includes("else showTab('dashboard', null)"),
    'init restores live RNP/RK tabs and otherwise opens dashboard'
);
assert.ok(
    html.includes('Загрузка данных|Загрузка артикулов'),
    'RNP boot failure UI must cover nested loading strings'
);

const rnpSrc = fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8');
assert.ok(rnpSrc.includes('function _abandonStaleMain'), 'stale RNP render must retry instead of hanging');
assert.ok(rnpSrc.includes("functions.invoke('rnp-finance-sync'"), 'WB finance sync still goes through the rnp-finance-sync edge function');
assert.ok(!rnpSrc.includes('rnp-action-btn--sync'), 'manual «Обновить из WB» stays off the RNP toolbar');
assert.ok(html.includes('id="nr-notify"') && html.includes('id="nr-notify-dot"'), 'header has a notification bell with a red-dot badge');
assert.ok(html.includes('const NrNotify'), 'notification history lives in the header bell');
assert.ok(/\.rnp-gs-photo img\s*\{[^}]*object-fit:\s*contain/.test(html), 'left article photo shows the full frame');
assert.ok(rnpSrc.includes("from('exchange_rates')"), 'RNP must read the fixed exchange rate from exchange_rates');
assert.ok(rnpSrc.includes('function _latestNbkr'), 'RNP settings must show the official NBKR rate next to the working rate');
assert.ok(rnpSrc.includes('лимиты WB не тратит'), 'RNP must explain that NBKR does not hit WB limits');
assert.ok(/key: 'storage_sum',\s+label: 'Хранение \(сверено\)'/.test(rnpSrc), 'RNP shows reconciled storage row');
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903152000_rnp_nbkr_rate_cron.sql')),
    'daily NBKR cron migration must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903152000_rnp_nbkr_rate_cron.sql'), 'utf8')
        .includes('"mode":"rate"'),
    'NBKR cron must call rnp-finance-sync mode=rate, not WB sync'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/rnp-finance-sync/index.ts')),
    'rnp-finance-sync edge function must exist'
);
assert.ok(rnpSrc.includes('nr-early-tab-style'), 'RNP retry boot must see the early-tab CSS');
assert.ok(rnpSrc.includes('setTimeout(_retryRnpBoot, 1500)'), 'RNP boot retry loop must keep scheduling');
assert.ok(rnpSrc.includes('_mainInflightCab === _cab'), 'openMain must dedupe concurrent renders per cabinet');
assert.ok(
    !/return snapReq !== _loadRequestId\(\)/.test(rnpSrc),
    'RNP load must not be invalidated by dashboard loadFromDB request ids'
);
assert.ok(rnpSrc.includes('function _monthStickLabel'), 'month title must stay visible when scrolling days');
assert.ok(rnpSrc.includes('rnp-th-month-prev'), 'previous-month header must stick over frozen week columns');
assert.ok(html.includes('rnp-th-month-stick'), 'month stick label CSS must exist');
assert.ok(html.includes('rnp-head-marquee-pin'), 'photo marquee must pin at the frozen edge while days scroll');
assert.ok(rnpSrc.includes('rnp-head-marquee-pin'), 'marquee HTML wraps photos in the sticky pin');
assert.ok(rnpSrc.includes('function _syncFrozenPane'), 'week/ИТОГ sticky left is applied after layout');
assert.ok(!/pin\.style\.height\s*=\s*.*leftTh/.test(rnpSrc), 'marquee pin must not follow leftTh — that loop grows photos');
assert.ok(rnpSrc.includes('pin.style.height = `${stackH}px`'), 'photo pin matches the KPI+sizes stack so cards are not clipped');
assert.ok(!rnpSrc.includes('leftTh?.offsetWidth'), 'frozen width must not follow the KPI colspan');
assert.ok(rnpSrc.includes('acc += _frozenWeekW()'), 'sticky week offsets stay on design widths, not measured growth');
assert.ok(rnpSrc.includes('MARQUEE_CARD_MAX_H'), 'photo cards must cap height so they do not grow on each resize');
assert.ok(rnpSrc.includes('MARQUEE_REPS_MAX'), 'marquee must not clone photos without a cap');
assert.ok(rnpSrc.includes('_marqueeRo.observe(scroll)'), 'resize observer watches the scroller only, not the left header');
assert.ok(rnpSrc.includes('PHOTO_ASPECT_W'), 'header photos stay 3:4 instead of skinny stamps');
assert.ok(rnpSrc.includes('function openPhoto'), 'clicking a photo opens it full-size');
assert.ok(rnpSrc.includes('function closePhoto'), 'full-size photo can close');
assert.ok(rnpSrc.includes('onclick="RNP.openPhoto(this)"'), 'photo cards open the lightbox');
assert.ok(html.includes('id="rnp-photo-lightbox"'), 'full-size photo uses a lightbox overlay');
assert.ok(/\.rnp-test-photo img\s*\{[^}]*object-fit:\s*contain/.test(html), 'marquee photos show the full frame, not a side crop');
assert.ok(/\.rnp-test-card\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/.test(html), 'marquee cards keep the WB 3:4 frame');
assert.ok(!/\.rnp-test-card\s*\{[^}]*height:\s*100%/.test(html), 'cards must not stretch to the KPI+sizes row');
assert.ok(html.includes('table-layout: fixed'), 'fixed table layout stops the size grid from stretching frozen columns');
assert.ok(!/contain:\s*layout style paint/.test(html), 'paint containment on the marquee clips the sticky photo pin');
assert.ok(rnpSrc.includes('_loadPlans(dateFrom, dateTo)'), 'plans must be loaded only for the visible calendar range');
assert.ok(
    rnpSrc.includes("content_cards") && rnpSrc.includes('force: true') && rnpSrc.includes('refreshArticles'),
    '«Обновить артикулы» must pull WB content cards, not only orders'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('syncArticlesFromContentCards'),
    'auto-sync must add new catalog cards to rnp_articles'
);
assert.ok(/Promise\.all\(\[\s*_loadPlans\(dateFrom, dateTo\)/.test(rnpSrc), 'RNP loads plans/orders/stocks in parallel');
assert.ok(rnpSrc.includes('function _adNmsFromDay'), 'RNP must parse nm breakdown from advertising_daily_stats');
assert.ok(rnpSrc.includes('function _mergeAdStatsFromDb'), 'RNP must merge advertising_daily_stats on load');
assert.ok(rnpSrc.includes("from('advertising_daily_stats')") || rnpSrc.includes("'advertising_daily_stats'"),
    'RNP must read advertising_daily_stats, not only rnp_daily_data');
assert.ok(rnpSrc.includes('_hydrateFunnelAfterPaint'), 'organic impressions must hydrate after first paint');
assert.ok(rnpSrc.includes("label: 'Показатели воронки'"), 'funnel section title stays short for sellers');
assert.ok(!rnpSrc.includes('WB 7 дней, старше из кэша'), 'technical funnel footnote must stay off the sheet');
assert.ok(!rnpSrc.includes('•live'), 'live badge text must not sit on the grid');
assert.ok(!rnpSrc.includes('enrichment ограничен'), 'English enrichment warning must stay hidden');
assert.ok(rnpSrc.includes("map[cat] = !_isCatCollapsed(cat)"), 'clicking a category group hides or shows its articles');
assert.ok(rnpSrc.includes("localStorage.getItem('rnp_collapsed_cats')"), 'collapsed category groups persist');
assert.ok(rnpSrc.includes('${collapsed ? \'\' : `<div class="rnp-cat-tabs">${tabsHtml}</div>`}'), 'collapsed groups hide their article tabs');
assert.ok(!rnpSrc.includes('function _isCatCollapsed(cat) {\n        return false;'), 'category groups must be able to collapse');
assert.ok(!rnpSrc.includes('lite ? true'), 'lite mode must not force-collapse every article group');
assert.ok(rnpSrc.includes('const DAY_COL_W = 40'), 'day cells are narrow but still fit 100 000');
assert.ok(rnpSrc.includes('const FROZEN_COL_W = 40'), 'week/ИТОГ cells must match the day grid');
assert.ok(rnpSrc.includes('function _fitNum') && rnpSrc.includes('rnp-num--m'),
    'million-scale numbers shrink inside the cell');
assert.ok(!rnpSrc.includes('function _ruClothingToLetter'), 'do not guess RU/EU numbers onto XXS–5XL');
{
    const start = rnpSrc.indexOf('function _normSize');
    const end = rnpSrc.indexOf('function _nrDialog');
    assert.ok(start > 0 && end > start, 'size helper must sit next to _normSize');
    const fns = new Function(`${rnpSrc.slice(start, end)}; return { _normSize };`)();
    assert.strictEqual(fns._normSize('36'), '36');
    assert.strictEqual(fns._normSize('40'), '40');
    assert.strictEqual(fns._normSize('S (40-42)'), 'S');
    assert.strictEqual(fns._normSize('44'), '44');
    assert.strictEqual(fns._normSize('M (44-46)'), 'M');
    assert.strictEqual(fns._normSize('42-44'), '42-44');
    assert.strictEqual(fns._normSize('54-56'), '54-56');
    assert.strictEqual(fns._normSize('XXL'), 'XXL');
    assert.strictEqual(fns._normSize(''), '—');
}
assert.ok(
    rnpSrc.includes('keys.length ? keys.sort(_sortSizes) : ALL_SIZES.slice()'),
    'size grid must show WB tech_size columns, not a fixed XXS–5XL template'
);
{
    const sortStart = rnpSrc.indexOf('function _sortSizes');
    const sortEnd = rnpSrc.indexOf('async function _loadAllStocks');
    assert.ok(sortStart > 0 && sortEnd > sortStart, 'numeric sizes must sort as numbers');
    const sortFns = new Function(`
        const SIZE_ORDER = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL'];
        ${rnpSrc.slice(sortStart, sortEnd)}
        return { _sortSizes };
    `)();
    assert.deepStrictEqual(['44', '36', '40'].sort(sortFns._sortSizes), ['36', '40', '44']);
    assert.deepStrictEqual(['XL', 'S', 'M'].sort(sortFns._sortSizes), ['S', 'M', 'XL']);
}
assert.ok(html.includes('--rnp-day-w: 40px'), 'CSS day column width must match JS');
assert.ok(html.includes('viewport-fit=cover'), 'iPhone Safari must respect the safe area');
assert.ok(html.includes('.rnp-article-panel--phone'), 'phone KPI panel has a stacked layout');
assert.ok(
    html.includes('.header-back-btn:not(.hidden) + .min-w-0 { display: none !important; }'),
    'iPhone header hides the truncated title when the back chevron is visible'
);
assert.ok(html.includes('.cabinet-picker-label { max-width: 96px'), 'cabinet name must not crowd the iPhone header');
assert.ok(rnpSrc.includes('function _isPhone()'), 'RNP must detect a phone viewport');
assert.ok(rnpSrc.includes('function _isNarrow()'), 'iPad uses the same swipe sheet as iPhone');
assert.ok(rnpSrc.includes('const PHONE_METRIC_W = 108'), 'phone metric column is narrower than desktop');
assert.ok(rnpSrc.includes('rnp-article-panel--phone'), 'article KPI lifts above the sheet on a phone');
assert.ok(rnpSrc.includes('function togglePrevWeeks') && rnpSrc.includes('rnp-action-bar--phone'),
    'phone RNP bar is period + chevron; weeks of last month stay behind the arrow');
assert.ok(rnpSrc.includes('rnp-settings-phone-tools') && rnpSrc.includes('_weeksCollapsed'),
    'Excel/План/секции move into RNP settings on the phone');
assert.ok(rnpSrc.includes('function _bindArticleSwipe') && rnpSrc.includes('rnp-sheet-body--swap'),
    'article cards swipe and fade like a desktop pick');
assert.ok(rnpSrc.includes('if (_isNarrow()) return null;'), 'weeks/ИТОГ swipe on phone and iPad, they are not removed');
assert.ok(rnpSrc.includes('function _colgroupHTML'), 'colgroup pins week/day widths so Safari cannot squash Нед 1–5');
assert.ok(rnpSrc.includes('function _sheetMinWidthPx'), 'sheet width is the sum of metric + spark + every week/day column');
assert.ok(rnpSrc.includes('rnp-sheet-table--swipe'), 'narrow sheets opt into horizontal swipe');
assert.ok(
    !/function _buildSheetHeadRows[\s\S]{0,200}if \(_isPhone\(\)\) return '';/.test(rnpSrc),
    'phone must not drop the sheet head — marquee and weeks stay in the table'
);
assert.ok(
    rnpSrc.includes('return totalCol ? [...weekCols, totalCol, ...dayCols] : [...weekCols, ...dayCols];'),
    'week columns are always built, never filtered out on a phone'
);
assert.ok(
    !/function _buildCols\([\s\S]*?function _sortSizes/.test(rnpSrc) ||
    !rnpSrc.slice(rnpSrc.indexOf('function _buildCols'), rnpSrc.indexOf('function _sortSizes')).includes('_isPhone'),
    '_buildCols must not drop weeks on a phone viewport'
);
assert.ok(
    html.includes('.rnp-sheet-table--swipe .rnp-data-col') &&
    html.includes('overflow-x: auto') &&
    html.includes('-webkit-overflow-scrolling: touch'),
    'week table swipes horizontally; first column stays sticky via existing metric col'
);
{
    const wStart = rnpSrc.indexOf('const FROZEN_METRIC_W');
    const wEnd = rnpSrc.indexOf('const MARQUEE_CARD_MAX_H');
    const leftStart = rnpSrc.indexOf('function _leftFrozenPx');
    const leftEnd = rnpSrc.indexOf('function _monthStickLabel');
    const frozenStart = rnpSrc.indexOf('function _frozenLeft');
    const frozenEnd = rnpSrc.indexOf('function _stickyColAttrs');
    const spanStart = rnpSrc.indexOf('function _leftFrozenSpan');
    const spanEnd = rnpSrc.indexOf('function _timelinePeriods');
    assert.ok(wStart > 0 && wEnd > wStart && leftStart > 0 && frozenStart > leftEnd && spanStart > 0);
    const make = (phone) => new Function(`
        const window = { matchMedia: (q) => ({ matches: String(q).includes('768') || String(q).includes('1024') ? ${phone ? 'true' : 'false'} : false }) };
        const MONTH_COL_W = 42;
        ${rnpSrc.slice(wStart, wEnd)}
        ${rnpSrc.slice(spanStart, spanEnd)}
        ${rnpSrc.slice(leftStart, leftEnd)}
        ${rnpSrc.slice(frozenStart, frozenEnd)}
        return { _isPhone, _isNarrow, _metricW, _sparkW, _dayColW, _leftFrozenPx, _frozenLeft, _sheetMinWidthPx, _sheetDataColCount, _colgroupHTML };
    `)();
    const phone = make(true);
    const desk = make(false);
    assert.strictEqual(phone._isPhone(), true);
    assert.strictEqual(phone._isNarrow(), true);
    assert.strictEqual(phone._metricW(), 108);
    assert.strictEqual(phone._sparkW(), 32);
    assert.strictEqual(phone._dayColW(), 44);
    assert.strictEqual(phone._leftFrozenPx({ mode: 'week', weeks: [1, 2, 3, 4] }), 140);
    assert.strictEqual(desk._leftFrozenPx({ mode: 'week', weeks: [1, 2, 3, 4] }), 372);
    assert.strictEqual(phone._frozenLeft(0, [{ type: 'week' }]), null);
    assert.strictEqual(desk._frozenLeft(0, [{ type: 'week' }]), 172);
    const cal = { mode: 'week', weeks: [1, 2, 3, 4, 5], days: new Array(30) };
    assert.strictEqual(phone._sheetDataColCount(cal), 36);
    assert.strictEqual(phone._sheetMinWidthPx(cal), 108 + 32 + 36 * 44);
    assert.ok(phone._colgroupHTML(cal).includes('<colgroup>'));
    assert.strictEqual((phone._colgroupHTML(cal).match(/<col /g) || []).length, 38);
}
assert.ok(html.includes('.rnp-num--m'), 'CSS shrinks million values so they stay inside the cell');
{
    const start = rnpSrc.indexOf('function _fmt(val, type)');
    const end = rnpSrc.indexOf('function _cellColor');
    assert.ok(start > 0 && end > start, 'number fit helpers sit next to _fmt');
    const fns = new Function(`${rnpSrc.slice(start, end)}; return { _fmt, _numFitClass, _fitNum };`)();
    assert.strictEqual(fns._fmt(100000, 'som'), '100\u00a0000');
    assert.ok(!fns._numFitClass(fns._fmt(100000, 'som')).includes('rnp-num--m'));
    assert.ok(fns._numFitClass(fns._fmt(1000000, 'som')).includes('rnp-num--m'));
    assert.ok(fns._fitNum(fns._fmt(1000000, 'som')).includes('rnp-num--m'));
}
assert.ok(rnpSrc.includes('nmIds'), 'funnel hydrate must request all active articles, not one nm');
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('orders_filled_until'),
    'auto-sync must fill the July→today order gap, not only walk backward'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('ORDERS_MIN_INTERVAL_MS'),
    'auto-sync must space supplier/orders at 1 req/min per token'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('addDaysStr(today, -1)') &&
    fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('for (const dayStr of [yesterday, today])'),
    'auto-sync Pass B must load yesterday and today so RNP is not empty in the morning'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/rnp-finance-sync/index.ts'), 'utf8')
        .includes('cron_finance_first'),
    'night finance cron must finish every cabinet before downloading storage'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903161000_orders_filled_until.sql')),
    'orders_filled_until migration must exist'
);
assert.ok(rnpSrc.includes('показы РК'), 'toolbar must show live ad impressions so empty cells are not silent');
assert.ok(rnpSrc.includes('existing ? !!existing.is_active : (activateCatalog || activateNew)'),
    'catalog sync must not turn back on articles the seller already hid');
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8')
        .includes('.update({ is_active: true })'),
    'auto-sync must not reactivate hidden rnp_articles from the WB catalog'
);

assert.ok(rnpSrc.includes('await _mergeAdStatsFromDb(nmIds, cal)'),
    'RNP main load must merge advertising_daily_stats, not only define the helper');
assert.ok(/const \[, dailyRows, , stocksRaw\] = await Promise\.all/.test(rnpSrc),
    'RNP must take wb_stocks from Promise.all slot 4, not exchange rates');
assert.ok(rnpSrc.includes('Array.isArray(stocksRaw)'),
    'RNP must not crash if stocks come back undefined');
assert.ok(rnpSrc.includes('const missing = nmIds.filter'),
    'funnel hydrate must sync articles still missing impressions, not skip the whole cabinet');
assert.ok(rnpSrc.includes('_seedTodayLiveZeros(nmIds, cal)'),
    'RNP must seed live zeros so today is not a blank sheet');

assert.ok(html.includes('id="dash-stock-tabs"') && html.includes('data-stock-view="fbo"'),
    'FBO/FBS split stays on the warehouse chart, not as extra hero cards');
assert.ok(html.includes('id="wh-fbo"') && html.includes('id="wh-fbs"'),
    'warehouse tab must show FBO and FBS totals');
assert.ok(html.includes('function switchDashStockView'),
    'dashboard must switch warehouse list/chart between all/FBO/FBS');
assert.ok(html.includes('nr_dash_stock_view') && html.includes('id="dash-wh-legend"'),
    'FBS shop names and qty must persist across cabinets');

const autoSyncSrc = fs.readFileSync(path.join(__dirname, 'supabase/functions/auto-sync/index.ts'), 'utf8');
assert.ok(
    autoSyncSrc.includes('isServiceAuthorized'),
    'auto-sync must accept the cron service_role JWT so FBS shops sync for every cabinet'
);
assert.ok(
    autoSyncSrc.includes('fetchFbsStockRows(admin, token, cabinetId)'),
    'FBS sync must pass the supabase admin client — a free `admin` ref throws and falls back to the generic blob'
);
assert.ok(
    autoSyncSrc.includes('if (result.warehousesFound) return result.rows'),
    'named FBS shops must be kept even when one warehouse returns 0 qty — do not overwrite with products-report'
);
assert.ok(
    autoSyncSrc.includes('warehousesFound: true') && autoSyncSrc.includes('{ skus: chunk }'),
    'FBS marketplace sync must query /api/v3/stocks with barcodes (skus) for every seller warehouse'
);
assert.ok(
    !/fetchFbsStockRows\(token, cabinetId\)/.test(autoSyncSrc),
    'fetchFbsStockRows must not be called without admin'
);
assert.ok(html.includes("mode: 'stocks'") && html.includes('AUTO_SYNC_URL'),
    'dashboard refresh must sync stocks via auto-sync, not the dead Statistics stocks API');
assert.ok(html.includes("'m-stock-fbo','m-stock-fbs'"),
    'cabinet switch must reset FBO/FBS stock KPIs');

assert.ok(autoSyncSrc.includes('fetchFboStockRows') && autoSyncSrc.includes('fetchFbsStockRows'),
    'auto-sync must fetch FBO and FBS stocks separately');
assert.ok(autoSyncSrc.includes("stock_scheme: 'fbs'") && autoSyncSrc.includes("stock_scheme: 'fbo'"),
    'auto-sync must persist stock_scheme on wb_stocks');
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903173000_wb_stocks_fbo_fbs.sql')),
    'FBO/FBS stock_scheme migration must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903173000_wb_stocks_fbo_fbs.sql'), 'utf8')
        .includes("'stock_fbo'") &&
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903173000_wb_stocks_fbo_fbs.sql'), 'utf8')
        .includes("'stock_fbs'"),
    'dashboard_summary must return stock_fbo and stock_fbs'
);

assert.ok(html.includes('id="tab-telegram-bots"') && html.includes("showTab('telegram-bots'"),
    'dashboard must have a Telegram bots page');
assert.ok(html.includes('id="tab-ozon"') && html.includes("showTab('ozon'"),
    'dashboard must have a separate Ozon token page');
assert.ok(html.includes('function loadTelegramBotsPage') && html.includes('toggleTgCabinetMute'),
    'Telegram page must list bots and mute a cabinet channel');
assert.ok(html.includes('function saveOzonForCabinet') && html.includes('ozon_client_id'),
    'Ozon page must save client id and api key per cabinet');
assert.ok(html.includes("tabs.api?.classList.remove('hidden-tab')"),
    'settings must show the cabinets tab for regular users, not only Super Admin');
assert.ok(html.includes('function deleteCabinet') && html.includes("rpc('delete_cabinet'"),
    'settings cabinets must have a delete button that wipes tokens and data');
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903210000_delete_cabinet.sql')),
    'delete_cabinet RPC migration must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903210000_delete_cabinet.sql'), 'utf8')
        .includes('wb_token = null') &&
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903210000_delete_cabinet.sql'), 'utf8')
        .includes('ozon_api_key = null'),
    'delete_cabinet must wipe WB and Ozon tokens before dropping the row'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903190000_telegram_bots_ozon.sql')),
    'telegram_bots / ozon_token migration must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/telegram-gates.ts'), 'utf8')
        .includes('cabinet_muted'),
    'telegram senders must skip a muted cabinet channel'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/telegram-admin/index.ts')),
    'telegram-admin edge function must exist to deleteWebhook'
);

assert.ok(
    /\.main-content\s*\{[^}]*overflow-anchor:\s*none/.test(html),
    'main-content must disable overflow-anchor so refresh cannot jump the page'
);
assert.ok(
    html.includes("'.main-content'") && html.includes('PAGE_SCROLL_SELECTORS'),
    'domMorph.preserveScroll must lock .main-content, not only window'
);
assert.ok(
    /requestAnimationFrame\(\(\) => \{\s*restore\(\);\s*requestAnimationFrame\(restore\)/.test(html),
    'scroll restore must re-apply after layout (double rAF)'
);
assert.ok(
    html.includes("openSettings({ preserveScroll: true })"),
    'dashboard refresh / settings boot must not rebuild the settings tab from scratch'
);
assert.ok(rnpSrc.includes('class="rnp-settings-gear"'), 'RNP toolbar has a small gear for settings');
assert.ok(html.includes('id="rnp-settings-overlay"'), 'RNP settings open as an overlay, not a second page');
assert.ok(html.includes('function cabinetDisplayName'), 'cabinet picker shows legal IP names, not Baza/Elium letters');
assert.ok(html.includes('ИП Бейшеев А.Д.') && html.includes('ИП Айзада'), 'Baza and Elium show the IP names from WB');
assert.ok(html.includes('ИП Уркунбаев К.А.') && html.includes('ОсОО «Айлин Стиль»'), 'Zevina 1/2 show the legal names from WB');
assert.ok(!html.includes('id="cabinet-picker-initial"'), 'letter avatar next to the cabinet name is gone');
assert.ok(!html.includes('cab-dot'), 'dropdown no longer draws B/E/Z circles');
const cabFns = new Function(
    html.slice(html.indexOf('function cabinetDisplayName'), html.indexOf('function updateCabinetPickerUI'))
    + '; return { cabinetDisplayName };'
)();
assert.strictEqual(cabFns.cabinetDisplayName('Baza'), 'ИП Бейшеев А.Д.');
assert.strictEqual(cabFns.cabinetDisplayName('Elium'), 'ИП Айзада');
assert.strictEqual(cabFns.cabinetDisplayName('Zevina 1'), 'ИП Уркунбаев К.А.');
assert.strictEqual(cabFns.cabinetDisplayName('Zevina 2'), 'ОсОО «Айлин Стиль»');
assert.ok(
    html.includes('input[type="number"]::-webkit-inner-spin-button')
        && html.includes('input[type="number"]::-webkit-outer-spin-button')
        && /input\[type="number"\]\s*\{[^}]*appearance:\s*textfield/.test(html),
    'number inputs must hide the browser spinner arrows everywhere'
);
assert.ok(html.includes("if (name === 'rnp-settings')"), 'old rnp-settings tab route opens the modal');
assert.ok(rnpSrc.includes('function closeSettings()'), 'settings modal can close without leaving RNP');
assert.ok(rnpSrc.includes("getElementById('rnp-settings-modal-body')"), 'settings HTML renders into the modal body');

const toggleFn = rnpSrc.slice(rnpSrc.indexOf('async function toggleArt'), rnpSrc.indexOf('async function enableAll'));
assert.ok(!toggleFn.includes('_renderSettings'),
    'excluding an article in RNP settings must not rebuild the tab');
assert.ok(toggleFn.includes('_patchSettingsToggleUi'),
    'toggleArt must patch the existing switch in place');
const enableFn = rnpSrc.slice(rnpSrc.indexOf('async function enableAll'), rnpSrc.indexOf('async function setCost'));
assert.ok(!enableFn.includes('_renderSettings'),
    'enableAll must not rebuild the settings tab');
assert.ok(rnpSrc.includes('data-toggle-nm=') && rnpSrc.includes('data-key="${a.nm_id}"'),
    'settings article rows must have stable keys for in-place morph');
assert.ok(rnpSrc.includes("'.main-content'") && rnpSrc.includes('_PAGE_SCROLL_SELECTORS'),
    'RNP scroll lock must include .main-content');
assert.ok(rnpSrc.includes('const keepWorkspace'),
    'RNP refresh must keep the painted workspace instead of swapping in a spinner');
assert.ok(!rnpSrc.includes("scrollIntoView({ behavior: 'smooth'"),
    'strategy tabs must not scroll the page via scrollIntoView');

const chartsSrc = fs.readFileSync(path.join(__dirname, 'dashboard-charts.js'), 'utf8');
assert.ok(chartsSrc.includes('setWarehouseScheme'),
    'warehouse donut must filter FBO/FBS on switch');
assert.ok(chartsSrc.includes('wrap.style.minHeight'),
    'chart destroy must lock the wrap height so cards do not collapse on refresh');

const proxySrc = fs.readFileSync(path.join(__dirname, 'supabase/functions/wb-proxy/index.ts'), 'utf8');
assert.ok(proxySrc.includes('stocks-report/wb-warehouses'),
    'wb-proxy stocks must use the current WB warehouses endpoint');
assert.ok(proxySrc.includes('case \'stocks_fbs\''),
    'wb-proxy must expose FBS stocks');

assert.ok(html.includes('id="admin-access-card"') && html.includes('id="admin-spaces-tab-blocked"'),
    'settings security must host access requests plus allowed/blocked tabs');
assert.ok(html.includes("switchSpacesAdminTab('allowed'") && html.includes("switchSpacesAdminTab('blocked'"),
    'admin must split allowed and blocked spaces');
assert.ok(html.includes('function sortPendingRequests') && html.includes('function sortBlockedSpaces'),
    'pending login attempts must not mix with blocked users');
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/admin-space/index.ts'), 'utf8')
        .includes("from('allowed_users').delete()"),
    'blocking a space must remove the email from allowed_users'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8')
        .includes('Заявка на вход отправлена администратору'),
    'pending users must see that the admin got their login request'
);

assert.ok(html.includes('data-adv-view="autobidder"') && html.includes('id="adv-subtab-autobidder"'),
    'advertising detail must have an Автобиддер tab');
assert.ok(html.includes('id="autobidder-modal"') && html.includes('function openAutobidderModal'),
    'campaign row must open the autobidder rule modal');
assert.ok(html.includes('function saveAutobidderRule') && html.includes("from('autobidder_rules_legacy_mvp')"),
    'autobidder modal must persist a rule to autobidder_rules_legacy_mvp');
assert.ok(html.includes('AUTOBIDDER_RUN_URL') && html.includes('function runAutobidderNow'),
    'dashboard must call autobidder-run for a manual pass');
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903200000_autobidder.sql')),
    'autobidder_rules migration must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903200000_autobidder.sql'), 'utf8')
        .includes('autobidder_rules') &&
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260903200000_autobidder.sql'), 'utf8')
        .includes('autobidder_log'),
    'migration must create rules and log tables'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260903201000_autobidder_cron.sql')),
    'autobidder cron migration must exist'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/autobidder-run/index.ts')),
    'autobidder-run edge function must exist'
);
const autobidderSrc = fs.readFileSync(path.join(__dirname, 'supabase/functions/autobidder-run/index.ts'), 'utf8');
assert.ok(autobidderSrc.includes('setAdvertBids') && autobidderSrc.includes('target_metric'),
    'autobidder-run must change WB bids against the target metric');
assert.ok(!autobidderSrc.includes('budget') || autobidderSrc.includes('Бюджет не пополняет'),
    'autobidder must not deposit campaign budget');
assert.ok(
    proxySrc.includes("case 'advert_get_bids'") && proxySrc.includes("case 'advert_set_bids'"),
    'wb-proxy must expose get/set bid actions'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/_shared/wb-advert-bids.ts')),
    'shared WB bid helpers must exist'
);

assert.ok(html.includes('id="tab-agents"') && html.includes("showTab('agents'"),
    'BETA must have an Агенты tab');
assert.ok(html.includes('function loadAgentsPage') && html.includes('function openAgentFn'),
    'Agents tab must open one of the ten WB tools');
assert.ok(html.includes('Пригласительная ссылка') && html.includes('function submitAgentInvite'),
    'first agent function must generate a WB invite link');
assert.ok(
    html.includes('Команда кабинета') &&
    html.includes('Цены и скидки') &&
    html.includes('Отзывы без ответа') &&
    html.includes('Вопросы покупателей') &&
    html.includes('Новые FBS-заказы') &&
    html.includes('Стикеры заказов') &&
    html.includes('Пропуск на склад') &&
    html.includes('Чаты с покупателями') &&
    html.includes('Баланс продавца'),
    'Agents tab must list all ten wow functions'
);
assert.ok(
    proxySrc.includes("case 'users_invite'") &&
    proxySrc.includes("case 'prices_set'") &&
    proxySrc.includes("case 'feedbacks_answer'") &&
    proxySrc.includes("case 'orders_fbs_new'") &&
    proxySrc.includes("case 'passes_create'") &&
    proxySrc.includes("case 'buyer_chats'"),
    'wb-proxy must expose invite, prices, reviews, FBS, passes and chats'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/_shared/wb-agent-wow.ts')),
    'shared agent WB helpers must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8').includes('"/agents"'),
    'Vercel must rewrite /agents to the dashboard'
);

assert.ok(!html.includes('--logo-mark: #F5C400'), 'dashboard logo mark must not be yellow');
assert.ok(html.includes('--logo-mark: #FFFFFF'), 'dashboard logo mark must be white');
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('bg-[#F5C400] text-[#111] font-black'),
    'site header logo must not be the yellow NR tile'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('bg-white text-[#111] font-black'),
    'site header logo must be the white NR tile'
);
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8').includes('background: #F5C400'),
    'login logo must not use the yellow mark'
);

assert.ok(
    rnpSrc.includes('warehouse_name, stock_scheme'),
    'RNP stock load must select stock_scheme so the FBO/FBS donut is not all-FBO'
);
assert.ok(rnpSrc.includes('_applyStocksToCache(data, nmIds)'),
    'single-article stock reload must reuse FBO/FBS cache builder');
assert.ok(
    rnpSrc.includes('_stockSchemeView') &&
    rnpSrc.includes('function setStockSchemeView') &&
    rnpSrc.includes("RNP.setStockSchemeView('fbo')") &&
    rnpSrc.includes("RNP.setStockSchemeView('fbs')"),
    'RNP donut slices must filter the size grid by FBO or FBS'
);
assert.ok(
    rnpSrc.includes('склад WB РФ') &&
    rnpSrc.includes('склад продавца') &&
    rnpSrc.includes("На WB") &&
    rnpSrc.includes("На FBS") &&
    rnpSrc.includes('class="rnp-stock-donut"'),
    'RNP donut must filter the size grid: FBO = WB RF report, FBS = seller warehouse'
);
assert.ok(
    html.includes('.rnp-stock-block--fbo') &&
    html.includes('.rnp-stock-block--fbs'),
    'selected donut slice must highlight the size stock table'
);
assert.ok(
    rnpSrc.includes('rnp-stock-scheme-wrap') &&
    rnpSrc.includes('_stockSchemeInnerHTML'),
    'size table and donut must refresh together when a slice is selected'
);
assert.ok(
    html.includes('.rnp-stock-donut') &&
    html.includes('--rnp-fbo: #7B61FF') &&
    html.includes('--rnp-fbs: #3B82F6'),
    'RNP FBO/FBS donut colors must be distinct from each other'
);

function grabFn(src, name) {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    let depth = 0, started = false, i = start;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') {
            depth--;
            if (started && depth === 0) { i++; break; }
        }
    }
    return src.slice(start, i);
}

const schemeHelpers = [
    grabFn(rnpSrc, '_emptySizeBucket'),
    grabFn(rnpSrc, '_stockSchemeOf'),
    grabFn(rnpSrc, '_accumSize'),
    grabFn(rnpSrc, '_mergeSizeBucket'),
    grabFn(rnpSrc, '_schemeWhTotals'),
    grabFn(rnpSrc, '_schemePercents'),
    grabFn(rnpSrc, '_polarXY'),
    grabFn(rnpSrc, '_donutSlicePath'),
].join('\n');
const scheme = new Function(`${schemeHelpers}
    return {
        _emptySizeBucket, _stockSchemeOf, _accumSize, _schemeWhTotals,
        _schemePercents, _donutSlicePath,
    };`)();

assert.strictEqual(scheme._stockSchemeOf({ stock_scheme: 'fbs' }), 'fbs');
assert.strictEqual(scheme._stockSchemeOf({ scheme: 'mp' }), 'fbs');
assert.strictEqual(scheme._stockSchemeOf({ stock_scheme: 'fbo' }), 'fbo');
assert.strictEqual(scheme._stockSchemeOf({}), 'fbo');

const bucket = scheme._emptySizeBucket();
scheme._accumSize(bucket, { quantity: 10, stock_scheme: 'fbo', tech_size: 'M' });
scheme._accumSize(bucket, { quantity: 6, stock_scheme: 'fbs', in_way_to_client: 2 });
assert.strictEqual(bucket.wh, 16);
assert.strictEqual(bucket.transit, 2);
assert.strictEqual(bucket.fbo.wh, 10);
assert.strictEqual(bucket.fbs.wh, 6);
assert.strictEqual(bucket.fbs.transit, 2);

const split = scheme._schemeWhTotals({ M: bucket, L: { wh: 4 } });
assert.deepStrictEqual(split, { fbo: 10, fbs: 6, total: 16 });
assert.deepStrictEqual(scheme._schemePercents(111, 66), { fbo: 63, fbs: 37 });
assert.deepStrictEqual(scheme._schemePercents(0, 0), { fbo: 0, fbs: 0 });
assert.ok(scheme._donutSlicePath(0, 63, 46, 28, 50, 50).includes('A 46 46'));
assert.ok(scheme._donutSlicePath(0, 100, 46, 28, 50, 50).includes('A 28 28'));

const viewQty = (mode) => new Function('_stockSchemeView', `${grabFn(rnpSrc, '_viewSizeQty')}; return _viewSizeQty;`)(mode);
const sized = { wh: 16, transit: 2, fbo: { wh: 10, transit: 0 }, fbs: { wh: 6, transit: 2 } };
assert.deepStrictEqual(viewQty('all')(sized), { wh: 16, transit: 2 });
assert.deepStrictEqual(viewQty('fbo')(sized), { wh: 10, transit: 0 });
assert.deepStrictEqual(viewQty('fbs')(sized), { wh: 6, transit: 2 });

console.log('dashboard_html_test: ok');
