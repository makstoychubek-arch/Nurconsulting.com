// Расход ChatGPT: цена по модели, сумма месяца, код ошибки OpenAI, защита бюджета. Сеть не нужна.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const code = readFileSync(new URL('./llm-usage.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace(/^export /gm, '');
let budget = 0, rows = [], calls = [], fail = false;
const db = { from: () => ({ select: () => ({ gte: async () => ({ data: rows }) }) }), rpc: async (name, args) => { calls.push([name, args]); if (fail) throw new Error('x'); } };
const lib = new Function('getAdminClient', 'loadAlinaSettings', stripTypeScriptTypes(code) + '\nreturn { estimateCostUsd, openAiErrorCode, recordLlmUsage, sumUsage, moscowDay, llmBudgetOk }')(() => db, async () => ({ llmBudgetUsd: budget }));

assert.equal(lib.estimateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000), 0.75);
assert.equal(lib.estimateCostUsd('gpt-4o-mini-2024-07-18', 1000, 0), 0.00015, 'версия модели считается по префиксу');
assert.equal(lib.estimateCostUsd('gpt-4o', 1_000_000, 0), 2.5); assert.equal(lib.estimateCostUsd('gpt-4.1-mini', 0, 1_000_000), 1.6);
assert.equal(lib.estimateCostUsd('что-то-новое', 1_000_000, 0), 2.5, 'неизвестная модель считается дорогой, чтобы не занизить расход');
assert.equal(lib.openAiErrorCode(429, '{"error":{"code":"insufficient_quota","message":"x"}}'), 'insufficient_quota');
assert.equal(lib.openAiErrorCode(401, '{"error":{"type":"invalid_request_error"}}'), 'invalid_request_error');
assert.equal(lib.openAiErrorCode(502, '<html>'), 'http_502');
assert.equal(lib.moscowDay(Date.parse('2026-11-17T22:30:00Z')), '2026-11-18', 'день по Москве');
const u = lib.sumUsage([
  { day: '2026-11-17', model: 'gpt-4o-mini', calls: 10, prompt_tokens: 1_000_000, completion_tokens: 0, errors: 0, last_error: null, last_error_at: null },
  { day: '2026-11-18', model: 'gpt-4o', calls: 2, prompt_tokens: 1_000_000, completion_tokens: 0, errors: 1, last_error: 'insufficient_quota', last_error_at: '2026-11-18T09:00:00Z' },
], '2026-11-18');
assert.equal(Math.round(u.costUsd * 100) / 100, 2.65); assert.equal(u.todayUsd, 2.5); assert.deepEqual([u.calls, u.errors, u.lastError], [12, 1, 'insufficient_quota']);
await lib.recordLlmUsage('gpt-4o-mini', { prompt_tokens: 120, completion_tokens: 30 });
await lib.recordLlmUsage('gpt-4o-mini', null, 'insufficient_quota');
assert.deepEqual(calls[0], ['llm_usage_add', { p_model: 'gpt-4o-mini', p_prompt: 120, p_completion: 30, p_error: null }]); assert.equal(calls[1][1].p_error, 'insufficient_quota');
fail = true; await lib.recordLlmUsage('x', null); fail = false; // сбой учёта ничего не ломает
console.log('ok   цена по модели, сумма месяца, код ошибки, учёт best-effort');

let t = 1_000_000;
assert.equal(await lib.llmBudgetOk(t), true, 'бюджет не задан: можно');
budget = 5; rows = [{ day: '2026-11-18', model: 'gpt-4o', calls: 1, prompt_tokens: 1_000_000, completion_tokens: 0, errors: 0, last_error: null, last_error_at: null }];
assert.equal(await lib.llmBudgetOk(t + 61_000), true, 'израсходовано 2,5 из 5: можно');
rows[0].prompt_tokens = 3_000_000; // 7,5 доллара
assert.equal(await lib.llmBudgetOk(t + 90_000), true, 'в течение минуты решение из кэша');
assert.equal(await lib.llmBudgetOk(t + 200_000), false, 'бюджет превышен: ChatGPT не вызываем');
budget = 0; assert.equal(await lib.llmBudgetOk(t + 400_000), true, 'бюджет снят: снова можно');
console.log('ok   защита бюджета: можно, нельзя после превышения, кэш минуту, бюджет снят');
console.log('PASS: llm-usage');
