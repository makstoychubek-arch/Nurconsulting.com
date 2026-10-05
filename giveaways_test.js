'use strict';
const assert = require('assert');
const fs = require('fs');
const G = require('./giveaways.js');

// Шаблон ровно по рабочей таблице «Список БЛУЗКИ»
const labels = G.COLS.map((c) => c.label);
['Вид', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Примерная дата забора', 'Фактическая дата забора', 'Дата рекламы',
    'Разрезанный ШК', 'Дата публикации отзыва', 'Вид отзыва', 'Реквизиты', 'Кэш выплачен', 'Планируемая дата выплаты', 'Отзыв опубликован',
    'Ответственный', 'Ключ'].forEach((l) => assert.ok(labels.includes(l), 'column ' + l));
assert.strictEqual(G.MIN_ROWS, 1000, 'таблица сразу на 1000 строк');

// Дата выплаты = фактическая дата забора + 15 дней (формула G+15)
assert.strictEqual(G.payoutDate({ pickup_date: '2026-02-24' }), '2026-03-11');
assert.strictEqual(G.payoutDate({}), '');
assert.strictEqual(G.isOverdue({ pickup_date: '2026-02-24', cash_amount: 600, cash_status: 'Нет' }, '2026-03-20'), true);
assert.strictEqual(G.isOverdue({ pickup_date: '2026-02-24', cash_amount: 600, cash_status: 'Да' }, '2026-03-20'), false);
assert.strictEqual(G.isOverdue({ pickup_date: '2026-03-10', cash_amount: 600, cash_status: '' }, '2026-03-20'), false);

const rows = [
    { cash_amount: 600, cash_status: 'Да', pickup_date: '2026-02-24' },
    { cash_amount: 1000, cash_status: 'Нет', pickup_date: '2026-02-24' },
    null,
    { cash_amount: 0, cash_status: '' },
];
const s = G.summary(rows, '2026-03-20');
assert.deepStrictEqual([s.total, s.due, s.dueSum, s.overdue, s.paidSum], [3, 1, 1000, 1, 600]);

// Значения при вводе, вставке и протягивании
const col = (k) => G.COLS.find((c) => c.key === k);
assert.strictEqual(G.coerce(col('order_price'), '1 300,5'), 1300.5);
assert.strictEqual(G.coerce(col('order_price'), ''), null);
assert.strictEqual(G.coerce(col('order_price'), 'abc'), undefined);
assert.strictEqual(G.coerce(col('order_date'), '21.02.2026'), '2026-02-21');
assert.strictEqual(G.coerce(col('order_date'), '21/02/26'), '2026-02-21');
assert.strictEqual(G.coerce(col('order_date'), '2026-02-21'), '2026-02-21');
assert.strictEqual(G.coerce(col('order_date'), 'вчера'), undefined);
assert.strictEqual(G.coerce(col('barcode_cut'), 'Да'), true);
assert.strictEqual(G.coerce(col('barcode_cut'), ''), false);
assert.strictEqual(G.coerce(col('cash_status'), 'готов к выплате'), 'Готов к выплате');
assert.strictEqual(G.coerce(col('_payout'), '1'), undefined, 'вычисляемую колонку не записываем');

// Копирование группой: TSV как в Google Sheets, вставка обратно даёт ту же матрицу
const sheet = [
    { kind: 'КЭШБЕК', tg_link: '@a', order_date: '2026-09-21', order_price: 1300, cash_amount: 600 },
    { kind: 'БЛОГЕР', tg_link: '@b"q', order_date: '2026-09-28', order_price: null, cash_amount: 0 },
];
const tsv = G.toTsv(sheet, 0, 4, 0, 1);
assert.strictEqual(tsv, 'КЭШБЕК\t@a\t21.09.2026\t1300\t600\nБЛОГЕР\t"@b""q"\t28.09.2026\t\t0');
assert.deepStrictEqual(G.parseTsv(tsv), [['КЭШБЕК', '@a', '21.09.2026', '1300', '600'], ['БЛОГЕР', '@b"q', '28.09.2026', '', '0']]);
assert.deepStrictEqual(G.parseTsv('a\tb\n"x\ny"\tz\n'), [['a', 'b'], ['x\ny', 'z']], 'переносы внутри ячейки в кавычках');
assert.deepStrictEqual(G.parseTsv('1\r\n2\r\n'), [['1'], ['2']]);

// Протягивание (плюс): блок размножается циклом вниз и вправо
const plan = G.fillPlan(sheet, { r1: 0, r2: 1, c1: 0, c2: 1 }, 4, 1);
assert.deepStrictEqual(plan.map((p) => p.r + ':' + p.c + ':' + p.text), ['2:0:КЭШБЕК', '2:1:@a', '3:0:БЛОГЕР', '3:1:@b"q', '4:0:КЭШБЕК', '4:1:@a']);
const right = G.fillPlan(sheet, { r1: 0, r2: 0, c1: 3, c2: 3 }, 0, 5);
assert.deepStrictEqual(right.map((p) => p.c + ':' + p.text), ['4:1300', '5:1300']);

// Раздел только для команды и только в «Товарах»
const html = fs.readFileSync(__dirname + '/dashboard.html', 'utf8');
assert.ok(html.includes('id="gg-view-give-btn" data-staff-only="1"') && html.includes('id="gg-view-give"'), 'Раздачи — вкладка Товаров, только для команды');
const mig = fs.readFileSync(__dirname + '/supabase/migrations/20261005220000_giveaways.sql', 'utf8');
assert.ok(mig.includes('enable row level security') && mig.includes('public.is_staff()') && mig.includes('revoke all on public.giveaways from anon, authenticated;'), 'таблица раздач только для команды');
const grid = fs.readFileSync(__dirname + '/supabase/migrations/20261005230000_giveaways_grid.sql', 'utf8');
assert.ok(grid.includes('add column if not exists pos integer') && grid.includes('giveaways_cabinet_pos_uniq'), 'строка = позиция в сетке, пустые строки не хранятся');
const src = fs.readFileSync(__dirname + '/giveaways.js', 'utf8');
assert.ok(src.includes('esc(txt)') && src.includes('class="gv-cb"'), 'значения экранируются, буфер обмена через скрытое поле');
console.log('giveaways_test: ok');
