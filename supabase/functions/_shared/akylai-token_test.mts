import assert from 'node:assert/strict';
import { hasBit, parseAkylaiToken, tokenSellerId, WB_BIT_FEEDBACKS, WB_BIT_READ_ONLY } from './akylai-token.ts';

function makeToken(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'ES256', kid: '20250101v1', typ: 'JWT' })}.${b64(payload)}.signature`;
}

const NOW = 1_800_000_000;
const FEEDBACKS = 2 ** WB_BIT_FEEDBACKS;
const READ_ONLY = 2 ** WB_BIT_READ_ONLY;
// Персональный токен по документации WB: acc=3, for="self", t=false.
const personal = { id: 'b3a1c1d2-0000-4000-8000-000000000001', sid: 'seller-uuid-1', acc: 3, for: 'self', t: false, exp: NOW + 86400 * 90 };

// 1. Правильный: персональный, «Вопросы и отзывы», запись разрешена.
{
    const r = parseAkylaiToken(makeToken({ ...personal, s: FEEDBACKS | 2 ** 1 }), NOW);
    assert.equal(r.ok, true, 'valid personal token with feedbacks passes');
    if (r.ok) {
        assert.equal(r.info.sid, 'seller-uuid-1');
        assert.equal(r.info.acc, 3);
        assert.equal(r.info.exp, NOW + 86400 * 90);
    }
}

// 2. «Только чтение»: бит 30 выставлен.
{
    const r = parseAkylaiToken(makeToken({ ...personal, s: FEEDBACKS + READ_ONLY }), NOW);
    assert.deepEqual(r, { ok: false, problem: 'READ_ONLY' }, 'read-only token is rejected');
}

// 3. Не персональный: базовый (acc=1, без for) и сервисный (acc=4, for=asid:...).
{
    const base = parseAkylaiToken(makeToken({ sid: 's', acc: 1, t: false, s: FEEDBACKS, exp: NOW + 100 }), NOW);
    assert.deepEqual(base, { ok: false, problem: 'NOT_PERSONAL' }, 'base token is not personal');
    const service = parseAkylaiToken(makeToken({ sid: 's', acc: 4, for: 'asid:123', t: false, s: FEEDBACKS, exp: NOW + 100 }), NOW);
    assert.deepEqual(service, { ok: false, problem: 'NOT_PERSONAL' }, 'service token is not personal');
    const test = parseAkylaiToken(makeToken({ sid: 's', acc: 2, t: true, s: FEEDBACKS, exp: NOW + 100 }), NOW);
    assert.deepEqual(test, { ok: false, problem: 'NOT_PERSONAL' }, 'test (sandbox) token is not personal');
}

// Нет категории «Вопросы и отзывы».
assert.deepEqual(parseAkylaiToken(makeToken({ ...personal, s: 2 ** 1 }), NOW), { ok: false, problem: 'NO_FEEDBACKS' });

// Просрочен.
assert.deepEqual(parseAkylaiToken(makeToken({ ...personal, s: FEEDBACKS, exp: NOW - 1 }), NOW), { ok: false, problem: 'EXPIRED' });

// Мусор и пустой ввод.
assert.deepEqual(parseAkylaiToken('', NOW), { ok: false, problem: 'EMPTY' });
assert.deepEqual(parseAkylaiToken('not-a-token', NOW), { ok: false, problem: 'MALFORMED' });
assert.deepEqual(parseAkylaiToken('a.@@@.c', NOW), { ok: false, problem: 'MALFORMED' });

// Пробелы/переносы и «Bearer » при копировании не мешают.
{
    const t = makeToken({ ...personal, s: FEEDBACKS });
    const r = parseAkylaiToken(`  Bearer ${t.slice(0, 20)}\n${t.slice(20)}  `, NOW);
    assert.equal(r.ok, true, 'whitespace and Bearer prefix are stripped');
}

// Маска больше 2^31: побитовые операторы JS сломались бы, hasBit — нет.
assert.equal(hasBit(2 ** 33 + FEEDBACKS, WB_BIT_FEEDBACKS), true);
assert.equal(hasBit(2 ** 33 + FEEDBACKS, WB_BIT_READ_ONLY), false);
assert.equal(hasBit(READ_ONLY, WB_BIT_READ_ONLY), true);

// sid из любого токена (для поиска дублей среди старых кабинетов).
assert.equal(tokenSellerId(makeToken({ sid: 'abc' })), 'abc');
assert.equal(tokenSellerId('garbage'), '');

console.log('akylai-token_test: ok');
