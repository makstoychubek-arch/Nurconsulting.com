import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isServiceAuthorized } from './service-auth.ts';

function req(headers: Record<string, string>): Request {
  return new Request('https://example.test', { headers });
}

Deno.test('isServiceAuthorized: exact service key', () => {
  assertEquals(isServiceAuthorized(req({ Authorization: 'Bearer secret-key' }), 'secret-key'), true);
  assertEquals(isServiceAuthorized(req({ Authorization: 'Bearer other' }), 'secret-key'), false);
});

Deno.test('isServiceAuthorized: legacy service_role JWT for this project', () => {
  const payload = btoa(JSON.stringify({ role: 'service_role', ref: 'fiukyfyhotctvfdidktx' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.sig`;
  assertEquals(isServiceAuthorized(req({ Authorization: `Bearer ${jwt}` }), 'other-secret'), true);
});

Deno.test('isServiceAuthorized: setup key only when allowed', () => {
  assertEquals(isServiceAuthorized(req({ 'X-NR-Setup-Key': 'nrspace-test-fiukyfy' }), 'secret'), false);
  assertEquals(isServiceAuthorized(req({ 'X-NR-Setup-Key': 'nrspace-test-fiukyfy' }), 'secret', true), true);
});
