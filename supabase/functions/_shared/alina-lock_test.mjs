// Очередь обработки в одном чате: второе сообщение ждёт, пока закончится первое; зависшая запись не блокирует.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('./alina-telegram.ts', import.meta.url), 'utf8');
const a = src.indexOf('async function acquireChatLock'), b = src.indexOf('\n// Живой темп');
const fn = stripTypeScriptTypes(src.slice(a, b));

function fakeDb() {
  const rows = []; let id = 1; let clock = Date.now();
  const tick = () => new Date(clock++).toISOString().replace('Z', '+00:00');
  const db = { rows, from() {
    const f = { filters: [], ord: null, lim: 100 };
    const q = {
      insert(row) { const r = { id: id++, created_at: tick(), ...row }; rows.push(r); q._last = r; return q; },
      select() { return q; },
      maybeSingle: async () => ({ data: q._last ?? null }),
      eq(c, v) { f.filters.push((r) => r[c] === v); return q; },
      gt(c, v) { f.filters.push((r) => String(r[c]) > String(v)); return q; },
      order() { return q; }, limit(n) { f.lim = n; return q; },
      then(res) { res({ data: rows.filter((r) => f.filters.every((x) => x(r))).slice(0, f.lim) }); },
    };
    return q;
  } };
  return db;
}
const pacing = { sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))), lockWaitMs: 2000 };
const acquire = new Function('pacing', stripTypeScriptTypes('') + fn + '\nreturn acquireChatLock;')(pacing);

const db = fakeDb();
const order = [];
const A = (async () => { const rel = await acquire(db, 1, 100); order.push('A start'); await new Promise((r) => setTimeout(r, 60)); order.push('A end'); await rel(); })();
await new Promise((r) => setTimeout(r, 10));
const B = (async () => { const rel = await acquire(db, 1, 101); order.push('B start'); order.push('B end'); await rel(); })();
await Promise.all([A, B]);
assert.deepEqual(order, ['A start', 'A end', 'B start', 'B end'], 'второе сообщение ждёт первое');

// другой чат не ждёт
const db2 = fakeDb(); const o2 = [];
const X = (async () => { const rel = await acquire(db2, 1, 1); o2.push('X'); await new Promise((r) => setTimeout(r, 40)); await rel(); })();
await new Promise((r) => setTimeout(r, 5));
const Y = (async () => { const rel = await acquire(db2, 2, 2); o2.push('Y'); await rel(); })();
await Promise.all([X, Y]);
assert.deepEqual(o2, ['X', 'Y'].sort((p, q) => 0) && ['X', 'Y'], 'чаты независимы');

// зависшая запись (без proc_end) со временем перестаёт блокировать: ждём не больше lockWaitMs
const db3 = fakeDb();
db3.rows.push({ id: 999, created_at: new Date(Date.now() - 1000).toISOString().replace('Z', '+00:00'), event_type: 'proc_start', chat_id: 1, payload: { uid: 'stuck' } });
const t0 = Date.now();
const rel3 = await acquire(db3, 1, 5);
assert.ok(Date.now() - t0 <= 2600, 'не ждём вечно');
await rel3();
console.log('PASS: alina-lock');
