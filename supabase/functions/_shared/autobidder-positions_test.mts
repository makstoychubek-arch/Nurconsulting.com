import assert from 'node:assert/strict';
import {
    boundsFromCorridor,
    cacheIsFresh,
    clustersNeedingPositions,
    isDeadCluster,
    POSITION_CACHE_TTL_MIN,
    positionSignal,
    reportPeriod,
    type PositionCacheRow,
} from './autobidder-positions.ts';

// --- позиция берётся за последний день, а не как среднее за период
const report = {
    query: 'свитер',
    frequency: 65490,
    avgPosition: 9.4,
    orders: 4,
    days: [
        { date: '2026-09-10', avgPosition: 40, orders: 0 },
        { date: '2026-09-14', avgPosition: 22, orders: 1 },
        { date: '2026-09-16', avgPosition: 9, orders: 3 },
    ],
};
const sig = positionSignal(report, '2026-09-16');
assert.equal(sig.position, 9, 'нужен последний день, а не среднее 23.7');
assert.equal(sig.date, '2026-09-16');
assert.equal(sig.frequency, 65490);
assert.equal(sig.ordersInPeriod, 4);
assert.equal(sig.stale, false);

// Дни идут не по порядку — всё равно берём самый свежий.
assert.equal(positionSignal({
    ...report,
    days: [
        { date: '2026-09-16', avgPosition: 9, orders: 0 },
        { date: '2026-09-15', avgPosition: 12, orders: 0 },
    ],
}, '2026-09-16').position, 9);

// Дни без позиции пропускаем и спускаемся к предыдущему.
assert.equal(positionSignal({
    ...report,
    days: [
        { date: '2026-09-16', avgPosition: null, orders: 0 },
        { date: '2026-09-15', avgPosition: 14, orders: 0 },
    ],
}, '2026-09-16').position, 14);
// avgPosition = 0 у WB значит «не показывались», а не первое место.
assert.equal(positionSignal({
    ...report,
    days: [{ date: '2026-09-16', avgPosition: 0, orders: 0 }],
}, '2026-09-16').position, null);

// Слишком старую позицию не отдаём: лучше «не знаю», чем решение по прошлой неделе.
const old = positionSignal({
    ...report,
    days: [{ date: '2026-09-10', avgPosition: 5, orders: 0 }],
}, '2026-09-16');
assert.equal(old.position, null);
assert.equal(old.stale, true);
assert.equal(old.date, '2026-09-10', 'дату всё равно показываем, чтобы было видно причину');

assert.deepEqual(positionSignal(null, '2026-09-16'),
    { position: null, date: null, frequency: 0, ordersInPeriod: 0, stale: false });

// --- кластеры, которые никто не ищет
assert.equal(isDeadCluster({ position: null, date: null, frequency: 0, ordersInPeriod: 0, stale: false }), true);
// Частота 0, но заказы были — значит трогать можно, отчёт просто отстаёт.
assert.equal(isDeadCluster({ position: null, date: null, frequency: 0, ordersInPeriod: 2, stale: false }), false);
assert.equal(isDeadCluster({ position: 12, date: '2026-09-16', frequency: 0, ordersInPeriod: 0, stale: false }), false);
assert.equal(isDeadCluster({ position: 12, date: '2026-09-16', frequency: 900, ordersInPeriod: 0, stale: false }), false);

// --- границы ставки: правило важнее, коридор WB подставляется в пустоты
assert.deepEqual(boundsFromCorridor(50, 150, { min: 355, max: 750 }),
    { minBidFloor: 50, maxBid: 150 });
// Потолка в правиле нет — берём максимальный охват WB, а не бесконечность.
assert.deepEqual(boundsFromCorridor(50, null, { min: 355, max: 750 }),
    { minBidFloor: 50, maxBid: 750 });
// Пола в правиле нет — берём минимальный охват WB.
assert.deepEqual(boundsFromCorridor(0, null, { min: 355, max: 750 }),
    { minBidFloor: 355, maxBid: 750 });
// Коридора нет вообще — остаёмся на правиле.
assert.deepEqual(boundsFromCorridor(50, 150, null), { minBidFloor: 50, maxBid: 150 });
assert.deepEqual(boundsFromCorridor(0, null, null), { minBidFloor: 0, maxBid: null });
// Противоречивое правило: потолок ниже пола — тянем потолок до пола.
assert.deepEqual(boundsFromCorridor(500, 300, null), { minBidFloor: 500, maxBid: 500 });
// Нулевые значения от WB не считаем ставкой.
assert.deepEqual(boundsFromCorridor(0, null, { min: 0, max: 0 }), { minBidFloor: 0, maxBid: null });

// --- кеш
const now = Date.parse('2026-09-16T18:00:00Z');
assert.equal(cacheIsFresh('2026-09-16T17:00:00Z', now), true);
assert.equal(cacheIsFresh('2026-09-16T14:00:00Z', now), false);
assert.equal(cacheIsFresh(null, now), false);
assert.equal(cacheIsFresh('мусор', now), false);
assert.equal(cacheIsFresh('2026-09-16T17:00:00Z', now, 30), false);

const cache = new Map<string, PositionCacheRow>([
    ['свитер', { clusterKey: 'свитер', position: 9, date: '2026-09-16', frequency: 65490, fetchedAt: '2026-09-16T17:30:00Z' }],
    ['кофта женская', { clusterKey: 'кофта женская', position: 72, date: '2026-09-16', frequency: 169610, fetchedAt: '2026-09-16T10:00:00Z' }],
]);
assert.deepEqual(
    clustersNeedingPositions(['свитер', 'кофта женская', 'новый кластер'], cache, now),
    ['кофта женская', 'новый кластер'],
    'свежий кеш не перезапрашиваем, просроченный и новый — да',
);
// Регистр и дубли не должны плодить лишние запросы к лимитированной ручке.
assert.deepEqual(
    clustersNeedingPositions(['Свитер', 'свитер', '  ', 'НОВЫЙ', 'новый'], cache, now),
    ['НОВЫЙ'],
);
assert.equal(POSITION_CACHE_TTL_MIN, 180);

// --- период отчёта
assert.deepEqual(reportPeriod('2026-09-16'), { start: '2026-09-10', end: '2026-09-16' });
assert.deepEqual(reportPeriod('2026-01-03'), { start: '2025-12-28', end: '2026-01-03' });

console.log('autobidder-positions_test: ok');
