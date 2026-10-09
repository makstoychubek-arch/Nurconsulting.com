// Разбор отчётов WB (раздел «Оцифровка → Отчёты WB») на маленьких тестовых файлах.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('./wb-reports.js');
const dir = path.join(__dirname, 'test-fixtures', 'wb-reports');
const read = (n) => new Uint8Array(fs.readFileSync(path.join(dir, n)));

(async () => {
    const fin = await P.parseReportFile(read('fin.xlsx'), 'Детализированный отчет №1_20261001_2.xlsx');
    assert.strictEqual(fin.type, 'fin');
    assert.strictEqual(fin.date, '2026-10-01', 'день берётся из имени файла');
    assert.strictEqual(fin.summary.sales_qty, 2);
    assert.strictEqual(fin.summary.sales_sum, 1000);
    assert.strictEqual(fin.summary.returns_sum, 400);
    assert.strictEqual(fin.summary.commission, 90, 'комиссия = ВВ продаж минус ВВ возвратов');
    assert.strictEqual(fin.summary.logistics, 90);
    assert.strictEqual(fin.summary.ads, 200, 'удержание «WB Продвижение» считается рекламой');
    assert.strictEqual(fin.summary.storage, 30);
    assert.strictEqual(fin.summary.to_pay_total, 800 - 320 - 90 - 200 - 30);
    assert.strictEqual(fin.rows[0].article, 'a1');
    assert.strictEqual(fin.rows[0].qty, 1);

    const finNoName = await P.parseReportFile(read('fin.xlsx'), 'report.xlsx');
    assert.strictEqual(finNoName.date, '2026-10-01', 'без даты в имени день берётся из «Дата продажи»');

    const sales = await P.parseReportFile(read('sales.xlsx'), 'x.XLSX');
    assert.strictEqual(sales.type, 'sales');
    assert.strictEqual(sales.date, '2026-10-01');
    assert.ok(!sales.multiDay);
    assert.strictEqual(sales.rows[0].warehouse, 'Склад WB РФ');
    assert.strictEqual(sales.rows[0].extra.stock, 10);

    const dyn = await P.parseReportFile(read('dynamics.xlsx'), 'd.xlsx');
    assert.strictEqual(dyn.type, 'dynamics');
    assert.deepStrictEqual(dyn.dates, ['2026-10-01', '2026-10-02'], 'даты Excel превращаются в дни');
    assert.strictEqual(dyn.perDay['2026-10-02'].summary.ordered_sum, 4000);

    const fbo = await P.parseReportFile(read('stock_fbo.xlsx'), 'o.xlsx');
    assert.strictEqual(fbo.type, 'stock_fbo');
    assert.strictEqual(fbo.summary.stock, 10);

    const fbs = await P.parseReportFile(read('stock_fbs.xlsx'), 's.xlsx');
    assert.strictEqual(fbs.type, 'stock_fbs');
    assert.strictEqual(fbs.rows[0].barcode, '2040000000001');
    assert.strictEqual(fbs.summary.stock, 5);

    await assert.rejects(() => P.parseReportFile(new Uint8Array([1, 2, 3, 4]), 'bad.xlsx'), /не файл Excel/);

    const js = fs.readFileSync(path.join(__dirname, 'wb-reports.js'), 'utf8');
    assert.ok(js.includes('report_uploads') && js.includes('report_rows'), 'сохранение идёт в таблицы report_uploads / report_rows');
    const mig = fs.readFileSync(path.join(__dirname, 'supabase/migrations/20261009120000_wb_report_uploads.sql'), 'utf8');
    assert.ok(/enable row level security/.test(mig) && mig.includes('current_user_cabinet_ids'), 'таблицы отчётов закрыты по кабинету');
    console.log('wb_reports_test: ok');
})().catch((e) => { console.error(e); process.exit(1); });
