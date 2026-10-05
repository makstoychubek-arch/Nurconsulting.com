'use strict';
const assert = require('assert');
const fs = require('fs');
const G = require('./giveaways.js');

// Шаблон ровно по рабочей таблице «Список БЛУЗКИ»
const labels = G.COLS.map((c) => c.label);
['Вид', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Примерная дата забора', 'Фактическая дата забора', 'Дата рекламы',
    'Разрезанный ШК', 'Дата публикации отзыва', 'Вид отзыва', 'Реквизиты', 'Кэш выплачен', 'Планируемая дата выплаты', 'Отзыв опубликован',
    'Ответственный', 'Ключ'].forEach((l) => assert.ok(labels.includes(l), 'column ' + l));

// Дата выплаты = фактическая дата забора + 15 дней (формула G+15)
assert.strictEqual(G.payoutDate({ pickup_date: '2026-02-24' }), '2026-03-11');
assert.strictEqual(G.payoutDate({}), '');
// Просрочка: срок прошёл, кэш не выплачен
assert.strictEqual(G.isOverdue({ pickup_date: '2026-02-24', cash_amount: 600, cash_status: 'Нет' }, '2026-03-20'), true);
assert.strictEqual(G.isOverdue({ pickup_date: '2026-02-24', cash_amount: 600, cash_status: 'Да' }, '2026-03-20'), false);
assert.strictEqual(G.isOverdue({ pickup_date: '2026-02-24', cash_amount: 600, cash_status: 'Отмена' }, '2026-03-20'), false);
assert.strictEqual(G.isOverdue({ pickup_date: '2026-03-10', cash_amount: 600, cash_status: '' }, '2026-03-20'), false);

const rows = [
    { kind: 'КЭШБЕК', cash_amount: 600, cash_status: 'Да', responsible: 'МАРЛЕН', pickup_date: '2026-02-24' },
    { kind: 'КЭШБЕК', cash_amount: 1000, cash_status: 'Нет', responsible: 'МАРЛЕН', pickup_date: '2026-02-24' },
    { kind: 'БЛОГЕР', cash_amount: 0, cash_status: '', responsible: 'Светлана', tg_link: '@blog' },
];
const s = G.summary(rows, '2026-03-20');
assert.deepStrictEqual([s.total, s.due, s.dueSum, s.overdue, s.paidSum], [3, 1, 1000, 1, 600]);
assert.strictEqual(G.applyFilters(rows, { kind: 'БЛОГЕР' }).length, 1);
assert.strictEqual(G.applyFilters(rows, { q: 'blog' }).length, 1);
assert.strictEqual(G.applyFilters(rows, { who: 'МАРЛЕН', cash: 'Нет' }).length, 1);
assert.strictEqual(G.coerce({ type: 'number' }, ''), null);
assert.strictEqual(G.coerce({ type: 'number' }, '600'), 600);
assert.strictEqual(G.coerce({ type: 'text' }, '  '), null);
assert.ok(G.templateCsv().split('\n')[0].includes('Реквизиты'));

// Раздел только для команды и только в «Товарах»
const html = fs.readFileSync(__dirname + '/dashboard.html', 'utf8');
assert.ok(html.includes('id="gg-view-give-btn" data-staff-only="1"') && html.includes('id="gg-view-give"'), 'Раздачи — вкладка Товаров, только для команды');
const mig = fs.readFileSync(__dirname + '/supabase/migrations/20261005220000_giveaways.sql', 'utf8');
assert.ok(mig.includes('enable row level security') && mig.includes('public.is_staff()') && mig.includes('revoke all on public.giveaways from anon, authenticated;'), 'таблица раздач только для команды');
assert.ok(fs.readFileSync(__dirname + '/giveaways.js', 'utf8').includes('esc(') && !/innerHTML\s*=\s*[^;]*row\.requisites/.test(fs.readFileSync(__dirname + '/giveaways.js', 'utf8')), 'значения экранируются');
console.log('giveaways_test: ok');
