/** Смена цен: если сервер просит код подтверждения, сайт спрашивает его и повторяет отправку с кодом. Запуск: node e2e/price-confirm.e2e.js */
const assert = require('assert');
const { serve, openApp, chromium, ADMIN_ID, CAB } = require('./harness.js');
const tables = { spaces: [{ id: 's0', user_id: ADMIN_ID, email: 'makstoychubek@gmail.com', status: 'active', tariff_plan: 'vip', is_super_admin: true, first_name: 'M', last_name: 'T', full_name: 'M T' }], cabinets: [{ id: CAB, name: 'T', wb_token_set: true, user_id: ADMIN_ID }] };
(async () => {
    const srv = await serve();
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
    try {
        const env = await openApp(browser, 'http://127.0.0.1:' + srv.address().port, { userId: ADMIN_ID, email: 'makstoychubek@gmail.com', latencyMs: 20, tables, rpcs: { is_super_admin: true }, functions: { 'wb-proxy': async () => ({}) } });
        const { page } = env;
        await page.evaluate(() => {
            window.__calls = [];
            window.callWbProxy = async (action, params) => {
                window.__calls.push({ action, confirm: params.confirm || null });
                if (!params.confirm) return { confirmRequired: true, confirmId: 'cid1', count: 3, maxDrop: 0.45, minutes: 10 };
                if (params.confirm.code === '111111') return { confirmRequired: true, confirmId: 'cid1', error: 'Неверный код', attemptsLeft: 4 };
                return { uploadId: 77 };
            };
        });
        // 1. неверный код, потом верный: два повтора с кодом, итог из WB
        await page.evaluate(() => { window.__p = NrPriceSend('cab', { items: [{ nmID: 1, price: 100 }] }).then((r) => { window.__res = r; }); });
        await page.waitForSelector('.nru-code input', { timeout: 5000 });
        assert.ok(await page.evaluate(() => /45%/.test(document.querySelector('.nru-code').textContent) && /Telegram/.test(document.querySelector('.nru-code').textContent)), 'в окне видно снижение и что код ушёл в Telegram');
        await page.fill('.nru-code input', '111111'); await page.click('.nru-ft .nru-b.p');
        await page.waitForFunction(() => [...document.querySelectorAll('.nru-code')].some((e) => /Неверный код/.test(e.textContent)), null, { timeout: 5000 });
        console.log('ok   после неверного кода окно просит ввести заново');
        await page.waitForTimeout(400);
        await page.locator('.nru-code input').last().fill('482913'); await page.locator('.nru-ft .nru-b.p').last().click();
        await page.waitForFunction(() => window.__res, null, { timeout: 5000 });
        const r = await page.evaluate(() => ({ res: window.__res, calls: window.__calls.filter((c) => c.action === 'prices_set') }));
        assert.strictEqual(r.res.uploadId, 77, 'после верного кода цены ушли: ' + JSON.stringify(r.res));
        assert.deepStrictEqual(r.calls.map((c) => c.confirm && c.confirm.code), [null, '111111', '482913'], 'коды: ' + JSON.stringify(r.calls));
        console.log('ok   крупное снижение: сайт спрашивает код, неверный просит ввести заново, верный отправляет цены');
        // 2. отмена окна: цены не отправляются
        await page.evaluate(() => { window.__calls = []; window.__res = null; NrPriceSend('cab', { items: [{ nmID: 1, price: 100 }] }).then((x) => { window.__res = x; }); });
        await page.waitForSelector('.nru-code input', { timeout: 5000 });
        await page.click('.nru-ft .nru-b:not(.p)');
        await page.waitForFunction(() => window.__res, null, { timeout: 5000 });
        assert.ok(await page.evaluate(() => /отменена/.test(window.__res.error)), 'отмена: сообщение, что смена цен отменена');
        assert.strictEqual(await page.evaluate(() => window.__calls.filter((c) => c.action === 'prices_set').length), 1, 'после отмены в WB ничего не уходит');
        console.log('ok   отмена окна кода: цены не уходят');
        // 3. обычная смена цен без запроса кода проходит сразу
        await page.evaluate(() => { window.callWbProxy = async () => ({ uploadId: 5 }); });
        assert.strictEqual(await page.evaluate(() => NrPriceSend('cab', { items: [] }).then((x) => x.uploadId)), 5, 'без запроса кода ответ приходит сразу');
        console.log('ok   небольшая смена цен: код не нужен');
        assert.deepStrictEqual(env.errors.filter((e) => !/404|favicon/.test(e)), [], 'в консоли нет ошибок');
    } catch (e) { console.error('FAIL', e.message); process.exitCode = 1; } finally { await browser.close(); srv.close(); }
})();
