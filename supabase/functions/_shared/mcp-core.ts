// MCP-сервер для личного ИИ клиента (Claude, ChatGPT): только чтение данных СВОИХ кабинетов.
// Протокол MCP (JSON-RPC) здесь, доступ к данным передаёт вызывающая функция, поэтому всё проверяется тестом.
// deno-lint-ignore-file no-explicit-any

export interface McpCab { id: string; name: string }
export interface McpData {
    cabinets(): Promise<McpCab[]>;
    stocks(cabId: string, article?: string): Promise<any[]>;
    orders(cabId: string, days: number): Promise<any[]>;
    finance(cabId: string, days: number): Promise<any[]>;
    penalties(cabId: string, days: number): Promise<any[]>;
}

export const TOOLS = [
    { name: 'list_cabinets', description: 'Список ваших кабинетов Wildberries.', inputSchema: { type: 'object', properties: {} } },
    {
        name: 'get_stocks', description: 'Остатки по артикулам: FBO и FBS по размерам. Можно указать часть названия артикула.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string', description: 'Название кабинета' }, article: { type: 'string', description: 'Часть названия артикула' } }, required: ['cabinet'] },
    },
    {
        name: 'get_orders', description: 'Заказы по дням за последние дни: склад WB и склад продавца.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, days: { type: 'number', description: 'От 1 до 31, по умолчанию 7' } }, required: ['cabinet'] },
    },
    {
        name: 'get_finance', description: 'Финансы по дням: продажи, к перечислению, логистика, хранение, штрафы, итого к оплате.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, days: { type: 'number', description: 'От 1 до 31, по умолчанию 7' } }, required: ['cabinet'] },
    },
    {
        name: 'get_penalties', description: 'Штрафы и удержания с причиной: дата, сумма, основание (например, недовоз по поставке или невыполненный заказ), артикул и номер поставки.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, days: { type: 'number', description: 'От 1 до 31, по умолчанию 30' } }, required: ['cabinet'] },
    },
];

function pick(cabs: McpCab[], q: unknown): { cab?: McpCab; error?: string } {
    const s = String(q ?? '').trim().toLowerCase();
    if (!cabs.length) return { error: 'У вас пока нет доступных кабинетов.' };
    if (!s) return cabs.length === 1 ? { cab: cabs[0] } : { error: 'Укажите кабинет: ' + cabs.map((c) => c.name).join(', ') };
    const exact = cabs.filter((c) => c.name.toLowerCase() === s || c.id === s);
    const hit = exact.length ? exact : cabs.filter((c) => c.name.toLowerCase().includes(s));
    if (hit.length === 1) return { cab: hit[0] };
    return { error: hit.length ? 'Подходит несколько кабинетов: ' + hit.map((c) => c.name).join(', ') : 'Такого кабинета нет. Доступны: ' + cabs.map((c) => c.name).join(', ') };
}

const text = (v: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }], isError });
const clampDays = (v: unknown) => Math.min(31, Math.max(1, Math.round(Number(v) || 7)));

export async function callTool(name: string, args: any, data: McpData) {
    const cabs = await data.cabinets();
    if (name === 'list_cabinets') return text(cabs.map((c) => c.name));
    if (!['get_stocks', 'get_orders', 'get_finance', 'get_penalties'].includes(name)) return text('Неизвестный инструмент: ' + name, true);
    const r = pick(cabs, args?.cabinet);
    if (!r.cab) return text(r.error!, true);
    if (name === 'get_stocks') return text(await data.stocks(r.cab.id, args?.article ? String(args.article) : undefined));
    if (name === 'get_orders') return text(await data.orders(r.cab.id, clampDays(args?.days)));
    if (name === 'get_penalties') return text(await data.penalties(r.cab.id, Math.min(31, Math.max(1, Math.round(Number(args?.days) || 30)))));
    return text(await data.finance(r.cab.id, clampDays(args?.days)));
}

// Один запрос JSON-RPC. Для уведомлений ответа нет (null).
export async function handleRpc(msg: any, data: McpData): Promise<any | null> {
    const id = msg?.id;
    const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
    const err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(-32600, 'Invalid Request');
    if (id === undefined) return null;
    switch (msg.method) {
        case 'initialize':
            return ok({ protocolVersion: msg.params?.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'nr-space', version: '1.0.0' } });
        case 'ping': return ok({});
        case 'tools/list': return ok({ tools: TOOLS });
        case 'tools/call':
            try { return ok(await callTool(String(msg.params?.name || ''), msg.params?.arguments || {}, data)); }
            catch (e) { return ok(text('Не удалось получить данные: ' + String((e as Error)?.message || e), true)); }
        default: return err(-32601, 'Method not found');
    }
}
