// А/Б-тест: показы по окнам из замеров накопленной статистики РК.
import assert from 'node:assert/strict';
import { attributeSnapshots, extractNmCumulative, takeAdSnapshots, type Snap } from './ab-adv-snapshots.ts';

const T0 = Date.parse('2026-10-06T10:00:00Z');
const at = (sec: number) => new Date(T0 + sec * 1000);
const snap = (sec: number, views: number, extra: Partial<Snap> = {}): Snap => ({
    campaign_id: 1, taken_at: at(sec), stat_date: '2026-10-06', views, clicks: Math.round(views / 10), atbs: 0, orders: 0, spend: views * 0.5, ...extra,
});

// ── extractNmCumulative: берём только свой товар, суммируем по площадкам
const day = { apps: [
    { nms: [{ nmId: 7, views: 10, clicks: 2, atbs: 1, orders: 0, sum: 5 }, { nmId: 8, views: 99, clicks: 9 }] },
    { nms: [{ nmId: 7, views: 5, clicks: 1, atbs: 0, orders: 1, sum: 2.5 }] },
] };
assert.deepEqual(extractNmCumulative(day, 7), { views: 15, clicks: 3, atbs: 1, orders: 1, spend: 7.5 });
assert.deepEqual(extractNmCumulative({}, 7), { views: 0, clicks: 0, atbs: 0, orders: 0, spend: 0 }, 'нет данных = нули');

// ── Прирост делится по окнам; ротация через 10 с после замера уводит почти всё на новое фото
const windows = [
    { label: '1', start: at(-1800), end: at(10) },
    { label: '2', start: at(10), end: at(7200) },
];
const res = attributeSnapshots([snap(0, 100), snap(600, 160), snap(1200, 220)], windows);
const total = (res.get('1')?.impressions || 0) + (res.get('2')?.impressions || 0);
assert.ok(Math.abs(total - 120) < 1e-6, 'весь прирост разнесён, ничего не потеряно и не добавлено');
assert.ok((res.get('1')?.impressions || 0) < 1.5, 'старое фото получает лишь доли за 10 секунд');
assert.ok((res.get('2')?.impressions || 0) > 118, 'новое фото получает почти весь прирост');

// ── Реальные окна, а не время: ночью (мало показов) 7,5 ч дают меньше, чем вечером за 1,25 ч
const night = attributeSnapshots(
    [snap(0, 0), snap(27000, 1200)], [{ label: 'N', start: at(0), end: at(27000) }],
);
const evening = attributeSnapshots(
    [snap(0, 0), snap(4500, 1440)], [{ label: 'E', start: at(0), end: at(4500) }],
);
assert.equal(Math.round(night.get('N')!.impressions), 1200);
assert.equal(Math.round(evening.get('E')!.impressions), 1440, 'больше показов за меньшее время: время не делит показы');

// ── Смена дня: счётчик нового дня начинается с нуля
const roll = attributeSnapshots(
    [snap(0, 1000, { stat_date: '2026-10-05' }), snap(600, 40, { stat_date: '2026-10-06' })],
    [{ label: 'X', start: at(0), end: at(600) }],
);
assert.equal(Math.round(roll.get('X')!.impressions), 40);

// ── Счётчик «упал» (WB пересчитал): прирост 0, не отрицательный
const drop = attributeSnapshots([snap(0, 500), snap(600, 450)], [{ label: 'X', start: at(0), end: at(600) }]);
assert.equal(drop.get('X')?.impressions ?? 0, 0);

// ── Несколько кампаний суммируются по отдельности
const multi = attributeSnapshots(
    [snap(0, 10, { campaign_id: 1 }), snap(600, 30, { campaign_id: 1 }), snap(0, 100, { campaign_id: 2 }), snap(600, 105, { campaign_id: 2 })],
    [{ label: 'X', start: at(0), end: at(600) }],
);
assert.equal(Math.round(multi.get('X')!.impressions), 25);

// ── takeAdSnapshots: сбор с подставным WB и подставной базой
function fakeAdmin(opts: { recent?: any[]; token?: string } = {}) {
    const inserted: any[] = [];
    const from = (table: string) => {
        const q: any = {
            select: () => q, in: () => q, gte: () => q,
            insert: async (rows: any[]) => { inserted.push(...rows); return { error: null }; },
            then: (res: any) => res({
                data: table === 'ab_test_adv_snapshots' ? (opts.recent || [])
                    : [{ id: 'cab1', name: 'K', wb_token: opts.token ?? 'x'.repeat(60), wb_token_promotion: null }],
                error: null,
            }),
        };
        return q;
    };
    return { admin: { from }, inserted };
}
const test = (extra: any = {}) => ({
    id: 'T1', cabinet_id: 'cab1', nm_id: 7, status: 'active',
    settings: { sources: { ads: true }, campaigns: [11] }, ...extra,
});
const now = () => new Date('2026-10-06T10:00:00Z');
const wbOk = (json: unknown) => async () => new Response(JSON.stringify(json), { status: 200 });

{
    const { admin, inserted } = fakeAdmin();
    const rep = await takeAdSnapshots(admin, [test()], {
        now, fetchFn: wbOk([{ advertId: 11, days: [{ date: '2026-10-06T00:00:00+03:00', apps: [{ nms: [{ nmId: 7, views: 42, clicks: 3, atbs: 1, orders: 0, sum: 12.5 }] }] }] }]) as any,
    });
    assert.equal(rep.taken, 1);
    assert.equal(inserted[0].views, 42);
    assert.equal(inserted[0].stat_date, '2026-10-06');
    assert.equal(inserted[0].spend, 12.5);
}
{
    const { admin, inserted } = fakeAdmin();
    await takeAdSnapshots(admin, [test()], { now, fetchFn: wbOk([{ advertId: 11, days: [] }]) as any });
    assert.equal(inserted[0].views, 0, 'нет строки за сегодня = точка отсчёта с нулями');
}
{
    const { admin, inserted } = fakeAdmin({ recent: [{ test_id: 'T1', taken_at: now().toISOString() }] });
    const rep = await takeAdSnapshots(admin, [test()], { now, fetchFn: wbOk([]) as any });
    assert.equal(rep.taken, 0); assert.equal(rep.skipped, 1); assert.equal(inserted.length, 0, 'чаще раза в 2 минуты не снимаем');
}
{
    const { admin, inserted } = fakeAdmin();
    const rep = await takeAdSnapshots(admin, [test()], { now, fetchFn: (async () => new Response('x', { status: 429 })) as any });
    assert.equal(rep.taken, 0); assert.ok(rep.errors[0].includes('429')); assert.equal(inserted.length, 0, 'лимит WB не роняет и ничего не пишет');
}
{
    const { admin } = fakeAdmin();
    const rep = await takeAdSnapshots(admin, [test({ status: 'finished' }), test({ settings: { sources: { ads: false }, campaigns: [11] } }), test({ settings: { sources: { ads: true }, campaigns: [] } })], { now, fetchFn: wbOk([]) as any });
    assert.equal(rep.taken, 0, 'неактивные, без рекламы и без РК не снимаем');
}
{
    const { admin } = fakeAdmin({ token: '' });
    const rep = await takeAdSnapshots(admin, [test()], { now, fetchFn: wbOk([]) as any });
    assert.ok(rep.errors[0].includes('токена'), 'без токена продвижения причина понятна');
}

console.log('ab-adv-snapshots_test: ok');
