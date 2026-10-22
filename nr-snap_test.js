const assert = require('assert');
const S = require('./nr-snap.js');

const cols = ['id', 'cabinet_id', 'nm_id', 'date', 'orders_count'];
let rows, calls;
function fakeDb() {
    return {
        rpc(name, args) {
            calls.push(name);
            if (name === 'nr_pack_version') return Promise.resolve({ data: { n: rows.length, h: String(rows.length) + ':' + rows.map(r => r[4]).join(',') }, error: null });
            return Promise.resolve({ data: { cols, rows: rows.map(r => r.slice()), n: rows.length, h: String(rows.length) + ':' + rows.map(r => r[4]).join(',') }, error: null });
        },
    };
}
const F = [
    { op: 'eq', column: 'cabinet_id', value: 'c1' },
    { op: 'gte', column: 'date', value: '2026-10-01' },
    { op: 'lte', column: 'date', value: '2026-10-31' },
];

(async () => {
    // план: период уходит на сервер, остальное фильтруется локально; чужие столбцы/операции — отказ
    assert.deepStrictEqual(S.plan('rnp_daily_data', F, '*').key, 'rnp_daily_data|c1|2026-10-01|2026-10-31');
    assert.strictEqual(S.plan('users', F, '*'), null);
    assert.deepStrictEqual(S.plan('rnp_daily_data', F, 'id, date').proj, ['id', 'date']);
    assert.strictEqual(S.plan('rnp_daily_data', F, 'id,sum(date)'), null);
    assert.strictEqual(S.plan('rnp_daily_data', [{ op: 'gte', column: 'date', value: 'x' }], '*'), null);
    assert.strictEqual(S.plan('rnp_daily_data', F.concat([{ op: 'like', column: 'x', value: 1 }]), '*'), null);

    // 1) первая загрузка — одна упакованная выгрузка
    rows = [[1, 'c1', 100, '2026-10-01', 5], [2, 'c1', 101, '2026-10-02', 7]];
    calls = [];
    const db = fakeDb();
    let got = await S.fetchRows(db, 'rnp_daily_data', F, '*');
    assert.deepStrictEqual(calls, ['nr_pack_rows']);
    assert.deepStrictEqual(got.map(r => r.orders_count), [5, 7]);
    assert.strictEqual(got[0].nm_id, 100);

    // 2) данные не менялись — только маленькая проверка подписи, строки из кэша
    calls = [];
    got = await S.fetchRows(db, 'rnp_daily_data', F, '*');
    assert.deepStrictEqual(calls, ['nr_pack_version']);
    assert.strictEqual(got.length, 2);

    // 3) вызывающий код правит строки — кэш не портится
    got[0].orders_count = 999;
    calls = [];
    got = await S.fetchRows(db, 'rnp_daily_data', F, '*');
    assert.strictEqual(got[0].orders_count, 5);

    // 4) данные поменялись — качаем свежую выгрузку
    rows[0][4] = 6;
    calls = [];
    got = await S.fetchRows(db, 'rnp_daily_data', F, '*');
    assert.deepStrictEqual(calls, ['nr_pack_version', 'nr_pack_rows']);
    assert.strictEqual(got[0].orders_count, 6);

    // 5) запрос по одному артикулу берёт кэш кабинета и фильтрует локально
    calls = [];
    got = await S.fetchRows(db, 'rnp_daily_data', F.concat([{ op: 'eq', column: 'nm_id', value: 101 }]), '*');
    assert.deepStrictEqual(got.map(r => r.id), [2]);

    // 5b) проекция колонок
    got = await S.fetchRows(db, 'rnp_daily_data', F, 'nm_id,orders_count');
    assert.deepStrictEqual(Object.keys(got[0]), ['nm_id', 'orders_count']);

    // 6) по одному артикулу без кэша кабинета выгрузку не запускаем
    S._reset();
    calls = [];
    assert.strictEqual(await S.fetchRows(db, 'rnp_daily_data', F.concat([{ op: 'eq', column: 'nm_id', value: 101 }]), '*'), null);
    assert.deepStrictEqual(calls, []);

    // 7) сервер ответил ошибкой — null, дальше старый путь; «нет функции» отключает механизм
    S._reset();
    const bad = { rpc: () => Promise.resolve({ data: null, error: { message: 'Could not find the function public.nr_pack_rows' } }) };
    assert.strictEqual(await S.fetchRows(bad, 'rnp_daily_data', F, '*'), null);
    calls = [];
    assert.strictEqual(await S.fetchRows(db, 'rnp_daily_data', F, '*'), null);
    assert.deepStrictEqual(calls, []);

    console.log('nr-snap_test: ok');
})().catch(e => { console.error(e); process.exit(1); });
