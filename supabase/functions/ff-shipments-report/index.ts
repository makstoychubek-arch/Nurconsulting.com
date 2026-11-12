// ff-shipments-report: ежедневная карточка ФФ (АМАН) в Telegram, по одному сообщению на кабинет.
// Каждое утро в 07:00 по Бишкеку (01:00 UTC) за вчера: отправки, хранение, штраф ФФ за день и общий долг.
// Те же начисления пишутся в ff_ledger (строки «[auto дата] ...»): сайт показывает тот же общий счёт и вычитает оплаты, которые вводит владелец.
// Штрафы берутся из финотчёта WB (raw_finance_report, «Невыполненный заказ»: отмена продавцом и подмена), в рубли по курсу НБКР.
// Канал «FBS» (TELEGRAM_CHAT_FBS). Тело (необязательно): { date, cabinets: ['Имя'], test: true (без журнала), force: true, dry: true (только расчёт), noTelegram: true (только записать в счёт) }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { cabinetLegalName } from '../_shared/wb-restock-reply.ts';
import type { FfTerm } from '../_shared/ff-shipments.ts';
import { debtFrom, grp, shipForDay, storageForDay, type FfStorageTerm, type LedgerRow } from '../_shared/ff-account.ts';
import { renderFfAccountPng } from '../_shared/ff-account-card-png.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const FF_PREFIX = 'АМАН';
const FF_NAME = 'АМАН ФФ';
const SINCE = '2026-10-27';   // с этой даты считается общий долг (до неё Бейшеев оплачен, у Уркунбаева стартовый долг лежит в записях)
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const prettyDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const yesterdayBishkek = () => new Date(Date.now() + 6 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const shortDate = (iso: string) => iso.slice(8, 10) + '.' + iso.slice(5, 7);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayBishkek();
    const only: string[] | null = Array.isArray(body.cabinets) ? body.cabinets.map(String) : null;
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);

    try {
        const { data: termRows, error: tErr } = await admin.from('ff_terms')
            .select('cabinet_id, ff_name, kind, value, date_from, date_to, daily_cap, storage_mode').like('ff_name', FF_PREFIX + '%');
        if (tErr) throw new Error('ff_terms: ' + tErr.message);
        const terms = (termRows || []) as FfStorageTerm[];
        const cabIds = [...new Set(terms.filter((t) => t.kind === 'ship').map((t) => t.cabinet_id))];
        if (!cabIds.length) return json({ ok: true, skipped: 'no_terms' });

        const { data: cabs } = await admin.from('cabinets').select('id, name').in('id', cabIds);
        const nameOf = new Map<string, string>(((cabs || []) as { id: string; name: string }[]).map((c) => [String(c.id), c.name]));

        // Курс ₽ → сом на дату (штрафы WB приходят в сомах)
        const { data: fxRows } = await admin.from('exchange_rates').select('date, rate').eq('pair', 'RUB_KGS').lte('date', date).order('date', { ascending: false }).limit(1);
        const rate = Number(fxRows?.[0]?.rate) || 0;

        const token = getTelegramToken();
        const chatId = getTelegramChatId('fbs');
        const results: Record<string, unknown>[] = [];

        for (const cabId of cabIds) {
            const name = nameOf.get(cabId) || '';
            if (only && !only.includes(name)) continue;
            const legal = cabinetLegalName(name);
            const res: Record<string, unknown> = { cabinet: legal };
            // Выключенные в канале «FBS» кабинеты (Айзада, Zevina 2) ни в счёт, ни в Telegram не попадают
            const gate = await shouldSendTelegram(admin, { channel: 'fbs', cabinetId: cabId });
            if (!gate.ok) { res.skipped = gate.reason; results.push(res); continue; }

            // Отправки за день
            const { data: ord, error: oErr } = await admin.from('fbs_orders').select('ff_name')
                .eq('cabinet_id', cabId).eq('order_date', date).like('ff_name', FF_PREFIX + '%').limit(20000);
            if (oErr) throw new Error('fbs_orders: ' + oErr.message);
            const ship = shipForDay(terms as FfTerm[], cabId, (ord || []) as { ff_name: string | null }[], date);

            // Хранение: остаток FBS на дату (нет снимка: ближайший прошлый)
            const { data: stRows } = await admin.from('goods_daily_stocks').select('date, fbs').eq('cabinet_id', cabId)
                .lte('date', date).gte('date', new Date(new Date(date + 'T00:00:00Z').getTime() - 7 * 86400000).toISOString().slice(0, 10)).limit(20000);
            const byDay = new Map<string, number>();
            for (const s of (stRows || []) as { date: string; fbs: number | null }[]) byDay.set(String(s.date).slice(0, 10), (byDay.get(String(s.date).slice(0, 10)) || 0) + (Number(s.fbs) || 0));
            const lastDay = [...byDay.keys()].sort().pop();
            const stock = byDay.get(date) ?? (lastDay ? byDay.get(lastDay)! : 0);
            const storage = storageForDay(terms, cabId, date, stock);

            // Штраф ФФ за день (сом → ₽), по дате удержания в финотчёте
            const { data: pen } = await admin.from('raw_finance_report').select('penalty, bonus_type_name, sale_dt, rr_dt')
                .eq('cabinet_id', cabId).neq('penalty', 0).ilike('bonus_type_name', 'Штраф МП. Невыполненный заказ%')
                .eq('rr_dt', date)   // «удержано за» дату: так же, как в карточке штрафов.limit(5000);
            const penKgs = ((pen || []) as { penalty: number | string; bonus_type_name: string }[])
                .filter((p) => /отправка товара отличного от заявленного|отмена продавцом/i.test(p.bonus_type_name))
                .reduce((s, p) => s + Math.abs(Number(p.penalty) || 0), 0);
            const penalty = rate ? r2(penKgs / rate) : 0;

            // Отгрузки (короба) и доп. услуги за день: ручные записи владельца на сайте (коробá: boxes заполнено)
            const { data: manual } = await admin.from('ff_ledger').select('title, boxes, amount').eq('cabinet_id', cabId).eq('kind', 'charge').eq('entry_date', date).limit(500);
            let boxes = 0, boxSum = 0, extraSum = 0;
            for (const m of (manual || []) as { title: string; boxes: number | null; amount: number | string }[]) {
                if (/^(\[auto|Старт счёта|Долг по ФФ)/.test(String(m.title))) continue;   // свои строки и стартовый долг в день не входят
                if (m.boxes != null && Number(m.boxes) > 0) { boxes += Number(m.boxes); boxSum += Number(m.amount); } else extraSum += Number(m.amount);
            }
            const dayTotal = r2(ship.sum + storage + boxSum + extraSum);
            Object.assign(res, { date, shipCount: ship.count, ship: ship.sum, storage, boxes, boxSum, extraSum, penalty, dayTotal });

            if (body.dry !== true && body.test !== true) {
                // Запись в общий счёт: повторный запуск за ту же дату пересчитывает свои строки
                const tag = `[auto ${date}]`;
                await admin.from('ff_ledger').delete().eq('cabinet_id', cabId).like('title', tag + '%');
                const rows: Record<string, unknown>[] = [];
                if (dayTotal > 0) rows.push({ cabinet_id: cabId, ff_name: FF_NAME, kind: 'charge', title: `${tag} Отправки ${ship.count} шт, хранение`, amount: dayTotal, entry_date: date });
                if (penalty > 0) rows.push({ cabinet_id: cabId, ff_name: FF_NAME, kind: 'payment', title: `${tag} Штраф ФФ (зачёт)`, amount: penalty, entry_date: date });
                if (rows.length) {
                    const { error: iErr } = await admin.from('ff_ledger').insert(rows);
                    if (iErr) throw new Error('ff_ledger: ' + iErr.message);
                }
            }

            const { data: led } = await admin.from('ff_ledger').select('kind, amount, entry_date').eq('cabinet_id', cabId).limit(5000);
            const debt = debtFrom((led || []) as LedgerRow[], SINCE);
            res.debt = debt;
            if (body.dry === true) { results.push(res); continue; }
            if (body.noTelegram === true) { results.push(res); continue; }

            if (!token || !chatId) return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_FBS не заданы' }, 400);
            const eventType = `ff_account_${date}`;
            if (body.test !== true && body.force !== true) {
                const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cabId).eq('event_type', eventType).limit(1);
                if (dupes?.length) { res.skipped = 'already_sent'; results.push(res); continue; }
            }

            const png = await renderFfAccountPng({
                cabinet: legal, dateLabel: prettyDate(date), dayTotal,
                shipSub: ship.count ? `${ship.count} шт${ship.rate ? ' × ' + ship.rate : ''}` : '0 шт', ship: ship.sum, storage,
                boxSub: `${grp(boxes)} кор.`, box: boxSum, extra: extraSum,
                penalty, debt, sinceLabel: 'с ' + shortDate(SINCE),
            });
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', new Blob([png], { type: 'image/png' }), 'ff.png');
            const tg = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
            if (!tg.ok) { res.error = `Telegram HTTP ${tg.status}`; results.push(res); continue; }
            if (body.test !== true) {
                await admin.from('notification_log').insert({ cabinet_id: cabId, campaign_id: null, event_type: eventType, message_text: `ff ${date}: ${dayTotal} ₽, штраф ${penalty}, долг ${debt}` });
            }
            res.sent = true;
            results.push(res);
        }
        return json({ ok: true, date, results });
    } catch (e) {
        return json({ error: String((e as Error)?.message || e) }, 500);
    }
});
