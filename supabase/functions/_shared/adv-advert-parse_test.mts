import assert from 'node:assert/strict';
import {
    allNmIds,
    campaignTypeFromWb,
    firstNmId,
    flattenAdverts,
    getBidsBody,
    listClustersBody,
    parseListClustersResponse,
    parseNmFromName,
    shouldSyncClusters,
} from './adv-advert-parse.ts';

const v2 = {
    adverts: [
        {
            id: 39497221,
            bid_type: 'manual',
            status: 9,
            settings: { name: 'СРС пиджак квадратный', payment_type: 'cpc' },
            nm_settings: [
                { nm_id: 409845462, subject: { name: 'пиджаки' } },
                { nm_id: 409845463 },
            ],
        },
        {
            id: 38634350,
            bid_type: 'manual',
            status: 9,
            settings: { name: '287679331 Поиск пиджак квадрат шоко2' },
        },
        {
            type: 9,
            status: 7,
            advert_list: [{ id: 2, bid_type: 'unified', status: 7, settings: { name: 'Единая' } }],
        },
    ],
};

const flat = flattenAdverts(v2);
assert.equal(flat.length, 3);
assert.equal(firstNmId(flat[0]), 409845462, 'nm_settings[0].nm_id');
assert.equal(firstNmId(flat[1]), 287679331, 'nm from campaign name');
assert.equal(parseNmFromName('287679331 Поиск'), 287679331);
assert.equal(parseNmFromName('Кампания от 23.03.2026'), 0);
assert.equal(firstNmId({ settings: { name: 'без артикула' } }), null);
assert.equal(campaignTypeFromWb(flat[0]), 'manual_bid');
assert.equal(campaignTypeFromWb(flat[2]), 'auto_bid');
assert.deepEqual(allNmIds(flat[0]), [409845462, 409845463]);
assert.equal(shouldSyncClusters(flat[0]), true);
assert.equal(shouldSyncClusters({ status: 11 }), false);
assert.equal(shouldSyncClusters({ status: 7, nm_settings: [{ nm_id: 287679331 }] }), true);
assert.equal(shouldSyncClusters(flat[2]), false);

assert.deepEqual(
    listClustersBody([{ advertId: 38634350, nmId: 287679331 }]),
    { items: [{ advertId: 38634350, nmId: 287679331 }] },
);
assert.deepEqual(
    getBidsBody([{ advertId: 38634350, nmId: 287679331 }]),
    { items: [{ advert_id: 38634350, nm_id: 287679331 }] },
);

const parsed = parseListClustersResponse({
    items: [{
        advertId: 38634350,
        nmId: 287679331,
        normQueries: {
            active: ['пиджак для женщин', 'пиджак женский коричневый'],
            excluded: ['жакет'],
            archived: ['поло мужское'],
        },
    }],
});
assert.equal(parsed.length, 1);
assert.equal(parsed[0].advertId, 38634350);
assert.equal(parsed[0].nmId, 287679331);
assert.deepEqual(parsed[0].active, ['пиджак для женщин', 'пиджак женский коричневый']);
assert.deepEqual(parsed[0].excluded, ['жакет', 'поло мужское']);

const emptyWrongBody = parseListClustersResponse({ items: [] });
assert.equal(emptyWrongBody.length, 0);

console.log('adv-advert-parse_test: ok');
