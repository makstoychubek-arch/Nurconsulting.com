'use strict';
const assert = require('node:assert/strict');
const AdsHQ = require('./ads-command-center.js');

assert.equal(typeof AdsHQ.buildHqModel, 'function');
assert.match(AdsHQ.formatMoney(4200), /4.200/);
assert.equal(AdsHQ.formatDrrLabel(AdsHQ.formatDrr(4200, 20000)), '21.0%');
assert.equal(AdsHQ.tokenState({ adv_token_valid: false }), 'bad');
assert.equal(AdsHQ.tokenState({ adv_token_valid: true, adv_token_secret_id: 'x' }), 'ok');
assert.equal(AdsHQ.ruleRangeStatus({ target_pos_from: 5, target_pos_to: 10 }, 7), 'in');
assert.equal(AdsHQ.ruleRangeStatus({ target_pos_from: 5, target_pos_to: 10 }, 15), 'worse');
assert.equal(AdsHQ.campaignTypeLabel(4), 'Каталог / полка');
assert.equal(AdsHQ.campaignTypeLabel(6), 'Поиск');
assert.equal(AdsHQ.campaignTypeLabel(8), 'Авто');
assert.equal(AdsHQ.campaignTypeLabel(9), 'Поиск + каталог');
assert.equal(AdsHQ.campaignTypeLabel('manual_bid'), 'Поиск + полка');
assert.equal(AdsHQ.campaignTypeLabel('auto_bid'), 'Авто');
assert.equal(AdsHQ.campaignStatusLabel(9), 'Идёт');
assert.equal(AdsHQ.campaignStatusLabel('paused'), 'Пауза');
assert.equal(AdsHQ.filterCampaigns([{ live: true }, { live: false }], 'active').length, 1);
assert.equal(AdsHQ.filterCampaigns([{ live: true }, { live: false }], 'all').length, 2);

const model = AdsHQ.buildHqModel({
    today: '2026-09-10',
    from7: '2026-09-04',
    cabinets: [
        { id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's', adv_daily_budget_cap: 8000 },
        { id: 'cab-b', name: 'Elium', adv_token_valid: false, adv_daily_budget_cap: 4000 },
    ],
    legacyCampaigns: [
        { cabinet_id: 'cab-a', campaign_id: 38634350, campaign_name: 'Пиджак', status: 9, type: 9 },
        { cabinet_id: 'cab-b', campaign_id: 1, campaign_name: 'Пауза', status: 11, type: 9 },
    ],
    legacyStats: [
        { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-10', spend: 4200, sum_price: 20000 },
        { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-09', spend: 800, sum_price: 5000 },
    ],
    v2Campaigns: [
        { id: 'camp-u', cabinet_id: 'cab-a', wb_campaign_id: 38634350, name: 'Пиджак', status: 'active', campaign_type: 'manual_bid' },
    ],
    clusters: [
        { id: 'cl-1', campaign_id: 'camp-u', cluster_key: 'пиджак для женщин', is_active: true, tier: 'orders' },
    ],
    rules: [
        { id: 'r1', campaign_id: 'camp-u', cluster_id: 'cl-1', target_pos_from: 5, target_pos_to: 10, max_bid: 500 },
    ],
    snapshots: [
        { campaign_id: 'camp-u', cluster_key: 'пиджак для женщин', ad_position: 15, captured_at: '2026-09-10T06:00:00Z' },
    ],
    v2Stats: [],
});

assert.equal(model.rows.length, 2);
assert.equal(model.rows[0].id, 'cab-a', 'sort: out-of-range first');
assert.equal(model.rows[0].outRange, 1);
assert.equal(model.rows[0].spendToday, 4200);
assert.equal(model.rows[0].campaigns[0].spendToday, 4200);
assert.equal(model.rows[0].campaigns[0].typeLabel, 'Поиск + каталог');
assert.equal(model.rows[0].campaigns[0].live, true);
assert.equal(model.rows[1].campaigns[0].live, false);
assert.equal(model.rows[0].campaigns[0].clusters[0].key, 'пиджак для женщин');
assert.equal(model.totals.active, 1);
assert.equal(model.totals.tokenBad, 1);

assert.equal(AdsHQ.setCabinet('cab-a'), 'cab-a');
assert.equal(AdsHQ.getFilterCabinetId(), 'cab-a');
assert.equal(AdsHQ.setCabinet(''), '');
assert.equal(AdsHQ.getFilterCabinetId(), '');

function fakeEl() {
    return {
        innerHTML: '',
        textContent: '',
        value: '',
        classList: { toggle() {}, add() {}, remove() {} },
        style: {},
        dataset: {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
}

const els = {
    'ads-hq-tbody': fakeEl(),
    'ads-hq-phone': fakeEl(),
    'ads-hq-kpis': fakeEl(),
    'ads-hq-freshness': fakeEl(),
};

global.document = {
    getElementById(id) { return els[id] || null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
};

(async () => {
    let synced = 0;
    const rowsByTable = {
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        advertising_campaigns: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, campaign_name: 'Пиджак', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 11, campaign_name: 'Пауза полка', status: 11, type: 4 },
        ],
        advertising_daily_stats: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-10', spend: 4200, sum_price: 20000 },
        ],
        adv_campaigns: [],
        adv_clusters: [],
        autobidder_rules: [],
        serp_position_snapshots: [],
        adv_daily_stats: [],
    };
    AdsHQ.init({
        fetchAllRows: async (table) => rowsByTable[table] || [],
        syncFromWb: async () => { synced += 1; },
    });
    AdsHQ.setCabinet('cab-a');
    await AdsHQ.load();
    assert.match(els['ads-hq-tbody'].innerHTML, /Пиджак/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Поиск \+ каталог/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Идёт/);
    assert.doesNotMatch(els['ads-hq-tbody'].innerHTML, /Пауза полка/);
    assert.doesNotMatch(els['ads-hq-tbody'].innerHTML, /Baza/);
    assert.match(els['ads-hq-phone'].innerHTML, /Пиджак/);
    assert.match(els['ads-hq-kpis'].innerHTML, /Активные полки/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /Сэкономлено/);
    assert.equal(synced, 0);

    AdsHQ.setCampFilter('all');
    assert.match(els['ads-hq-tbody'].innerHTML, /Пауза полка/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Каталог \/ полка/);

    AdsHQ.setCabinet('cab-empty');
    rowsByTable.cabinets = [{ id: 'cab-empty', name: 'Zevina' }];
    rowsByTable.advertising_campaigns = [];
    rowsByTable.advertising_daily_stats = [];
    await AdsHQ.load();
    assert.equal(synced, 1);
    assert.match(els['ads-hq-tbody'].innerHTML, /Подтянуть из WB/);
    assert.match(els['ads-hq-phone'].innerHTML, /Подтянуть из WB/);

    console.log('ads-command-center_test: ok');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
