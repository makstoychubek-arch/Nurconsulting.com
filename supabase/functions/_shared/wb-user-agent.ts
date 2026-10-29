// Единый User-Agent и сервисный секрет во всех запросах к API Wildberries.
// Каталог «Решения для бизнеса» требует согласованный с WB User-Agent и секрет сервиса в заголовках каждого запроса.
// Значения берём из секретов WB_SERVICE_UA и WB_SERVICE_SECRET; пока их нет, подставляется общий User-Agent сервиса.
// Модуль подключается первой строкой функций, которые ходят в WB, и сам оборачивает fetch один раз.
// deno-lint-ignore-file no-explicit-any

const g = globalThis as any;

if (!g.__nrWbUa) {
    g.__nrWbUa = true;
    const env = (k: string): string => String(g.Deno?.env?.get?.(k) ?? '').trim();
    const ua = env('WB_SERVICE_UA') || 'NRSpace/1.0 (+https://nurcon.kg)';
    const secret = env('WB_SERVICE_SECRET');
    const original = typeof g.fetch === 'function' ? g.fetch.bind(g) : null;
    if (original) g.fetch = (input: any, init?: any) => {
        try {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input?.url ?? '');
            if (/^https:\/\/[a-z0-9-]+\.wildberries\.ru\//i.test(url)) {
                const headers = new Headers(init?.headers ?? (typeof input === 'object' && input?.headers ? input.headers : undefined));
                if (!headers.has('User-Agent')) headers.set('User-Agent', ua);
                if (secret && /-api\.wildberries\.ru\//i.test(url) && !headers.has('X-Client-Secret')) headers.set('X-Client-Secret', secret);
                return original(input, { ...(init ?? {}), headers });
            }
        } catch (_) { /* при любой ошибке отправляем запрос как есть */ }
        return original(input, init);
    };
}
