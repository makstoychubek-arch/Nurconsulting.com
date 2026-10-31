import assert from 'node:assert/strict';
import { backoffSeconds, coalesceOps, friendlyWbError, isRetryable, sendBid, sendCreate, sendFinish, sendNms, sendZones, validateOp, type AdvOp } from './adv-ops.ts';

const op = (seq: number, kind: AdvOp['kind'], payload: Record<string, unknown>, advert = 111): AdvOp =>
    ({ id: 'i' + seq, seq, cabinet_id: 'c', advert_id: advert, kind, payload, attempts: 1 });

// проверка входных данных
assert.equal(validateOp(op(1, 'set_bid', { nm_id: 5, bid_kopecks: 42000, placement: 'search' })), null);
assert.match(validateOp(op(1, 'set_bid', { nm_id: 5, bid_kopecks: 10 })) || '', /пределов/);
assert.match(validateOp(op(1, 'set_bid', { nm_id: 5, bid_kopecks: 99_000_000 })) || '', /пределов/);
assert.match(validateOp(op(1, 'set_bid', { bid_kopecks: 500 })) || '', /артикул/i);
assert.match(validateOp({ kind: 'set_bid', advert_id: null, payload: { nm_id: 1, bid_kopecks: 500 } }) || '', /кампании/);
assert.equal(validateOp(op(1, 'add_nm', { nms: [1, 2] })), null);
assert.match(validateOp(op(1, 'add_nm', { nms: [] })) || '', /товаров/);
assert.match(validateOp(op(1, 'remove_nm', { nms: Array.from({ length: 51 }, (_, i) => i + 1) })) || '', /товаров/);
assert.equal(validateOp({ kind: 'create', advert_id: null, payload: { name: 'Свитер', nms: [1], payment_type: 'cpc', bid_type: 'manual' } }), null);
assert.match(validateOp({ kind: 'create', advert_id: null, payload: { name: '', nms: [1] } }) || '', /названия/);
assert.match(validateOp({ kind: 'create', advert_id: null, payload: { name: 'a', nms: [1], payment_type: 'x' } }) || '', /оплаты/);

// склейка: от пяти нажатий «+» уходит одна ставка, последняя
const ops = [
    op(1, 'set_bid', { nm_id: 5, bid_kopecks: 41000, placement: 'search' }),
    op(2, 'set_bid', { nm_id: 5, bid_kopecks: 42000, placement: 'search' }),
    op(3, 'add_nm', { nms: [9] }),
    op(4, 'set_bid', { nm_id: 5, bid_kopecks: 43000, placement: 'search' }),
    op(5, 'set_bid', { nm_id: 6, bid_kopecks: 30000, placement: 'search' }),
    op(6, 'set_bid', { nm_id: 5, bid_kopecks: 20000, placement: 'recommendations' }),
];
const c = coalesceOps(ops);
assert.deepEqual(c.run.map((o) => o.seq), [3, 4, 5, 6]);
assert.deepEqual(c.superseded.map((o) => o.seq), [1, 2]);
assert.deepEqual(coalesceOps([...ops].reverse()).run.map((o) => o.seq), [3, 4, 5, 6], 'порядок входа не важен');

// повторы
assert.deepEqual([1, 2, 3, 4, 5, 9].map(backoffSeconds), [30, 120, 300, 900, 1800, 1800]);
assert.equal(isRetryable({ ok: false, status: 429, body: '' }), true);
assert.equal(isRetryable({ ok: false, status: 503, body: '' }), true);
assert.equal(isRetryable({ ok: false, status: 400, body: '' }), false);
assert.equal(isRetryable({ ok: false, status: 403, body: '' }), false);
assert.match(friendlyWbError({ ok: false, status: 403, body: '' }), /Токен WB/);
assert.match(friendlyWbError({ ok: false, status: 400, body: 'bad nm' }), /bad nm/);

// запросы в WB
const calls: { url: string; method: string; body: any; auth: string }[] = [];
let answers: number[] = [200];
const fake = async (url: string, init: RequestInit) => {
    calls.push({ url, method: String(init.method), body: init.body ? JSON.parse(String(init.body)) : null, auth: String((init.headers as any).Authorization) });
    const st = answers.shift() ?? 200;
    return new Response(st === 200 ? '12345' : 'no', { status: st });
};
await sendBid(fake, 'TOKEN', op(1, 'set_bid', { nm_id: 5, bid_kopecks: 41999.6, placement: 'combined' }));
assert.equal(calls[0].url, 'https://advert-api.wildberries.ru/api/advert/v1/bids');
assert.deepEqual(calls[0].body, { bids: [{ advert_id: 111, nm_bids: [{ nm_id: 5, bid_kopecks: 42000, placement: 'combined' }] }] });
assert.equal(calls[0].auth, 'TOKEN');
calls.length = 0; answers = [404, 200];
const r = await sendBid(fake, 'T', op(1, 'set_bid', { nm_id: 5, bid_kopecks: 500 }));
assert.equal(r.ok, true);
assert.equal(calls[1].url, 'https://advert-api.wildberries.ru/adv/v1/bids', 'запасной путь при 404');
calls.length = 0; answers = [200];
await sendNms(fake, 'T', 111, [1, 2], []);
assert.deepEqual(calls[0].body, { nms: [{ advert_id: 111, nms: { add: [1, 2] } }] });
calls.length = 0;
await sendNms(fake, 'T', 111, [], [7]);
assert.deepEqual(calls[0].body, { nms: [{ advert_id: 111, nms: { delete: [7] } }] });
calls.length = 0;
const cr = await sendCreate(fake, 'T', { name: ' Свитер ', nms: ['5', 6], payment_type: 'cpc', bid_type: 'manual' });
assert.deepEqual(calls[0].body, { name: 'Свитер', nms: [5, 6], bid_type: 'manual', payment_type: 'cpc', placement_types: ['search'] });
assert.equal(cr.data, 12345);
calls.length = 0;
await sendCreate(fake, 'T', { name: 'a', nms: [1], bid_type: 'unified' });
assert.equal('placement_types' in calls[0].body, false, 'для единой ставки места не задаются');

// завершение и зоны показов
assert.equal(validateOp(op(1, 'finish', {})), null);
assert.match(validateOp({ kind: 'finish', advert_id: null, payload: {} }) || '', /кампании/);
assert.equal(validateOp(op(1, 'set_zones', { search: true, recommendations: false })), null);
assert.equal(validateOp(op(1, 'set_zones', { search: false, recommendations: true })), null);
assert.match(validateOp(op(1, 'set_zones', { search: false, recommendations: false })) || '', /хотя бы одна/);
assert.match(validateOp(op(1, 'set_zones', { search: true })) || '', /Поиск/);
// дневной лимит и автопополнение WB не поддерживает: такие операции очередь не принимает
assert.match(validateOp(op(1, 'set_limit' as any, { amount_kopecks: 100 })) || '', /не поддерживает/);
assert.match(validateOp(op(1, 'set_autorefill' as any, { on: true })) || '', /не поддерживает/);
const z = coalesceOps([
    op(1, 'set_zones', { search: true, recommendations: false }),
    op(2, 'set_zones', { search: true, recommendations: true }),
    op(3, 'set_zones', { search: true, recommendations: false }, 222),
    op(4, 'finish', {}),
]);
assert.deepEqual(z.run.map((o) => o.seq), [2, 3, 4]);
assert.deepEqual(z.superseded.map((o) => o.seq), [1]);
assert.match(friendlyWbError({ ok: false, status: 422, body: '' }), /уже/);

calls.length = 0; answers = [200];
await sendFinish(fake, 'TOKEN', 777);
assert.equal(calls[0].url, 'https://advert-api.wildberries.ru/adv/v0/stop?id=777');
assert.equal(calls[0].method, 'GET');
assert.equal(calls[0].body, null);
assert.equal(calls[0].auth, 'TOKEN');
calls.length = 0;
await sendZones(fake, 'TOKEN', 111, true, false);
assert.equal(calls[0].url, 'https://advert-api.wildberries.ru/adv/v0/auction/placements');
assert.equal(calls[0].method, 'PUT');
assert.deepEqual(calls[0].body, { placements: [{ advert_id: 111, placements: { search: true, recommendations: false } }] });

console.log('adv-ops_test: ok');
