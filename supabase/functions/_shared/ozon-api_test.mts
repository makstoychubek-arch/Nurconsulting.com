import assert from 'node:assert/strict';
import { buildPostingRows, buildProductRows, buildStockRows, matchByBarcode, ozonCall, OzonError } from './ozon-api.ts';

const creds = { clientId: '1', apiKey: 'k' };
const noSleep = async () => {};
const NOW = '2026-11-12T10:00:00Z';

// повтор на 429, потом успех
{
    let n = 0;
    const calls: string[] = [];
    const f = async (url: string, init: { headers: Record<string, string> }) => {
        n++;
        calls.push(url + '|' + init.headers['Client-Id']);
        return n < 3
            ? { ok: false, status: 429, text: async () => 'rate limit' }
            : { ok: true, status: 200, text: async () => '{"result":{"items":[]}}' };
    };
    const r = await ozonCall(creds, '/v3/product/list', {}, f as any, { sleep: noSleep });
    assert.deepEqual(r, { result: { items: [] } });
    assert.equal(n, 3);
    assert.equal(calls[0], 'https://api-seller.ozon.ru/v3/product/list|1');
}

// 403 (нет роли) не повторяем
{
    let n = 0;
    const f = async () => { n++; return { ok: false, status: 403, text: async () => 'forbidden' }; };
    await assert.rejects(ozonCall(creds, '/x', {}, f as any, { sleep: noSleep }), (e: unknown) => e instanceof OzonError && e.status === 403);
    assert.equal(n, 1);
}

// 5xx исчерпал повторы: ошибка с кодом
{
    const f = async () => ({ ok: false, status: 502, text: async () => 'upstream request failed' });
    await assert.rejects(ozonCall(creds, '/x', {}, f as any, { sleep: noSleep, retries: 2 }), (e: unknown) => e instanceof OzonError && e.status === 502);
}

// 200 с не-JSON (как «upstream request failed») считаем ошибкой
{
    const f = async () => ({ ok: true, status: 200, text: async () => 'upstream request failed' });
    await assert.rejects(ozonCall(creds, '/x', {}, f as any, { sleep: noSleep }), (e: unknown) => e instanceof OzonError);
}

// товары: цены, комиссии, габариты, штрихкод без внутреннего OZN
{
    const rows = buildProductRows('cab',
        [{ product_id: 11, offer_id: 'a_42', sku: 100, archived: false }, { product_id: 12, offer_id: 'a_44', sku: 101, archived: true }],
        [{ id: 11, name: 'Костюм', barcodes: ['2042127578633', 'OZN2014682905'] }, { id: 12, name: 'Костюм 2', barcodes: [] }],
        [{ product_id: 11, acquiring: 52.99, volume_weight: 1.1, commissions: { sales_percent_fbo: 21, sales_percent_fbs: 47, fbo_deliv_to_customer_amount: 26.45 }, price: { price: '5299', old_price: '8982', min_price: '5299', currency_code: 'KGS' } }],
        [{ id: 11, depth: 450, width: 350, height: 30, weight: 750 }], NOW);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].barcode, '2042127578633');
    assert.equal(rows[0].price, 5299);
    assert.equal(rows[0].commission_fbo_pct, 21);
    assert.equal(rows[0].depth_mm, 450);
    assert.equal(rows[0].deliv_to_customer, 26.45);
    assert.equal(rows[1].barcode, null);
    assert.equal(rows[1].price, null);
    assert.equal(rows[1].archived, true);
    assert.equal(rows[1].currency, 'KGS');
}

// остатки: две записи одной схемы складываются, неизвестная схема пропускается
{
    const rows = buildStockRows('cab', [
        { product_id: 1, offer_id: 'x', stocks: [{ type: 'fbo', present: 5, reserved: 1 }, { type: 'fbo', present: 2, reserved: 0 }, { type: 'fbs', present: 3, reserved: 3 }, { type: 'crossborder', present: 9, reserved: 0 }] },
        { product_id: 2, offer_id: 'y', stocks: [] },
    ], NOW);
    assert.equal(rows.length, 2);
    const fbo = rows.find((r) => r.scheme === 'fbo')!;
    assert.equal(fbo.present, 7);
    assert.equal(fbo.reserved, 1);
    assert.equal(rows.find((r) => r.scheme === 'fbs')!.present, 3);
}

// отправления: сумма, отмена, причина, город
{
    const rows = buildPostingRows('cab', [
        { posting_number: '1-1', order_id: 7, status: 'cancelled', substatus: 'posting_canceled', cancellation: { cancel_reason: 'товар не подошёл' }, created_at: '2026-11-10T08:00:00Z', in_process_at: '2026-11-10T08:00:10Z', analytics_data: { city: 'Москва', warehouse_name: 'ХАБ' }, products: [{ offer_id: 'a_42', sku: 100, quantity: 2, price: { amount: '1000', currency: 'KGS' } }] },
        { posting_number: '2-1', status: 'delivered', created_at: '2026-11-10T09:00:00Z', products: [{ offer_id: 'b', sku: 5, quantity: 1, price: { amount: '250.5', currency: 'KGS' } }] },
    ], NOW);
    assert.equal(rows[0].total_amount, 2000);
    assert.equal(rows[0].cancelled, true);
    assert.equal(rows[0].cancel_reason, 'товар не подошёл');
    assert.equal(rows[0].city, 'Москва');
    assert.equal(rows[1].cancelled, false);
    assert.equal(rows[1].total_amount, 250.5);
    assert.equal(rows[1].city, null);
}

// связь по штрихкоду: без дублей, пустой штрихкод пропускаем
{
    const m = matchByBarcode('cab',
        [{ product_id: 1, offer_id: 'a_42', barcode: '111' }, { product_id: 1, offer_id: 'a_42', barcode: '111' }, { product_id: 2, offer_id: 'a_44', barcode: null }, { product_id: 3, offer_id: 'z', barcode: '999' }],
        [{ nm_id: 500, barcode: '111' }]);
    assert.equal(m.length, 1);
    assert.deepEqual(m[0], { cabinet_id: 'cab', nm_id: 500, offer_id: 'a_42', ozon_product_id: 1, method: 'barcode' });
}

console.log('ozon-api: ok');
