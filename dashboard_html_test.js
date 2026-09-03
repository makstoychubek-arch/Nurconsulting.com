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
    /class="rail-btn"[^>]*data-tab="rnp"/.test(html) || /data-tab="rnp"[^>]*data-flyout="fly-rnp"/.test(html),
    'RNP rail button must have data-tab="rnp" so one click opens the module'
);

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
assert.ok(html.includes('abtest-card-row'), 'A/B cards use WBRadar row layout');
assert.ok(html.includes('nr-early-tab-style'), 'RNP early-tab CSS id must exist for boot detection');
assert.ok(
    html.includes("if (document.getElementById('nr-early-tab-style'))"),
    'getCurrentActiveTab must treat early-tab CSS as RNP open'
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
assert.ok(rnpSrc.includes('_loadPlans(dateFrom, dateTo)'), 'plans must be loaded only for the visible calendar range');
assert.ok(/Promise\.all\(\[\s*_loadPlans\(dateFrom, dateTo\)/.test(rnpSrc), 'RNP loads plans/orders/stocks in parallel');

console.log('dashboard_html_test: ok');
