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
{
    const rail = html.slice(html.indexOf('class="rail-nav"'), html.indexOf('class="rail-bottom"'));
    assert.ok(
        /class="rail-btn"[^>]*data-tab="goods-groups"/.test(rail) && /<span class="rail-btn-lbl">Товары<\/span>/.test(rail),
        'Товары must sit on the main rail as a live tab'
    );
    assert.ok(rail.indexOf('data-tab="advertising"') < rail.indexOf('data-tab="ab-testing"') &&
        rail.indexOf('data-tab="ab-testing"') < rail.indexOf('data-tab="goods-groups"') &&
        rail.indexOf('data-tab="goods-groups"') < rail.indexOf('data-tab="content-factory"') &&
        rail.indexOf('data-tab="content-factory"') < rail.indexOf('data-tab="agents"') &&
        rail.indexOf('data-tab="goods-groups"') < rail.indexOf('data-flyout="fly-beta"'),
        'Контент sits on the rail between Товары and Агенты');
}
assert.ok(!/data-tab="rnp"[^>]*data-flyout/.test(html),
    'РНП rail button opens the module, not a second column');
assert.ok(/<span class="rail-btn-lbl">А\/Б<\/span>/.test(html) && /data-tab="ab-testing"/.test(html),
    'А/Б Тесты sit on the main rail as a live tab');
assert.ok(!/<span class="rail-btn-lbl">Тарифы<\/span>/.test(html), 'Тарифы must not stay on the main rail');
assert.ok(!html.includes('id="fly-ocr"') && !html.includes('id="fly-rnp"') && !html.includes('id="fly-tariffs"'),
    'ocr/rnp/tariffs flyouts must stay folded into BETA');
assert.ok(html.includes("const LIVE_TABS = new Set(['dashboard', 'settings', 'rnp', 'rnp-settings', 'advertising', 'ab-testing', 'goods-groups', 'content-factory', 'agents', 'summary'])"),
    'dashboard, settings, RNP, advertising, A/B, Товары, Контент-завод, Агенты and Сводный отчёт are live tabs');
assert.ok(html.includes('function openBetaStub') && html.includes('id="tab-beta-stub"'),
    'non-live modules must open the BETA stub instead of broken UIs');
assert.ok(html.includes('Сейчас работают Дашборд, РНП, Контроль РК, А/Б Тесты, Товары, Контент-завод, Агенты и Сводный отчёт'),
    'BETA stub must list the live modules');
assert.ok(html.includes('id="gg-fbo"') && html.includes('id="gg-transit"') && html.includes('goods-catalog'),
    'Товары tab shows FBO/FBS/in-transit columns and loads the Zevina catalog');
assert.ok(!html.includes('gg-hero') && !html.includes('class="gg-title"') && !html.includes('id="gg-load-btn"'),
    'Товары has no duplicate heading, explanation or refresh button');
assert.ok(html.includes('id="gg-excel-btn"') && html.includes('exportGoodsExcel') && html.includes('id="gg-settings-overlay"'),
    'Товары has a small Excel button and RNP-style settings overlay');
assert.ok(html.includes('id="gg-excel-btn"') && html.includes('M3 9h18M3 15h18M9 3v18M15 3v18'),
    'Товары Excel is the same grid icon as RNP');
assert.ok(!html.includes('.gg-toolbar.is-daily #gg-excel-btn') && !html.includes('gg-now-tools.is-off'),
    'Остатки and Остатки по дням keep the same tool icons so they do not jump');
assert.ok(html.includes('gg-now-tools rnp-tool-icons') && /\.gg-toolbar\s*\{[^}]*width:\s*100%/.test(html),
    'Товары toolbar spans the row so icons sit top-right like RNP');
assert.ok(
    html.includes('#gg-now-tools.gg-now-tools') &&
    html.includes('flex: 0 0 70px') &&
    html.includes('#gg-excel-btn { display: inline-flex !important; }') &&
    html.includes('overflow-x: hidden') &&
    /#tab-goods-groups\.tab-content\.active\s*\{[^}]*min-width:\s*0/.test(html) &&
    /\.gg-table-scroll\s*\{[^}]*max-width:\s*100%/.test(html) &&
    /\.gg-search\s*\{[^}]*position:\s*absolute/.test(html) &&
    !html.includes("classList.toggle('is-daily'"),
    'goods tool icons stay pinned on the right when the daily table is wider than the viewport'
);
assert.ok(html.includes('th.gg-col-nm') && html.includes('text-align: center !important') && html.includes('max-width: 110px'),
    'WB column is centered and cannot swallow leftover viewport width');
assert.ok(html.includes('goods-compact') && html.includes("name === 'goods-groups'") && html.includes('padding: 14px 20px 16px'),
    'Товары tabs sit below the title with room to breathe');
assert.ok(html.includes('id="ads-hq-reload"') && html.includes('id="adv-sync-btn"') && html.includes('rnp-tool-icon'),
    'Ads refresh buttons are the same round icons, top-right');
assert.ok(
    html.includes('id="ads-hq-search"') &&
    html.includes('id="ads-hq-period"') &&
    html.includes('ads-hq-tools') &&
    html.includes('id="ads-hq-when-btn"') &&
    html.includes('module-date-label'),
    'RK toolbar has a period chip, search and RNP-soft tools on the right'
);
assert.ok(
    html.includes('class="rnp-tool-icon" id="ads-hq-bulk-pause"') &&
    html.includes('class="rnp-tool-icon" id="ads-hq-bulk-start"'),
    'RK pause and start sit in the same round icon row as refresh'
);
assert.ok(!/adv-sync-btn[\s\S]{0,400}btn\.textContent =/.test(html),
    'Ads icon buttons keep their SVG while syncing');
assert.ok(!html.includes('data-adv-module="cards"') && !html.includes('id="adv-view-cards"') && !html.includes('showAdvertisingCardsView'),
    'RK no longer has a Кабинеты cards tab');
assert.ok(
    html.includes('id="gg-search-btn"') && html.includes('function toggleGoodsSearch') && html.includes('cx="11" cy="11" r="7"'),
    'Товары search is a loupe icon, not a wide empty field'
);
assert.ok(
    html.includes('#gg-table') &&
    html.includes('display: inline-table !important') &&
    html.includes('width: max-content !important'),
    'Товары table is inline-table so leftover viewport width cannot open a gap before WB'
);
assert.ok(/\.gg-art\s*\{[^}]*white-space:\s*nowrap/.test(html),
    'article names stay on one line next to the numbers');
assert.ok(html.includes('class="gg-art" title='),
    'long article names keep a hover title when the cell ellipsizes');
assert.ok(html.includes("setGoodsView('now')\">Остатки</button>") && !html.includes("setGoodsView('now')\">Сейчас</button>"),
    'the live stocks tab is called Остатки');
assert.ok(
    html.includes('id="gg-view-cost"') &&
    html.includes("setGoodsView('cost')") &&
    html.includes('function renderGoodsCostTable') &&
    html.includes('cost_price') &&
    html.includes("name === 'cost'"),
    'Себестоимость is a Товары tab and writes rnp_articles.cost_price'
);
assert.ok(
    html.includes('id="gg-view-daily"') &&
    html.includes("setGoodsView('daily')") &&
    html.includes('id="gg-daily-table"') &&
    html.includes('snapshot_goods_daily_stocks') &&
    html.includes('goods_daily_stocks') &&
    html.includes('function renderGoodsDailyTable') &&
    html.includes('function ensureDailyStocks') &&
    html.includes('dailyDayKeys') &&
    html.includes('gg-spark-wrap'),
    'Товары daily view snapshots FBO+FBS once per day and renders a write-once month table'
);
assert.ok(!html.includes('Раздел готов. Напишите'),
    'daily stocks stub copy must be gone');
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260910140000_goods_daily_stocks.sql')),
    'goods_daily_stocks migration must exist'
);
const dailyMig = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260910140000_goods_daily_stocks.sql'), 'utf8');
assert.ok(dailyMig.includes('on conflict (cabinet_id, nm_id, date) do nothing'),
    'daily snapshot must never overwrite a stored day');
assert.ok(dailyMig.includes('goods_daily_stocks_no_update') && dailyMig.includes('write-once'),
    'daily cache rows cannot be updated');
assert.ok(!/s\.in_way/.test(dailyMig) && dailyMig.includes('sum(s.quantity)'),
    'daily snapshot sums warehouse quantity only, never WB in-way');
assert.ok(dailyMig.includes("timezone('Asia/Bishkek', now())"),
    'first snapshot migration used the Bishkek calendar day');
assert.ok(dailyMig.includes("date '2026-09-10'") && dailyMig.includes('d < v_start or d > v_today'),
    'first snapshot migration refused days before 10 Sep 2026');
assert.ok(dailyMig.includes('p_nm_ids') && dailyMig.includes('unnest'),
    'snapshot can pin catalog nm_ids so empty warehouse SKUs still get a write-once 0');
assert.ok(html.includes('p_nm_ids') && html.includes('lastClosedSalesYmd') && html.includes('canWriteDailySnapshot'),
    'daily view may only snapshot the MSK day that already closed');
const eodMig = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260910180000_goods_daily_stocks_eod_msk.sql'), 'utf8');
assert.ok(eodMig.includes("timezone('Europe/Moscow', now())") && eodMig.includes('::date - 1'),
    'snapshot date is the last closed Moscow sales day');
assert.ok(eodMig.includes('goods-daily-stocks-03-bishkek') && eodMig.includes("'0 21 * * *'"),
    '03:00 Bishkek / 00:00 MSK cron writes the closed day');
assert.ok(eodMig.includes('goods-daily-eod') && eodMig.includes("delete from public.goods_daily_stocks where date = date '2026-09-10'"),
    'premature 10.09 rows are cleared so 03:00 can write the real close');
const eodFn = fs.readFileSync(path.join(__dirname, 'supabase/functions/goods-daily-eod/index.ts'), 'utf8');
assert.ok(eodFn.includes("mode: 'stocks'") && eodFn.includes("rpc('snapshot_goods_daily_stocks'"),
    '03:00 job refreshes wb_stocks then snapshots the closed day');
assert.ok(dailyMig.includes('delete from public.goods_daily_stocks'),
    'delete_cabinet must also drop daily stock cache');
assert.ok(html.includes("rnp-reload-requested") && html.includes("loadGoodsGroups({ silent: true })"),
    'Товары silently refreshes when RNP reloads stocks');
assert.ok(!html.includes('id="gg-cabinet-filter"') && !html.includes('onGoodsGroupsCabinetChange'),
    'Товары has no extra cabinet select — header cabinet only');
assert.ok(html.includes('cabinets.find(c => c.id === currentCabinetId)'),
    'Товары stocks load for the header currentCabinetId');
assert.ok(html.includes("'nm_id, quantity, stock_scheme'"),
    'Товары FBO/FBS come from wb_stocks without WB in-way columns');
assert.ok(!/r\.transit \+= Number\(s\.in_way/.test(html),
    'Товары must not take «в пути» from Wildberries in_way_*');
assert.ok(html.includes("goods_transit") && html.includes("goods_plan") && html.includes('gg-edit-input'),
    'В пути and В плане are editable and stored on rnp_articles.manual_data');

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
    /<span class="rail-logo-name">Space<\/span>/.test(html) && !html.includes('<span class="rail-logo-name">NR Space</span>'),
    'sidebar wordmark is Space — NR is already inside the logo mark'
);
assert.ok(
    html.includes('<a href="/" class="rail-logo" id="sidebar-home-btn"') &&
    !html.includes("showTab('dashboard');\n            hideFlyouts(true);"),
    'sidebar logo opens the main welcome site'
);
assert.ok(
    html.includes('border-radius: 18px;') &&
    html.includes('left: 232px;') &&
    !html.includes('rounded-none app-header') &&
    !html.includes('border-radius:0'),
    'cabinet header is a floating Apple-rounded bar'
);
assert.ok(html.includes('ab-create-btn'), 'A/B create button uses WBRadar-style control');
assert.ok(/id="new-test-form"[^>]*rnp-settings-overlay/.test(html) && html.includes('rnp-settings-dialog ab-new-dialog'),
    'A/B create form is a short RNP-style settings overlay');
assert.ok(html.includes('max-height: min(62vh, 520px)') && !html.includes('max-height: min(88vh, 860px)'),
    'A/B create dialog is a short sheet, not almost full-screen');
assert.ok(html.indexOf('id="new-test-form"') > html.indexOf('id="tab-rnp-settings"'),
    'A/B create overlay lives outside the A/B tab so the tab overflow cannot clip it');
assert.ok(/id="ab-report-modal"[^>]*rnp-settings-overlay/.test(html) && /id="ab-edit-modal"[^>]*rnp-settings-overlay/.test(html),
    'A/B report and edit use the same overlay as RNP settings');
assert.ok(html.includes('rnp-settings-overlay::before') && html.includes('mask-image') && html.includes('backdrop-filter: blur(22px)'),
    'settings overlay fades like iOS so the site logo stays visible at the edges');
assert.ok(!/\.rnp-settings-overlay\s*\{[^}]*background:\s*var\(--bg\)/.test(html),
    'overlay is not a solid page fill that hides the sidebar logo');
assert.ok(html.includes('id="ab-campaign-search"') && html.includes('ab-campaign-name') && html.includes('ab-campaign-id'),
    'A/B campaign picker shows name + id and can search «тест стр»');
assert.ok(html.includes('id="ab-min-impressions"') && html.includes('value="2000"'),
    'A/B auto-stop defaults to 2000 impressions per photo');
assert.ok(html.includes('id="ab-min-ctr"') && html.includes('value="5"') && html.includes('id="ab-stop-on-winner"'),
    'A/B can auto-stop when a winner hits CTR from 5% and up');
assert.ok(html.includes('function armABWinnerStop') && html.includes('Стоп от'),
    'active A/B card has a button to stop once the CTR goal is determined');
assert.ok(html.includes('function pauseABTestCampaigns') && html.includes("callWbProxy('advert_pause'"),
    'finishing an A/B test pauses the linked ad campaigns');
{
    const abRot = fs.readFileSync(path.join(__dirname, 'supabase/functions/ab-test-rotate/index.ts'), 'utf8');
    const abStop = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/ab-test-auto-stop.ts'), 'utf8');
    assert.ok(abRot.includes('decideAbAutoStop') && abRot.includes('function pauseAbCampaigns'),
        'cron uses shared auto-stop and pauses RK');
    assert.ok(abStop.includes('winner_determined') && abStop.includes('AB_DEFAULT_MIN_CTR = 5'),
        'A/B stops when a winner hits CTR from 5% and up');
    assert.ok(abRot.includes('getTelegramChatId(\'ab_tests\')') || abRot.includes('getTelegramChatId("ab_tests")'),
        'A/B result is sent to the A/B Telegram channel');
    assert.ok(abRot.includes('renderAbReportPng') && abRot.includes('sendTelegramPhoto'),
        'A/B finish sends a PNG snapshot card, not only a text album');
    assert.ok(abRot.includes("action === 'demo_snapshot'") && abRot.includes("action === 'verify_main_photo'"),
        'cron can send a test snapshot and verify WB main photo slot 1');
    assert.ok(abRot.includes('WB_MAIN_PHOTO_SLOT') && abRot.includes('X-Photo-Number'),
        'rotation writes WB photo number 1 (main/cover)');
}
assert.ok(html.includes('rail-user-name'), 'sidebar shows user name like WBRadar');
assert.ok(/<span class="rail-btn-lbl">Товары<\/span>/.test(html), 'Товары sits on the main rail below РК');
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
assert.ok(!betaFly.includes("showTab('goods-groups'"), 'Товары is not duplicated inside BETA');
assert.ok(!betaFly.includes("showTab('ab-testing'"), 'А/Б Тесты left BETA and live on the rail');
assert.ok(betaFly.includes("showTab('tariffs'"), 'BETA flyout lists Тарифы');
assert.ok(!betaFly.includes("showTab('cost'"), 'Себестоимость left BETA and lives in Товары');
assert.ok(betaFly.includes("showTab('dds'"), 'BETA flyout lists Финансы');
assert.ok(betaFly.includes("showTab('logistics'"), 'BETA flyout lists Логистика');
assert.ok(betaFly.includes("showTab('calculator'"), 'BETA flyout lists Калькулятор');
assert.ok(betaFly.includes('id="sidebar-user"'), 'BETA flyout keeps the user footer');
assert.ok(html.includes('id="nr-bottom-nav"'), 'mobile bottom nav must exist');
{
    const bn = html.slice(html.indexOf('id="nr-bottom-nav"'), html.indexOf('id="nr-beta-overlay"'));
    assert.ok(
        bn.indexOf('id="bn-agents"') < bn.indexOf('id="bn-rnp"') &&
        bn.indexOf('id="bn-rnp"') < bn.indexOf('id="bn-dash"') &&
        bn.indexOf('id="bn-dash"') < bn.indexOf('id="bn-goods"') &&
        bn.indexOf('id="bn-goods"') < bn.indexOf('id="bn-beta"'),
        'bottom nav order: Агенты, РНП, Дашборд, Остатки, Меню'
    );
    assert.ok(
        bn.includes('bn-lbl">Агенты') &&
        bn.includes('bn-lbl">Остатки') &&
        bn.includes('bn-lbl">Меню') &&
        !bn.includes('id="bn-rk"') &&
        !bn.includes('id="bn-ab"') &&
        !bn.includes('id="bn-settings"'),
        'RK, A/B and settings left the bar for the menu sheet'
    );
    assert.ok(!bn.includes('id="bn-theme"') && !bn.includes('toggleTheme()'),
        'theme toggle is not on the bottom nav');
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
    html.includes('padding-top: calc(48px + env(safe-area-inset-top, 0px)) !important;') &&
    html.includes('padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px)) !important;'),
    'page content reserves the compact rounded header plus iPhone safe areas'
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
    html.includes("agents: 'bn-agents'") &&
    html.includes("flyout-sec\">Кабинет") &&
    html.includes('querySelectorAll(\'.beta-theme-label\')'),
    'phone menu holds RK / A/B / settings; theme labels stay in the sheet'
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
    html.includes('function loadAdsSpendForDash') &&
    html.includes("fetchAllRows('advertising_daily_stats'") &&
    html.includes('adsSum: Number(adsCur') &&
    html.includes('function fmtDashAds'),
    'dashboard Реклама / ДРР reads advertising_daily_stats for the selected dates'
);
assert.ok(
    html.includes("fmt(n) + ' сом'") &&
    html.includes("toLocaleString('ru-RU') + ' сом'") &&
    !html.includes("fmt(ordersSum)+' ₽'"),
    'dashboard money is som, not rubles'
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
    html.includes('.kpi-value, .card-title'),
    'headings use Poppins via --font-display'
);
assert.ok(
    html.includes('.kpi-hero-value {') &&
    html.includes('font-family: var(--font-ui)') &&
    html.includes('font-size: 13px') &&
    html.includes('class="nr-num') &&
    html.includes('function paintNrNum') &&
    html.includes('function dashNumFitClass'),
    'dashboard KPI numbers use the same Inter/13px scale as RNP, with a small unit'
);
assert.ok(
    html.includes('.nr-num--m { font-size: 11px') &&
    html.includes('digits >= 7 || n >= 1e6'),
    'seven-digit dashboard values shrink like rnp-num--m'
);
{
    const fitStart = html.indexOf('function dashNumFitClass');
    const paintEnd = html.indexOf('window.paintNrNum = paintNrNum;');
    assert.ok(fitStart > 0 && paintEnd > fitStart, 'paintNrNum helpers must exist');
    const escapeStart = html.indexOf('function escapeHtml(str)');
    const escapeEnd = html.indexOf('\n    }', escapeStart);
    assert.ok(escapeStart > 0 && escapeEnd > escapeStart, 'escapeHtml must exist');
    const api = new Function(`${html.slice(escapeStart, escapeEnd + 6)}\n${html.slice(fitStart, paintEnd)}; return { dashNumFitClass, paintNrNum };`)();
    assert.strictEqual(api.dashNumFitClass('13 517'), 'nr-num');
    assert.ok(api.dashNumFitClass('1 100 440').includes('nr-num--m'), '7+ digits shrink');
    const el = { textContent: '', innerHTML: '' };
    api.paintNrNum(el, '135 170 сом');
    assert.ok(el.innerHTML.includes('class="nr-num"') && el.innerHTML.includes('135 170') && el.innerHTML.includes('nr-num-unit') && el.innerHTML.includes('сом'),
        'money splits number and unit like the RNP donut');
    api.paintNrNum(el, '11 399 112 сом');
    assert.ok(el.innerHTML.includes('nr-num--m'), 'million-scale hero values use the compact class');
    api.paintNrNum(el, '13 517 шт.');
    assert.ok(el.innerHTML.includes('13 517') && el.innerHTML.includes('шт.'), 'stock keeps the piece unit small');
}
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
assert.ok(html.includes('window.__nrEarlyTab') && html.includes('#tab-dashboard.active{display:none !important}#tab-'),
    'F5 must pin the current tab before first paint, not only settings');
assert.ok(
    html.includes("document.documentElement.setAttribute('data-nr-early'") &&
    html.includes('html[data-nr-early] #header-date-chip-wrap') &&
    html.includes("titles[tab]) t.textContent = titles[tab]") &&
    html.includes("rnp: 'Модуль РНП'"),
    'F5 in RNP must paint Модуль РНП in the header before auth, not flash Дашборд'
);
assert.ok(
    html.includes("document.documentElement.removeAttribute('data-nr-early')") &&
    html.includes('rnp.openMain(!!force && !painted)'),
    'restored RNP sheet must not force-rebuild on every bootRnpTab'
);
assert.ok(html.includes("skipSrc && (name === 'src' || name === 'srcset')") && html.includes('const liveSrc = oldEl.getAttribute(\'src\')'),
    'domMorph must keep painted img src instead of copying placeholders');
assert.ok(!html.includes('.main-content.page-transition'),
    'tab switch must not hide the page with an opacity flash');
assert.ok(html.includes('hasPaintedRows'),
    'Товары must keep painted rows on refresh instead of swapping in Загрузка');
assert.ok(
    html.includes('__nrLive') && html.includes('window.__nrEarlyTab = __nrPane'),
    'early-tab pins every live module before first paint'
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
assert.ok(
    !rnpSrc.includes('sales_count: client.sales_count || r.sales_count'),
    'RNP must not keep buyout estimates over finance-report sales'
);
assert.ok(
    rnpSrc.includes('// Продажи / реализация / к перечислению — только финотчёт.'),
    'RNP merge comment must say sales come from the finance report'
);
assert.ok(
    !/Math\.round\(count \* buyout\)/.test(rnpSrc) && !/Math\.round\(b\.count \* buyout\)/.test(rnpSrc),
    'RNP sheet must not invent sales as orders × buyout'
);
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
assert.ok(rnpSrc.includes('function _needsWideHead') && rnpSrc.includes('function _buildWideHeadHTML'),
    'without August weeks KPI and photos sit above the table, not in a 172px frozen cell');
assert.ok(rnpSrc.includes("if (_needsWideHead(cal)) return '';"),
    'sheet head stays empty on desktop when there are no compare weeks');
assert.ok(html.includes('.rnp-head-wide') && html.includes('152px max-content minmax(0, 1fr)'),
    'wide RNP head packs info and compact stocks, leftover goes to the photo gallery');
assert.ok(html.includes('.rnp-head-wide-info') && html.includes('width: 152px'),
    'first info block is capped so the gallery can grow');
assert.ok(html.includes('.rnp-head-wide-stocks .rnp-stock-table') && html.includes('width: max-content'),
    'stock size table must not stretch and leave a gap after На складе');
assert.ok(html.includes('.rnp-head-wide-info .rnp-gs-photo') && html.includes('object-fit: cover'),
    'main article photo sits in a 3/4 frame instead of a stretched stamp');
assert.ok(html.includes('padding: 4px 0 4px 10px') && html.includes('.rnp-head-wide .rnp-marquee-wrap') && html.includes('mask-image: none'),
    'wide photo gallery must reach the right edge without a fade hole');
assert.ok(rnpSrc.includes('allPhotos: true') && rnpSrc.includes('insertAdjacentHTML') && rnpSrc.includes('GALLERY_PHOTO_COUNT'),
    'wide gallery fills with all product photos and extra copies, without wiping the track');
assert.ok(html.includes('.rnp-head-wide-info') && html.includes('.rnp-head-wide-photos') && html.includes('.rnp-head-wide-stocks'),
    'wide head is a fixed row: товар, остатки, фото');
assert.ok(
    /rnp-sheet-body \{[\s\S]*?overflow-y:\s*auto/.test(html) &&
    html.includes('min-height: 0; height: 100%') &&
    !html.includes('min-height: calc(100vh - 120px)'),
    'RNP sheet scrolls vertically inside a bounded workspace, not a clipped 100vh box'
);
assert.ok(
    html.includes('.rnp-article-panel--wide.is-pinned') &&
    html.includes('position: sticky') &&
    html.includes('--rnp-pin-h') &&
    html.includes('--rnp-scroll-w') &&
    html.includes('min-height: 72px'),
    'wide photos stick at the top and shrink after the sheet is scrolled'
);
assert.ok(
    !rnpSrc.includes('function _defaultLayout') &&
    !rnpSrc.includes('function resetLayout') &&
    !rnpSrc.includes('rnp-layout-resize') &&
    !rnpSrc.includes('rnp-layout-canvas') &&
    rnpSrc.includes('rnp-head-wide--stocks') &&
    rnpSrc.includes('_stockSchemeInnerHTML') &&
    !rnpSrc.includes('_buildKpisBlockHTML'),
    'desktop RNP head is a fixed row: info, stocks, photos — no drag editor'
);
assert.ok(
    rnpSrc.includes('rnp-head-wide-stocks') &&
    html.includes('.rnp-head-wide-stocks') &&
    !html.includes('.rnp-article-panel--wide.is-pinned .rnp-stock-scheme-wrap {\n            display: none'),
    'остатки stay in the middle slot and do not hide when the head pins'
);
assert.ok(
    !grabFn(rnpSrc, '_buildInfoBlockHTML').includes('rnp-gs-cost-input') &&
    !grabFn(rnpSrc, '_buildInfoBlockHTML').includes('RNP.setCost') &&
    !grabFn(rnpSrc, '_buildKpiTopHTML').includes('rnp-gs-cost-input') &&
    !grabFn(rnpSrc, '_buildKpiTopHTML').includes('RNP.setCost') &&
    grabFn(rnpSrc, '_settingsArticleRowHtml').includes('RNP.setCost'),
    'себест. is edited only in RNP settings, not in the article header'
);
assert.ok(
    rnpSrc.includes('_buildWideHeadHTML(art, stockBySize, rawData, cal)') &&
    !rnpSrc.includes('function _buildLayoutHTML'),
    'article head uses the fixed wide template, not a freeform canvas'
);
assert.ok(
    !grabFn(rnpSrc, '_buildLeftPanelHTML').includes('_phoneCollapseHtml') &&
    grabFn(rnpSrc, '_buildLeftPanelHTML').includes('_buildKpiTopHTML'),
    'desktop info card is only the profitability block — no Остатки hide button'
);
assert.ok(
    /function _buildKpiPanelHTML[\s\S]*?if \(_isPhone\(\)\) return _buildPhoneHeroHTML[\s\S]*?return _buildKpiTopHTML/.test(rnpSrc),
    'desktop product card keeps KPIs in the info box without a stock collapse row'
);
assert.ok(
    html.includes("localStorage.getItem('nr_theme')") &&
    html.includes('var __nrTheme') &&
    html.includes('html {\n            background: var(--bg);') &&
    html.includes('color-scheme: dark'),
    'dark theme is applied before first paint so RNP does not flash white'
);
assert.ok(
    html.indexOf('var __nrTheme') < html.indexOf(':root, [data-theme="ios"]'),
    'nr_theme is restored before CSS variables, not after the RNP shell HTML'
);
assert.ok(
    rnpSrc.includes('function _bindHeadPin') &&
    rnpSrc.includes('function _syncHeadPin') &&
    rnpSrc.includes('MARQUEE_PINNED_H') &&
    rnpSrc.includes("classList.toggle('is-pinned'"),
    'RNP shrinks the photo marquee when the sheet scroller is pinned'
);
assert.ok(/\.rnp-settings-overlay\s*\{[^}]*z-index:\s*10050/.test(html),
    'settings overlay sits above the floating header');
assert.ok(html.includes('body.rnp-settings-open .rnp-workspace') && html.includes('visibility: hidden'),
    'open settings hide the RNP sheet so photos cannot show through');
assert.ok(!/color-mix\(in srgb, var\(--surface-solid\) 94%/.test(html),
    'settings dialog is opaque and does not show the RNP table through it');
assert.ok(rnpSrc.includes("document.body.appendChild(overlay)"),
    'settings overlay moves to body so the header cannot cover it');
assert.ok(rnpSrc.includes('hiddenGroups') && rnpSrc.includes('function toggleGroupVisible'),
    'RNP settings can hide a whole group instead of toggling articles one by one');
assert.ok(rnpSrc.includes('function _syncSettingsGroups') && rnpSrc.includes('rnp-settings-groups'),
    'group toggles stay in the modal even when the article list is patched in place');
{
    const spanStart = rnpSrc.indexOf('function _needsWideHead');
    const spanEnd = rnpSrc.indexOf('function _sheetDataColCount');
    const pxStart = rnpSrc.indexOf('function _leftFrozenPx');
    const pxEnd = rnpSrc.indexOf('function _monthStickLabel');
    const fns = new Function(`
        const FROZEN_METRIC_W = 132, FROZEN_SPARK_W = 40, FROZEN_COL_W = 40, DAY_COL_W = 40;
        function _isNarrow() { return false; }
        function _metricW() { return 132; }
        function _sparkW() { return 40; }
        function _dayColW() { return 40; }
        ${rnpSrc.slice(spanStart, spanEnd)}
        ${rnpSrc.slice(pxStart, pxEnd)}
        return { _leftFrozenPx, _leftFrozenSpan, _needsWideHead };
    `)();
    const noWeeks = { mode: 'week', weeks: [], days: new Array(30).fill({}) };
    assert.strictEqual(fns._needsWideHead(noWeeks), true);
    assert.strictEqual(fns._leftFrozenPx(noWeeks), 172, 'table frozen edge stays metric+spark when photos are above');
    assert.strictEqual(fns._leftFrozenSpan(noWeeks), 2);
    const withWeeks = { mode: 'week', weeks: [1, 2, 3, 4, 5], days: new Array(30).fill({}) };
    assert.strictEqual(fns._needsWideHead(withWeeks), false);
    assert.strictEqual(fns._leftFrozenPx(withWeeks), 412);
}
assert.ok(!/pin\.style\.height\s*=\s*.*leftTh/.test(rnpSrc), 'marquee pin must not follow leftTh — that loop grows photos');
assert.ok(rnpSrc.includes('photoCol') && rnpSrc.includes('layoutH'), 'photo cards follow the fixed photos column');
assert.ok(rnpSrc.includes('const MARQUEE_CARD_MAX_H = 110'), 'collage cards are ~110px so the sheet gets more room');
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
assert.ok(rnpSrc.includes('pick(list[0].nm_id)') && rnpSrc.includes('!inGroup'),
    'clicking another RNP category opens that group\'s first article');
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
    'phone RNP bar still exists; last-month weeks are opt-in via compare');
assert.ok(
    rnpSrc.includes('function togglePhoneBlock') &&
    rnpSrc.includes("title, open, inner") &&
    rnpSrc.includes("_phoneCollapseHtml('kpi', 'Показатели'") &&
    rnpSrc.includes("_phoneCollapseHtml('stock', _stockCollapseTitle"),
    'phone card collapses Показатели and Остатки independently'
);
assert.ok(
    html.includes('.rnp-collapse-head') &&
    html.includes('.rnp-article-panel--phone .rnp-collapse-body') &&
    html.includes('grid-template-rows: 0fr'),
    'phone collapse CSS hides values until the header is tapped'
);
assert.ok(rnpSrc.includes('_phoneStockOpen') && rnpSrc.includes("rnp_stock_open"),
    'stock open state is remembered so Остатки can stay hidden');
assert.ok(
    !rnpSrc.includes('_phoneKpiOpen = false; _phoneStockOpen = false'),
    'switching articles must not force-hide the stock donut'
);
{
    const start = rnpSrc.indexOf('function _phoneCollapseHtml');
    const end = rnpSrc.indexOf('function _buildKpiTopHTML');
    assert.ok(start > 0 && end > start, 'phone collapse helper sits next to the KPI card');
    const phone = new Function(`
        function _isPhone() { return true; }
        ${rnpSrc.slice(start, end)}
        return { _phoneCollapseHtml };
    `)();
    const desk = new Function(`
        function _isPhone() { return false; }
        ${rnpSrc.slice(start, end)}
        return { _phoneCollapseHtml };
    `)();
    const open = phone._phoneCollapseHtml('kpi', 'Показатели', false, '<div class="rnp-kpi">x</div>');
    assert.ok(open.includes('data-block="kpi"') && open.includes('Показатели') && open.includes('rnp-kpi'));
    assert.ok(!open.includes('is-open'));
    assert.ok(phone._phoneCollapseHtml('stock', 'Остатки', true, 'BODY').includes('is-open'));
    assert.strictEqual(desk._phoneCollapseHtml('kpi', 'Показатели', false, '<b>keep</b>'), '<b>keep</b>');
    const deskStock = desk._phoneCollapseHtml('stock', 'Остатки', true, 'BODY');
    assert.strictEqual(deskStock, 'BODY', 'desktop must not wrap Остатки in a popover overlay');
}
assert.ok(
    rnpSrc.includes('function _buildPhoneHeroHTML') &&
    rnpSrc.includes('rnp-phone-hero product-card-mobile-layout') &&
    rnpSrc.includes('rnp-phone-hero-slides') &&
    rnpSrc.includes('rnp-phone-hero-donut') &&
    rnpSrc.includes('if (_isPhone()) return _buildPhoneHeroHTML'),
    'phone card is the photo slideshow plus a collapsible stock donut'
);
assert.ok(
    rnpSrc.includes("_phoneCollapseHtml('stock', _stockCollapseTitle(stockBySize), _phoneStockOpen") &&
    rnpSrc.includes('rnp-phone-hero-donut') &&
    !rnpSrc.includes('rnp-stock-pop-hide'),
    'phone Остатки header opens the donut overlay; no hide button in the info card'
);
assert.ok(
    html.includes('.rnp-phone-hero') &&
    html.includes('.product-card-mobile-layout') &&
    html.includes('.rnp-phone-hero-slides {') &&
    html.includes('height: 110px') &&
    html.includes('.rnp-article-panel--phone .rnp-kpi-top') &&
    html.includes('.rnp-table-scroll .rnp-head-panel { display: none; }') &&
    html.includes('.rnp-collapse.is-open .rnp-phone-hero-donut') &&
    html.includes('.rnp-collapse[data-block="stock"].is-open > .rnp-collapse-body') &&
    html.includes('position: fixed'),
    'phone CSS keeps slideshow + overlay stocks and hides the article/KPI block'
);
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
        .includes("for (const dayStr of mode === 'history' ? [] : [yesterday, today])"),
    'auto-sync Pass B must load yesterday and today so RNP is not empty in the morning'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/rnp-finance-sync/index.ts'), 'utf8')
        .includes('cron_finance_first'),
    'night finance cron must finish every cabinet before downloading storage'
);
const wbProxySrc = fs.readFileSync(path.join(__dirname, 'supabase/functions/wb-proxy/index.ts'), 'utf8');
assert.ok(wbProxySrc.includes('fetchSalesReportsDetailedPage'),
    'wb-proxy finance_report must use the Finance API detailed-by-period helper');
assert.ok(wbProxySrc.includes("timeZone: 'Europe/Moscow'"),
    'wb-proxy funnel window must use Moscow dates, not UTC ISO');
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
assert.ok(
    rnpSrc.includes('function _adNmId') &&
    rnpSrc.includes('n?.nmId ?? n?.nmID ?? n?.nm_id') &&
    rnpSrc.includes("ad_impressions: keep('ad_impressions')") &&
    rnpSrc.includes('await _mergeAdStatsFromDb(missing, _buildCalendar())'),
    'RK stats survive finance merge and accept WB nmID in fullstats'
);
{
    const start = rnpSrc.indexOf('function _adNmId');
    const end = rnpSrc.indexOf('function _ensureCacheDay');
    assert.ok(start > 0 && end > start);
    const fns = new Function(`${rnpSrc.slice(start, end)}\nreturn { _adNmId, _adNmsFromDay };`)();
    assert.strictEqual(fns._adNmId({ nmID: 247347214 }), 247347214);
    assert.strictEqual(fns._adNmId({ nmId: 1 }), 1);
    const nms = fns._adNmsFromDay({ apps: [{ nms: [{ nmID: 9, views: 3 }] }] });
    assert.strictEqual(fns._adNmId(nms[0]), 9);
}
assert.ok(/const \[, dailyRows, , stocksRaw\] = await Promise\.all/.test(rnpSrc),
    'RNP must take wb_stocks from Promise.all slot 4, not exchange rates');
assert.ok(rnpSrc.includes('Array.isArray(stocksRaw)'),
    'RNP must not crash if stocks come back undefined');
assert.ok(rnpSrc.includes('funnelOrders != null ? funnelOrders : keep'),
    'RNP must keep WB card funnel Заказы, not max() with statistics-api');
assert.ok(rnpSrc.includes('function _funnelDayOrders'),
    'RNP must read orderCount from the WB sales funnel');
assert.ok(rnpSrc.includes('if (funnelOrders != null) rec.orders_count = funnelOrders'),
    'funnel upsert must persist WB orderCount into orders_count');
assert.ok(rnpSrc.includes('Number(ex.orders_count || 0) > 0'),
    'sync today must not skip a 0-order cell just because funnel touched updated_at');
assert.ok(rnpSrc.includes('const funnelKeep = _funnelImpliedOrders(ex)'),
    'sync today must keep WB card funnel ЗАКАЗЫ, not overwrite with wb_orders');
assert.ok(rnpSrc.includes('funnelKeep != null ? funnelKeep : Number(agg.orders_count || 0)'),
    'sync today writes Корзина × Заказы% when the funnel row already exists');
assert.ok(rnpSrc.includes('recentHole'),
    'funnel hydrate must refill yesterday/today when older days have orders but recent cells are 0');
assert.ok(rnpSrc.includes('function _funnelImpliedOrders'),
    'RNP must recover WB Заказы from Корзина × Заказы% when orderCount is missing');
assert.ok(rnpSrc.includes('_withFunnelOrders'),
    'week totals must sum funnel-corrected daily orders, not raw wb_orders');
assert.ok(rnpSrc.includes('funnelLag'),
    'funnel hydrate must rerun when Корзина × Заказы% differs from ЗАКАЗЫ');
{
    const start = rnpSrc.indexOf('function _funnelPickNum');
    const end = rnpSrc.indexOf('function _sleep');
    assert.ok(start > 0 && end > start, 'funnel order helpers sit next to date helpers');
    const fns = new Function(`${rnpSrc.slice(start, end)}; return { _funnelDayOrders, _funnelImpliedOrders, _withFunnelOrders };`)();
    assert.strictEqual(fns._funnelDayOrders({ orderCount: 8 }), 8);
    assert.strictEqual(fns._funnelDayOrders({ ordersCount: 10 }), 10);
    assert.strictEqual(fns._funnelDayOrders({}), null);
    assert.strictEqual(fns._funnelDayOrders({ orderCount: 0 }), 0);
    assert.strictEqual(fns._funnelImpliedOrders({ basket_count: 157, funnel_order_conv: 18 }), 28);
    assert.strictEqual(fns._funnelImpliedOrders({ cartCount: 83, cartToOrderConversion: 12 }), 10);
    assert.strictEqual(fns._funnelDayOrders({ cartCount: 157, cartToOrderConversion: 18 }), 28);
    assert.strictEqual(fns._funnelDayOrders({ orderCount: 66, cartCount: 294, cartToOrderConversion: 16 }), 47);
    assert.strictEqual(fns._withFunnelOrders({ orders_count: 17, basket_count: 157, funnel_order_conv: 18 }).orders_count, 17);
    assert.strictEqual(fns._withFunnelOrders({ date: '2026-09-13', orders_count: 17, basket_count: 157, funnel_order_conv: 18 }).orders_count, 28);
    assert.strictEqual(fns._withFunnelOrders({ date: '2026-09-14', orders_count: 66, basket_count: 294, funnel_order_conv: 16 }).orders_count, 47);
}
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
assert.ok(html.includes("mode: 'refresh'") && html.includes('AUTO_SYNC_URL'),
    'dashboard refresh must sync via auto-sync, not the dead Statistics stocks API');
// Кнопка «Обновить» удаляла wb_orders от 2026-01-01 и писала вместо истории то,
// что WB отдал на dateFrom (а он отдаёт последние изменившиеся заказы, не период).
assert.ok(
    !/from\('wb_orders'\)\s*\.delete\(\)/.test(html) && !html.includes("await supabase.from('wb_orders').delete()"),
    'dashboard must never delete order history from the browser'
);
assert.ok(
    !html.includes("callWbProxy('orders', { dateFrom: from }"),
    'orders must be synced day by day on the server, not pulled from WB by the page'
);
assert.ok(
    autoSyncSrc.includes("if (mode === 'refresh')") &&
    autoSyncSrc.includes("mode !== 'full' && mode !== 'stocks' && mode !== 'refresh'"),
    'auto-sync must support the refresh mode used by the dashboard button'
);
// Цена заказа: у WB нет поля priceWithDiscount, из-за него суммы падали на
// totalPrice (до скидки) и заказы на дашборде были завышены в 1.5-3 раза.
const readsFakePriceField = (src) => /(?:\.|\[['"])priceWithDiscount/.test(src);
assert.ok(
    !readsFakePriceField(html) &&
    !readsFakePriceField(autoSyncSrc) &&
    !readsFakePriceField(fs.readFileSync(path.join(__dirname, 'rnp-module.js'), 'utf8')) &&
    !readsFakePriceField(fs.readFileSync(path.join(__dirname, 'supabase/functions/rnp-morning-fill/index.ts'), 'utf8')),
    'nothing may read the non-existent WB field priceWithDiscount'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/wb-order-price.ts'), 'utf8')
        .includes('export function orderPriceWithDisc') &&
    autoSyncSrc.includes('orderPriceWithDisc(o)'),
    'order price must come from the shared priceWithDisc helper'
);
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
assert.ok(rnpSrc.includes('class="rnp-settings-gear"') && rnpSrc.includes('onclick="RNP.openSettings()"'),
    'RNP toolbar has a small gear for settings');
assert.ok(rnpSrc.includes('function _excelSvg') && rnpSrc.includes('function _editSvg') && rnpSrc.includes('function _planSvg'),
    'RNP toolbar Plan / Excel / Edit are SVG icons');
assert.ok(rnpSrc.includes('function _iconToolsHtml'),
    'RNP toolbar icons stay in one row');
assert.ok(rnpSrc.includes('План/факт') && rnpSrc.includes('openPlanFact') && rnpSrc.includes('function _planFactSvg'),
    'RNP toolbar has a visible План/факт chip that opens the Excel sheet');
assert.ok(html.includes('.rnp-plan-fact-open svg') && html.includes('height: 26px'),
    'План/факт chip is a labeled control, not 10px muted text among icons');
assert.ok(html.includes('id="rnp-plan-fact-overlay"') && html.includes('.pf-sheet'),
    'plan/fact overlay is the Excel clone sheet');
assert.ok(!rnpSrc.includes('>Excel</button>') && !rnpSrc.includes('↵ План') && !rnpSrc.includes('>Редактировать</button>'),
    'RNP toolbar no longer uses text pills for Plan / Excel / Edit');
assert.ok(html.includes('.rnp-tool-icon') && html.includes('.rnp-tool-icons'),
    'icon buttons share the same 22px circle as the settings gear');
assert.ok(
    rnpSrc.includes('function setCompareMonth') &&
    rnpSrc.includes('rnp-compare-month-btn') &&
    rnpSrc.includes('function _compareSvg') &&
    rnpSrc.includes('rnp_compare_month'),
    'RNP compare icon picks a month instead of always showing the previous one'
);
assert.ok(
    rnpSrc.includes("useCmp ? _weeksForMonth") &&
    !rnpSrc.includes('_isPhone() && _weeksCollapsed'),
    'previous-month weeks stay off until a compare month is chosen, on desktop and phone'
);
assert.ok(html.includes('.rnp-compare-month-menu') && html.includes('.rnp-compare-month-suggest'),
    'compare menu offers the previous month and other months');
{
    const dateStart = rnpSrc.indexOf('function _dateStr(y, m, d)');
    const dateEnd = rnpSrc.indexOf('function _localDateStr');
    const weekStart = rnpSrc.indexOf('function _weekLabel');
    const weekEnd = rnpSrc.indexOf('function _buildCols');
    const weeksStart = rnpSrc.indexOf('function _weeksForMonth');
    const weeksEnd = rnpSrc.indexOf('function _buildWeekCalendar');
    const fns = new Function(`
        ${rnpSrc.slice(dateStart, dateEnd)}
        ${rnpSrc.slice(weekStart, weekEnd)}
        ${rnpSrc.slice(weeksStart, weeksEnd)}
        return { _weeksForMonth };
    `)();
    const aug = fns._weeksForMonth(2026, 7);
    assert.ok(aug.length >= 5 && aug[0].dates[0] === '2026-08-01' && aug[0].dates.includes('2026-08-02'),
        'August compare weeks start on 2026-08-01');
}
assert.ok(html.includes('id="rnp-settings-overlay"'), 'RNP settings open as an overlay, not a second page');
assert.ok(rnpSrc.includes('Группы в РНП') && rnpSrc.includes('function _settingsGroupsHtml'),
    'settings has a group visibility card');
{
    const start = rnpSrc.indexOf('function _normalizeOptions');
    const end = rnpSrc.indexOf('function _settingsOptions');
    assert.ok(start > 0 && end > start);
    const fns = new Function(`${rnpSrc.slice(start, end)}; return { _normalizeOptions };`)();
    assert.deepStrictEqual(fns._normalizeOptions({ hiddenGroups: ['Бомбер', 'Бомбер', ''] }).hiddenGroups, ['Бомбер']);
    assert.deepStrictEqual(fns._normalizeOptions({}).hiddenGroups, []);
}
assert.ok(html.includes('function cabinetDisplayName'), 'cabinet picker shows legal IP names, not Baza/Elium letters');
assert.ok(html.includes('ИП Бейшеев А.Д.') && html.includes('ИП Айзада'), 'Baza and Elium show the IP names from WB');
assert.ok(html.includes('ИП Уркунбаев К.А.'), 'Zevina 1 shows the legal name from WB');
assert.ok(html.includes('function isHiddenCabinet') && html.includes('visibleCabinets'),
    'Ailin / Zevina 2 is hidden from every cabinet list');
assert.ok(!html.includes('id="cabinet-picker-initial"'), 'letter avatar next to the cabinet name is gone');
assert.ok(!html.includes('cab-dot'), 'dropdown no longer draws B/E/Z circles');
const cabFns = new Function(
    html.slice(html.indexOf('function cabinetDisplayName'), html.indexOf('window.isHiddenCabinet'))
    + '; return { cabinetDisplayName, isHiddenCabinet, visibleCabinets };'
)();
assert.strictEqual(cabFns.cabinetDisplayName('Baza'), 'ИП Бейшеев А.Д.');
assert.strictEqual(cabFns.cabinetDisplayName('Elium'), 'ИП Айзада');
assert.strictEqual(cabFns.cabinetDisplayName('Zevina 1'), 'ИП Уркунбаев К.А.');
assert.strictEqual(cabFns.cabinetDisplayName('Zevina 2'), 'ОсОО «Айлин Стиль»');
assert.ok(cabFns.isHiddenCabinet({ name: 'Zevina 2' }) && cabFns.isHiddenCabinet({ name: 'ОсОО Айлин Стиль' }));
assert.ok(!cabFns.isHiddenCabinet({ name: 'Zevina 1' }) && !cabFns.isHiddenCabinet({ name: 'Baza' }));
assert.ok(!cabFns.isHiddenCabinet({ name: 'ИП Уркунбаев К.А.' }), 'Urkunbaev stays visible');
assert.strictEqual(cabFns.visibleCabinets([
    { id: '1', name: 'Zevina 1' },
    { id: '2', name: 'Zevina 2' },
    { id: '3', name: 'Elium' },
]).map((c) => c.id).join(','), '1,3');
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
assert.ok(rnpSrc.includes('function _saveRnpShell') && rnpSrc.includes('function _restoreRnpShell'),
    'RNP snapshot of the last workspace must survive F5');
assert.ok(html.includes("rnp_shell_cab") && html.includes("rnp_shell_") && html.includes('function read(k)'),
    'tab-rnp restores the last sheet before any spinner');
assert.ok(html.includes('localStorage.getItem(k)') && html.includes('rnp_chrome'),
    'RNP restore also reads localStorage and the compact chrome snapshot');
assert.ok(html.includes("selected_cabinet_id") && html.includes("p.cab === cab") && !html.includes('get(cab || \'last\')'),
    'early RNP restore must use the selected cabinet, not the last other cabinet');
assert.ok(!rnpSrc.includes("k !== 'rnp_shell_cab') keys.push(k)") && rnpSrc.includes('function _rnpDomCab') && rnpSrc.includes('data-rnp-cab'),
    'RNP must not fall back to another cabinet snapshot');
assert.ok(rnpSrc.includes('function _readSavedActiveNm') && rnpSrc.includes('rnp_active_nm_'),
    'active article is remembered per cabinet');
assert.ok(html.includes('const rnpNow = getRnp()') && html.includes('rnpNow.ensureReady'),
    'cabinet switch must start RNP before dashboard loadFromDB');
assert.ok(rnpSrc.includes('function _saveRnpChrome') && rnpSrc.includes('function _compactRnpWorkspace'),
    'RNP snapshot is compacted so it fits storage and comes back on F5');
assert.ok(rnpSrc.includes('function _patchLockedSheet') && rnpSrc.includes('function _paintSheetBody') && rnpSrc.includes('function _sheetLockKey'),
    'same RNP sheet must patch values in place instead of swapping blocks');
assert.ok(rnpSrc.includes('function _swapSheetKeepPhotos') && rnpSrc.includes('function _hydratePhotoCacheFromDom'),
    'RNP refresh must keep painted photos and rehydrate them from the restored sheet');
assert.ok(rnpSrc.includes('function _hydratePhotoCacheFromDom') && rnpSrc.includes('_hydratePhotoCacheFromStorage();'),
    'photo cache must hydrate from storage and the restored sheet before paint');
assert.ok(rnpSrc.includes('function _patchElHtml') && !rnpSrc.includes('el.innerHTML = _stockSchemeInnerHTML'),
    'stock/donut refresh must patch numbers without rebuilding the block');
assert.ok(rnpSrc.includes("'.rnp-head-wide-stocks'") && rnpSrc.includes("'.rnp-stock-scheme-wrap'"),
    'locked sheet patch must update stocks without replacing the photo block');
assert.ok(rnpSrc.includes('function _sameArticleSheet') && rnpSrc.includes('sameArticle && hasTable') && rnpSrc.includes('sameArticle && hasPhotos'),
    'switching RNP article must replace photos and funnel instead of patching another product');
assert.ok(rnpSrc.includes('function _photoUrlFitsNm') && rnpSrc.includes('fromAttr !== fromUrl'),
    'photo cache must not attach another article\'s WB image to this nm_id');
assert.ok(html.includes('function setInner') && html.includes('function patchNode') && html.includes('SKIP_CHILD_SEL'),
    'domMorph patches text and classes instead of wiping innerHTML of cards');
assert.ok(html.includes('contain: layout style'),
    'KPI and stock blocks keep their box while values change');
{
    const adsHqSrc = fs.readFileSync(path.join(__dirname, 'ads-command-center.js'), 'utf8');
    assert.ok(adsHqSrc.includes("querySelectorAll('.adv-kpi-tile-value')"),
        'ads KPI tiles must update the number in place');
    assert.ok(adsHqSrc.includes("morphList(tb, html.join(''), 'data-key')"),
        'ads HQ table must morph keyed rows instead of replacing tbody');
    assert.ok(adsHqSrc.includes('function paintPending') && adsHqSrc.includes('cabinetRows()[0]'),
        'RK KPIs follow the header cabinet, not the first row of a stale model');
    assert.ok(!adsHqSrc.includes('подтягиваем полки из WB'),
        'opening an empty cabinet must not block on a live WB sync');
    assert.ok(adsHqSrc.includes('usedYesterday') && adsHqSrc.includes('function compareCampaigns') && adsHqSrc.includes('extendRangeForRanking'),
        'RK lists yesterday-used campaigns first and keeps a lookback for that sort');
}
assert.ok(rnpSrc.includes('function _fillRnpChrome') && rnpSrc.includes('nr-rnp-lock') && rnpSrc.includes('function _rnpIdbPut'),
    'F5 chrome stays put and the full sheet is also stored in IndexedDB');
assert.ok(!rnpSrc.includes("if (tabs) tabs.innerHTML = _renderTabsHTML(_rnpVisibleArticles());"),
    'photo preload must not rebuild the article tabs');
assert.ok(html.includes("indexedDB.open('nr-rnp-lock'"),
    'tab-rnp restores the IndexedDB sheet before the module boots');
assert.ok(!/if \(!_cachedPhotoUrl\(art, 1\)\) await _ensurePhoto/.test(rnpSrc),
    'article sheet must not wait for photos before painting the table');
assert.ok(!rnpSrc.includes('Рисуем таблицу'),
    'general sheet must not swap in a drawing spinner');
assert.ok(
    !/if \(_initInflight && !_cabArticles\(\)\.length\) \{\s*el\.innerHTML/.test(rnpSrc),
    'waiting for articles must not replace the RNP workspace with a loading card'
);
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
const adminSpaceSrc = fs.readFileSync(path.join(__dirname, 'supabase/functions/admin-space/index.ts'), 'utf8');
assert.ok(
    adminSpaceSrc.includes("from('team_staff').delete()"),
    'blocking a space must revoke staff rights'
);
assert.ok(
    !/insert\(\{\s*email: space\.email/.test(adminSpaceSrc),
    'activating a client must not grant access to other cabinets'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8')
        .includes('Заявка на вход отправлена администратору'),
    'access_denied screen still explains the wait if the gate rejects'
);
{
    const loginSrc = fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8');
    assert.ok(
        loginSrc.includes("space?.status === 'blocked'") &&
        loginSrc.includes("space.status !== 'pending'") &&
        !loginSrc.includes("if (space?.status !== 'active')"),
        'pending Google login must reach /space onboarding, not access_denied'
    );
    assert.ok(
        html.includes('function submitOnboarding') &&
        html.includes("onboardingMode = true") &&
        html.includes('id="onb-token"'),
        'dashboard has the new-client token screen'
    );
}

assert.ok(html.includes('id="ads-hq-start-at"') && html.includes('type="datetime-local"') && html.includes('id="ads-hq-schedule-start"'),
    'RK can pick a start time without launching now');
assert.ok(html.includes('id="ads-hq-schedule"') && html.includes('На время'),
    'pending schedule list lives on the RK tab');
{
    const adsHqSrc = fs.readFileSync(path.join(__dirname, 'ads-command-center.js'), 'utf8');
    const startFn = adsHqSrc.slice(adsHqSrc.indexOf('async function scheduleStart'), adsHqSrc.indexOf('async function cancelSchedule'));
    assert.ok(startFn.includes("status: 'pending'") && !startFn.includes('callWbProxy') && !startFn.includes('advert_start'),
        'setting a time must not start the campaign now');
}

assert.ok(html.includes('data-adv-view="autobidder"') && html.includes('id="adv-subtab-autobidder"'),
    'advertising detail must have an Автобиддер tab');
assert.ok(html.includes('id="adv-view-ads"') && html.includes('id="ads-hq-tbody"') && html.includes('Активные полки'),
    'РК opens on the shelves list, not cabinet cards');
assert.ok(!html.includes('Активные полки кабинета из шапки') && !html.includes('ads-hq-title'),
    'RK does not repeat the page title above the KPI tiles');
assert.ok(html.includes('id="ads-hq-reload"') && html.includes('id="ads-hq-phone"') && html.includes('ads-hq-table-wrap') && html.includes('>Полка<'),
    'ads HQ shows phone cards, a campaign table and a reload control');
assert.ok(html.includes('let adsReload = null') && html.includes('await adsReload') && html.includes('window.AdsHQ.load()'),
    'switching cabinet on RK must reload shelves immediately, not after the dashboard RPC');
assert.ok(html.includes('data-camp-filter="active"') && html.includes('data-camp-filter="all"') && html.includes('ads-hq-advanced'),
    'ads HQ defaults to active shelves and hides autobidder in details');
assert.ok(html.includes('syncFromWb') && html.includes('syncAdvertisingNow({ silent: true })'),
    'ads HQ refresh pulls campaigns from WB, then rereads the DB');
assert.ok(html.includes('const isAdsHq') && html.includes("window._advView !== 'detail'"),
    'RK header treats command center as the root view, not a drill-in');
assert.ok(
    html.includes('DATE_FILTER_TABS.has(tabName) && !showEmpty') &&
    !html.includes('DATE_FILTER_TABS.has(tabName) && !showEmpty && !isAdsHq'),
    'RK HQ shows the same header date chip as the dashboard'
);
assert.ok(html.includes('getDateRange: getActiveDateRange'),
    'RK shelves read spend/DRR for the header date range');
assert.ok(html.includes('>Расход<') && html.includes('adv-kpi-tile-label">ДРР<') && !html.includes('Расход сегодня') && !html.includes('ДРР 7д'),
    'RK KPI and table labels are the picked period, not a hardcoded today/7d');
assert.ok(
    html.includes("tab === 'tab-advertising' && window._advView === 'detail'") &&
    html.includes("showAdvertisingAdsView({ cabinetId: currentCabinetId") &&
    !html.includes("window._advView === 'detail' || window._advView === 'ads'"),
    'header back from detail returns to command center of the header cabinet'
);
assert.ok(html.includes('AdsHQ.open({ cabinetId:') && html.includes('currentCabinetId'),
    'command center opens for the header cabinet, not all cabinets');
assert.ok(html.includes('data-adv-view="ads"') && html.includes('ads-command-center'),
    'Реклама tab sits next to legacy Автобиддер and loads ads-command-center.js');
assert.ok(html.includes('id="ads-hq-journal-chart"') && html.includes('id="ads-hq-save"'),
    'command center must include rule form and journal chart');
assert.ok(html.includes('id="adv-subtab-autobidder"') && html.includes("from('autobidder_rules_legacy_mvp')"),
    'legacy Автобиддер tab stays wired to autobidder_rules_legacy_mvp');
assert.ok(html.includes('id="autobidder-modal"') && html.includes('function openAutobidderModal'),
    'campaign row must open the autobidder rule modal');
assert.ok(html.includes('function saveAutobidderRule') && html.includes("from('autobidder_rules_legacy_mvp')"),
    'autobidder modal must persist a rule to autobidder_rules_legacy_mvp');
assert.ok(html.includes('AUTOBIDDER_RUN_URL') && html.includes('function runAutobidderNow'),
    'dashboard must call autobidder-run for a manual pass');
assert.ok(html.includes("callWbProxy('adv_cluster_board'") && html.includes('function renderClusterBoard'),
    'campaign row must open the per-campaign cluster board');
assert.ok(html.includes("callWbProxy('adv_cluster_bid'") && html.includes('function saveClusterBid'),
    'each cluster must accept its own CPM bid');
assert.ok(html.includes("callWbProxy('adv_cluster_minus'") && html.includes('function toggleClusterMinus'),
    'cluster board must exclude / restore a cluster via minus phrases');
assert.ok(html.includes("callWbProxy('adv_cluster_positions'") && html.includes('function loadClusterPositions'),
    'cluster board must load search position and frequency per key');
assert.ok(html.includes('data-cl-bid=') && html.includes('class="cl-bid-input"'),
    'cluster bid must be an editable input, not read-only text');
assert.ok(html.includes('cl-chip') && html.includes('Исключения'),
    'cluster board needs the Все / Активные / Со ставкой / Исключения filters');
// Кластеры живут в модалке того же вида, что настройки РНП, и выплывают.
assert.ok(html.includes('id="cluster-overlay"') && html.includes('class="rnp-settings-dialog cl-dialog"'),
    'cluster keys must open in the shared site modal, not an inline table row');
assert.ok(html.includes('function openClusterModal') && html.includes('function closeClusterModal'),
    'cluster modal needs explicit open/close');
assert.ok(html.includes('@keyframes nr-dialog-in')
    && html.includes('.rnp-settings-overlay.is-open > .rnp-settings-dialog'),
    'site modals must animate in instead of appearing instantly');
assert.ok(html.includes('prefers-reduced-motion'),
    'modal animation must respect reduced motion');
assert.ok(!html.includes('adv-camp-kw-row-'),
    'old inline phrase row must be gone so the modal is the only cluster view');
// Никакого перерисовывания на каждый символ и рендера всех строк сразу.
assert.ok(html.includes('_clusterSearchTimer') && html.includes('CLUSTER_PAGE'),
    'cluster search must be debounced and rows rendered in pages');
assert.ok(html.includes('function showMoreClusters') && html.includes('function sortClusterBy'),
    'cluster table needs paging and column sorting');
assert.ok(html.includes('function renderClusterShell') && html.includes('function renderClusterRows'),
    'filter/sort/search must repaint only tbody, not the whole panel');
assert.ok(html.includes('table-layout: fixed') && html.includes('<colgroup>'),
    'fixed column widths keep the table from relayouting on every render');
assert.ok(html.includes('data-cl-filter=') && html.includes('data-cl-sort='),
    'chips and header sorting go through delegated clicks');
// Коридор ставок WB: три уровня охвата кликом, без ручного счёта цифр.
assert.ok(html.includes('function clusterReachCell') && html.includes('Коридор WB'),
    'cluster board must show the WB bid corridor per cluster');
assert.ok(html.includes('function setClusterReach') && html.includes('function setAllClusterReach'),
    'one click must set a reach level for one cluster and for all visible ones');
assert.ok(html.includes("data-cl-all=\"min\"") && html.includes("data-cl-all=\"medium\"")
    && html.includes("data-cl-all=\"max\""),
    'bulk Эконом / Средний / Максимум buttons must exist');
assert.ok(html.includes('cl-flag-over') && html.includes('cl-flag-under'),
    'overpay and underbid must be flagged, not left for the user to compute');
// Частота 0 значит «не ищут», а не «нет данных» — иначе экран врёт.
assert.ok(html.includes('function clusterFreqCell') && html.includes('не ищут'),
    'zero search frequency must read as "не ищут", not as a missing value');
{
    const proxy = fs.readFileSync(path.join(__dirname, 'supabase/functions/wb-proxy/index.ts'), 'utf8');
    assert.ok(proxy.includes('/api/advert/v0/bids/recommendations') && proxy.includes('mergeClusterCorridors'),
        'bid corridor comes from the official recommendations endpoint');
    assert.ok(proxy.includes("case 'adv_cluster_board'") && proxy.includes("case 'adv_cluster_bid'")
        && proxy.includes("case 'adv_cluster_minus'") && proxy.includes("case 'adv_cluster_positions'"),
        'wb-proxy must serve the cluster board, bid, minus and positions actions');
    assert.ok(proxy.includes('/api/advert/v1/normquery/bids'),
        'cluster bids go through v1 (bidMinorUnits in cabinet currency)');
    assert.ok(!proxy.includes('/adv/v0/normquery/bids'),
        'v0 bids path is in rubles — must not be used');
    assert.ok(proxy.includes('fetchAdvConfigCached'),
        'bid step comes from GET /api/advert/v1/config and is cached per cabinet');
    assert.ok(proxy.includes('/api/v2/search-report/product/orders') && proxy.includes('readPositionCache'),
        'positions come from the official report and are cached (3 req/min per cabinet)');
}
{
    const hq = fs.readFileSync(path.join(__dirname, 'ads-command-center.js'), 'utf8');
    assert.ok(hq.includes('data-keys=') && hq.includes('openClusterModal'),
        'active shelves list must open cluster keys for the shelf');
}
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
    proxySrc.includes("from '../_shared/wb-adv-proxy.ts'") && proxySrc.includes('isAdvNamespaceRequest'),
    'wb-proxy must add /adv/* namespace without replacing old advert_* actions'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/_shared/wb-adv-proxy.ts')),
    'shared /adv/* proxy module must exist'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260904020000_adv_vault_rpc.sql')),
    'adv Vault RPC migration must exist'
);
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260904020000_adv_vault_rpc.sql'), 'utf8').includes('ADD COLUMN'),
    'adv Vault RPC migration must not add cabinets columns'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260904020000_adv_vault_rpc.sql'), 'utf8').includes('read_adv_vault_secret'),
    'adv Vault RPC migration must define read_adv_vault_secret'
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
assert.ok(html.includes('id="agent-invite-copy-btn"') && html.includes('id="agent-invite-url"'),
    'generated invite must show a selectable URL field and a copy button');
assert.ok(html.includes('пригласительная Baza 996700123456'),
    'invite panel tells how to ask Karina in the team chat');
assert.ok(html.includes('function copyTextToClipboard') && html.includes("execCommand('copy')"),
    'copy button must work on iPhone when navigator.clipboard is blocked');
assert.ok(html.includes('function pickAgentInviteUrl') && html.includes('nr_last_wb_invite'),
    'invite URL is recovered from nested WB fields and kept until copy');
{
    const start = html.indexOf('function pickAgentInviteUrl');
    const end = html.indexOf('function copyTextToClipboard');
    assert.ok(start > 0 && end > start, 'invite URL helper sits next to clipboard copy');
    const fns = new Function(`${html.slice(start, end)}; return { pickAgentInviteUrl };`)();
    assert.strictEqual(fns.pickAgentInviteUrl({ inviteUrl: 'https://seller.wildberries.ru/invite/abc' }), 'https://seller.wildberries.ru/invite/abc');
    assert.strictEqual(fns.pickAgentInviteUrl({ invite: { url: 'https://wb.ru/i/1' } }), 'https://wb.ru/i/1');
    assert.strictEqual(fns.pickAgentInviteUrl({ data: { invite_url: 'https://wb.ru/i/2' } }), 'https://wb.ru/i/2');
}
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
    html.includes('Или ответьте в Telegram коротко: завтра / да / 170'),
    'questions panel must hint the Telegram short reply'
);
assert.ok(
    proxySrc.includes("case 'users_invite'") &&
    proxySrc.includes("case 'users_access'") &&
    proxySrc.includes('changeExistingUserAccess') &&
    proxySrc.includes("case 'prices_set'") &&
    proxySrc.includes("case 'feedbacks_answer'") &&
    proxySrc.includes("case 'orders_fbs_new'") &&
    proxySrc.includes("case 'passes_create'") &&
    proxySrc.includes("case 'buyer_chats'"),
    'wb-proxy must expose invite, access change, prices, reviews, FBS, passes and chats'
);
assert.ok(
    html.includes('value="finance"') &&
    html.includes('function changeAgentUserAccess') &&
    html.includes("callWbProxy('users_access'"),
    'Agents tab must change access for an already added user, including finances'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/_shared/wb-agent-wow.ts')),
    'shared agent WB helpers must exist'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8').includes('"/agents"'),
    'Vercel must rewrite /agents to the dashboard'
);
assert.ok(
    html.includes("LIVE_TABS = new Set(['dashboard', 'settings', 'rnp', 'rnp-settings', 'advertising', 'ab-testing', 'goods-groups', 'content-factory', 'agents', 'summary'])") &&
    html.includes('data-tab="agents"') &&
    html.includes('id="agents-hub-side"') &&
    html.includes('function renderAgentHub') &&
    html.includes('function submitTelegramBotHub') &&
    html.includes('function saveAgentBrain') &&
    html.includes('function sendAgentTgMessage') &&
    html.includes('function selectAgentTgChannel') &&
    html.includes('ah-logo-wa') &&
    html.includes('ah-logo-tg') &&
    html.includes('TG_CHANNEL_PURPOSE') &&
    html.includes('Отправить в Telegram') &&
    html.includes('Ватсап') &&
    html.includes('Телеграм') &&
    html.includes('>Мозг<') &&
    html.includes('ChatGPT') &&
    html.includes('function deleteWhatsAppAgent') &&
    html.includes('function showAgentsPage') &&
    html.includes('id="agents-page-fns"') &&
    html.includes('id="agents-page-chats"') &&
    html.includes('id="agents-page-brain"') &&
    html.includes('data-agents-page="fns"') &&
    html.includes('data-agents-page="chats"') &&
    html.includes('data-agents-page="brain"') &&
    html.includes('Функции агента') &&
    html.includes('Ватсап и Телеграм'),
    'Агенты live in the left rail: WhatsApp, Telegram channels, send-to-chat, ChatGPT brain'
);
assert.ok(
    html.includes("'telegram-bots': 'agents'") &&
    fs.readFileSync(path.join(__dirname, 'supabase/functions/telegram-admin/index.ts'), 'utf8').includes("action === 'create'") &&
    fs.readFileSync(path.join(__dirname, 'supabase/functions/telegram-admin/index.ts'), 'utf8').includes("action === 'send_channel'") &&
    fs.readFileSync(path.join(__dirname, 'supabase/functions/telegram-admin/index.ts'), 'utf8').includes("action === 'channels'") &&
    fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/telegram-routing.ts'), 'utf8').includes('TELEGRAM_CHANNEL_PURPOSE') &&
    fs.existsSync(path.join(__dirname, 'supabase/migrations/20260914120000_agent_hub.sql')),
    'can add a Telegram bot, list channel status, and send a site message into the TG chat'
);

{
    const astraMig = fs.readFileSync(
        path.join(__dirname, 'supabase/migrations/20260918120000_agent_brain_astra.sql'), 'utf8');
    assert.ok(
        html.includes('id="agents-canvas"') &&
        html.includes('function renderAgentsCanvas') &&
        html.includes('function persistAgentBrain') &&
        html.includes('function saveAgentAstra') &&
        html.includes('function formatAstraBalance') &&
        html.includes('function connectedAgentNames') &&
        html.includes('ac-model-btn') &&
        html.includes("openAgentHubForm('brain')") &&
        html.includes("openAgentHubForm('astra')") &&
        html.includes('актуально') &&
        html.includes('подключены:') &&
        html.includes('Astra') &&
        html.includes('баланс') &&
        html.includes("'gpt-5'") &&
        html.includes('astra_balance') &&
        !/_agentHub\.brain = \{ provider: 'chatgpt', model \}/.test(html) &&
        !/api\.openai\.com\/v1\/organization/.test(html) &&
        !/organization\/usage/.test(html),
        'Agents canvas: ChatGPT hub, current model, connected agents, Astra balance, no live OpenAI billing'
    );
    assert.ok(
        html.includes("showAgentsPage('chats');openAgentHubForm('wa')") &&
        html.includes("showAgentsPage('chats');focusAgentTelegram()") &&
        html.includes("openAgentFn(id, opts)") &&
        html.includes("nr_agents_page"),
        'canvas nodes jump to Функции / Ватсап-Телеграм pages; Мозг remembers last page'
    );
    assert.ok(
        astraMig.includes('astra_balance') &&
        astraMig.includes('astra_currency') &&
        astraMig.includes('add column if not exists') &&
        /не тянется|не живой/i.test(astraMig),
        'agent_brain stores a manual Astra remainder, not a live OpenAI pull'
    );
    function sliceFn(src, name) {
        const start = src.indexOf(`function ${name}`);
        assert.ok(start >= 0, `dashboard must define ${name}`);
        let i = src.indexOf('{', start);
        let depth = 0;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') {
                depth--;
                if (depth === 0) return src.slice(start, i + 1);
            }
        }
        throw new Error('unclosed ' + name);
    }
    const fake = {
        _agentHub: { brain: { provider: 'chatgpt', model: 'gpt-4o-mini', astra_balance: 12, astra_currency: 'USD' } },
        _tgBotsState: { channels: { sales: { configured: true } } },
        TG_CHANNEL_LABELS: { sales: 'Продажи' },
    };
    const helpers = [
        sliceFn(html, 'mergeAgentBrain'),
        sliceFn(html, 'formatAstraBalance'),
        sliceFn(html, 'connectedAgentNames'),
    ].join('\n');
    const run = Function('_agentHub', '_tgBotsState', 'TG_CHANNEL_LABELS', `${helpers}
        return {
            usd: formatAstraBalance({ astra_balance: 12.4, astra_currency: 'USD' }),
            rub: formatAstraBalance({ astra_balance: 1500, astra_currency: 'RUB' }),
            empty: formatAstraBalance({ astra_balance: null }),
            keepAstra: mergeAgentBrain({ model: 'gpt-5' }),
            names: connectedAgentNames(),
        };`);
    const got = run(fake._agentHub, fake._tgBotsState, fake.TG_CHANNEL_LABELS);
    assert.ok(got.usd.includes('12') && got.usd.includes('$'), 'Astra USD balance is visible');
    assert.ok(got.rub.includes('1') && got.rub.includes('₽'), 'Astra RUB balance is visible');
    assert.strictEqual(got.empty, 'не задан');
    assert.strictEqual(got.keepAstra.model, 'gpt-5');
    assert.strictEqual(got.keepAstra.astra_balance, 12);
    assert.ok(got.names.includes('Карина') && got.names.includes('Телеграм'), 'canvas lists people and connected Telegram');
}

// Хаб агентов — внутренняя страница команды. У клиента она давала 404 в консоль
// (таблиц не было) и показывала реестр наших ботов, поэтому вкладка скрыта и
// закрыта в базе: whatsapp_agents / agent_brain / telegram_bots — только is_staff().
{
    const staffMigration = fs.readFileSync(
        path.join(__dirname, 'supabase/migrations/20260916260000_agent_hub_staff_only.sql'), 'utf8');
    assert.ok(
        staffMigration.includes('create or replace function public.is_staff()') &&
        staffMigration.includes('grant execute on function public.is_staff() to authenticated'),
        'is_staff() must exist so the UI can ask once whether to show internal tabs'
    );
    assert.ok(
        staffMigration.includes('create policy whatsapp_agents_staff') &&
        staffMigration.includes('create policy agent_brain_staff') &&
        staffMigration.includes('drop policy if exists whatsapp_agents_select') &&
        staffMigration.includes('drop policy if exists agent_brain_select'),
        'agent hub tables must be staff-only instead of any-authenticated'
    );
    assert.ok(
        /create policy telegram_bots_select on public\.telegram_bots for select\s*\n\s*using \(public\.is_staff\(\)\)/.test(staffMigration) &&
        staffMigration.includes('revoke all on public.telegram_bot_secrets from authenticated'),
        'the bot registry and bot tokens must not be readable by clients'
    );
    assert.ok(
        html.includes("const STAFF_ONLY_TABS = new Set(['agents', 'telegram-bots'])") &&
        html.includes("if (STAFF_ONLY_TABS.has(name) && !isStaff)") &&
        html.includes("supabase.rpc('is_staff')") &&
        html.includes('html:not([data-staff="1"]) [data-staff-only] { display: none !important; }') &&
        html.includes('data-tab="agents" title="Агенты" data-staff-only="1"') &&
        html.includes(`onclick="showTab('agents', this)" data-staff-only="1"`) &&
        html.includes(`onclick="showTab('telegram-bots', this)" data-staff-only="1"`) &&
        html.includes("if (!grid || !isStaff) return;"),
        'client must not see the internal Агенты tab: hidden in nav and blocked in showTab'
    );
    assert.ok(
        html.includes("if (localStorage.getItem('nr_is_staff') === '1')") &&
        html.includes("} else if (__nrTab === 'agents') {"),
        'direct /agents hit must fall back to the dashboard before first paint for a client'
    );
}

assert.ok(!html.includes('--logo-mark: #F5C400'), 'dashboard logo mark must not be yellow');
assert.ok(html.includes('--logo-mark: #FFFFFF'), 'dashboard logo mark must be white');
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('bg-[#F5C400] text-[#111] font-black'),
    'site header logo must not be the yellow NR tile'
);
assert.ok(
    fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('src="/icons/logo-nr.svg"') &&
    fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('class="logo-nr"'),
    'site header logo must use the shared bold NR mark'
);
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('tracking-tight">NR Space</span>') &&
    !fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8').includes('tracking-tight">NR Space</span>'),
    'wordmark after the NR mark must be Space, not a second NR'
);
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes("fill='%231F2933'"),
    'site favicon must not keep the old dark NR tile'
);
assert.ok(
    !fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8').includes('background: #F5C400'),
    'login logo must not use the yellow mark'
);
assert.ok(
    html.includes('src="/icons/logo-nr.svg"') &&
    html.includes('logo-nr') &&
    fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8').includes('src="/icons/logo-nr.svg"') &&
    fs.readFileSync(path.join(__dirname, 'offline.html'), 'utf8').includes('src="/icons/logo-nr.svg"'),
    'dashboard, login and offline must share the same NR logo file'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'icons/logo-nr.svg')) &&
    fs.readFileSync(path.join(__dirname, 'icons/logo-nr.svg'), 'utf8').includes('fill="#ffffff"') &&
    fs.readFileSync(path.join(__dirname, 'icons/logo-nr.svg'), 'utf8').includes('fill="#000000"') &&
    fs.readFileSync(path.join(__dirname, 'icons/logo-nr.svg'), 'utf8').includes('rx="120"') &&
    !fs.readFileSync(path.join(__dirname, 'icons/logo-nr.svg'), 'utf8').includes('stroke='),
    'master NR mark is extra-bold black letters on a rounded white tile, no border'
);
{
    const site = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.ok(
        site.includes('class="site-header') &&
        site.includes('hero-welcome') &&
        site.includes('site-login-chip') &&
        site.includes('viewport-fit=cover') &&
        site.includes('@media (max-width: 767px)'),
        'landing header is rounded and the iPhone hero stays compact'
    );
}
assert.ok(
    fs.existsSync(path.join(__dirname, 'favicon.ico')) &&
    fs.existsSync(path.join(__dirname, 'icons/favicon.png')) &&
    fs.existsSync(path.join(__dirname, 'icons/telegram-nr-avatar.png')),
    'favicon and Telegram avatar must be exported from the same NR mark'
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

{
    const schemePhone = new Function(`
        function _isPhone() { return true; }
        function _buildStockSizeHTML() { return 'SIZES'; }
        function _buildStockDonutHTML() { return '<div class="rnp-stock-donut"></div>'; }
        ${grabFn(rnpSrc, '_stockSchemeInnerHTML')}
        return _stockSchemeInnerHTML({}, {});
    `)();
    const schemeDesk = new Function(`
        function _isPhone() { return false; }
        function _buildStockSizeHTML() { return 'SIZES'; }
        function _buildStockDonutHTML() { return '<div class="rnp-stock-donut"></div>'; }
        ${grabFn(rnpSrc, '_stockSchemeInnerHTML')}
        return _stockSchemeInnerHTML({}, {});
    `)();
    assert.ok(schemePhone.includes('SIZES') && !schemePhone.includes('rnp-stock-donut'),
        'phone Остатки block keeps the size table and does not duplicate the donut');
    assert.ok(schemeDesk.includes('SIZES') && schemeDesk.includes('rnp-stock-donut'),
        'desktop stock scheme still shows the size table and donut together');

    const hero = new Function(`
        function _isPhone() { return true; }
        const _phoneStockOpen = true;
        function _stockCollapseTitle() { return 'Остатки'; }
        function _phoneCollapseHtml(id, title, open, inner) {
            return '<div class="rnp-collapse' + (open ? ' is-open' : '') + '" data-block="' + id + '">' + title + inner + '</div>';
        }
        function _imgHtml() { return '<img class="rnp-phone-hero-img">'; }
        function _buildStockDonutHTML() { return '<div class="rnp-stock-donut"><b>12</b><span>шт</span></div>'; }
        function _buildMarqueeHTML() { return '<div class="rnp-marquee-wrap"><div class="rnp-test-card">slide</div></div>'; }
        ${grabFn(rnpSrc, '_buildPhoneHeroHTML')}
        return {
            withCal: _buildPhoneHeroHTML({ nm_id: 111 }, {}, {}),
            noCal: _buildPhoneHeroHTML({ nm_id: 111 }, {}),
        };
    `)();
    assert.ok(hero.withCal.includes('rnp-phone-hero') && hero.withCal.includes('product-card-mobile-layout'));
    assert.ok(hero.withCal.includes('rnp-phone-hero-slides') && hero.withCal.includes('rnp-test-card'));
    assert.ok(hero.withCal.includes('rnp-phone-hero-donut') && hero.withCal.includes('data-nm="111"') && hero.withCal.includes('rnp-stock-donut'));
    assert.ok(hero.withCal.includes('Остатки') && hero.withCal.includes('data-block="stock"') && hero.withCal.includes('is-open'));
    assert.ok(!hero.withCal.includes('артикул WB') && !hero.withCal.includes('Показатели') && !hero.withCal.includes('себест'));
    assert.ok(hero.noCal.includes('rnp-phone-hero-banner'));

    const phonePanel = new Function(`
        function _isPhone() { return true; }
        function _buildPhoneHeroHTML() { return '<div class="rnp-phone-hero"></div>'; }
        function _buildKpiTopHTML() { return '<div class="rnp-kpi-top">артикул WB</div>'; }
        function _phoneCollapseHtml(id, title, open, inner) { return inner; }
        function _stockSchemeInnerHTML() { return 'SIZES'; }
        const _strategyTab = 0;
        const _phoneStockOpen = false;
        ${grabFn(rnpSrc, '_buildKpiPanelHTML')}
        return _buildKpiPanelHTML({ nm_id: 1 }, {}, {}, {});
    `)();
    assert.strictEqual(phonePanel, '<div class="rnp-phone-hero"></div>',
        'phone product card must not keep the name/article/KPI block');

    function kpiTop(isPhone) {
        return new Function(`
            const _strategyTab = 0;
            const _phoneKpiOpen = false;
            const _settings = { exchangeRate: 1, usdRate: 87.5 };
            function _isPhone() { return ${isPhone}; }
            function _periodSummary() {
                return { to_transfer: 0, sales_count: 0, roi_pct: 0, margin_pct: 0, profit: 0,
                    plan_orders_pct: 0, drr_pct: 0, ctr_pct: 0, impressions: 0,
                    logistics_per_unit: 0, buyout_pct: 0, cro_pct: 0, wb_rate: 0 };
            }
            function _articleMoneySom() { return 0; }
            function _sellerArticle() { return 'Блузка'; }
            function _syncStatus() { return { level: 'ok' }; }
            function _syncDot() { return ''; }
            function _fmtKpi() { return '0'; }
            function _imgHtml() { return '<img class="rnp-gs-photo-img">'; }
            function _phoneCollapseHtml(id, title, open, inner) { return inner; }
            ${grabFn(rnpSrc, '_collectKpiView')}
            ${grabFn(rnpSrc, '_kpiGridHTML')}
            ${grabFn(rnpSrc, '_buildKpiTopHTML')}
            return _buildKpiTopHTML({ nm_id: 222, cost_price: 10 }, {}, {}, {});
        `)();
    }
    const deskTop = kpiTop(false);
    assert.ok(deskTop.includes('rnp-gs-photo') && !deskTop.includes('rnp-kpi-top--nophoto'),
        'desktop KPI card still shows the article photo');
    assert.ok(!deskTop.includes('себест') && !deskTop.includes('rnp-gs-cost-input'),
        'desktop KPI card does not show the cost input');
    assert.ok(deskTop.includes('Показы РК') && deskTop.includes('Клики РК') && deskTop.includes('Расход РК'),
        'article KPI shows RK stats without scrolling to the ads section');

    function viewApi(isPhone) {
        return new Function(`
            let _stockSchemeView = 'all';
            function _isPhone() { return ${isPhone}; }
            function _refreshStockSchemeUI() {}
            ${grabFn(rnpSrc, 'setStockSchemeView')}
            return { set: setStockSchemeView, get: () => _stockSchemeView };
        `)();
    }
    const phoneView = viewApi(true);
    phoneView.set('fbo');
    assert.strictEqual(phoneView.get(), 'fbo');
    phoneView.set('fbo');
    assert.strictEqual(phoneView.get(), 'fbo', 'phone tap on the same FBO slice keeps FBO in the center');
    phoneView.set('fbs');
    assert.strictEqual(phoneView.get(), 'fbs');
    phoneView.set('all');
    assert.strictEqual(phoneView.get(), 'all', 'phone tap on the donut hole resets to FBO+FBS');
    const deskView = viewApi(false);
    deskView.set('fbo');
    deskView.set('fbo');
    assert.strictEqual(deskView.get(), 'all', 'desktop donut still toggles a slice off');
}

assert.ok(
    rnpSrc.includes('.rnp-phone-hero-donut') &&
    rnpSrc.includes('_buildStockDonutHTML(stock)'),
    'tapping a donut slice must refresh the phone hero donut as well as the size table'
);

{
    const start = rnpSrc.indexOf('function _planHitKind');
    const end = rnpSrc.indexOf('function _settingsArticleRowHtml');
    assert.ok(start > 0 && end > start, '_planHitKind sits next to cell color helpers');
    const fns = new Function(`${rnpSrc.slice(start, end)}; return { _planHitKind };`)();
    assert.strictEqual(fns._planHitKind(28, 28), 'hit');
    assert.strictEqual(fns._planHitKind(80, 80), 'hit');
    assert.strictEqual(fns._planHitKind(22.4, 28), 'mid');
    assert.strictEqual(fns._planHitKind(7, 28), 'miss');
    assert.strictEqual(fns._planHitKind(0, 28), 'miss');
    assert.strictEqual(fns._planHitKind(10, 0), '');
    assert.strictEqual(fns._planHitKind(10, null), '');
    assert.strictEqual(fns._planHitKind(10, undefined), '');
    assert.ok(html.includes('box-shadow: inset 0 -3px 0 var(--green)') && html.includes('rnp-cell-plan-hit--miss'),
        'dashboard CSS paints a bar under ЗАКАЗЫ without extra DOM');
    assert.ok(html.includes('rnp-cell-plan--set'),
        'filled plan cells (План заказ) get the Excel-yellow highlight');
    assert.ok(html.includes('overflow: hidden') && html.includes('.rnp-article-panel--wide'),
        'wide RNP head clips so photos cannot cover the sheet');
    assert.ok(rnpSrc.includes("m.key === 'orders_count' || m.key === 'sales_count'"),
        'plan-hit color applies to ЗАКАЗЫ and Продажи, not to План продаж leftover');
    assert.ok(rnpSrc.includes('rnp-cell-plan-hit rnp-cell-plan-hit--'),
        'day/week/total ЗАКАЗЫ cells get a plan-hit class, not a flex stack');
    assert.ok(!rnpSrc.includes('rnp-cell-stack') && !rnpSrc.includes('_planHitInner'),
        'plan-hit must not inject flex stacks into table cells');
    assert.ok(rnpSrc.includes('rnp-cell-plan--set'),
        'non-zero plan inputs get the yellow set class');
    assert.ok(rnpSrc.includes('if (!_isPhone()) return inner;'),
        'desktop Остатки stay in the header, not a floating overlay');
}

// Дашборд не имеет права рисовать оценочные финансы вместо отчёта WB.
{
    assert.ok(!/salesSum\s*=\s*Math\.round\(ordersSum\s*\*\s*0\.65\)/.test(html)
        && !html.includes('ordersCount>0?\'65%\':\'—\''),
        'dashboard must not derive sales/buyout from orders × 0.65');
    assert.ok(!html.includes('function computeQuickOrderMetrics') && !html.includes('function syncRNPTab'),
        'estimate-only metric helpers must be gone, not just unused');
    assert.ok(html.includes("supabase.rpc('dashboard_finance_rows'"),
        'finance rows come from the nightly cache, not a WB call per dashboard load');
    assert.ok(html.includes('id="dash-finance-note"') && html.includes('function financeCoverageNote'),
        'dashboard explains which days the finance report actually covers');

    const start = html.indexOf('function financeCoverageNote');
    const end = html.indexOf('function updateDashboardFromDB');
    assert.ok(start > 0 && end > start, 'financeCoverageNote must precede updateDashboardFromDB');
    const src = html.slice(html.indexOf('const DAY_MS = 86400000;'), end);
    const api = new Function(`${src}; return { financeCoverageNote, dashPluralDays };`)();

    assert.strictEqual(
        api.financeCoverageNote('2026-09-01', '2026-09-15', { from: '2026-09-01', to: '2026-09-15' }),
        '', 'полное покрытие — без плашки');
    const tail = api.financeCoverageNote('2026-09-01', '2026-09-15', { from: '2026-09-01', to: '2026-09-11' });
    assert.match(tail, /последние 4 дня/, 'недостающий хвост периода назван прямо');
    assert.match(tail, /11 сентября/);
    const oneDay = api.financeCoverageNote('2026-09-01', '2026-09-15', { from: '2026-09-01', to: '2026-09-14' });
    assert.match(oneDay, /за последний день/, 'один день не «за последние 1 день»');
    assert.match(
        api.financeCoverageNote('2026-09-01', '2026-09-15', { from: '2026-09-02', to: '2026-09-15' }),
        /первый день периода в отчёт не попал/);
    const head = api.financeCoverageNote('2026-09-01', '2026-09-15', { from: '2026-09-05', to: '2026-09-15' });
    assert.match(head, /первые 4 дня периода/);
    assert.strictEqual(api.financeCoverageNote('2026-09-01', '2026-09-15', {}), '');
    assert.strictEqual(api.dashPluralDays(11), '11 дней');
    assert.strictEqual(api.dashPluralDays(21), '21 день');
    assert.strictEqual(api.dashPluralDays(3), '3 дня');
}

// SETOF резался PostgREST на 1000 строк — у большого кабинета это была
// прибыль по восьмой части отчёта.
{
    const mig = fs.readFileSync(
        path.join(__dirname, 'supabase/migrations/20260916250000_finance_rows_grouped_jsonb.sql'), 'utf8');
    assert.ok(/create or replace function public\.dashboard_finance_rows[\s\S]*?returns jsonb/.test(mig),
        'dashboard_finance_rows must return one jsonb, not SETOF');
    assert.ok(mig.includes('group by'), 'rows must be pre-grouped so the payload stays small');
}

// Ночной синк должен просить у WB те поля, без которых дашборд считает нули.
{
    const src = fs.readFileSync(path.join(__dirname, 'supabase/functions/rnp-finance-sync/index.ts'), 'utf8');
    assert.ok(src.includes('fields: FINANCE_DASHBOARD_FIELDS'),
        'finance sync must ask WB for retailPrice/acquiringFee/bonusTypeName too');
}

// pg_cron носит прежний JWT service_role — сверка байт-в-байт даёт 401 и канал молчит.
for (const slug of ['advertising-sync', 'autobidder-run', 'check-campaigns-notify', 'daily-sales-report']) {
    const src = fs.readFileSync(path.join(__dirname, `supabase/functions/${slug}/index.ts`), 'utf8');
    assert.ok(src.includes('isServiceAuthorized'), `${slug} must accept both service_role keys`);
    assert.ok(!/bearer === serviceKey/.test(src), `${slug} must not compare the service key byte-for-byte`);
}
assert.ok(
    fs.readFileSync(path.join(__dirname, 'supabase/functions/advertising-sync/index.ts'), 'utf8')
        .includes('LIVE_CAMPAIGN_STATUSES'),
    'advertising-sync must skip finished campaigns so every cabinet fits the time budget'
);

// Пустой прошлый период рисовал «↑ 100%» — у нового кабинета весь дашборд
// выглядел как рекордный рост, хотя сравнивать было не с чем.
{
    const start = html.indexOf('function setMetricTrend');
    const end = html.indexOf('function clearAllMetricTrends');
    assert.ok(start > 0 && end > start, 'setMetricTrend must be in dashboard.html');
    const src = html.slice(start, end);
    assert.ok(!/curr > 0 \? 100/.test(src), 'рост с нуля нельзя выдавать за 100%');

    const setMetricTrend = new Function(`${src}; return setMetricTrend;`)();
    const fakeEl = () => ({
        textContent: 'старое',
        title: 'старое',
        className: 'metric-trend up',
        classList: { contains: () => false },
        hasAttribute: () => false,
    });

    const fromZero = fakeEl();
    setMetricTrend(fromZero, 120000, 0);
    assert.strictEqual(fromZero.textContent, '—', 'нет базы сравнения — прочерк, а не процент');
    assert.match(fromZero.title, /данных нет/, 'подсказка объясняет прочерк');
    assert.strictEqual(fromZero.className, 'metric-trend flat');

    const bothZero = fakeEl();
    setMetricTrend(bothZero, 0, 0);
    assert.strictEqual(bothZero.textContent, '', 'ноль к нулю — пусто');

    const grew = fakeEl();
    setMetricTrend(grew, 150, 100);
    assert.strictEqual(grew.textContent, '↑ 50.0%');
    assert.strictEqual(grew.title, '', 'подсказка от прошлого рендера не должна залипать');

    const noData = fakeEl();
    setMetricTrend(noData, 150, null);
    assert.strictEqual(noData.textContent, '');
    assert.strictEqual(noData.title, '');
}

// Тренды приезжают в два прохода (база, потом отчёт) — второй не должен
// стирать первый.
{
    const src = html.slice(
        html.indexOf('const METRIC_TREND_DEFS'),
        html.indexOf('function enrichMetricsWithStockExtras'));
    const touched = [];
    const applyMetricTrends = new Function('document', 'setMetricTrend',
        `${src}; return applyMetricTrends;`)(
        { querySelector: (sel) => ({ sel }) },
        (el, c, p) => touched.push([typeof el === 'string' ? el : el.sel, c, p]));

    applyMetricTrends({ ordersSum: 10 }, { ordersSum: 5 });
    assert.deepStrictEqual(touched, [['trend-m-orders-sum', 10, 5]],
        'проход из базы не трогает карточки финотчёта');

    touched.length = 0;
    applyMetricTrends({ profitFull: 7, realizationSum: null }, { profitFull: 4, realizationSum: 9 });
    assert.deepStrictEqual(touched, [['trend-m-profit', 7, 4], ['trend-m-realization', null, 9]],
        'проход по отчёту не трогает карточки из базы');
}

// Прошлый период для трендов по отчёту — окно той же длины, что реально закрыто.
{
    const start = html.indexOf('async function loadFinanceTrendBase');
    const end = html.indexOf('function dashPluralDays');
    assert.ok(start > 0 && end > start, 'loadFinanceTrendBase must exist');
    const src = html.slice(start, end);
    assert.ok(src.includes('prevPeriodRange(covered.from, covered.to)'),
        'сравнивать закрытые дни с окном той же длины, а не с полным месяцем');
    assert.ok(src.includes('loadFinanceRowsFromCache'), 'база тренда — только кеш');
    assert.ok(!src.includes('loadFinanceReport'), 'второй живой запрос в WB упрётся в лимит минуты');
    assert.ok(src.includes('dashboard_finance_coverage') && src.includes('cachedFrom > range.from'),
        'дырка в кеше не должна выглядеть как падение продаж');
}

// Только что подключённый кабинет показывал «0 сом» вместо «данные ещё едут».
{
    const start = html.indexOf('function updateDashboardFromDB');
    const body = html.slice(start, start + 2500);
    assert.ok(/const noDataYet = ordersCount === 0 && returns === 0 && Number\(totalStock\) === 0/.test(body),
        'пустой кабинет надо отличать от кабинета без продаж');
    assert.ok(/noDataYet \? '—' : fmtDashMoney\(ordersSum\)/.test(body), 'вместо нуля — прочерк');
    assert.ok(body.includes('Первая синхронизация после подключения токена'),
        'клиенту надо объяснить, почему пусто');
    assert.ok(html.includes('id="dash-data-note"') && html.includes('function showDataNote'),
        'плашка про сбор данных живёт отдельно от плашки про финотчёт');
}

// Остатки лежат только на сегодня — тренд по ним сравнивал число с самим собой.
{
    const start = html.indexOf('function updateDashboardFromDB');
    const body = html.slice(start, start + 2500);
    assert.ok(!/stockTotal: Number\(totalStock\)/.test(body),
        'не сравнивать остатки с теми же остатками');
    assert.ok(/else \{\s*clearAllMetricTrends\(\);/.test(body),
        'без прошлого периода тренды прошлого кабинета надо гасить');
}

// Страница грузит не исходники, а собранные /dist/<имя>.<хэш>.min.js. Правку в
// rnp-module.js однажды закоммитили без пересборки, и локально проверялся
// старый код: на проде Vercel собирает сам, а тут — то, что лежит в репозитории.
{
    const crypto = require('node:crypto');
    const esbuild = require('esbuild');
    const stale = [];
    for (const name of ['dashboard-charts.js', 'rnp-module.js', 'wb-formulas.js',
        'ads-command-center.js', 'goods-catalog.js', 'content-factory.js', 'nr-wow.js', 'dash-cabinet-plans.js', 'rnp-plan-fact.js']) {
        const built = esbuild.buildSync({
            entryPoints: [path.join(__dirname, name)],
            bundle: false, minify: true, format: 'iife', target: ['es2018'],
            write: false, logLevel: 'silent',
        }).outputFiles[0].contents;
        const hash = crypto.createHash('sha256').update(built).digest('hex').slice(0, 10);
        const expected = `${name.replace(/\.js$/, '')}.${hash}.min.js`;
        if (!html.includes(`/dist/${expected}`)) stale.push(name);
        else if (!fs.existsSync(path.join(__dirname, 'dist', expected))) stale.push(name + ' (нет файла)');
    }
    assert.deepStrictEqual(stale, [], 'dist отстал от исходников — запустите npm run build');
}

{
    const cf = fs.readFileSync(path.join(__dirname, 'content-factory.js'), 'utf8');
    const mig = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20260917200000_content_factory.sql'), 'utf8');
    const igPub = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/content-ig-publish.ts'), 'utf8');
    const igFn = fs.readFileSync(path.join(__dirname, 'supabase/functions/content-ig-publish/index.ts'), 'utf8');
    const tick = fs.readFileSync(path.join(__dirname, 'supabase/functions/_shared/content-publish-tick.ts'), 'utf8');
    assert.ok(html.includes('id="tab-content-factory"') && html.includes('id="cf-root"') && html.includes("data-tab=\"content-factory\""),
        'Контент-завод is a live tab with a root mount');
    assert.ok(html.includes('function bootContentFactory') && html.includes("'content-factory': '/content'"),
        'Контент-завод boots on /content and cabinet switch');
    assert.ok(!betaFly.includes("showTab('content-factory'"),
        'Контент-завод is on the rail, not duplicated in BETA');
    assert.ok(cf.includes("from('rnp_articles')") && cf.includes("callWb('content_cards'"),
        'calendar pulls articles from rnp_articles and photos/price via existing content_cards');
    assert.ok(cf.includes('pickCardByNmId') && cf.includes(".eq('nm_id', id)") && cf.includes('photosForNmId') && cf.includes('nmIds: [nm]') && !cf.includes('cards.map(parseWbCard)[0]'),
        'photos bind to exact nmId, never the first similar WB card');
    assert.ok(!cf.includes('data-cf="publish-now"') && cf.includes('data-cf="approve-post"') && cf.includes('Очередь') && cf.includes('Подтверждено') && cf.includes('Возврат в черновик'),
        'Instagram goes only through the confirmation queue after slide preview');
    assert.ok(!cf.includes('pipelineHtml') && !cf.includes('cf-pipe') && !cf.includes('developers.facebook.com') && !cf.includes('FACEBOOK_APP_ID') && !cf.includes('Схема публикации'),
        'no pipeline essay or Facebook setup dump in the tab');
    assert.ok(!html.includes('cf-pipe') && !html.includes('Схема публикации'),
        'dashboard CSS does not keep the pipeline diagram');
    const openSrc = cf.slice(cf.indexOf('function open('), cf.indexOf('const ContentFactory'));
    assert.ok(openSrc.includes('paint()') && openSrc.includes('needsReload') && !openSrc.includes('await reload()') && !openSrc.includes('loadIg'),
        'open() paints immediately and does not await reload or IG');
    const reloadSrc = cf.slice(cf.indexOf('async function reload('), cf.indexOf('async function pullArticleCard'));
    assert.ok(!reloadSrc.includes('loadIg') && reloadSrc.includes('loadArticles') && reloadSrc.includes('loadPosts'),
        'reload skips Instagram oauth');
    assert.ok(cf.includes('AbortController') && cf.includes('FN_TIMEOUT_MS') && cf.includes("action: 'status'"),
        'edge calls abort instead of hanging for minutes');
    assert.ok(cf.includes("kind: 'photo'") && cf.includes("photo: 'Фото'") && (cf.includes("s.kind === 'cover' || s.kind === 'photo'") || cf.includes('kind === \'cover\' || s.kind === \'photo\'')),
        'carousel adds plain photo slides');
    assert.ok(cf.includes('layoutSeoOverlays') && cf.includes('pickCardDescription') && cf.includes('cf-slide-cap') && cf.includes('dedupeSeoText') && cf.includes('SEO_HEADLINE_MAX'),
        'SEO description from the WB card is laid out onto slides without repeating words');
    assert.ok(mig.includes("'review'") && mig.includes('approved_at'),
        'posts need review/approval before cron or Graph publish');
    assert.ok(mig.includes('article_id uuid') && !mig.includes('article_id bigint'),
        'content_posts.article_id matches live rnp_articles.id (uuid)');
    assert.ok(mig.includes('create table if not exists public.content_posts') &&
        mig.includes('references public.rnp_articles(id)') &&
        mig.includes('create table if not exists public.bloggers') &&
        mig.includes('create table if not exists public.blogger_payouts') &&
        mig.includes('compute_blogger_payout_amount') &&
        mig.includes('token_secret_id') &&
        mig.includes('store_vault_secret') &&
        mig.includes("jobname = 'content_publish_tick'"),
        'schema covers calendar, bloggers, payouts, vault token slot and cron');
    assert.ok(igPub.includes("media_type: 'CAROUSEL'") && igPub.includes('is_carousel_item') && igPub.includes('media_publish'),
        'Instagram publish is container → carousel → publish');
    assert.ok(igFn.includes('approved_at') && igFn.includes('Подтверждено'),
        'Graph publish rejects posts without queue confirmation');
    assert.ok(tick.includes("if (deps.dryRun)") && tick.includes("action: 'would_publish'"),
        'scheduler dry_run does not publish to Instagram');
    assert.ok(
        fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8').includes('"/content"'),
        'Vercel rewrites /content to the dashboard'
    );
    assert.ok(
        fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8').includes('"/reports"'),
        'Vercel rewrites /reports to the dashboard'
    );
}

assert.ok(html.includes('data-theme="tabler"') && html.includes("NR_THEMES = ['ios', 'tabler', 'neon']"),
    'Tabler is a third theme and can be rolled back by cycling Тема');
assert.ok(html.includes('id="evidence-report-root"') && html.includes('EvidenceReport.paint'),
    'Сводный отчёт paints Evidence P&L from dashboard metrics');
assert.ok(
    /<script src="\/(?:dist\/)?evidence-report(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'evidence-report script is on the dashboard'
);
assert.ok(
    /<script src="\/(?:dist\/)?nr-wow(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'nr-wow script is on the dashboard'
);
assert.ok(
    html.includes('NrWow.withView') && html.includes('NrWow.tickSpan') && html.includes('NrWow.spotlight'),
    'tabs, KPI numbers and cards use the lightweight wow helpers'
);
assert.ok(
    fs.existsSync(path.join(__dirname, 'supabase/functions/_shared/content-carousel-templates.ts')),
    'carousel Satori templates live next to the PNG renderer'
);
assert.ok(html.includes("summary: '/reports'") && html.includes("'/reports': 'summary'"),
    '/reports opens the live summary tab');
assert.ok(
    html.includes('id="dash-plan-cabs"') && html.includes('id="dash-plan-skus"')
        && html.includes('id="m-dash-penalty"') && html.includes('openDashPlanSku'),
    'dashboard plan is the current cabinet, with SKU photos and penalties'
);
assert.ok(!html.includes('План заказов · все кабинеты'),
    'all-cabinets plan row is gone');
assert.ok(html.includes('main-content:has(#tab-dashboard.active)') && html.includes('padding: 4px 24px 16px'),
    'dashboard top padding is tight');
assert.ok(html.includes('.main-rail:has(#tab-dashboard.active)') && html.includes('padding-top: 66px'),
    'dashboard sits flush under the header');
assert.ok(
    /<script src="\/(?:dist\/)?dash-cabinet-plans(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'dash-cabinet-plans script is on the dashboard'
);
assert.ok(
    /<script src="\/(?:dist\/)?rnp-plan-fact(?:\.[0-9a-f]+)?(?:\.min)?\.js"><\/script>/.test(html),
    'rnp-plan-fact script is on the dashboard'
);

console.log('dashboard_html_test: ok');
