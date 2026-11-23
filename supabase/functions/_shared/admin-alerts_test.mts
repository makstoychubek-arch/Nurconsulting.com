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
// Обмен «Раздач» с Google, расход ChatGPT, вебхук Алины
const ext = { ...base().settings, giveaway_sync: { enabled: true, threshold: 30, value: null }, llm: { enabled: true, threshold: 80, value: null }, alina_hook: { enabled: true, threshold: 20, value: null } };
const okSheet = { name: 'ИП МАРС', error: null, last_sync: '2026-10-23T11:59:00Z' };
assert.deepEqual(buildAlerts(base({ settings: ext, sheets: [okSheet], llm: { costUsd: 1, budgetUsd: 10, lastError: null, lastErrorAt: null }, alinaHook: { pending: 0, error: null, errorAt: null } })), [], 'всё хорошо: тишина');
const gsErr = buildAlerts(base({ settings: ext, sheets: [{ ...okSheet, error: 'Лист не прочитался' }] }));
assert.equal(gsErr[0].key, 'giveaway_sync'); assert.ok(gsErr[0].text.includes('ИП МАРС: Лист не прочитался'));
const gsStale = buildAlerts(base({ settings: ext, sheets: [{ ...okSheet, last_sync: '2026-10-23T10:00:00Z' }] }));
assert.ok(gsStale[0].text.includes('давно нет обмена'), 'обмена не было больше 30 минут');
assert.equal(buildAlerts(base({ settings: { ...ext, giveaway_sync: { enabled: false, threshold: 30, value: null } }, sheets: [{ ...okSheet, error: 'x' }] })).length, 0, 'выключено: молчим');
const over = buildAlerts(base({ settings: ext, llm: { costUsd: 12, budgetUsd: 10, lastError: null, lastErrorAt: null } }));
assert.equal(over[0].fingerprint, 'over'); assert.ok(over[0].text.includes('Бюджет ChatGPT'));
const near = buildAlerts(base({ settings: ext, llm: { costUsd: 8.5, budgetUsd: 10, lastError: null, lastErrorAt: null } }));
assert.ok(near[0].text.includes('85%'), 'предупреждение при 80% бюджета');
assert.equal(buildAlerts(base({ settings: ext, llm: { costUsd: 5, budgetUsd: 0, lastError: null, lastErrorAt: null } })).length, 0, 'бюджет не задан: расход не тревожит');
const quota = buildAlerts(base({ settings: ext, llm: { costUsd: 1, budgetUsd: 0, lastError: 'insufficient_quota', lastErrorAt: '2026-10-23T11:30:00Z' } }));
assert.ok(quota[0].text.includes('закончились деньги на счёте OpenAI'));
assert.equal(buildAlerts(base({ settings: ext, llm: { costUsd: 1, budgetUsd: 0, lastError: 'insufficient_quota', lastErrorAt: '2026-10-20T11:30:00Z' } })).length, 0, 'старая ошибка не повторяется');
const hook = buildAlerts(base({ settings: ext, alinaHook: { pending: 40, error: 'Connection timed out', errorAt: '2026-10-23T11:50:00Z' } }));
assert.ok(hook[0].text.includes('в очереди 40') && hook[0].text.includes('Connection timed out'));
assert.equal(buildAlerts(base({ settings: ext, alinaHook: { pending: 3, error: 'старая', errorAt: '2026-10-23T09:00:00Z' } })).length, 0, 'старая ошибка вебхука не тревожит');
console.log('admin-alerts_test: ok');
