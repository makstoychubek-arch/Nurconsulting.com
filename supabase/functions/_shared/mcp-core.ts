// MCP-сервер для личного ИИ клиента (Claude, ChatGPT): только чтение данных СВОИХ кабинетов.
// Протокол MCP (JSON-RPC) здесь, доступ к данным передаёт вызывающая функция, поэтому всё проверяется тестом.
// deno-lint-ignore-file no-explicit-any

export interface McpCab { id: string; name: string }
export interface McpWrite {
    allowed(): Promise<boolean>;
    cabinets(): Promise<McpCab[]>;
    propose(cabId: string, changes: any[]): Promise<any>;
    apply(changeId: string): Promise<any>;
    cancel(changeId: string): Promise<any>;
}
export interface McpRange { from: string; to: string }
export type McpGroup = 'day' | 'article' | 'day_article';
export interface McpData {
    write?: McpWrite;
    cabinets(): Promise<McpCab[]>;
    stocks(cabId: string, article?: string): Promise<any[]>;
    orders(cabId: string, r: McpRange, group: McpGroup): Promise<any[]>;
    sales(cabId: string, r: McpRange, group: McpGroup): Promise<any[]>;
    finance(cabId: string, r: McpRange): Promise<any[]>;
    penalties(cabId: string, r: McpRange): Promise<any[]>;
    adCampaigns(cabId: string, status: string, r: McpRange | null): Promise<any>;
    adStats(cabId: string, r: McpRange, campaignId: number | null, group: 'day' | 'campaign'): Promise<any>;
}
export const MAX_RANGE_DAYS = 90;

export const TOOLS = [
    { name: 'list_cabinets', description: 'Список ваших кабинетов Wildberries.', inputSchema: { type: 'object', properties: {} } },
    {
        name: 'get_stocks', description: 'Остатки по артикулам: FBO и FBS по размерам. Можно указать часть названия артикула.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string', description: 'Название кабинета' }, article: { type: 'string', description: 'Часть названия артикула' } }, required: ['cabinet'] },
    },
    {
        name: 'get_orders', description: 'Заказы (статистика WB) за выбранные даты: склад WB и склад продавца, отмены, сумма. group_by: day (по дням, по умолчанию), article (итого по артикулам за период), day_article (по дням и артикулам, не больше 31 дня). Даты: from и to (ГГГГ-ММ-ДД), не больше 90 дней; без дат берутся последние days дней.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, from: { type: 'string', description: 'Начало, ГГГГ-ММ-ДД' }, to: { type: 'string', description: 'Конец, ГГГГ-ММ-ДД (по умолчанию сегодня)' }, days: { type: 'number', description: 'Если дат нет: последние дни, от 1 до 90, по умолчанию 7' }, group_by: { type: 'string', enum: ['day', 'article', 'day_article'] } }, required: ['cabinet'] },
    },
    {
        name: 'get_sales', description: 'Выкупы (продажи по финотчёту WB) за выбранные даты: штуки, возвраты, сумма. group_by: day, article или day_article (до 31 дня). Даты: from и to, не больше 90 дней.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, days: { type: 'number' }, group_by: { type: 'string', enum: ['day', 'article', 'day_article'] } }, required: ['cabinet'] },
    },
    {
        name: 'get_finance', description: 'Финансы по дням за выбранные даты: продажи, к перечислению, логистика, хранение, штрафы, итого к оплате. Даты: from и to, не больше 90 дней.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, days: { type: 'number', description: 'Если дат нет: последние дни, от 1 до 90, по умолчанию 7' } }, required: ['cabinet'] },
    },
    {
        name: 'list_ad_campaigns', description: 'Рекламные кампании кабинета. status: all, active (идут), paused (на паузе), archive (завершённые). Если указать from/to, у каждой кампании будут итоги за период (затраты, показы, клики, заказы, сумма заказов), и кампании без активности за период не показываются.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, status: { type: 'string', enum: ['all', 'active', 'paused', 'archive'] }, from: { type: 'string' }, to: { type: 'string' }, days: { type: 'number' } }, required: ['cabinet'] },
    },
    {
        name: 'get_ad_stats', description: 'Статистика рекламы за выбранные даты: затраты, показы, клики, добавления в корзину, заказы, сумма заказов, CTR. group_by: day (по дням, по умолчанию) или campaign (итого по кампаниям). Можно указать campaign_id одной кампании, в том числе архивной. Даты: from и to, не больше 90 дней.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, days: { type: 'number' }, campaign_id: { type: 'number' }, group_by: { type: 'string', enum: ['day', 'campaign'] } }, required: ['cabinet'] },
    },
    {
        name: 'get_penalties', description: 'Штрафы и удержания (за выбранные даты from/to, не больше 90 дней) с причиной: дата, сумма, основание (например, недовоз по поставке или невыполненный заказ), артикул и номер поставки.',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, days: { type: 'number', description: 'Если дат нет: последние дни, от 1 до 90, по умолчанию 30' } }, required: ['cabinet'] },
    },
    {
        name: 'propose_price_change', description: 'ШАГ 1 из 2. Предложить новую цену или скидку (до 30 артикулов, цена со скидкой не больше чем на 25%). Ничего не меняет: возвращает «было → станет» и номер. Покажите это человеку и применяйте только после его явного «да».',
        inputSchema: { type: 'object', properties: { cabinet: { type: 'string' }, changes: { type: 'array', items: { type: 'object', properties: { article: { type: 'string', description: 'Артикул продавца' }, nm_id: { type: 'number' }, price: { type: 'number', description: 'Цена до скидки' }, discount: { type: 'number', description: 'Скидка продавца, %' } } } } }, required: ['cabinet', 'changes'] },
        annotations: { readOnlyHint: true },
    },
    {
        name: 'apply_change', description: 'ШАГ 2 из 2. Применить ранее предложенное изменение по его номеру. Менять можно только после явного согласия человека. Действует 15 минут.',
        inputSchema: { type: 'object', properties: { change_id: { type: 'string' } }, required: ['change_id'] },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    {
        name: 'cancel_change', description: 'Отменить предложенное, но ещё не применённое изменение.',
        inputSchema: { type: 'object', properties: { change_id: { type: 'string' } }, required: ['change_id'] },
        annotations: { readOnlyHint: false },
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
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const spanDays = (r: McpRange) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 86400000) + 1;
/** Период из from/to (ГГГГ-ММ-ДД, не больше 90 дней) или из days (последние дни). given: человек сам указал период. */
export function resolveRange(args: any, defDays: number): { r?: McpRange; error?: string; given: boolean } {
    const today = ymd(new Date());
    if (args?.from || args?.to) {
        const from = String(args?.from ?? '').trim();
        let to = String(args?.to ?? today).trim();
        if (!isDate(from) || !isDate(to)) return { error: 'Даты нужны в формате ГГГГ-ММ-ДД, например from: 2026-10-01, to: 2026-10-09.', given: true };
        if (to > today) to = today;
        if (to < from) return { error: 'Дата «to» раньше даты «from».', given: true };
        const r = { from, to };
        if (spanDays(r) > MAX_RANGE_DAYS) return { error: `За один запрос не больше ${MAX_RANGE_DAYS} дней. Запросите период по частям.`, given: true };
        return { r, given: true };
    }
    const days = Math.min(MAX_RANGE_DAYS, Math.max(1, Math.round(Number(args?.days) || defDays)));
    return { r: { from: ymd(new Date(Date.now() - days * 86400000)), to: today }, given: !!args?.days };
}
const GROUPS = ['day', 'article', 'day_article'];

export async function callTool(name: string, args: any, data: McpData) {
    const cabs = await data.cabinets();
    if (name === 'list_cabinets') return text(cabs.map((c) => c.name));
    if (['propose_price_change', 'apply_change', 'cancel_change'].includes(name)) {
        const w = data.write;
        if (!w || !(await w.allowed())) return text('Изменения выключены. Включите «Разрешить ИИ менять цены» в «Настройки → Интеграции» на сайте.', true);
        if (name === 'apply_change') return text(await w.apply(String(args?.change_id ?? '')));
        if (name === 'cancel_change') return text(await w.cancel(String(args?.change_id ?? '')));
        const wc = pick(await w.cabinets(), args?.cabinet);
        if (!wc.cab) return text(wc.error!, true);
        return text(await w.propose(wc.cab.id, Array.isArray(args?.changes) ? args.changes : []));
    }
    const READ = ['get_stocks', 'get_orders', 'get_sales', 'get_finance', 'get_penalties', 'list_ad_campaigns', 'get_ad_stats'];
    if (!READ.includes(name)) return text('Неизвестный инструмент: ' + name, true);
    const r = pick(cabs, args?.cabinet);
    if (!r.cab) return text(r.error!, true);
    if (name === 'get_stocks') return text(await data.stocks(r.cab.id, args?.article ? String(args.article) : undefined));
    const rg = resolveRange(args, name === 'get_penalties' ? 30 : 7);
    if (!rg.r) return text(rg.error!, true);
    if (name === 'get_orders' || name === 'get_sales') {
        const group = (GROUPS.includes(String(args?.group_by)) ? String(args.group_by) : 'day') as McpGroup;
        if (group === 'day_article' && spanDays(rg.r) > 31) return text('По дням и артикулам одновременно не больше 31 дня. Возьмите период короче или group_by: article.', true);
        return text(name === 'get_orders' ? await data.orders(r.cab.id, rg.r, group) : await data.sales(r.cab.id, rg.r, group));
    }
    if (name === 'get_penalties') return text(await data.penalties(r.cab.id, rg.r));
    if (name === 'list_ad_campaigns') {
        const st = ['all', 'active', 'paused', 'archive'].includes(String(args?.status)) ? String(args.status) : 'all';
        return text(await data.adCampaigns(r.cab.id, st, rg.given ? rg.r : null));
    }
    if (name === 'get_ad_stats') {
        const cid = Number(args?.campaign_id);
        return text(await data.adStats(r.cab.id, rg.r, Number.isFinite(cid) && cid > 0 ? cid : null, args?.group_by === 'campaign' ? 'campaign' : 'day'));
    }
    return text(await data.finance(r.cab.id, rg.r));
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
