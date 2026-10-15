// Проверка service-auth: подделанный JWT service_role не проходит, настоящий — только если подпись принимает платформа.
import assert from 'node:assert/strict';

const env: Record<string, string> = { SUPABASE_URL: 'https://example.invalid', SERVICE_ROLE_KEY: 'alt-key' };
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };
let gatewayCalls = 0;
let gatewayAnswer = 401;
(globalThis as any).fetch = async () => { gatewayCalls++; return new Response(null, { status: gatewayAnswer }); };

const { isServiceAuthorized, looksLikeServiceRoleJwt } = await import('./service-auth.ts');

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown, sig = 'AAAA') => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.${sig}`;
const req = (t?: string) => new Request('https://x.invalid/fn', { method: 'POST', headers: t ? { Authorization: `Bearer ${t}` } : {} });

const forged = jwt({ role: 'service_role', ref: 'fiukyfyhotctvfdidktx' });
assert.equal(looksLikeServiceRoleJwt(forged), true, 'предфильтр пропускает по полям');
assert.equal(looksLikeServiceRoleJwt(jwt({ role: 'anon', ref: 'fiukyfyhotctvfdidktx' })), false);
assert.equal(looksLikeServiceRoleJwt(jwt({ role: 'service_role', ref: 'other' })), false);

assert.equal(await isServiceAuthorized(req(), 'real-key'), false, 'без токена');
assert.equal(await isServiceAuthorized(req('real-key'), 'real-key'), true, 'ключ из окружения');
assert.equal(await isServiceAuthorized(req('alt-key'), 'real-key'), true, 'запасной ключ');
assert.equal(await isServiceAuthorized(req('abc'), 'real-key'), false, 'случайная строка');
assert.equal(gatewayCalls, 0, 'для обычных строк платформу не дёргаем');

gatewayAnswer = 401;
assert.equal(await isServiceAuthorized(req(forged), 'real-key'), false, 'подделка с мусорной подписью: платформа отвечает 401');
assert.equal(gatewayCalls, 1);
assert.equal(await isServiceAuthorized(req(forged), 'real-key'), false);
assert.equal(gatewayCalls, 1, 'отказ запоминается на минуту');

gatewayAnswer = 200;
const real = jwt({ role: 'service_role', ref: 'fiukyfyhotctvfdidktx', iat: 1 }, 'SIG');
assert.equal(await isServiceAuthorized(req(real), 'real-key'), true, 'платформа приняла подпись');
assert.equal(await isServiceAuthorized(req(real), 'real-key'), true);
assert.equal(gatewayCalls, 2, 'принятие запоминается');

(globalThis as any).fetch = async () => { throw new Error('network'); };
assert.equal(await isServiceAuthorized(req(jwt({ role: 'service_role', ref: 'fiukyfyhotctvfdidktx', n: 2 })), 'real-key'), false, 'сеть недоступна — отказ');

console.log('service-auth_test: ok');
