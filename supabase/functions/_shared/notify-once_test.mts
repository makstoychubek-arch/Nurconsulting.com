/**
 * Юнит-тесты notifyOnce: дедуп по notification_log за окно N минут,
 * пропуск отправки при отсутствии токена, запись лога независимо от
 * успеха отправки. Supabase-клиент и fetch — мок, без сети/БД.
 */
import assert from 'node:assert/strict';
import { notifyOnce } from './notify-once.ts';

type Row = { cabinet_id: string; campaign_id: number | null; event_type: string; sent_at: string };

function fakeAdmin(existingRows: Row[]) {
    const inserted: Row[] = [];
    const rows = existingRows;

    function builder(table: string) {
        const filters: Array<(r: Row) => boolean> = [];
        const api = {
            select() { return api; },
            eq(col: keyof Row, val: unknown) {
                filters.push((r) => r[col] === val);
                return api;
            },
            is(col: keyof Row, val: null) {
                filters.push((r) => r[col] === val);
                return api;
            },
            gte(col: 'sent_at', val: string) {
                filters.push((r) => r[col] >= val);
                return api;
            },
            limit(_n: number) {
                const data = rows.filter((r) => filters.every((f) => f(r)));
                return Promise.resolve({ data, error: null });
            },
            async insert(row: Record<string, unknown>) {
                const r: Row = {
                    cabinet_id: String(row.cabinet_id),
                    campaign_id: row.campaign_id == null ? null : Number(row.campaign_id),
                    event_type: String(row.event_type),
                    sent_at: new Date().toISOString(),
                };
                inserted.push(r);
                rows.push(r);
                return { data: null, error: null };
            },
        };
        void table;
        return api;
    }

    return { from: builder, _inserted: inserted } as unknown as Parameters<typeof notifyOnce>[0] & { _inserted: Row[] };
}

// ── Telegram отправку мокаем через global fetch — sendTelegramMessage
//    ходит именно через него, отдельного инжекта в notifyOnce нет. ──────────
const realFetch = globalThis.fetch;
let lastFetchUrl = '';
let fetchOk = true;
globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    lastFetchUrl = String(url);
    void init;
    return new Response(JSON.stringify({ ok: fetchOk }), { status: fetchOk ? 200 : 400 });
}) as typeof fetch;

// 1) Нет дубля за окно — шлёт и пишет лог.
{
    const admin = fakeAdmin([]);
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', 42, 'bid_changed', 'текст 1');
    assert.equal(sent, true, 'первое сообщение должно уйти');
    assert.equal(admin._inserted.length, 1, 'должна появиться запись в notification_log');
    assert.ok(lastFetchUrl.includes('bottok/sendMessage'), 'должен дёрнуть Telegram API');
}

// 2) Дубль в пределах окна — не шлёт повторно.
{
    const now = new Date().toISOString();
    const admin = fakeAdmin([{ cabinet_id: 'cab-1', campaign_id: 42, event_type: 'bid_changed', sent_at: now }]);
    lastFetchUrl = '';
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', 42, 'bid_changed', 'текст 2');
    assert.equal(sent, false, 'дубль в окне дедупа не должен отправляться');
    assert.equal(admin._inserted.length, 0, 'не должно быть новой записи в логе для подавленного дубля');
    assert.equal(lastFetchUrl, '', 'Telegram вообще не должен дёргаться при дубле');
}

// 3) Тот же event_type, но другой campaign_id — не дубль, шлёт.
{
    const now = new Date().toISOString();
    const admin = fakeAdmin([{ cabinet_id: 'cab-1', campaign_id: 42, event_type: 'bid_changed', sent_at: now }]);
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', 99, 'bid_changed', 'текст для другой кампании');
    assert.equal(sent, true, 'другая campaign_id — не тот же дубль');
}

// 4) За пределами окна дедупа — снова можно слать.
{
    const old = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const admin = fakeAdmin([{ cabinet_id: 'cab-1', campaign_id: 42, event_type: 'bid_changed', sent_at: old }]);
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', 42, 'bid_changed', 'снова актуально', 60);
    assert.equal(sent, true, 'событие старше окна дедупа не считается дублем');
}

// 5) campaignId=null (событие уровня кабинета, напр. budget_cap_reached) —
//    дедуп ключуется по is(campaign_id, null), а не eq.
{
    const now = new Date().toISOString();
    const admin = fakeAdmin([{ cabinet_id: 'cab-1', campaign_id: null, event_type: 'token_invalid', sent_at: now }]);
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', null, 'token_invalid', 'токен невалиден');
    assert.equal(sent, false, 'дубль по кабинетному событию (campaign_id=null) тоже подавляется');
}

// 6) Нет токена/chat id — не шлёт, но лог всё равно пишет (видно, что событие
//    произошло, даже если Telegram не настроен).
{
    const admin = fakeAdmin([]);
    lastFetchUrl = '';
    const sent = await notifyOnce(admin, '', '', 'cab-1', 1, 'schedule_pause', 'пауза по расписанию');
    assert.equal(sent, false, 'без токена отправка не считается успешной');
    assert.equal(admin._inserted.length, 1, 'но событие в лог всё равно попадает');
    assert.equal(lastFetchUrl, '', 'без токена Telegram не дёргаем вообще');
}

// 7) Telegram вернул ошибку — notifyOnce возвращает false, но лог пишется
//    (событие было, просто доставка не удалась).
{
    const admin = fakeAdmin([]);
    fetchOk = false;
    const sent = await notifyOnce(admin, 'tok', 'chat', 'cab-1', 1, 'stock_pause', 'нет остатков');
    fetchOk = true;
    assert.equal(sent, false, 'ошибка Telegram API → sendOk=false');
    assert.equal(admin._inserted.length, 1, 'лог пишется даже при неудачной отправке');
}

globalThis.fetch = realFetch;
console.log('notify-once_test: ok');
