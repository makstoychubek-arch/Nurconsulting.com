'use strict';
const assert = require('node:assert/strict');
const C = require('./adv-controls.js');

(async () => {
    // что реально поддерживает WB
    assert.deepEqual({ f: C.supports.finish, z: C.supports.setZones, l: C.supports.setLimit, a: C.supports.setAutoRefill }, { f: true, z: true, l: false, a: false });

    // ключ кампании
    assert.deepEqual(C.parseKey('cab-1:555'), { cab: 'cab-1', advertId: 555 });
    assert.equal(C.parseKey('555'), null);
    assert.equal(C.parseKey('cab:0'), null);

    // неподдерживаемое отклоняется честно
    await assert.rejects(C.setLimit('c:1', { on: true, amountKop: 100000, carryOver: false }), (e) => e.unsupported === true && /WB/.test(e.reason));
    await assert.rejects(C.setAutoRefill('c:1', true), (e) => e.unsupported === true);

    // зоны: только ручная ставка и cpm
    assert.equal(C.zonesAllowed({ paymentType: 'cpc' }), false);
    assert.equal(C.zonesAllowed({ paymentType: 'cpm', bidType: 'unified' }), false);
    assert.equal(C.zonesAllowed({ paymentType: 'cpm', bidType: 'manual' }), true);
    assert.equal(C.zonesAllowed(null), true);
    await assert.rejects(C.setZones('c:1', { search: false, recommendations: false }), (e) => e.invalid === true);
    await assert.rejects(C.setZones('c:1', { search: true }), (e) => e.invalid === true);
    C.register('c:2', { paymentType: 'cpc' });
    await assert.rejects(C.setZones('c:2', { search: true, recommendations: true }), (e) => e.unsupported === true);

    // оптимистичный результат сразу, очередь подставлена
    const inserted = [], invoked = [];
    let opsStatus = 'done';
    const fakeDb = {
        from(t) {
            const q = {
                insert(row) { inserted.push({ t, row }); return { select: () => Promise.resolve({ data: [{ id: 'op' + inserted.length }] }) }; },
                select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return Promise.resolve({ data: [{ kind: 'set_zones', payload: { search: true, recommendations: false }, status: 'done', created_at: '2026-10-31T10:00:00Z' }] }); },
            };
            return q;
        },
        functions: { invoke(n, o) { invoked.push({ n, o }); return Promise.resolve({}); } },
    };
    C.init({ supabase: fakeDb });
    C.register('c:3', { paymentType: 'cpm', bidType: 'manual', zones: { search: true, recommendations: true }, createdAt: '2026-01-01T00:00:00Z' });
    const t0 = Date.now();
    const r = await C.setZones('c:3', { search: true, recommendations: false });
    assert.ok(Date.now() - t0 < 100, 'ответ мгновенный');
    assert.equal(r.queued, true);
    assert.deepEqual(C.getState('c:3').zones, { search: true, recommendations: false });
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(inserted[0].t, 'adv_ops');
    assert.deepEqual(inserted[0].row, { cabinet_id: 'c', advert_id: 3, kind: 'set_zones', payload: { search: true, recommendations: false } });
    assert.equal(invoked[0].n, 'adv-ops-run');
    // повторное нажатие с тем же значением ничего не ставит в очередь
    assert.equal((await C.setZones('c:3', { search: true, recommendations: false })).queued, false);

    const f = await C.finish('c:4');
    assert.equal(f.queued, true);
    assert.equal(C.getState('c:4').status, 'finishing');
    await new Promise((res) => setTimeout(res, 20));
    assert.equal(inserted[1].row.kind, 'finish');
    assert.equal(inserted[1].row.advert_id, 4);

    // история
    const h = await C.history('c:3');
    assert.equal(h.source, 'nr-space');
    assert.equal(h.createdAt, '2026-01-01T00:00:00Z');
    assert.equal(h.items[0].text, 'Зоны показов: поиск включён, рекомендации выключены');
    assert.equal(C.describeOp({ kind: 'finish', status: 'error', last_error: 'x' }).statusText, 'не принято WB');

    console.log('adv-controls_test: ok');
    process.exit(0); // фоновый опрос очереди ждёт таймеры
})().catch((e) => { console.error(e); process.exit(1); });
