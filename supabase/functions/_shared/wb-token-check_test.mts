import assert from 'node:assert/strict';
import {
    decodeWbToken,
    summarizePings,
    missingScopesMessage,
    pingStatusMeansNoAccess,
    REQUIRED_CATEGORIES,
} from './wb-token-check.ts';

function makeToken(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'ES256', typ: 'JWT' })}.${b64(payload)}.signature`;
}

const NOW = 1_700_000_000;

// пустой ввод
{
    const r = decodeWbToken('   ', NOW);
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, 'EMPTY');
}

// не токен вовсе
{
    const r = decodeWbToken('просто строка', NOW);
    assert.equal(r.ok === false && r.code, 'MALFORMED');
}

// три части, но середина не json
{
    const r = decodeWbToken('aaa.bbb.ccc', NOW);
    assert.equal(r.ok === false && r.code, 'MALFORMED');
}

// живой токен
{
    const r = decodeWbToken(makeToken({ sid: 'abc', s: 81662, exp: NOW + 1000, t: false }), NOW);
    assert.equal(r.ok, true);
    assert.equal(r.ok === true && r.payload.sid, 'abc');
}

// пробелы и переносы при копировании не должны ломать токен
{
    const t = makeToken({ sid: 'abc', exp: NOW + 1000 });
    const r = decodeWbToken(`  ${t.slice(0, 20)}\n ${t.slice(20)}  `, NOW);
    assert.equal(r.ok, true);
}

// просрочен
{
    const r = decodeWbToken(makeToken({ sid: 'abc', exp: NOW - 1 }), NOW);
    assert.equal(r.ok === false && r.code, 'EXPIRED');
}

// тестовый контур
{
    const r = decodeWbToken(makeToken({ sid: 'abc', exp: NOW + 1000, t: true }), NOW);
    assert.equal(r.ok === false && r.code, 'SANDBOX');
}

// токен без exp считаем валидным: WB не обязан его проставлять
{
    const r = decodeWbToken(makeToken({ sid: 'abc' }), NOW);
    assert.equal(r.ok, true);
}

// сводка по пингам: не хватает обязательной категории
{
    const s = summarizePings([
        { key: 'statistics', label: 'Статистика', ok: false, status: 401 },
        { key: 'content', label: 'Контент', ok: true, status: 200 },
        { key: 'adv', label: 'Продвижение', ok: false, status: 403 },
    ], REQUIRED_CATEGORIES.map((c) => c.key));
    assert.equal(s.ok, false);
    assert.deepEqual(s.missingRequired, ['Статистика']);
    assert.deepEqual(s.missingOptional, ['Продвижение']);
}

// все обязательные на месте — пускаем, даже если необязательных нет
{
    const s = summarizePings([
        { key: 'statistics', label: 'Статистика', ok: true, status: 200 },
        { key: 'content', label: 'Контент', ok: true, status: 200 },
        { key: 'adv', label: 'Продвижение', ok: false, status: 401 },
    ], REQUIRED_CATEGORIES.map((c) => c.key));
    assert.equal(s.ok, true);
    assert.deepEqual(s.missingRequired, []);
}

// текст ошибки перечисляет категории
{
    assert.match(missingScopesMessage(['Статистика', 'Контент']), /Статистика, Контент/);
    assert.equal(missingScopesMessage([]), '');
}

// 5xx на стороне WB не должен выглядеть как отсутствие доступа
{
    assert.equal(pingStatusMeansNoAccess(401), true);
    assert.equal(pingStatusMeansNoAccess(403), true);
    assert.equal(pingStatusMeansNoAccess(500), false);
    assert.equal(pingStatusMeansNoAccess(0), false);
}

console.log('wb-token-check_test: ok');
