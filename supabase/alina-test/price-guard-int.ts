// Сквозная проверка защиты смены цен (код подтверждения для сотрудников) на поддельной базе, WB и Telegram.
// Запуск: deno run -A supabase/alina-test/price-guard-int.ts
import { assertEquals, assert } from 'jsr:@std/assert@1';
import { guardPriceChange, notifyPriceChange } from '../functions/_shared/price-guard-run.ts';

type Row = Record<string, any>;
const table: Row[] = [];
let seq = 1;
const admin = { from: (_t: string) => {
  let filt: Array<[string, unknown]> = [], op = 'select', patch: Row = {}, ins: Row = {};
  const run = () => {
    const rows = table.filter((r) => filt.every(([k, v]) => r[k] === v));
    if (op === 'insert') { const row = { id: 'id' + seq++, attempts: 0, used_at: null, ...ins }; table.push(row); return { data: row, error: null }; }
    if (op === 'update') { rows.forEach((r) => Object.assign(r, patch)); return { data: null, error: null }; }
    if (op === 'delete') { for (const r of rows) table.splice(table.indexOf(r), 1); return { data: null, error: null }; }
    return { data: rows[0] ?? null, error: null };
  };
  const q: any = {
    select: () => q, eq: (k: string, v: unknown) => { filt.push([k, v]); return q; },
    insert: (r: Row) => { op = 'insert'; ins = r; return q; }, update: (r: Row) => { op = 'update'; patch = r; return q; }, delete: () => { op = 'delete'; return q; },
    maybeSingle: () => Promise.resolve(run()), single: () => Promise.resolve(run()),
    then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
  };
  return q;
} };
const sent: string[] = [];
let tgOk = true, wbThrows = false;
const cur = { 1: { price: 5000, discount: 30, discounted: 3500 }, 2: { price: 5000, discount: 30, discounted: 3500 } } as Record<number, { price: number; discount: number; discounted: number }>;
const deps = () => ({ admin, currentPrices: async () => { if (wbThrows) throw new Error('wb down'); return cur; }, sendAdmin: async (t: string) => { sent.push(t); return tgOk; }, json: (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s }) });
const base = { cabinetId: 'cab1', cabName: 'Кабинет', userId: 'u1', email: 'staff@x.kg', staff: true };
const big = [{ nmID: 1, price: 3000, discount: 30 }, { nmID: 2, price: 3000, discount: 30 }]; // 3500 -> 2100: падение 40%
const small = [{ nmID: 1, price: 4900, discount: 30 }];
const body = async (r: Response | null) => r ? await r.json() : null;

// 1. сотрудник, крупное снижение, кода нет: в WB не уходит, код ушёл владельцу
let g = await guardPriceChange({ ...base, items: big }, deps());
let b = await body(g.response);
assertEquals(b.confirmRequired, true); assert(b.confirmId); assertEquals(sent.length, 1);
const code = sent[0].match(/Код: (\d{6})/)![1];
assert(/staff@x\.kg/.test(sent[0]) && /Кабинет/.test(sent[0]) && /-40,0%/.test(sent[0]), 'в сообщении кто, где и на сколько: ' + sent[0].replace(/\n/g, ' | '));
const id = b.confirmId;
// 2. неверный код
g = await guardPriceChange({ ...base, items: big, confirm: { id, code: '000000' } }, deps()); b = await body(g.response);
assertEquals(b.error, 'Неверный код'); assertEquals(b.attemptsLeft, 4); assertEquals(g.confirmed, false);
// 3. код от других цен не подходит (подпись списка)
g = await guardPriceChange({ ...base, items: [{ nmID: 1, price: 2900, discount: 30 }, { nmID: 2, price: 3000, discount: 30 }], confirm: { id, code } }, deps()); b = await body(g.response);
assertEquals(b.restart, true, 'код привязан к тем же товарам и ценам');
// 4. чужой пользователь не может использовать код
g = await guardPriceChange({ ...base, userId: 'u2', items: big, confirm: { id, code } }, deps()); b = await body(g.response);
assertEquals(b.restart, true, 'код привязан к пользователю');
// 5. верный код: пропускает; повторное использование того же кода уже нет
g = await guardPriceChange({ ...base, items: big, confirm: { id, code } }, deps());
assertEquals(g.response, null); assertEquals(g.confirmed, true);
g = await guardPriceChange({ ...base, items: big, confirm: { id, code } }, deps()); b = await body(g.response);
assertEquals(b.restart, true, 'код одноразовый');
// 6. пять неверных подряд сжигают код
sent.length = 0; g = await guardPriceChange({ ...base, items: big }, deps()); b = await body(g.response); const id2 = b.confirmId;
let last: any; for (let i = 0; i < 5; i++) last = await body((await guardPriceChange({ ...base, items: big, confirm: { id: id2, code: '999999' } }, deps())).response);
assertEquals(last.restart, true, 'после пяти ошибок нужен новый код');
const real2 = sent[0].match(/Код: (\d{6})/)![1];
last = await body((await guardPriceChange({ ...base, items: big, confirm: { id: id2, code: real2 } }, deps())).response); assertEquals(last.restart, true, 'сожжённый код не принимается даже верный');
// 7. истёкший код
sent.length = 0; g = await guardPriceChange({ ...base, items: big }, deps()); b = await body(g.response); const id3 = b.confirmId; const c3 = sent[0].match(/Код: (\d{6})/)![1];
table.find((r) => r.id === id3)!.expires_at = new Date(Date.now() - 1000).toISOString();
last = await body((await guardPriceChange({ ...base, items: big, confirm: { id: id3, code: c3 } }, deps())).response); assertEquals(last.restart, true, 'истёкший код');
// 8. небольшое изменение у сотрудника проходит без кода; клиенту без команды крупное тоже (нет Telegram-привязки), но оценка помечена
g = await guardPriceChange({ ...base, items: small }, deps()); assertEquals(g.response, null); assertEquals(g.assessment.needConfirm, false);
g = await guardPriceChange({ ...base, staff: false, items: big }, deps()); assertEquals(g.response, null); assertEquals(g.assessment.needConfirm, true);
// 9. не дошло до Telegram: цены не меняются, код не остаётся в базе
const before = table.length; tgOk = false; g = await guardPriceChange({ ...base, items: big }, deps());
assertEquals(g.response!.status, 503); assertEquals(table.length, before, 'код без доставки не хранится'); tgOk = true;
// 10. WB не отдал текущие цены: считаем рискованным
wbThrows = true; g = await guardPriceChange({ ...base, items: small }, deps()); b = await body(g.response); assertEquals(b.confirmRequired, true); wbThrows = false;
// 11. уведомление о смене цен
sent.length = 0; await notifyPriceChange({ email: 'staff@x.kg', cabName: 'Кабинет', staff: true, confirmed: true, assessment: g.assessment }, deps().sendAdmin);
assert(/СМЕНА ЦЕН/.test(sent[0]) && /Подтверждено кодом/.test(sent[0]));
console.log('PASS: защита смены цен: код одноразовый, привязан к ценам и пользователю, сгорает, при сбое Telegram цены не меняются');
Deno.exit(0);
