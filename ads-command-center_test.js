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
assert.equal(model.rows[0].campaigns[0].clusters[0].key, 'пиджак для женщин');
assert.equal(model.totals.active, 1);
assert.equal(model.totals.tokenBad, 1);

console.log('ads-command-center_test: ok');
