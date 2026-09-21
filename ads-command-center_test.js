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
assert.equal(AdsHQ.campaignStatusLabel(9), 'Активна');
assert.equal(AdsHQ.campaignStatusLabel('paused'), 'Приостановлена');
assert.equal(AdsHQ.nmIdFromName('1218782505 СПМ Айвори'), 1218782505);
assert.equal(AdsHQ.nmIdFromName('247350276 СРС Укороч Костюм'), 247350276);
assert.equal(AdsHQ.nmIdFromName('Кампания от 23.03.2026'), 0);
assert.equal(AdsHQ.nmIdFromName('РК 35179140'), 35179140);
assert.deepEqual(AdsHQ.nmIdsFromDayData({
    apps: [{ nms: [{ nmId: 247350276 }, { nmId: 247350276 }] }],
}), [247350276, 247350276]);
assert.match(AdsHQ.campPhotoUrl(1218782505), /basket-44\.wbbasket\.ru\/vol12187\/part1218782\/1218782505/);
assert.equal(AdsHQ.campPhotoUrl(1, 'https://img.example/main.webp'), 'https://img.example/main.webp');
assert.equal(AdsHQ.campThumbHtml('', 1), '');
assert.match(AdsHQ.campThumbHtml('https://img.example/main.webp', 1218782505), /ads-hq-thumb/);
assert.match(AdsHQ.campThumbHtml('https://img.example/main.webp', 1218782505), /data-nmid="1218782505"/);
assert.equal(AdsHQ.filterCampaigns([{ live: true }, { live: false }], 'active').length, 1);
assert.equal(AdsHQ.filterCampaigns([{ live: true }, { live: false }], 'all').length, 2);
assert.equal(AdsHQ.filterCampaigns([
    { live: true, name: 'Пиджак', wbId: 1 },
    { live: true, name: 'Юбка', wbId: 2 },
], 'all', 'пидж').length, 1);
assert.equal(AdsHQ.campaignEnded({ status: 7 }), true);
assert.equal(AdsHQ.campaignEnded({ status: 'done' }), true);
assert.equal(AdsHQ.campaignEnded({ status: -1 }), true);
assert.equal(AdsHQ.campaignEnded({ status: 8 }), true);
assert.equal(AdsHQ.campaignEnded({ status: 11 }), false);
assert.equal(AdsHQ.campaignEnded({ status: 4 }), false);
assert.equal(AdsHQ.campaignEnded({ live: false }), false);
assert.deepEqual(AdsHQ.filterCampaigns([
    { live: true, status: 9, name: 'Идёт' },
    { live: false, status: 11, name: 'Пауза' },
    { live: false, status: 4, name: 'Готова' },
    { live: false, status: 7, name: 'Завершена' },
    { live: false, status: -1, name: 'Удалена' },
    { live: false, status: 8, name: 'Отклонена' },
], 'all').map((c) => c.name).sort(), ['Готова', 'Идёт', 'Пауза']);
assert.equal(AdsHQ.filterCampaigns([{ live: false, status: 7 }], 'active').length, 0);
assert.equal(AdsHQ.filterCampaigns([{ live: false, status: 7 }], 'all').length, 0);

{
    const ext = AdsHQ.extendRangeForRanking({ from: '2026-09-10', to: '2026-09-10' }, new Date(2026, 8, 10));
    assert.equal(ext.yesterday, '2026-09-09');
    assert.equal(ext.from, '2026-09-09');
    assert.equal(ext.to, '2026-09-10');
}

{
    const used = AdsHQ.buildHqModel({
        from: '2026-09-10',
        to: '2026-09-10',
        yesterday: '2026-09-09',
        now: new Date(2026, 8, 10),
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 1, campaign_name: 'Старая', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 2, campaign_name: 'Вчерашняя', status: 11, type: 9 },
        ],
        legacyStats: [
            { cabinet_id: 'cab-a', campaign_id: 1, stat_date: '2026-09-10', spend: 100, sum_price: 1000 },
            { cabinet_id: 'cab-a', campaign_id: 2, stat_date: '2026-09-09', spend: 800, sum_price: 4000 },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
    });
    assert.equal(used.rows[0].campaigns[0].name, 'Вчерашняя');
    assert.equal(used.rows[0].campaigns[0].usedYesterday, true);
    assert.equal(used.rows[0].campaigns[0].spendToday, 0, 'yesterday spend stays out of the picked day KPI');
    assert.equal(used.rows[0].spendToday, 100);
    const visible = AdsHQ.filterCampaigns(used.rows[0].campaigns, 'all');
    assert.equal(visible[0].name, 'Вчерашняя');
    assert.equal(AdsHQ.filterCampaigns(used.rows[0].campaigns, 'all', 'вчераш').length, 1);
    assert.equal(AdsHQ.filterCampaigns(used.rows[0].campaigns, 'active').length, 1);
    assert.equal(AdsHQ.filterCampaigns(used.rows[0].campaigns, 'active')[0].name, 'Старая');
}

{
    const ended = AdsHQ.buildHqModel({
        from: '2026-09-10',
        to: '2026-09-10',
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 1, campaign_name: 'Живая', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 2, campaign_name: 'Готовая', status: 4, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 3, campaign_name: 'Пауза', status: 11, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 4, campaign_name: 'Завершена', status: 7, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 5, campaign_name: 'Удалена', status: -1, type: 9 },
        ],
        legacyStats: [
            { cabinet_id: 'cab-a', campaign_id: 1, stat_date: '2026-09-10', spend: 100, sum_price: 1000 },
            { cabinet_id: 'cab-a', campaign_id: 4, stat_date: '2026-09-10', spend: 900, sum_price: 0 },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
    });
    assert.equal(ended.rows[0].spendToday, 100, 'finished RK spend stays out of the WB-style cabinet KPI');
    assert.equal(ended.rows[0].campaigns.length, 5, 'model keeps ended rows for spend');
    const visibleAll = AdsHQ.filterCampaigns(ended.rows[0].campaigns, 'all');
    assert.deepEqual(visibleAll.map((c) => c.name).sort(), ['Готовая', 'Живая', 'Пауза']);
    assert.equal(AdsHQ.filterCampaigns(ended.rows[0].campaigns, 'active').length, 1);
    const cabItems = AdsHQ.collectScheduleItems(
        [{ kind: 'cabinet', cabinetId: 'cab-a' }],
        ended
    );
    assert.deepEqual(cabItems.map((c) => c.wbId).sort(), [1, 2, 3]);
}

{
    const camp = {
        spendToday: 9204.17, views: 22160, clicks: 659, orders: 4, atbs: 50,
        revenue7: 15936, searchPos: 5, canceled: 0,
    };
    assert.equal(AdsHQ.formatMetric(camp, 'ctr'), '2.97 %');
    assert.equal(AdsHQ.formatMetric(camp, 'cpc'), '13.97');
    assert.equal(AdsHQ.formatMetric(camp, 'cpo'), '2\u00a0301.04');
    assert.equal(AdsHQ.formatMetric(camp, 'cr'), '0.61');
    assert.equal(AdsHQ.formatMetric(camp, 'cpm'), '415.35');
    assert.equal(AdsHQ.formatMetric(camp, 'roas'), '1.73');
    assert.equal(AdsHQ.formatMetric(camp, 'drr'), '57.76 %');
    assert.equal(AdsHQ.formatMetric(camp, 'orders'), '4');
    assert.equal(AdsHQ.formatMetric(camp, 'clicks'), '659');
    assert.equal(AdsHQ.formatMetric(camp, 'atbs'), '50');
    assert.equal(AdsHQ.formatMetric(camp, 'revenue'), '15\u00a0936');
    assert.equal(AdsHQ.formatMetric(camp, 'pos'), '5');
    assert.equal(AdsHQ.formatMetric(camp, 'budget'), 'Н/Д');
    const empty = { spendToday: 0, views: 0, clicks: 0, orders: 0, atbs: 0, revenue7: 0 };
    assert.equal(AdsHQ.formatMetric(empty, 'spend'), 'Н/Д');
    assert.equal(AdsHQ.formatMetric(empty, 'ctr'), 'Н/Д');
}

{
    const wb = AdsHQ.buildHqModel({
        from: '2026-09-20',
        to: '2026-09-20',
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 40302705, campaign_name: '296564448 Поиск коричневый', status: 9, type: 9, payment_type: 'cpm', bid_type: 'auto' },
            { cabinet_id: 'cab-a', campaign_id: 1, campaign_name: 'Завершена', status: 7, type: 9 },
        ],
        legacyStats: [
            {
                cabinet_id: 'cab-a', campaign_id: 40302705, stat_date: '2026-09-20',
                spend: 9204.17, views: 22160, clicks: 659, atbs: 50, orders: 4, sum_price: 15936,
                data: { canceled: 0, boosterStats: [{ avg_position: 5, nm: 296564448 }] },
            },
            { cabinet_id: 'cab-a', campaign_id: 1, stat_date: '2026-09-20', spend: 900, views: 100, clicks: 10, orders: 0, sum_price: 0 },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
        articles: [{
            cabinet_id: 'cab-a', nm_id: 296564448, photo_url: 'https://img.example/brown.webp',
            name: 'Поиск', manual_data: { seller_article: 'Поиск коричневый', price: 4880 },
        }],
        stocks: [{ cabinet_id: 'cab-a', nm_id: 296564448, quantity: 646 }],
    });
    assert.equal(wb.rows[0].spendToday, 9204.17);
    assert.equal(wb.rows[0].revenue7, 15936);
    assert.equal(Number(wb.rows[0].ctr.toFixed(2)), 2.97);
    assert.equal(Number(wb.rows[0].roas.toFixed(2)), 1.73);
    const row = wb.rows[0].campaigns.find((c) => c.wbId === 40302705);
    assert.equal(row.paymentType, 'cpm');
    assert.equal(row.bidType, 'auto');
    assert.equal(row.searchPos, 5);
    assert.equal(row.price, 4880);
    assert.equal(row.stock, 646);
    assert.equal(row.canceled, 0);
    assert.equal(row.live, true);
}

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
assert.equal(model.rows[0].spendToday, 5000);
assert.equal(model.rows[0].spend7, 5000);
assert.equal(model.rows[0].campaigns[0].spendToday, 5000);
assert.equal(model.rows[0].campaigns[0].typeLabel, 'Поиск + каталог');
assert.equal(model.rows[0].campaigns[0].live, true);
assert.equal(model.rows[1].campaigns[0].live, false);
assert.equal(model.rows[0].campaigns[0].clusters[0].key, 'пиджак для женщин');
assert.equal(model.rows[0].campaigns[0].nmId, 0, 'campaign_id is not an nmId');
assert.equal(model.rows[0].campaigns[0].photoUrl, '');
assert.equal(model.totals.active, 1);
assert.equal(model.totals.tokenBad, 1);

assert.equal(AdsHQ.parseScheduleAt('', new Date('2026-09-17T10:00:00Z')).error, 'empty');
assert.equal(AdsHQ.parseScheduleAt('2026-09-17T09:00', new Date('2026-09-17T10:00:00')).error, 'past');
{
    const at = AdsHQ.parseScheduleAt('2026-12-01T09:00', new Date('2026-09-17T10:00:00'));
    assert.ok(at.at instanceof Date);
}
assert.match(AdsHQ.defaultScheduleLocal(new Date(2026, 8, 17, 14, 20, 0)), /2026-09-17T15:00/);
{
    const items = AdsHQ.collectScheduleItems([
        { kind: 'campaign', cabinetId: 'cab-a', wbId: 38634350 },
        { kind: 'cluster', cabinetId: 'cab-a', wbId: 38634350, cluster: 'x' },
        { kind: 'cabinet', cabinetId: 'cab-b' },
    ], model);
    assert.equal(items.length, 2);
    assert.equal(items[0].wbId, 38634350);
    assert.equal(items[1].cabinetId, 'cab-b');
}
{
    const day = AdsHQ.buildHqModel({
        from: '2026-09-10',
        to: '2026-09-10',
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, campaign_name: 'Пиджак', status: 9, type: 9 },
        ],
        legacyStats: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-10', spend: 4200, sum_price: 20000 },
            { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-09', spend: 800, sum_price: 5000 },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
    });
    assert.equal(day.rows[0].spendToday, 4200, 'one day keeps only that day');
    const miss = AdsHQ.buildHqModel({
        from: '2026-09-01',
        to: '2026-09-02',
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, campaign_name: 'Пиджак', status: 9, type: 9 },
        ],
        legacyStats: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-10', spend: 4200, sum_price: 20000 },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
    });
    assert.equal(miss.rows[0].spendToday, 0, 'stats outside the picked range must not leak in');
}

{
    const photos = AdsHQ.buildHqModel({
        from: '2026-09-10',
        to: '2026-09-10',
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 39829721, campaign_name: '1218782505 СПМ Айвори', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 39497226, campaign_name: 'СРС Укороч Костюм', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 35179140, campaign_name: 'Кампания от 23.03.2026', status: 9, type: 9 },
            { cabinet_id: 'cab-a', campaign_id: 11, campaign_name: 'Пиджак', status: 9, type: 9 },
        ],
        legacyStats: [
            {
                cabinet_id: 'cab-a', campaign_id: 35179140, stat_date: '2026-09-10', spend: 1, sum_price: 10,
                data: { apps: [{ nms: [{ nmId: 296564448 }] }] },
            },
            {
                cabinet_id: 'cab-a', campaign_id: 39497226, stat_date: '2026-09-10', spend: 1, sum_price: 10,
                data: { apps: [{ nms: [{ nmId: 247350276 }] }] },
            },
        ],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
        articles: [
            {
                cabinet_id: 'cab-a', nm_id: 1218782505, photo_url: 'https://img.example/ivory.webp',
                name: 'Свитер', manual_data: { seller_article: 'СПМ Айвори' },
            },
            {
                cabinet_id: 'cab-a', nm_id: 11, photo_url: 'https://img.example/wrong.webp',
                name: 'Не то',
            },
            {
                cabinet_id: 'cab-a', nm_id: 777000111, photo_url: 'https://img.example/jacket.webp',
                name: 'Пиджак женский', manual_data: { seller_article: 'Пиджак' },
            },
        ],
    });
    const byName = Object.fromEntries(photos.rows[0].campaigns.map((c) => [c.name, c]));
    assert.equal(byName['1218782505 СПМ Айвори'].nmId, 1218782505);
    assert.equal(byName['1218782505 СПМ Айвори'].photoUrl, 'https://img.example/ivory.webp');
    assert.notEqual(byName['1218782505 СПМ Айвори'].nmId, 39829721);
    assert.equal(byName['СРС Укороч Костюм'].nmId, 247350276);
    assert.match(byName['СРС Укороч Костюм'].photoUrl, /247350276\/images\/c246x328\/1\.webp/);
    assert.equal(byName['Кампания от 23.03.2026'].nmId, 296564448);
    assert.equal(byName['Пиджак'].nmId, 777000111);
    assert.equal(byName['Пиджак'].photoUrl, 'https://img.example/jacket.webp');
    const nameless = AdsHQ.buildHqModel({
        cabinets: [{ id: 'cab-a', name: 'Baza', adv_token_valid: true, adv_token_secret_id: 's' }],
        legacyCampaigns: [
            { cabinet_id: 'cab-a', campaign_id: 35179140, campaign_name: '', status: 9, type: 9 },
        ],
        legacyStats: [],
        v2Campaigns: [],
        clusters: [],
        rules: [],
        snapshots: [],
        v2Stats: [],
        articles: [],
    });
    assert.equal(nameless.rows[0].campaigns[0].name, 'РК 35179140');
    assert.equal(nameless.rows[0].campaigns[0].nmId, 0, 'WB campaign id must not become nmId');
    assert.equal(nameless.rows[0].campaigns[0].photoUrl, '');
}
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
    'ads-hq-thead': fakeEl(),
    'ads-hq-phone': fakeEl(),
    'ads-hq-kpis': fakeEl(),
    'ads-hq-freshness': fakeEl(),
    'ads-hq-start-at': fakeEl(),
    'ads-hq-schedule': fakeEl(),
    'ads-hq-products-tbody': fakeEl(),
    'ads-hq-camps-wrap': fakeEl(),
    'ads-hq-products-wrap': fakeEl(),
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
            { cabinet_id: 'cab-a', campaign_id: 38634350, campaign_name: 'Пиджак', status: 9, type: 9, payment_type: 'cpm', bid_type: 'auto' },
            { cabinet_id: 'cab-a', campaign_id: 11, campaign_name: 'Пауза полка', status: 11, type: 4, payment_type: 'cpc', bid_type: 'manual' },
        ],
        advertising_daily_stats: [
            { cabinet_id: 'cab-a', campaign_id: 38634350, stat_date: '2026-09-10', spend: 4200, sum_price: 20000, views: 2000, clicks: 80, atbs: 12, orders: 3 },
        ],
        rnp_articles: [
            {
                cabinet_id: 'cab-a', nm_id: 777000111, photo_url: 'https://img.example/jacket.webp',
                name: 'Пиджак женский', manual_data: { seller_article: 'Пиджак' },
            },
        ],
        adv_campaigns: [],
        adv_clusters: [],
        autobidder_rules: [],
        serp_position_snapshots: [],
        adv_daily_stats: [],
        adv_start_schedule: [],
    };
    const inserted = [];
    let proxyCalls = 0;
    const supabase = {
        from(table) {
            assert.equal(table, 'adv_start_schedule');
            const ctx = { filters: {} };
            const api = {
                select() { return api; },
                eq(col, val) { ctx.filters[col] = val; return api; },
                maybeSingle: async () => ({ data: null, error: null }),
                update(row) {
                    ctx.row = row;
                    return api;
                },
                insert(row) {
                    inserted.push(row);
                    rowsByTable.adv_start_schedule = inserted.map((r, i) => ({ id: 's' + i, ...r }));
                    return Promise.resolve({ error: null });
                },
                then(resolve, reject) {
                    return Promise.resolve({ error: null }).then(resolve, reject);
                },
            };
            return api;
        },
    };
    AdsHQ.init({
        fetchAllRows: async (table) => rowsByTable[table] || [],
        syncFromWb: async () => { synced += 1; },
        supabase,
        callWbProxy: async () => { proxyCalls += 1; throw new Error('must not start now'); },
        showPremiumModal() {},
        getDateRange: () => ({ from: '2026-09-04', to: '2026-09-10' }),
    });
    AdsHQ.setCabinet('cab-a');
    await AdsHQ.load();
    assert.match(els['ads-hq-tbody'].innerHTML, /Пиджак/);
    assert.match(els['ads-hq-tbody'].innerHTML, /ads-hq-thumb/);
    assert.match(els['ads-hq-tbody'].innerHTML, /img\.example\/jacket\.webp/);
    assert.match(els['ads-hq-tbody'].innerHTML, /ads-hq-camp-name/);
    assert.match(els['ads-hq-phone'].innerHTML, /ads-hq-thumb/);
    assert.match(els['ads-hq-tbody'].innerHTML, /CPM/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Единая/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Активна/);
    assert.match(els['ads-hq-tbody'].innerHTML, /4.200/);
    assert.match(els['ads-hq-thead'].innerHTML, /Созданные заказы/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Пауза полка/, 'WB list shows paused campaigns by default');
    assert.doesNotMatch(els['ads-hq-tbody'].innerHTML, /Baza/);
    assert.match(els['ads-hq-phone'].innerHTML, /Пиджак/);
    assert.match(els['ads-hq-phone'].innerHTML, /Затраты/);
    assert.match(els['ads-hq-kpis'].innerHTML, /Сумма заказов/);
    assert.match(els['ads-hq-kpis'].innerHTML, /Затраты/);
    assert.match(els['ads-hq-kpis'].innerHTML, /Доля затрат/);
    assert.match(els['ads-hq-kpis'].innerHTML, /ROAS/);
    assert.match(els['ads-hq-kpis'].innerHTML, /CTR/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /Подменный артикул/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /Активные полки/);
    assert.match(els['ads-hq-kpis'].innerHTML, /4.00 %/);
    assert.match(els['ads-hq-kpis'].innerHTML, /21.00 %/);
    assert.match(els['ads-hq-kpis'].innerHTML, /4.76/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /Расход сегодня/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /ДРР 7д/);
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, /Сэкономлено/);
    assert.equal(synced, 0);

    AdsHQ.setCampFilter('active');
    assert.doesNotMatch(els['ads-hq-tbody'].innerHTML, /Пауза полка/);
    AdsHQ.setCampFilter('all');
    assert.match(els['ads-hq-tbody'].innerHTML, /Пауза полка/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Приостановлена/);
    assert.match(els['ads-hq-tbody'].innerHTML, /CPC/);
    assert.match(els['ads-hq-tbody'].innerHTML, /Ручная/);

    AdsHQ.setColPreset('funnel');
    assert.match(els['ads-hq-thead'].innerHTML, /Доля затрат/);
    assert.match(els['ads-hq-thead'].innerHTML, /Клики/);
    assert.match(els['ads-hq-thead'].innerHTML, /Сумма заказов/);
    AdsHQ.setColPreset('unit');
    assert.match(els['ads-hq-thead'].innerHTML, /CPC/);
    assert.match(els['ads-hq-thead'].innerHTML, /ROAS/);
    assert.match(els['ads-hq-thead'].innerHTML, /Отмены технические/);
    AdsHQ.setColPreset('stats');
    assert.match(els['ads-hq-thead'].innerHTML, /Созданные заказы/);

    AdsHQ.setSearch('пиджак');
    assert.match(els['ads-hq-tbody'].innerHTML, /Пиджак/);
    assert.doesNotMatch(els['ads-hq-tbody'].innerHTML, /Пауза полка/);
    AdsHQ.setSearch('нет-такой-рк');
    assert.match(els['ads-hq-tbody'].innerHTML, /Нет кампаний по запросу/);
    AdsHQ.setSearch('');
    assert.match(els['ads-hq-tbody'].innerHTML, /Пауза полка/);

    els['ads-hq-start-at'].value = '2026-12-01T09:00';
    const scheduled = await AdsHQ.scheduleStart([
        { kind: 'campaign', cabinetId: 'cab-a', wbId: 11 },
    ]);
    assert.equal(scheduled.ok, true);
    assert.equal(proxyCalls, 0, 'schedule must not call WB start');
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].status, 'pending');
    assert.equal(inserted[0].campaign_id, 11);
    assert.equal(inserted[0].cabinet_id, 'cab-a');
    assert.match(els['ads-hq-schedule'].innerHTML, /Пауза полка/);
    assert.match(els['ads-hq-tbody'].innerHTML, /ads-hq-when/);
    assert.match(els['ads-hq-phone'].innerHTML, /ads-hq-check/);

    AdsHQ.setCabinet('cab-empty');
    assert.match(els['ads-hq-kpis'].innerHTML, /—/, 'stale active count must clear as soon as the cabinet changes');
    assert.doesNotMatch(els['ads-hq-kpis'].innerHTML, />1</);
    assert.match(els['ads-hq-tbody'].innerHTML, /Загрузка кампаний/);
    rowsByTable.cabinets = [{ id: 'cab-empty', name: 'Zevina' }];
    rowsByTable.advertising_campaigns = [];
    rowsByTable.advertising_daily_stats = [];
    await AdsHQ.load();
    assert.equal(synced, 0, 'empty cabinet reads the DB only; WB sync is a button');
    assert.match(els['ads-hq-tbody'].innerHTML, /Подтянуть из WB/);
    assert.match(els['ads-hq-phone'].innerHTML, /Подтянуть из WB/);
    assert.match(els['ads-hq-kpis'].innerHTML, />0</);

    console.log('ads-command-center_test: ok');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
