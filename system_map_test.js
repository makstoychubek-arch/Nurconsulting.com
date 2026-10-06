/**
 * Карта системы: разбор архива функции, сканирование кода, правила «мусор/сбой», раскладка и запись.
 * Всё без сети: на маленьком придуманном снимке системы.
 */
const assert = require('assert');
const { projectModules } = require('./scripts/system-map/eszip');
const scan = require('./scripts/system-map/scan');
const { buildGraph, humanCron } = require('./scripts/system-map/graph');
const { layout, SIZE } = require('./scripts/system-map/layout');
const { jsonArg, chunks } = require('./scripts/system-map/sync');

// ── ESZIP: собираем минимальный архив по формату и разбираем обратно
function buildEszip(modules) {
    const parts = [];
    let off = 0;
    const header = [];
    for (const [spec, src] of modules) {
        const name = Buffer.from(spec);
        const body = Buffer.from(src);
        const h = Buffer.alloc(4 + name.length + 1 + 16 + 1);
        h.writeUInt32BE(name.length, 0); name.copy(h, 4); h[4 + name.length] = 0;
        h.writeUInt32BE(off, 5 + name.length); h.writeUInt32BE(body.length, 9 + name.length);
        header.push(h); parts.push(body); off += body.length;
    }
    const headerBuf = Buffer.concat(header);
    const pre = Buffer.alloc(8 + 4 + 4 + 4);
    pre.write('ESZIP2.3', 0, 'latin1'); pre.writeUInt32BE(4, 8); pre.writeUInt32BE(headerBuf.length, 16);
    return Buffer.concat([pre, headerBuf, Buffer.alloc(8), ...parts]);
}
const mods = projectModules(buildEszip([
    ['source/my-fn/index.ts', "const a = 1; // привет"],
    ['source/_shared/x.ts', 'export const x = 2;'],
    ['https://esm.sh/lib', 'внешнее'],
]));
assert.deepEqual(mods.map((m) => m.specifier), ['my-fn/index.ts', '_shared/x.ts'], 'своё берём, внешнее пропускаем, имена приводим к одному виду');
assert.ok(mods[0].source.includes('привет'), 'кириллица читается');

// ── Сканирование кода
const facts = scan.extractFacts(`
  admin.from('cabinets').select('*'); admin.from("akylai_settings"); db.rpc('feature_active', {});
  const t = Deno.env.get('OPENAI_API_KEY'); const d = Deno.env.get('REVIEW_MAX') ?? '300';
  fetch('https://api.telegram.org/bot' + x); fetch('https://advert-api.wildberries.ru/adv/v3/fullstats'); import 'https://esm.sh/x';
`);
assert.deepEqual([...facts.tables].sort(), ['akylai_settings', 'cabinets']);
assert.deepEqual([...facts.rpcs], ['feature_active']);
assert.deepEqual([...facts.secrets].sort(), ['OPENAI_API_KEY', 'REVIEW_MAX']);
assert.deepEqual([...facts.integrations].sort(), ['Telegram', 'Wildberries'], 'esm.sh не считается внешним сервисом');
assert.deepEqual([...scan.envWithDefault("Deno.env.get('A') ?? 'x'; Deno.env.get('B')")], ['A'], 'видим запасное значение');
assert.deepEqual([...scan.secretMentions("const names = ['TG_CHAT_SALES'];", ['TG_CHAT_SALES', 'TG_CHAT'])], ['TG_CHAT_SALES'], 'динамические имена секретов ловятся по слову');
assert.deepEqual([...scan.functionCalls("fetch(`${U}/functions/v1/akylai-status`); call('wb-proxy')", ['akylai-status', 'wb-proxy', 'akylai'])].sort(), ['akylai-status', 'wb-proxy'], 'ровно имя функции, без подстрок');

// ── Зашитые ключи: находим и вырезаем, значений в отчёт не кладём
const dirty = "const s = (Deno.env.get('NR_SETUP_SECRET') ?? 'top-secret-value').trim(); const t = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';";
assert.deepEqual(scan.findHardcodedSecrets(dirty).sort(), ['запасное значение секрета в коде', 'токен Telegram-бота']);
const clean = scan.redactSecrets(dirty);
assert.ok(!clean.includes('top-secret-value') && !clean.includes('AAAAAAAAAAAAAAAAAAAA'), 'значения вырезаны');
assert.ok(clean.includes("Deno.env.get('NR_SETUP_SECRET')"), 'структура кода сохранена');

// ── Расписание человеческим языком
assert.equal(humanCron('* * * * *'), 'каждую минуту');
assert.equal(humanCron('*/10 * * * *'), 'каждые 10 мин');
assert.equal(humanCron('0 */6 * * *'), 'каждые 6 ч');
assert.ok(humanCron('15 1 * * *').includes('01:15 UTC') && humanCron('15 1 * * *').includes('07:15'), 'есть время по Бишкеку');
assert.equal(humanCron('1 2 3 4 5'), '1 2 3 4 5', 'странное оставляем как есть');

// ── Правила карты на маленьком снимке
const fn = (slug, extra = {}) => ({ slug, version: 1, verifyJwt: true, inRepo: true, files: 1, tables: [], rpcs: [], secrets: [], secretsWithDefault: [], integrations: [], calls: [], hardcoded: [], ...extra });
const snap = {
    functions: [
        fn('akylai-reviews', { tables: ['akylai_settings'], secrets: ['OPENAI_API_KEY'], integrations: ['OpenAI'] }),
        fn('wb-proxy', { tables: ['cabinets'], calls: [] }),
        fn('diag-temp', { inRepo: false }),
        fn('old-key', { hardcoded: ['запасное значение секрета в коде'] }),
    ],
    secrets: [{ name: 'OPENAI_API_KEY' }, { name: 'LEFTOVER_KEY' }],
    tables: [
        { name: 'akylai_settings', rls: true, policies: 1, rows: 3, writes: 5, bytes: 100, cols: 4 },
        { name: 'cabinets', rls: true, policies: 2, rows: 4, writes: 9, bytes: 100, cols: 6 },
        { name: 'dead_empty', rls: true, policies: 1, rows: 0, writes: 0, bytes: 100, cols: 2 },
        { name: 'forgotten', rls: true, policies: 1, rows: 50, writes: 0, bytes: 100, cols: 2 },
        { name: 'open_table', rls: false, policies: 0, rows: 2, writes: 1, bytes: 100, cols: 2 },
    ],
    fks: [{ src: 'akylai_settings', dst: 'cabinets' }],
    views: [], sqlfns: [{ name: 'orphan_fn', args: '', definer: false, ret: 'void', src: 'select 1' }, { name: 'trg_fn', args: '', definer: false, ret: 'trigger', src: 'select 1' }],
    triggers: [{ name: 't', tbl: 'cabinets', fn: 'trg_fn' }], eventTriggers: [], policies: [],
    cron: [
        { name: 'ok-job', schedule: '*/5 * * * *', active: true, command: "select net.http_post(url := 'https://x.supabase.co/functions/v1/akylai-reviews')", last_status: 'succeeded' },
        { name: 'ghost-job', schedule: '0 * * * *', active: true, command: "select net.http_post(url := 'https://x.supabase.co/functions/v1/not-there')", last_status: 'succeeded' },
    ],
    bots: [], site: { calls: { 'wb-proxy': ['dashboard.html'] }, tables: { cabinets: ['dashboard.html'] }, rpcs: {} },
    repoOnly: [{ slug: 'never-deployed', tables: ['forgotten'], rpcs: [], secrets: [], secretsWithDefault: [], integrations: [], calls: [] }],
};
const g = buildGraph(snap);
const node = (ref) => g.nodes.find((n) => n.ref === ref);
assert.equal(node('fn:akylai-reviews').status, 'ok', 'cron зовёт: не мусор');
assert.equal(node('fn:wb-proxy').status, 'ok', 'сайт зовёт: не мусор');
assert.equal(node('fn:diag-temp').status, 'unused', 'никто не зовёт и без исходников: кандидат на уборку');
assert.ok(node('fn:diag-temp').reasons.some((r) => r.includes('диагностик')) && node('fn:diag-temp').reasons.some((r) => r.includes('исходников')), 'причины названы по-человечески');
assert.equal(node('fn:old-key').status, 'unused');
assert.ok(node('fn:old-key').reasons.some((r) => r.startsWith('В коде зашито')));
assert.equal(node('cron:ghost-job').status, 'bad', 'cron вызывает несуществующую функцию: сбой');
assert.ok(node('cron:ghost-job').reasons[0].includes('404'));
assert.equal(node('cron:ok-job').status, 'ok');
assert.equal(node('tbl:dead_empty').status, 'unused', 'пустая и никому не нужна');
assert.equal(node('tbl:forgotten').status, 'ok', 'таблицу читает функция из репозитория (даже не задеплоенная)');
assert.equal(node('tbl:open_table').status, 'bad', 'без RLS: сбой');
assert.equal(node('tbl:cabinets').status, 'ok');
assert.equal(node('fn:never-deployed').status, 'warn', 'есть в репозитории, не задеплоена');
assert.equal(node('sql:orphan_fn').status, 'unused');
assert.equal(node('sql:trg_fn').status, 'ok', 'триггерная функция используется');
assert.equal(node('secret:LEFTOVER_KEY').status, 'unused');
assert.equal(node('secret:OPENAI_API_KEY').status, 'ok');
assert.ok(!g.nodes.some((n) => /^secret:SUPABASE_/.test(n.ref)), 'встроенные SUPABASE_* не показываем');
assert.ok(g.edges.some((e) => e.from === 'cron:ok-job' && e.to === 'fn:akylai-reviews' && e.kind === 'schedules'));
assert.ok(g.edges.some((e) => e.from === 'secret:OPENAI_API_KEY' && e.to === 'fn:akylai-reviews' && e.weak), 'связи секретов слабые: рисуются только при выборе узла');
assert.ok(g.edges.every((e) => e.from !== e.to), 'нет петель');
assert.ok(g.summary.unusedFunctions.includes('diag-temp') && g.summary.badCron.includes('ghost-job') && g.summary.noRls.includes('open_table'));
assert.ok(g.summary.hardcodedKey.includes('old-key') && g.summary.notDeployed.includes('never-deployed'));
assert.ok(!JSON.stringify(g).includes('top-secret'), 'значения секретов в карту не попадают');

// ── Раскладка: без перекрытий, детерминированно, ваши положения не трогаем
const pos = layout(g.nodes);
assert.equal(pos.size, g.nodes.length);
const items = g.nodes.map((n) => ({ ...pos.get(n.ref), w: SIZE[n.kind][0], h: SIZE[n.kind][1] }));
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'узлы не налезают друг на друга');
}
assert.deepEqual([...layout(g.nodes)], [...pos], 'раскладка детерминирована');
const kept = layout(g.nodes, new Map([['fn:wb-proxy', true]]));
assert.ok(!kept.has('fn:wb-proxy') && kept.size === g.nodes.length - 1, 'узел с готовым положением не двигаем');

// ── Запись: JSON с символами $ и кавычками не ломает SQL
const arg = jsonArg([{ t: "a$b'c$j1$" }]);
assert.ok(/^\$j[0-9a-f]{8}\$/.test(arg) && arg.endsWith('::jsonb'));
assert.ok(!arg.slice(arg.indexOf('$', 1) + 1, -8).includes(arg.slice(0, 11)), 'метка не встречается внутри данных');
assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);

console.log('system_map_test: ok');
