// «Обнови раздачи по дням» (владелец, 24 ноября 2026): сверяет лист «График раздач пижам» с листом «Раздачи Пижам» таблицы МАРС
// и приводит даты заказа в «Раздачах» к графику. Строки и блогеров не удаляет и не добавляет, меняет только колонку D (дата заказа):
// по каждому товару даты строк, отсортированных по дате, заменяются датами из графика в том же порядке. Если число строк и число мест в графике не совпало, товар пропускается и попадает в отчёт.
// Доступ: только сервис. Ключ Google-аккаунта берётся как у Алины и не отдаётся наружу. По умолчанию dry_run.
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/ /g, ' ').replace(/\s+/g, ' ');
const iso = (serial: number) => new Date(Math.round((serial - 25569) * 86400_000)).toISOString().slice(0, 10);
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
const colName = (i: number) => { let n = i + 1, s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const GRAPH_TAB = 'График раздач пижам';
const TABLE_TAB = 'Раздачи Пижам';

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dry = body.dry_run !== false;
    const sa = await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!sa) return json({ ok: false, error: 'Нет ключа Google-аккаунта' }, 503);
    let token: string;
    try { token = await googleAccessToken(sa); } catch (e) { return json({ ok: false, error: 'Google не принял ключ' }, 503); }
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const read = async (tab: string, range: string): Promise<unknown[][]> => {
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(q(tab) + '!' + range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`, { headers: H, signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error(`${tab}: ${r.status} ${(await r.text()).slice(0, 160)}`);
        return ((await r.json()).values || []) as unknown[][];
    };
    let graph: unknown[][], table: unknown[][];
    try { graph = await read(GRAPH_TAB, 'A1:AD200'); table = await read(TABLE_TAB, 'A1:X2000'); } catch (e) { return json({ ok: false, error: String((e as Error).message) }, 502); }

    // график: блоки начинаются со строки, где в колонке A стоит «АРТ»; строка +1 итог по дням, строка +2 даты, дальше запросы
    const sched = new Map<string, number[]>(); // товар (норм.) -> даты-серийники (с повторами по числу мест)
    const label = new Map<string, string>();
    const starts: number[] = [];
    graph.forEach((r, i) => { if (String(r[0] ?? '').trim() === 'АРТ') starts.push(i); });
    starts.forEach((s, bi) => {
        const end = bi + 1 < starts.length ? starts[bi + 1] : graph.length;
        const head = String(graph[s][1] ?? '').trim();
        const fmt = (head.match(/(\d\s?в\s?1)/i) || [''])[0].replace(/\s/g, '').toLowerCase();
        const dates = graph[s + 2] || [];
        const add = (name: string, row: unknown[]) => {
            for (let c = 4; c <= 28; c++) {
                const d = num(dates[c]); const n = num(row[c]);
                if (d && n && n > 0) { const k = norm(name); const arr = sched.get(k) || []; for (let j = 0; j < n; j++) arr.push(d); sched.set(k, arr); label.set(k, name); }
            }
        };
        if (/цвета/i.test(head)) {
            for (let r = s + 3; r < end; r++) {
                const lab = String(graph[r]?.[1] ?? '').trim(); if (!lab) continue;
                const color = lab.split(/\s\d{6,}/)[0].trim();
                if (color) add(`Пижама ${fmt} ${color}`, graph[r]);
            }
        } else {
            add(head.split(/\s\d{6,}/)[0].trim(), graph[s + 1] || []);
        }
    });

    // таблица: колонка A товар, колонка D дата заказа (с 2-й строки)
    const rowsBy = new Map<string, { row: number; date: number | null }[]>();
    table.forEach((r, i) => {
        if (i === 0) return; const p = norm(r[0]); if (!p) return;
        const arr = rowsBy.get(p) || []; arr.push({ row: i + 1, date: num(r[3]) }); rowsBy.set(p, arr);
    });

    const report: Record<string, unknown>[] = [];
    const updates: { range: string; values: unknown[][] }[] = [];
    for (const [k, want] of sched) {
        const rows = rowsBy.get(k);
        const name = label.get(k) || k;
        if (!rows) { report.push({ product: name, status: 'нет строк в «Раздачах»', schedule: want.length }); continue; }
        if (rows.length !== want.length) { report.push({ product: name, status: 'число мест не совпало, пропущено', rows: rows.length, schedule: want.length }); continue; }
        const sortedRows = [...rows].sort((a, b) => (a.date ?? 1e12) - (b.date ?? 1e12) || a.row - b.row);
        const sortedWant = [...want].sort((a, b) => a - b);
        let changed = 0; const moves = new Map<string, number>();
        sortedRows.forEach((r, i) => {
            if (r.date !== sortedWant[i]) { changed++; const key = `${r.date ? iso(r.date) : 'пусто'} → ${iso(sortedWant[i])}`; moves.set(key, (moves.get(key) || 0) + 1); updates.push({ range: `${q(TABLE_TAB)}!D${r.row}`, values: [[sortedWant[i]]] }); }
        });
        report.push({ product: name, status: changed ? 'обновить' : 'уже совпадает', changed, moves: Object.fromEntries(moves) });
    }
    for (const k of rowsBy.keys()) if (!sched.has(k)) report.push({ product: k, status: 'нет в графике, не тронуто', rows: rowsBy.get(k)!.length });
    if (dry || !updates.length) return json({ ok: true, dry_run: dry, cells_to_change: updates.length, report });
    let done = 0;
    for (let i = 0; i < updates.length; i += 200) {
        const part = updates.slice(i, i + 200);
        const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(30000), body: JSON.stringify({ valueInputOption: 'RAW', data: part }) });
        if (!r.ok) return json({ ok: false, step: 'write', done, status: r.status, error: (await r.text()).slice(0, 300), report }, 502);
        done += part.length;
    }
    return json({ ok: true, applied: true, cells_changed: done, report });
});
