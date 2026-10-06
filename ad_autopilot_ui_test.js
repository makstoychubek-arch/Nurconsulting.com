// Автопилот ставок: блок в «Контроль РК», серверная функция и cron на месте, ставки меняются только при боевом режиме.
const fs = require('fs');
const assert = require('assert');
const ui = fs.readFileSync('ad-autopilot-ui.js', 'utf8');
new Function(ui); // файл должен хотя бы разбираться без синтаксических ошибок
const dash = fs.readFileSync('dashboard.html', 'utf8');
const fn = fs.readFileSync('supabase/functions/ad-autopilot/index.ts', 'utf8');
const mig = fs.readFileSync('supabase/migrations/20261006190000_ad_autopilot.sql', 'utf8');

assert.ok(dash.includes('id="ad-autopilot-card"') && /<script src="\/dist\/ad-autopilot-ui\.[0-9a-f]+\.min\.js"><\/script>|<script src="\/ad-autopilot-ui\.js"><\/script>/.test(dash), 'блок и скрипт на странице');
assert.ok(ui.includes("from('ad_autopilot_settings')") && ui.includes("from('ad_autopilot_campaigns')") && ui.includes("'ad-autopilot'"), 'настройки, кампании и запуск');
assert.ok(ui.includes("dry_run: mode !== 'live'") && ui.includes("enabled: mode !== 'off'"), 'по умолчанию режим пробный, боевой только осознанно');
assert.ok(mig.includes('dry_run       boolean not null default true') && mig.includes('enabled       boolean not null default false'), 'в базе по умолчанию выключен и пробный');
assert.ok(mig.includes('enable row level security') && mig.includes('can_access_cabinet'), 'доступ только к своим кабинетам');
assert.ok(fn.includes('if (!dry)') && fn.includes('setAdvertBids'), 'в пробном режиме ставки в WB не отправляются');
assert.ok(fn.includes("filterFeatureActive(admin, all || [], 'ads')"), 'уважает тумблер функции «РК и автоставки»');
assert.ok(fn.includes("payment_type === 'cpc'") && fn.includes('Number(a.status) === 9'), 'только работающие СРС, кампании не включаем и не выключаем');
assert.ok(!/\/adv\/v0\/(start|pause|stop|delete)/.test(fn), 'автопилот не включает и не выключает кампании');
const ads = fs.readFileSync('ads-command-center.js', 'utf8');
assert.ok(!ads.includes("'cpc'") || ads.includes('return \'\';'), 'переключатель авто убран');
assert.ok(!ui.includes('data-cid') && !ui.includes('adp-camps'), 'списка галочек больше нет');
assert.ok(ui.includes("from('ad_autopilot_campaigns').upsert") && ui.includes("from('ad_autopilot_campaigns').delete()"), 'переключатель пишет и убирает кампанию');
assert.ok(ui.includes('.adp-tg.on{background:#22c55e') && ui.includes('left:calc(50% - 8px)'), 'выключен: ползунок по центру, включён: зелёный');
console.log('ad_autopilot_ui_test: ok');
