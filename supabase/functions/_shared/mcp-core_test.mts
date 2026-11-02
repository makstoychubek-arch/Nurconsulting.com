// MCP для клиента: протокол, выбор кабинета и то, что чужие кабинеты не видны.
import assert from 'node:assert/strict';
import { handleRpc, TOOLS, type McpData } from './mcp-core.ts';

const calls: string[] = [];
const data: McpData = {
    cabinets: async () => [{ id: 'c1', name: 'Zevina 1' }, { id: 'c2', name: 'Baza' }],
    stocks: async (c, a) => { calls.push(`stocks:${c}:${a ?? ''}`); return [{ name: 'Свитер', fbo: 3, fbs: 5 }]; },
    orders: async (c, r, g) => { calls.push(`orders:${c}:${r.from}:${r.to}:${g}`); return []; },
    sales: async (c, r, g) => { calls.push(`sales:${c}:${r.from}:${r.to}:${g}`); return []; },
    finance: async (c, r) => { calls.push(`finance:${c}:${r.from}:${r.to}`); return []; },
    penalties: async (c, r) => { calls.push(`penalties:${c}:${r.from}:${r.to}`); return []; },
    adCampaigns: async (c, st, r) => { calls.push(`adc:${c}:${st}:${r ? r.from + '..' + r.to : '-'}`); return {}; },
    adStats: async (c, r, id, g) => { calls.push(`ads:${c}:${r.from}:${r.to}:${id ?? '-'}:${g}`); return {}; },
};

const init = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, data);
assert.equal(init.result.serverInfo.name, 'nr-space');
assert.ok(init.result.capabilities.tools);

assert.equal(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, data), null, 'уведомление без ответа');

const list = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, data);
assert.equal(list.result.tools.length, TOOLS.length);
assert.ok(list.result.tools.every((t: any) => !/(set|update|delete|create|write)/.test(t.name)), 'в названиях нет опасных слов');
const WRITE = ['propose_price_change', 'apply_change', 'cancel_change'];
assert.ok(list.result.tools.filter((t: any) => !WRITE.includes(t.name)).every((t: any) => /^(get_|list_)/.test(t.name)), 'кроме трёх инструментов изменения всё только чтение');

const call = async (name: string, args: any) => (await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } }, data)).result;

assert.match((await call('list_cabinets', {})).content[0].text, /Zevina 1/);
await call('get_stocks', { cabinet: 'zevina', article: 'свитер' });
assert.deepEqual(calls.at(-1), 'stocks:c1:свитер', 'кабинет по части названия, артикул передан');
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
await call('get_orders', { cabinet: 'Baza', days: 999 });
assert.equal(calls.at(-1), `orders:c2:${day(90)}:${day(0)}:day`, 'без дат: не больше 90 последних дней');
await call('get_finance', { cabinet: 'Baza' });
assert.equal(calls.at(-1), `finance:c2:${day(7)}:${day(0)}`, 'по умолчанию 7 дней');
await call('get_penalties', { cabinet: 'Baza' });
assert.equal(calls.at(-1), `penalties:c2:${day(30)}:${day(0)}`, 'штрафы по умолчанию за 30 дней');

// выбор дат
await call('get_orders', { cabinet: 'Baza', from: '2026-10-01', to: '2026-10-09', group_by: 'article' });
assert.equal(calls.at(-1), 'orders:c2:2026-10-01:2026-10-09:article', 'выбранные даты и разбивка по артикулам доходят до данных');
await call('get_sales', { cabinet: 'Baza', from: '2026-10-01', to: '2026-10-09', group_by: 'day_article' });
assert.equal(calls.at(-1), 'sales:c2:2026-10-01:2026-10-09:day_article');
const tooLong = await call('get_orders', { cabinet: 'Baza', from: '2026-01-01', to: '2026-06-01' });
assert.equal(tooLong.isError, true, 'период длиннее 90 дней отклоняется');
assert.match(tooLong.content[0].text, /90 дней/);
const badDate = await call('get_finance', { cabinet: 'Baza', from: 'вчера' });
assert.equal(badDate.isError, true, 'кривая дата объясняется человеку');
const reversed = await call('get_penalties', { cabinet: 'Baza', from: '2026-10-09', to: '2026-10-01' });
assert.equal(reversed.isError, true, 'конец раньше начала отклоняется');
const longDa = await call('get_orders', { cabinet: 'Baza', from: '2026-08-01', to: '2026-09-30', group_by: 'day_article' });
assert.equal(longDa.isError, true, 'по дням и артикулам не больше 31 дня');

// реклама
await call('list_ad_campaigns', { cabinet: 'Baza', status: 'archive', from: '2026-10-09', to: '2026-10-09' });
assert.equal(calls.at(-1), 'adc:c2:archive:2026-10-09..2026-10-09', 'архивные кампании с итогами за выбранный день');
await call('list_ad_campaigns', { cabinet: 'Baza' });
assert.equal(calls.at(-1), 'adc:c2:all:-', 'без периода итоги не считаются');
await call('get_ad_stats', { cabinet: 'Baza', from: '2026-10-01', to: '2026-10-09', campaign_id: 39497335, group_by: 'campaign' });
assert.equal(calls.at(-1), 'ads:c2:2026-10-01:2026-10-09:39497335:campaign');

const off = await call('apply_change', { change_id: 'x' });
assert.equal(off.isError, true, 'без разрешения на ключе изменить нельзя');
assert.match(off.content[0].text, /выключены/);
const wlog: string[] = [];
const dataW: McpData = { ...data, write: {
    allowed: async () => true,
    cabinets: async () => [{ id: 'c2', name: 'Baza' }],
    propose: async (c, ch) => { wlog.push(`propose:${c}:${ch.length}`); return { change_id: 'abc' }; },
    apply: async (id) => { wlog.push(`apply:${id}`); return { применено: 1 }; },
    cancel: async (id) => { wlog.push(`cancel:${id}`); return {}; },
} };
const callW = async (name: string, args: any) => (await handleRpc({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name, arguments: args } }, dataW)).result;
await callW('propose_price_change', { cabinet: 'Baza', changes: [{ article: 'a', price: 1 }] });
assert.equal(wlog.at(-1), 'propose:c2:1');
assert.equal((await callW('propose_price_change', { cabinet: 'Zevina 1', changes: [] })).isError, true, 'писать можно только в кабинетах, где вы владелец');
await callW('apply_change', { change_id: 'abc' });
assert.equal(wlog.at(-1), 'apply:abc');

const foreign = await call('get_stocks', { cabinet: 'Чужой кабинет' });
assert.equal(foreign.isError, true, 'чужой кабинет недоступен');
assert.ok(!calls.some((c) => c.includes('Чужой')), 'в данные чужой кабинет не пошёл');
const noCab = await call('get_stocks', {});
assert.equal(noCab.isError, true, 'при двух кабинетах нужно указать, какой');
assert.equal((await call('drop_table', {})).isError, true, 'неизвестный инструмент отклонён');
assert.equal((await handleRpc({ jsonrpc: '2.0', id: 4, method: 'resources/list' }, data)).error.code, -32601);
assert.equal((await handleRpc({ foo: 1 }, data)).error.code, -32600);
console.log('mcp-core_test: ok');
