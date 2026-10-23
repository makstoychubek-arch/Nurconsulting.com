// Оповещения владельцу: что попадает в сообщение и когда его повторяют.
import assert from 'node:assert/strict';
import { buildAlerts, shouldSend, type AlertSnapshot } from './admin-alerts.ts';

const now = new Date('2026-10-23T12:00:00Z');
const base = (over: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
    now,
    settings: {
        ai_balance: { enabled: true, threshold: 5, value: 20 }, tokens: { enabled: true, threshold: null, value: null },
        sync: { enabled: true, threshold: 36, value: null }, jobs: { enabled: true, threshold: null, value: null },
        bots: { enabled: true, threshold: null, value: null }, db_full: { enabled: true, threshold: 80, value: null },
        access: { enabled: true, threshold: null, value: null },
    },
    cabinets: [{ id: 'c1', name: 'Zevina 1', nr_managed: true, has_wb: true, adv_ok: true, last_sync: '2026-10-23T11:00:00Z', sync_error: null }],
    jobs: [], bots: [], dbBytes: 400 * 1024 * 1024, planBytes: 8 * 1024 ** 3, access: [], ...over,
});

assert.deepEqual(buildAlerts(base()), [], 'всё хорошо: тишина');

const low = buildAlerts(base({ settings: { ...base().settings, ai_balance: { enabled: true, threshold: 5, value: 2.1 } } }));
assert.equal(low.length, 1);
assert.ok(low[0].text.includes('$2,10'), 'остаток ИИ в тексте');

const off = buildAlerts(base({ settings: { ...base().settings, ai_balance: { enabled: false, threshold: 5, value: 1 } } }));
assert.equal(off.length, 0, 'выключенное оповещение молчит');

const tok = buildAlerts(base({ cabinets: [{ id: 'c2', name: 'ИП Марс', nr_managed: true, has_wb: true, adv_ok: false, last_sync: '2026-10-23T11:00:00Z', sync_error: null }] }));
assert.ok(tok[0].text.includes('ИП Марс: токен рекламы не принят'));

const client = buildAlerts(base({ cabinets: [{ id: 'c3', name: 'Чужой', nr_managed: false, has_wb: false, adv_ok: false, last_sync: null, sync_error: 'x' }] }));
assert.equal(client.length, 0, 'кабинеты клиентов не пугают владельца');

const stale = buildAlerts(base({ cabinets: [{ id: 'c1', name: 'Zevina 1', nr_managed: true, has_wb: true, adv_ok: true, last_sync: '2026-10-20T00:00:00Z', sync_error: null }] }));
assert.equal(stale[0].key, 'sync');

const db = buildAlerts(base({ dbBytes: 7 * 1024 ** 3 }));
assert.ok(db[0].text.includes('88%'));

const acc = buildAlerts(base({ access: [{ id: 5, action: 'access_granted', target: 'Zevina 1', detail: 'aizada@example.com' }] }));
assert.ok(acc[0].text.includes('aizada@example.com → Zevina 1'));

assert.equal(shouldSend('', null, 'a', now), true, 'новая проблема: шлём');
assert.equal(shouldSend('a', '2026-10-23T11:45:00Z', 'a', now), false, 'то же самое: молчим');
assert.equal(shouldSend('a', '2026-10-22T10:00:00Z', 'a', now), true, 'больше суток: напоминание');
assert.equal(shouldSend('a', '2026-10-23T11:45:00Z', 'b', now), true, 'состав изменился: шлём');
assert.equal(shouldSend('a', '2026-10-23T11:45:00Z', '', now), false, 'проблем нет: молчим');
console.log('admin-alerts_test: ok');
