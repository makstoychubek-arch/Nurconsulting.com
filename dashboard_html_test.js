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
assert.ok(html.includes('id="rail-settings-btn"'), 'settings must be a small button under the profile');
const settingsIdx = html.indexOf('id="rail-settings-btn"');
const userIdx = html.indexOf('id="rail-user-name"');
assert.ok(userIdx !== -1 && settingsIdx > userIdx, 'settings button must sit under the profile block');
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
assert.ok(rnpSrc.includes("functions.invoke('rnp-finance-sync'"), 'RNP «Обновить из WB» must go through the rnp-finance-sync edge function');
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
assert.ok(!rnpSrc.includes('pin.style.height'), 'marquee pin height must not follow leftTh — that loop grows photos');
assert.ok(!rnpSrc.includes('leftTh?.offsetWidth'), 'frozen width must not follow the KPI colspan');
assert.ok(rnpSrc.includes('acc += FROZEN_COL_W'), 'sticky week offsets stay on design widths, not measured growth');
assert.ok(rnpSrc.includes('MARQUEE_CARD_MAX_H'), 'photo cards must cap height so they do not grow on each resize');
assert.ok(rnpSrc.includes('MARQUEE_REPS_MAX'), 'marquee must not clone photos without a cap');
assert.ok(rnpSrc.includes('_marqueeRo.observe(scroll)'), 'resize observer watches the scroller only, not the left header');
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
assert.ok(rnpSrc.includes('<div class="rnp-cat-tabs">${tabsHtml}</div>'), 'every category in the RNP tab bar must show its article tabs');
assert.ok(!rnpSrc.includes('lite ? true'), 'lite mode must not force-collapse every article group');
assert.ok(rnpSrc.includes('function _isCatCollapsed(cat) {\n        return false;'), 'article groups stay open so variants are clickable in RNP');
assert.ok(rnpSrc.includes('const DAY_COL_W = 54'), 'day cells must fit sums like 137 020');
assert.ok(rnpSrc.includes('const FROZEN_COL_W = 54'), 'week/ИТОГ cells must match the wider day grid');
assert.ok(html.includes('--rnp-day-w: 54px'), 'CSS day column width must match JS');
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

assert.ok(html.includes('id="m-stock-fbo"') && html.includes('id="m-stock-fbs"'),
    'dashboard must show FBO and FBS stock KPIs separately');
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

console.log('dashboard_html_test: ok');
