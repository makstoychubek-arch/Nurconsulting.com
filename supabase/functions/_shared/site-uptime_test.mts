// Проверка «сайт жив»: тревога после двух неудач подряд, один раз, и сообщение о восстановлении.
import assert from 'node:assert/strict';
import { alertText, decide } from './site-uptime.ts';

const t0 = new Date('2026-10-06T10:00:00Z');
const up = { status: 'up' as const, failures: 0, since: '2026-10-01T00:00:00Z' };
const good = [{ name: 'Сайт', ok: true, detail: '200' }];
const bad = [{ name: 'Сайт', ok: false, detail: 'HTTP 502' }];

assert.equal(decide(up, good, t0).alert, null, 'всё хорошо: тишина');
const first = decide(up, bad, t0);
assert.equal(first.alert, null, 'одна неудача не тревога');
assert.equal(first.next.failures, 1);
const second = decide(first.next, bad, t0);
assert.equal(second.alert, 'down', 'вторая подряд: тревога');
assert.equal(second.next.status, 'down');
assert.equal(decide(second.next, bad, t0).alert, null, 'не повторяем тревогу');
const back = decide(second.next, good, new Date('2026-10-06T10:20:00Z'));
assert.equal(back.alert, 'recovered');
assert.equal(back.next.failures, 0);
assert.equal(decide(first.next, good, t0).next.failures, 0, 'случайная неудача сбрасывается');
assert.ok(alertText('down', bad, '2026-10-06T10:05:00Z').includes('HTTP 502'));
console.log('site-uptime_test: ok');
