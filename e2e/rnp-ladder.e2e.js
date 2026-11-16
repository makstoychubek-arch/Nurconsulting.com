/**
 * РНП: расходы лесенкой (Реализация → Комиссия → … → Реклама → Себестоимость → К выводу → Налог → Прибыль) и налог из настроек.
 * Запуск: node e2e/rnp-ladder.e2e.js.
 */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');

const day = (n) => new Date(Date.now() + 6 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const tables = {
    spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }],
    cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }],
    rnp_articles: [{ id: 'a0', cabinet_id: CAB, nm_id: 1001, name: 'a', category: 'К', is_active: true, cost_price: 100, sort_order: 0 }],
    rnp_daily_data: Array.from({ length: 5 }, (_, d) => ({ cabinet_id: CAB, nm_id: 1001, date: day(d), orders_count: 10, orders_sum: 10000, sales_count: 10, sales_sum: 10000, realization: 10000, to_transfer: 7000, delivery_sum: 1000, storage_sum: 100, penalty_sum: 50, ad_spend: 200 })),
};
const LADDER = ['Реализация', 'Комиссия', 'Комиссия %', 'Эквайринг', 'Логистика', 'Хранение', 'Приёмка и обработка', 'Штрафы', 'Прочие удержания и доплаты', 'Реклама (РК)', 'Фулфилмент', 'Налог', 'К выводу', 'Себестоимость', 'Прибыль'];

(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true, rnp_cabinet_totals: Array.from({ length: 5 }, (_, d) => ({ d: day(d), realization: 10000, to_transfer: 7000, delivery: 1000, storage: 100, penalty: 50, deduction: 350, acceptance: 0, to_withdraw: 5000, ad_spend: 200, acquiring: 0, compensation: 0, additional: 0 })), rnp_fin_by_nm: Array.from({ length: 5 }, (_, d) => ({ d: day(d), nm_id: 1001, acquiring: 100, compensation: 0, comm_base: 1000, comm_true: 280, acceptance: 30, pen_dims: 20, pen_accept: 0, pen_sub: 0, pen_cancel: 10, pen_pvz: 0, pen_supply: 0, pen_other: 0 })), rnp_cabinet_fin_split: Array.from({ length: 5 }, (_, d) => ({ d: day(d), pen_dims: 0, pen_accept: 0, pen_sub: 0, pen_cancel: 0, pen_pvz: 0, pen_supply: 0, pen_other: 50, ded_adv: 300, ded_jam: 50, ded_util: 0, ded_other: 0 })), rnp_cabinet_comm: Array.from({ length: 5 }, (_, d) => ({ d: day(d), comm_base: 10000, comm_true: 3000 })), rnp_log_split_by_nm: Array.from({ length: 5 }, (_, d) => ({ d: day(d), nm_id: 1001, log_sale: 300, log_cancel_to: 400, log_cancel_from: 200, log_return: 50, log_other: 50 })), rnp_cabinet_log_split: Array.from({ length: 5 }, (_, d) => ({ d: day(d), log_sale: 300, log_cancel_to: 400, log_cancel_from: 200, log_return: 50, log_other: 50 })) }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => { const s = document.getElementById('nr-splash'); if (s) s.remove(); NrMp.set('wb'); showTab('rnp'); });
        await page.waitForFunction(() => [...document.querySelectorAll('#tab-rnp tr')].some((r) => /^Реализация/.test((r.children[0] || {}).innerText || '')), null, { timeout: 15000 });
        const labels = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => ((r.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/^[▸▾]\s*|\s*[▸▾]$/g, '')));
        const got = (await labels()).filter((t) => LADDER.includes(t));
        const first = []; got.forEach((t) => { if (!first.includes(t)) first.push(t); });
        // «Общий» видит все строки, в порядке лесенки
        const idx = first.map((t) => LADDER.indexOf(t));
        assert.deepStrictEqual(idx, [...idx].sort((a, b) => a - b), 'порядок строк: ' + first.join(' → '));
        for (const need of ['Реализация', 'Логистика', 'Реклама (РК)', 'Себестоимость', 'К выводу', 'Прибыль']) assert.ok(first.includes(need), 'есть строка «' + need + '»: ' + first.join(', '));
        assert.ok(!(await labels()).includes('В доставке'), 'у WB строки «В доставке» нет (она только у Ozon)');
        assert.ok(!first.includes('Налог') && !first.includes('Фулфилмент'), 'по умолчанию «Налог» (тумблер выключен) и «Фулфилмент» (ползунок выключен) не показываются: ' + first.join(', '));
        const ADS = ['Расход', 'Показы', 'Клики', 'Корзины', 'Заказы', 'Выручка', 'CTR', 'CPC', 'CPM', 'CR', 'CPO', 'ДРР %', 'ДРРп %', 'ROAS'];
        const allLabels = await labels(), adIdx = ADS.map((t) => allLabels.indexOf(t));
        assert.ok(adIdx.every((i) => i >= 0) && adIdx.every((v, k) => k === 0 || v > adIdx[k - 1]), 'рекламный блок по цепочке: ' + allLabels.join(' | '));
        assert.ok(!allLabels.includes('Доля рекламы %'), '«Доля рекламы %» убрана');
        console.log('ok   РНП: расходы лесенкой (' + first.length + ' строк в верном порядке)');
        // сверка с финотчётом: «К выводу» = перечисление − логистика − хранение − штрафы − ВСЕ удержания; реклама = «WB Продвижение», в «Прочие» она не входит
        const readRow = (name) => page.evaluate((n) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => ((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/\s*[▸▾]$/, '') === n); if (!r) return null; return Number(String(r.querySelector('td:last-child').innerText).replace(/[^0-9,.-]/g, '').replace(',', '.')); }, name);
        await page.waitForFunction(() => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Прочие удержания/.test((x.children[0] || {}).innerText || '')); return r && /[1-9]/.test(r.querySelector('td:last-child').innerText); }, null, { timeout: 8000 });
        const adRow = await readRow('Реклама (РК)'), othRow = await readRow('Прочие удержания и доплаты'), payRow = await readRow('К выводу');
        assert.strictEqual(adRow, 1500, 'реклама в расходах = удержание «WB Продвижение» (300 × 5 дней): ' + adRow);
        assert.strictEqual(othRow, 250, 'в «Прочих удержаниях» нет рекламы, только «Джем» (50 × 5 дней): ' + othRow);
        assert.strictEqual(payRow, 5 * (7000 - 1000 - 100 - 50 - 350), '«К выводу» сходится с формулой WB: ' + payRow);
        // налог: по умолчанию тумблер выключен и строки нет; включили, ставка 10% от реализации, строка встаёт перед себестоимостью
        const read = (name) => page.evaluate((n) => { const r = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => ((x.children[0] || {}).innerText || '').replace(/\s+/g, ' ').trim().replace(/\s*[▸▾]$/, '') === n); if (!r) return null; const c = r.querySelector('td:last-child, th:last-child'); return Number(String(c.innerText).replace(/[^0-9,.-]/g, '').replace(',', '.')); }, name);
        const profit0 = await read('Прибыль');
        await page.evaluate(() => RNP.setTaxPct('10')); await page.waitForTimeout(600);
        assert.strictEqual(await read('Налог'), null, 'ставка есть, но тумблер выключен: налога нет');
        assert.strictEqual(await read('Прибыль'), profit0, 'прибыль не меняется, пока тумблер выключен');
        await page.evaluate(() => RNP.setTaxOn(true)); await page.waitForTimeout(800);
        const profit1 = await read('Прибыль'), tax1 = await read('Налог'), real = await read('Реализация'), payout1 = await read('К выводу');
        assert.ok(tax1 > 0 && Math.abs(tax1 - real * 0.1) <= Math.max(2, real * 0.002), 'налог 10% от реализации: ' + tax1 + ' из ' + real);
        assert.ok(profit1 < profit0 && Math.abs((profit0 - profit1) - tax1) <= 3, 'прибыль уменьшилась на налог: ' + profit0 + ' → ' + profit1);
        const cost1 = await read('Себестоимость'); assert.ok(Math.abs(payout1 - cost1 - profit1) <= 2, 'К выводу − себестоимость = прибыль: ' + payout1 + ' − ' + cost1 + ' ≠ ' + profit1);
        const order = await labels(); assert.ok(order.indexOf('Налог') < order.indexOf('К выводу') && order.indexOf('К выводу') < order.indexOf('Себестоимость') && order.indexOf('Себестоимость') < order.indexOf('Прибыль'), 'налог стоит перед себестоимостью');
        console.log('ok   налог 10% от реализации (' + tax1 + ') вычитается из прибыли (' + profit0 + ' → ' + profit1 + ')');
        // раскрытие: «Комиссия» показывает процент, «Прочие удержания и доплаты» и «Штрафы» показывают виды; стрелки синие
        await page.evaluate(() => { RNP.pick('general'); }); await page.waitForTimeout(1200);
        const arrows = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp .rnp-split-toggle')].map((e) => ({ t: e.innerText.replace(/\s+/g, ' ').trim(), c: getComputedStyle(e.querySelector('.rnp-split-arrow')).color, o: Number(getComputedStyle(e.querySelector('.rnp-split-arrow')).opacity) })));
        for (const need of ['Штрафы', 'Прочие удержания и доплаты']) assert.ok(arrows.some((a) => a.t.replace(/ [▸▾]$/, '') === need), 'у строки «' + need + '» есть стрелка раскрытия: ' + JSON.stringify(arrows.map((a) => a.t)));
        assert.ok(arrows.every((a) => a.c !== 'rgb(37, 99, 235)' && a.o > 0 && a.o < 0.6), 'стрелки не синие, а чёрные и еле заметные: ' + JSON.stringify(arrows));
        await page.evaluate(() => { for (const k of ['other_net_sum', 'penalty_sum', 'delivery_sum']) RNP.toggleSplit(k); }); await page.waitForTimeout(600);
        const open = [...new Set(await labels())];
        for (const need of ['Подписка «Джем»', 'Доплаты (минус)', 'Габариты', 'Продажа → клиенту', 'Отмена → клиенту', 'Возврат ← от клиента', 'Доля отмен %']) assert.ok(open.includes(need), 'после раскрытия есть «' + need + '»');
        const lg = await page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim())).filter((c) => /^(Отмена → клиенту|Доля отмен %)/.test(c[0])));
        assert.ok(lg.length === 2 && lg.every((r) => r.slice(1).some((x) => /[1-9]/.test(x))), 'логистика по причинам показывает цифры: ' + JSON.stringify(lg));
        console.log('ok   раскрытие строк: комиссия в процентах, прочие удержания и штрафы по видам, стрелки синие');
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        const cpGen = await (async () => { const r = await page.evaluate(() => { const t = [...document.querySelectorAll('#tab-rnp table tr')].find((x) => /^Комиссия %/.test(((x.children[0] || {}).innerText || '').trim())); return t ? t.querySelector('td:last-child').innerText : null; }); return Number(String(r).replace(/[^0-9,.-]/g, '').replace(',', '.')); })();
        assert.ok(Math.abs(cpGen - 30) < 0.3, '«Комиссия %» в «Общем» считается от цены продавца (30%): ' + cpGen);
        await page.evaluate(() => RNP.pick(1001)); await page.waitForTimeout(1200);
        // раскрытие строки не пересобирает весь лист: таблица и шапка остаются теми же узлами, прокрутка на месте
        await page.evaluate(() => RNP.pick(1001)); await page.waitForTimeout(1500);
        const keep = await page.evaluate(async () => {
            const body = document.getElementById('rnp-sheet-body'), tbl = body.querySelector('table'), headSel = '.rnp-head-wide, .rnp-article-panel, .rnp-head-wide-info', head = body.querySelector(headSel);
            body.scrollTop = 120; const st = body.scrollTop;
            const tgl = [...document.querySelectorAll('.rnp-split-toggle')].find((e) => /Логистика/.test(e.innerText));
            const rowsBefore = document.querySelectorAll('#rnp-sheet-body tbody tr').length;
            tgl.click(); await new Promise((r) => setTimeout(r, 700));
            return { sameTable: tbl === body.querySelector('table'), sameHead: !head || head === body.querySelector(headSel), scroll: body.scrollTop === st, rowsChanged: document.querySelectorAll('#rnp-sheet-body tbody tr').length !== rowsBefore };
        });
        assert.deepStrictEqual(keep, { sameTable: true, sameHead: true, scroll: true, rowsChanged: true }, 'раскрытие «Логистики» не обновляет весь лист: ' + JSON.stringify(keep));
        await page.evaluate(() => RNP.toggleSplit('delivery_sum'));
        console.log('ok   раскрытие строки не перерисовывает лист целиком');
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        // «Общее по артикулам» и один артикул: лесенка та же, «Прибыль на единицу» только у одного артикула
        const labelsOf = async () => [...new Set(await labels())];
        assert.ok(!(await labelsOf()).includes('Прибыль на единицу') && !(await labelsOf()).includes('От WB на единицу') && !(await labelsOf()).includes('Логистика на единицу') && !(await labelsOf()).includes('Хранение на единицу'), 'в «Общем» «Прибыль на единицу» не показывается');
        await page.evaluate(() => RNP.pick('byart')); await page.waitForTimeout(1500);
        const byart = (await labelsOf()).filter((t) => LADDER.includes(t));
        assert.ok(byart.includes('Реализация') && byart.includes('Себестоимость') && byart.includes('Прибыль'), '«Общее по артикулам»: ' + byart.join(', '));
        await page.evaluate(() => RNP.pick(1001)); await page.waitForTimeout(1500);
        const one = await labelsOf();
        assert.ok(one.includes('К перечислению') && one.includes('От WB на единицу') && one.includes('Комиссия') && one.includes('Комиссия %') && one.includes('Эквайринг'), 'у артикула есть Комиссия, Комиссия %, Эквайринг, К перечислению, От WB на единицу: ' + one.slice(0, 20).join(', '));
        const tt = await read('К перечислению'), tu = await read('От WB на единицу'); assert.ok(tt > 0 && tu > 0 && Math.abs(tt / tu - Math.round(tt / tu)) < 0.1, 'на единицу = К перечислению ÷ штуки: ' + tt + ' / ' + tu);
        assert.ok(one.includes('Прибыль на единицу') && one.includes('Налог'), 'у одного артикула есть «Прибыль на единицу» и «Налог»: ' + one.slice(0, 40).join(', '));
        const cm = await read('Комиссия'), cp = await read('Комиссия %'), rz = await read('Реализация'), aq = await read('Эквайринг'), tt2 = await read('К перечислению');
        assert.ok(cm > 0 && Math.abs(cm + aq + tt2 - rz) <= 3 && Math.abs(cp - 28) < 0.2, 'комиссия + эквайринг + к перечислению = реализация, процент от цены продавца (28%): ' + [rz, cm, cp, aq, tt2].join(' / '));
        const perUnit = await labels();
        for (const need of ['Приёмка и обработка', 'Логистика на единицу', 'Хранение на единицу', 'Реклама на единицу']) assert.ok(perUnit.includes(need), 'у артикула есть «' + need + '»: ' + perUnit.join(' | '));
        const accRow = await read('Приёмка и обработка'); assert.ok(accRow > 0, 'приёмка у артикула не нулевая: ' + accRow);
        const penFind = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim())).find((c) => /^Габариты/.test(c[0])));
        let pen1 = await penFind(); if (!pen1) { await page.evaluate(() => RNP.toggleSplit('penalty_sum')); await page.waitForTimeout(600); pen1 = await penFind(); }
        assert.ok(pen1 && pen1.slice(1).some((x) => /[1-9]/.test(x)), 'штрафы у артикула раскрываются по видам: ' + JSON.stringify(pen1));
        const oneIdx = (await labels()).indexOf('К выводу на единицу'), pay = await read('К выводу'), payU = await read('К выводу на единицу');
        assert.ok(oneIdx > (await labels()).indexOf('К выводу') && payU !== null, '«К выводу на единицу» стоит после «К выводу»');
        const findLg = () => page.evaluate(() => [...document.querySelectorAll('#tab-rnp table tr')].map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim())).find((c) => /^Отмена → клиенту/.test(c[0])));
        let lg1 = await findLg(); if (!lg1) { await page.evaluate(() => RNP.toggleSplit('delivery_sum')); await page.waitForTimeout(600); lg1 = await findLg(); }
        assert.ok(lg1 && lg1.slice(1).some((x) => /[1-9]/.test(x)), 'у артикула «Логистика» раскрывается по причинам: ' + JSON.stringify(lg1));
        console.log('ok   «Общее по артикулам» и один артикул: лесенка на месте, «Прибыль на единицу» только у артикула');
        // подсветка строки и столбца под курсором стоит ровно под курсором, и при масштабе страницы тоже
        await page.evaluate(() => RNP.pick('general')); await page.waitForTimeout(1200);
        for (const zoom of [1, 0.75]) {
            await page.evaluate((z) => { const t = document.getElementById('tab-rnp'); if (t) t.style.zoom = String(z); }, zoom);
            await page.waitForTimeout(300);
            const td = page.locator('#tab-rnp .rnp-sheet-table tr:has-text("Реализация") td').nth(4);
            await td.scrollIntoViewIfNeeded(); await td.hover(); await page.waitForTimeout(300);
            const m = await page.evaluate(() => { const r = document.querySelector('.rnp-xh-row'), c = document.querySelector('.rnp-xh-col'); const q = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }; const tdE = document.querySelector('#tab-rnp .rnp-sheet-table td:hover'); return { row: r && getComputedStyle(r).display !== 'none' ? q(r) : null, col: c && getComputedStyle(c).display !== 'none' ? q(c) : null, td: tdE ? q(tdE) : null, tr: tdE ? q(tdE.parentElement) : null }; });
            assert.ok(m.row && m.col && m.td, 'подсветка показана при zoom ' + zoom + ': ' + JSON.stringify(m));
            assert.ok(Math.abs(m.row[1] - m.tr[1]) <= 2 && Math.abs(m.row[3] - m.tr[3]) <= 2, 'строка подсвечена на своём месте (zoom ' + zoom + '): ' + JSON.stringify([m.row, m.tr]));
            assert.ok(Math.abs(m.col[0] - m.td[0]) <= 2 && Math.abs(m.col[2] - m.td[2]) <= 2, 'столбец подсвечен на своём месте (zoom ' + zoom + '): ' + JSON.stringify([m.col, m.td]));
        }
        await page.evaluate(() => { const t = document.getElementById('tab-rnp'); if (t) t.style.zoom = ''; });
        console.log('ok   подсветка под курсором стоит на месте (масштаб 100% и 75%)');
        assert.deepStrictEqual(env.errors, [], 'ошибок скриптов нет: ' + env.errors.join('; '));
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();
