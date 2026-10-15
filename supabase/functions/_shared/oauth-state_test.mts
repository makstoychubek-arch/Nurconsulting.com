import assert from 'node:assert/strict';
import { signOAuthState, verifyOAuthState } from './oauth-state.ts';

const secret = 'test-secret-1';
const now = 1_800_000_000_000;

const s = await signOAuthState(secret, { cabinet_id: 'cab-1', uid: 'u-1' }, now);
const ok = await verifyOAuthState(secret, s, 15 * 60_000, now + 1000);
assert.equal(ok?.cabinet_id, 'cab-1');
assert.equal(ok?.uid, 'u-1');

// подмена cabinet_id в теле — подпись не сходится
const [body, sig] = s.split('.');
const forgedBody = Buffer.from(JSON.stringify({ cabinet_id: 'victim', uid: 'u-1', t: now })).toString('base64url');
assert.equal(await verifyOAuthState(secret, `${forgedBody}.${sig}`, 15 * 60_000, now), null, 'подмена тела');
// старый формат без подписи (btoa(JSON)) больше не принимается
assert.equal(await verifyOAuthState(secret, btoa(JSON.stringify({ cabinet_id: 'victim', t: now })), 15 * 60_000, now), null, 'старый формат');
// чужой секрет
assert.equal(await verifyOAuthState('other', s, 15 * 60_000, now), null, 'чужой секрет');
// срок жизни
assert.equal(await verifyOAuthState(secret, s, 15 * 60_000, now + 16 * 60_000), null, 'просрочен');
// мусор и пустой секрет
assert.equal(await verifyOAuthState(secret, 'abc', 15 * 60_000, now), null);
assert.equal(await verifyOAuthState('', s, 15 * 60_000, now), null);
assert.equal(body.length > 10, true);

console.log('oauth-state_test: ok');
