import assert from 'node:assert/strict';
const env: Record<string, string> = {};
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };
const { geminiConfigured, geminiRequest, geminiChat } = await import('./gemini-fallback.ts');

assert.equal(geminiConfigured(), false);
assert.deepEqual(await geminiChat([{ role: 'user', content: 'x' }]), { ok: false, text: '', promptTokens: 0, completionTokens: 0, error: 'no_gemini_key' });

env.GEMINI_API_KEY = '  abc  ';
assert.equal(geminiConfigured(), true);
const r = geminiRequest([{ role: 'user', content: 'привет' }], { maxTokens: 100, json: true });
assert.equal(r.url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
const h = r.init.headers as Record<string, string>;
assert.equal(h.Authorization, 'Bearer abc');
const b = JSON.parse(String(r.init.body));
assert.equal(b.model, 'gemini-flash-lite-latest'); assert.equal(b.max_tokens, 100); assert.deepEqual(b.response_format, { type: 'json_object' });
env.GEMINI_MODEL = 'gemini-3.5-flash-lite';
assert.equal(JSON.parse(String(geminiRequest([]).init.body)).model, 'gemini-3.5-flash-lite');
console.log('gemini-fallback_test: ok');
