// Сквозная проверка режима «Раздачи — строки» на подставных Google и базе. Нужен deno и временный ключ:
// openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | openssl pkcs8 -topk8 -nocrypt -out /tmp/k8.pem; deno run -A supabase/alina-test/razdachi-int.ts /tmp/k8.pem
import { fetchSheetPlan, getLastRazdachi } from '../functions/_shared/alina-sheet-plan.ts';
import { clientRowsToday, syncLeadToRazdachiRow } from '../functions/_shared/alina-razdachi-sync.ts';
import { todayMskKey } from '../functions/_shared/alina-razdachi.ts';
import { assertEquals } from 'jsr:@std/assert@1';

const pem = Deno.readTextFileSync(Deno.args[0]);
Deno.env.set('GOOGLE_SERVICE_ACCOUNT_JSON', JSON.stringify({ client_email: 'sa@x.iam', private_key: pem }));
Deno.env.set('ALINA_RAZDACHI_ROWS', '1');
const SHEET = 'SHEET123', GID = 1641065187;
const D = todayMskKey();
const HEAD = ['ТОВАР', 'ВИД РАЗДАЧИ', 'Ссылка ТГ', 'Дата заказа', 'Цена в заказе', 'Размер кэша', 'Кэш выплачен', 'Примерная Дата забора', 'фактическая дата забора', 'Разрезанный ШК', 'Дата публикации отзыва ', 'Вид отзыва', 'Реквизиты', 'Реквизиты', 'Фактическая дата выплаты', 'Отзыв опубликован', 'Отвественный', 'Ключ'];
const row = (m: string, tg: string) => { const r = Array(HEAD.length).fill(''); r[0] = m; r[1] = 'БЛОГЕР'; r[2] = tg; r[3] = D; return r; };
const grid: string[][] = [Array(HEAD.length).fill(''), HEAD, row('Пижама 3в1 шоколадный', '@milposhka'), row('Пижама 3в1 шоколадный', '@annagaechka'), row('Пижама 2в1 шоколадный', '')];
const calls: string[] = [];
const col = (s: string) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input); calls.push(url.replace(/^https:\/\/[^/]+/, '').slice(0, 60));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  if (url.includes('oauth2.googleapis.com')) return json({ access_token: 't' });
  if (url.includes('fields=sheets.properties')) return json({ sheets: [{ properties: { sheetId: GID, title: 'Раздачи' } }, { properties: { sheetId: 5, title: 'График раздач' } }] });
  if (url.includes('batchGetByDataFilter')) { const gid = JSON.parse(String(init!.body)).dataFilters[0].gridRange.sheetId; return json({ valueRanges: [{ valueRange: { values: gid === GID ? grid : [] } }] }); }
  if (url.includes('values:batchUpdate')) { for (const d of JSON.parse(String(init!.body)).data) { const m = d.range.match(/!([A-Z]+)(\d+)$/)!; grid[Number(m[2]) - 1][col(m[1])] = d.values[0][0]; } return json({}); }
  if (url.includes('/values/')) { const m = decodeURIComponent(url).match(/!([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?\?/)!; const r1 = Number(m[2]); const r2 = m[4] ? Number(m[4]) : grid.length; return json({ values: grid.slice(r1 - 1, r2).map((r) => r.slice(col(m[1]), m[3] ? col(m[3]) + 1 : undefined)) }); }
  if (url.includes(':append')) throw new Error('append запрещён: новые строки не добавляем');
  throw new Error('неожиданный запрос ' + url);
}) as typeof fetch;

const events: Array<Record<string, unknown>> = [];
const lead: Record<string, unknown> = { id: 'L1', chat_id: 1, username: 'MilPoshka', product_name: 'Пижама 3в1 шоколадный', order_price: '1999', status: 'in_progress', sheet_row: null, sheet_target: null };
const db = { from(t: string) {
  const q: Record<string, unknown> = {};
  const self = { select: () => self, order: () => self, limit: () => self, eq: () => self,
    maybeSingle: async () => ({ data: t === 'alina_campaign' ? { sheet_id: SHEET, cabinet_key: 'mars' } : t === 'alina_selfbuy_leads' ? { ...lead } : null }),
    update: (p: Record<string, unknown>) => { if (t === 'alina_selfbuy_leads') Object.assign(lead, p); return self; },
    insert: async (r: Record<string, unknown>) => { events.push(r); return {}; }, ...q };
  return self;
} } as never;

await fetchSheetPlan(true, { sheet_id: SHEET, cabinet_key: 'mars', cabinet_name: null });
assertEquals(getLastRazdachi()?.sheet.rows.length, 3, 'лист разобран при обычном чтении плана, без лишних запросов');
const readsAfterPlan = calls.length;
assertEquals(clientRowsToday('MILPOSHKA').state, 'ok');
assertEquals((clientRowsToday('MILPOSHKA') as { rows: unknown[] }).rows.length, 1);
assertEquals((clientRowsToday('stranger') as { rows: unknown[] }).rows.length, 0, 'неизвестный: к менеджеру');
assertEquals((clientRowsToday(undefined) as { rows: unknown[] }).rows.length, 0, 'без логина: к менеджеру');

await syncLeadToRazdachiRow(db, 'L1');
assertEquals(grid[2][4], '1999', 'цена записана в строку клиента');
assertEquals(grid[2][2], '@milposhka'); assertEquals(grid[3][4], '', 'чужая строка не тронута'); assertEquals(grid.length, 5, 'строк не добавилось');
assertEquals(lead.sheet_row, 3); assertEquals(lead.sheet_target, `razdachi|Раздачи|${D}`);
assertEquals(events.at(-1)?.event_type, 'razdachi_write');
// следующий шаг в другой день: строка находится по сохранённой дате и номеру
lead.pickup_at = '20.11.2026'; await syncLeadToRazdachiRow(db, 'L1');
assertEquals(grid[2][8], '20.11.2026');
// неизвестный клиент: записи нет
const before = JSON.stringify(grid);
lead.username = 'stranger'; lead.sheet_row = null; lead.sheet_target = null; await syncLeadToRazdachiRow(db, 'L1');
assertEquals(JSON.stringify(grid), before); assertEquals(events.at(-1)?.event_type, 'razdachi_unmatched');
console.log('PASS: сквозной режим строк; запросов Google на чтение плана:', readsAfterPlan, '; всего за сценарий:', calls.length);
