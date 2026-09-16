import assert from 'node:assert/strict';
import {
    bidToMinorUnits,
    buildClusterBoard,
    buildClusterItemsBody,
    buildClusterListBody,
    buildClusterStatsBody,
    buildMinusBody,
    buildPositionsBody,
    buildSetBidsBody,
    canSetClusterBids,
    chunkQueries,
    clusterBoardTotals,
    countClusterFilters,
    filterClusters,
    mergeClusterPositions,
    minusCandidates,
    nmIdsFromAdvert,
    parseClusterBids,
    parseClusterList,
    parseClusterStats,
    parseMinusList,
    parsePositionsReport,
    uniqueNmIds,
} from './wb-cluster-board.ts';

// normquery/list — единственная ручка с camelCase, остальные snake_case.
assert.deepEqual(buildClusterListBody(1825035, [983512347]), {
    items: [{ advertId: 1825035, nmId: 983512347 }],
});
assert.deepEqual(buildClusterItemsBody(1825035, [983512347]), {
    items: [{ advert_id: 1825035, nm_id: 983512347 }],
});
assert.deepEqual(buildClusterStatsBody(1825035, [983512347], '2026-09-10', '2026-09-16'), {
    from: '2026-09-10',
    to: '2026-09-16',
    items: [{ advert_id: 1825035, nm_id: 983512347 }],
});
assert.deepEqual(buildMinusBody(1825035, 983512347, [' свитер ', 'СВИТЕР', 'кофта', '']), {
    advert_id: 1825035,
    nm_id: 983512347,
    norm_queries: ['свитер', 'кофта'],
});

// Ставка уходит только в разменных единицах и кратно шагу кабинета.
assert.equal(bidToMinorUnits(750, 0), 75000);
assert.equal(bidToMinorUnits(750, 100), 75000);
assert.equal(bidToMinorUnits(7.5, 100), 800);
assert.equal(bidToMinorUnits(0, 100), 0);
assert.deepEqual(
    buildSetBidsBody([{ advertId: 1, nmId: 2, normQuery: 'свитер на одно плечо', bid: 420 }], 100),
    { bids: [{ advertId: 1, nmId: 2, normQuery: 'свитер на одно плечо', bidMinorUnits: 42000 }] },
);
assert.equal(buildSetBidsBody([{ advertId: 1, nmId: 2, normQuery: '', bid: 420 }]).bids.length, 0);
assert.equal(buildSetBidsBody([{ advertId: 1, nmId: 2, normQuery: 'свитер', bid: 0 }]).bids.length, 0);

// Ответы WB из примеров спеки.
const list = parseClusterList({
    items: [{
        advertId: 1,
        nmId: 1218782505,
        normQueries: {
            active: ['свитер на одно плечо'],
            excluded: ['футболка поло'],
            archived: ['поло мужское'],
        },
    }],
});
assert.deepEqual(list.get(1218782505), {
    active: ['свитер на одно плечо'],
    excluded: ['футболка поло'],
    archived: ['поло мужское'],
});

const stats = parseClusterStats({
    stats: [{
        advert_id: 1,
        nm_id: 1218782505,
        stats: [{
            norm_query: 'свитер на одно плечо',
            views: 1949, clicks: 100, atbs: 68, orders: 19, shks: 20,
            ctr: 5.13, cpc: 471, cpm: 813, avg_pos: 3.6, spend: 4710, currency: 'KGS',
        }],
    }],
});
assert.equal(stats.length, 1);
assert.equal(stats[0].avgPos, 3.6);
assert.equal(stats[0].atbs, 68);
assert.equal(stats[0].currency, 'KGS');

// CTR у оплаты за клик приходит null — считаем сами, а не показываем ноль.
const cpcStats = parseClusterStats({
    stats: [{ advert_id: 1, nm_id: 5, stats: [{ norm_query: 'кофта', views: 200, clicks: 10, ctr: null, cpm: null }] }],
});
assert.equal(Math.round(cpcStats[0].ctr ?? 0), 5);
assert.equal(cpcStats[0].cpm, null);

const bids = parseClusterBids({
    bids: [{ advert_id: 1, nm_id: 1218782505, norm_query: 'свитер на одно плечо', bid: 750, bid_kopecks: 75000, currency: 'KGS' }],
});
assert.equal(bids[0].bid, 750);
assert.equal(bids[0].bidMinorUnits, 75000);

const minus = parseMinusList({ items: [{ advert_id: 1, nm_id: 1218782505, norm_queries: ['футболка поло'] }] });
assert.deepEqual(minus.get(1218782505), ['футболка поло']);

// Склейка: статус из list, цифры из stats, ставка из get-bids, минус отдельным флагом.
const board = buildClusterBoard({ nmIds: [1218782505], list, stats, bids, minus });
const main = board.find((r) => r.normQuery === 'свитер на одно плечо');
assert.ok(main);
assert.equal(main.state, 'active');
assert.equal(main.bid, 750);
assert.equal(main.views, 1949);
assert.equal(main.avgPos, 3.6);
assert.equal(main.minus, false);

const excluded = board.find((r) => r.normQuery === 'футболка поло');
assert.equal(excluded?.state, 'excluded');
assert.equal(excluded?.minus, true);
assert.equal(board.find((r) => r.normQuery === 'поло мужское')?.state, 'archived');

// Кластер без статистики, но со ставкой, всё равно попадает в таблицу.
const onlyBid = buildClusterBoard({
    nmIds: [7],
    bids: parseClusterBids({ bids: [{ advert_id: 1, nm_id: 7, norm_query: 'джемпер', bid: 300, bid_kopecks: 30000 }] }),
});
assert.equal(onlyBid.length, 1);
assert.equal(onlyBid[0].views, 0);
assert.equal(onlyBid[0].bid, 300);

// Артикулы чужой кампании в таблицу не пускаем.
assert.equal(buildClusterBoard({ nmIds: [999], list, stats, bids, minus }).length, 0);

const counts = countClusterFilters(board);
assert.equal(counts.all, 3);
assert.equal(counts.managed, 1);
assert.equal(counts.active, 1);
assert.equal(counts.excluded, 1);
assert.equal(counts.archived, 1);
assert.equal(filterClusters(board, 'managed').length, 1);
assert.equal(filterClusters(board, 'all').length, 3);

const totals = clusterBoardTotals(board);
assert.equal(totals.clusters, 3);
assert.equal(totals.views, 1949);
assert.equal(totals.orders, 19);

// Расход без заказов — кандидат в минус-фразы.
const drain = buildClusterBoard({
    nmIds: [7],
    list: parseClusterList({ items: [{ advertId: 1, nmId: 7, normQueries: { active: ['кофта поло'] } }] }),
    stats: parseClusterStats({
        stats: [{ advert_id: 1, nm_id: 7, stats: [{ norm_query: 'кофта поло', views: 900, clicks: 12, orders: 0, spend: 2000 }] }],
    }),
});
assert.equal(minusCandidates(drain).length, 1);
assert.equal(minusCandidates(drain, 5000).length, 0);

// setBids v1 — только ручная ставка и оплата за показы.
assert.equal(canSetClusterBids('manual', 'cpm'), true);
assert.equal(canSetClusterBids('auto', 'cpm'), false);
assert.equal(canSetClusterBids('manual', 'cpc'), false);
assert.equal(canSetClusterBids(null, null), true);

// Позиции и частота по каждому ключу: POST /api/v2/search-report/product/orders.
assert.deepEqual(buildPositionsBody(1218782505, ['свитер', 'кофта'], '2026-09-10', '2026-09-16'), {
    period: { start: '2026-09-10', end: '2026-09-16' },
    nmId: 1218782505,
    searchTexts: ['свитер', 'кофта'],
});
// WB берёт максимум 30 фраз за запрос — режем и убираем дубли.
assert.equal(buildPositionsBody(1, Array.from({ length: 50 }, (_, i) => 'q' + i), 'a', 'b').searchTexts.length, 30);
assert.deepEqual(chunkQueries(['a', 'A', ' b ', '', 'c'], 2), [['a', 'b'], ['c']]);
assert.equal(chunkQueries(Array.from({ length: 65 }, (_, i) => 'q' + i)).length, 3);

const posReport = parsePositionsReport({
    data: {
        total: [{ dt: '2026-09-10', avgPosition: 22, orders: 1 }],
        items: [
            {
                text: 'свитер на одно плечо',
                frequency: 2727,
                dateItems: [
                    { dt: '2026-09-15', avgPosition: 4, orders: 1 },
                    { dt: '2026-09-16', avgPosition: 8, orders: 1 },
                ],
            },
            { text: 'джемперы', frequency: 0, dateItems: [] },
        ],
    },
});
assert.equal(posReport.length, 2);
assert.equal(posReport[0].frequency, 2727);
assert.equal(posReport[0].avgPosition, 6);
assert.equal(posReport[0].orders, 2);
assert.equal(posReport[1].avgPosition, null);

const withPos = mergeClusterPositions(
    buildClusterBoard({
        nmIds: [1218782505],
        list: parseClusterList({
            items: [{ advertId: 1, nmId: 1218782505, normQueries: { active: ['свитер на одно плечо', 'кофты'] } }],
        }),
    }),
    posReport,
);
const hit = withPos.find((r) => r.normQuery === 'свитер на одно плечо');
assert.equal(hit?.frequency, 2727);
assert.equal(hit?.searchPosition, 6);
assert.equal(hit?.searchOrders, 2);
// Кластер, по которому отчёта нет, остаётся без позиции, а не с нулём.
assert.equal(withPos.find((r) => r.normQuery === 'кофты')?.searchPosition, undefined);

// Реальная форма GET /api/advert/v2/adverts: артикулы лежат в nm_settings.
assert.deepEqual(nmIdsFromAdvert({
    id: 39829721,
    bid_type: 'manual',
    settings: { name: '1218782505 Поиск свитер айвори', payment_type: 'cpm' },
    nm_settings: [{ nm_id: 1218782505, bids_kopecks: { search: 75000 } }],
}), [1218782505]);
assert.deepEqual(nmIdsFromAdvert({ settings: { nms: [{ nm: 5 }, { nm: 5 }, { nm: 6 }] } }), [5, 6]);
assert.deepEqual(nmIdsFromAdvert({ nms: [7, 8] }), [7, 8]);
assert.deepEqual(nmIdsFromAdvert(null), []);

assert.deepEqual(uniqueNmIds([5, '5', 0, null, 7]), [5, 7]);
assert.equal(uniqueNmIds(Array.from({ length: 150 }, (_, i) => i + 1)).length, 100);

console.log('wb-cluster-board_test: ok');
