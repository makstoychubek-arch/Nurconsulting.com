/**
 * Guards the Telegram penalties pipeline: JWT cron auth, dedicated
 * penalties chat, WB daily list + sellerOperName, empty reports still sent.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const root = __dirname;
const fn = fs.readFileSync(path.join(root, 'supabase/functions/daily-penalties-report/index.ts'), 'utf8');
const snap = fs.readFileSync(path.join(root, 'supabase/functions/_shared/wb-penalties-snapshot.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'supabase/functions/_shared/service-auth.ts'), 'utf8');
const routing = fs.readFileSync(path.join(root, 'supabase/functions/_shared/telegram-routing.ts'), 'utf8');

assert.ok(fn.includes('isServiceAuthorized'), 'cron JWT must pass auth');
assert.ok(auth.includes("payload?.role === 'service_role'"), 'service_role JWT is accepted even if keys drifted');
assert.ok(auth.includes("payload?.ref === PROJECT_REF"), 'JWT must belong to this project');
assert.ok(
    !/authHeader\.replace\('Bearer ', ''\) !== serviceKey/.test(fn),
    'must not reject cron because the Bearer key is a few bytes off the env secret',
);

assert.ok(fn.includes("getTelegramChatId('penalties')"), 'send to the penalties channel, not the sales group');
assert.ok(routing.includes("penalties: '-1003907884000'"), 'hardcoded penalties supergroup fallback');
assert.ok(routing.includes('TELEGRAM_CHAT_PENALTIES'), 'dedicated penalties secret');

assert.ok(snap.includes('/api/finance/v1/sales-reports/list'), 'WB list, not one-day detailed-only');
assert.ok(snap.includes('sellerOperName'), 'WB field is sellerOperName');
assert.ok(snap.includes('PENALTY_DETAIL_FIELDS'), 'slim detailed payload so Zevina fits');
assert.ok(fn.includes('fetchWeeklyPenaltyBundle'), 'daily report uses the snapshot bundle');
assert.ok(fn.includes("channel: 'penalties'"), 'cabinet mute gate is the penalties channel');
assert.ok(!fn.includes("skipped = 'no_penalties'"), 'empty day still posts «штрафов нет» so silence means a real outage');

const out = path.join('/tmp', 'wb-penalties-snapshot.mjs');
execSync(
    `npx esbuild ${JSON.stringify(path.join(root, 'supabase/functions/_shared/wb-penalties-snapshot.ts'))} --bundle --platform=neutral --format=esm --outfile=${out}`,
    { stdio: 'pipe' },
);

(async () => {
    const {
        pickSalesReport,
        parseSalesReportsList,
        aggregatePenaltyRows,
        PENALTY_DETAIL_FIELDS,
        formatPenaltyCaption,
    } = await import(out);

    assert.strictEqual(
        pickSalesReport([
            { reportId: '1', dateFrom: '2026-08-17', dateTo: '2026-08-23' },
            { reportId: '2', dateFrom: '2026-08-24', dateTo: '2026-08-30' },
            { reportId: '25009236420260902', dateFrom: '2026-09-02', dateTo: '2026-09-02' },
        ], '2026-09-02')?.reportId,
        '25009236420260902',
    );
    assert.strictEqual(
        pickSalesReport([
            { reportId: '1', dateFrom: '2026-08-17', dateTo: '2026-08-23' },
            { reportId: '2', dateFrom: '2026-08-24', dateTo: '2026-08-30' },
        ], '2026-08-26')?.reportId,
        '2',
    );

    const parsed = parseSalesReportsList(
        '[{"reportId":25009236420260902,"dateFrom":"2026-09-02","dateTo":"2026-09-02","period":"daily","penaltySum":0}]',
    );
    assert.strictEqual(parsed[0]?.reportId, '25009236420260902');

    const rows = aggregatePenaltyRows([
        { penalty: 1884.35, bonusTypeName: 'Штраф МП. Невыполненный заказ', docTypeName: '' },
        { penalty: 51.08, bonusTypeName: 'Платное хранение возвратов на ПВЗ более 3 дней' },
        { penalty: 0, deduction: 100, bonusTypeName: 'ВБ.Продвижение' },
        { penalty: 200, sellerOperName: 'Штраф за недопоставку' },
    ]);
    assert.strictEqual(rows.length, 3);
    assert.ok(rows[0].reason.includes('Штраф МП'));

    assert.ok(PENALTY_DETAIL_FIELDS.includes('sellerOperName'));
    assert.strictEqual(PENALTY_DETAIL_FIELDS.length, 6);

    const caption = formatPenaltyCaption({
        cabinetName: 'Zevina 1',
        date: '2026-08-10',
        rows: [{ reason: 'Отчет об утилизированном товаре', amount: 971 }],
        prevDate: '2026-08-09',
        prevTotal: 0,
        prevItems: 1,
        alertUser: 'maraWuW',
        watchdogThreshold: 500,
    });
    assert.ok(caption.includes('Сторож'));
    assert.ok(caption.includes('@maraWuW'));
    assert.ok(caption.includes('971'));

    console.log('daily_penalties_test: ok');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
