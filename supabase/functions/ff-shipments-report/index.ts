// ff-shipments-report: ежедневная карточка «Отправки FBS» в Telegram для фулфилмента (АМАН ФФ).
// Каждое утро в 07:00 по Бишкеку (01:00 UTC): сколько заказов FBS ушло за вчера по каждому кабинету и сколько это стоит
// в рублях по тарифам ФФ (ff_terms). Куда слать: канал «FBS» (TELEGRAM_CHAT_FBS). Кабинеты без тарифа ФФ и кабинеты,
// у которых канал FBS выключен, в карточку не попадают.
// Тело (необязательно): { date: 'YYYY-MM-DD', test: true (не пишет в журнал), force: true (слать повторно), dry: true (только расчёт) }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { cabinetLegalName } from '../_shared/wb-restock-reply.ts';
import { buildShipRows, totals, type FfOrder, type FfTerm } from '../_shared/ff-shipments.ts';
import { renderFfShipmentsPng } from '../_shared/ff-shipments-card-png.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const FF_PREFIX = 'АМАН';
const FF_LABEL = 'АМАН ФФ';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const prettyDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
// Утренний отчёт за вчера: день закрыт целиком, цифры окончательные (счёт ФФ считается по ним).
const yesterdayBishkek = () => new Date(Date.now() + 6 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayBishkek();
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);

    try {
        // Кабинеты ФФ: те, у кого задан тариф отправки на склады АМАН
        const { data: termRows, error: tErr } = await admin.from('ff_terms').select('cabinet_id, ff_name, kind, value, date_from, date_to')
            .like('ff_name', FF_PREFIX + '%').eq('kind', 'ship');
        if (tErr) throw new Error('ff_terms: ' + tErr.message);
        const terms = (termRows || []) as FfTerm[];
        const cabIds = [...new Set(terms.map((t) => t.cabinet_id))];
        if (!cabIds.length) return json({ ok: true, skipped: 'no_terms' });

        const allowed: string[] = [];
        for (const id of cabIds) {
            const gate = await shouldSendTelegram(admin, { channel: 'fbs', cabinetId: id });
            if (gate.ok) allowed.push(id);
        }
        if (!allowed.length) return json({ ok: true, skipped: 'all_muted' });

        const { data: cabs } = await admin.from('cabinets').select('id, name').in('id', allowed);
        const cabinetNames: Record<string, string> = {};
        for (const c of (cabs || []) as { id: string; name: string }[]) cabinetNames[c.id] = cabinetLegalName(c.name);

        const { data: ord, error: oErr } = await admin.from('fbs_orders').select('cabinet_id, ff_name, nm_id, order_date')
            .in('cabinet_id', allowed).eq('order_date', date).like('ff_name', FF_PREFIX + '%').limit(20000);
        if (oErr) throw new Error('fbs_orders: ' + oErr.message);
        const orders = (ord || []) as FfOrder[];

        const nms = [...new Set(orders.map((o) => o.nm_id))];
        const articleNames: Record<string, string> = {};
        if (nms.length) {
            const { data: arts } = await admin.from('rnp_articles').select('nm_id, name').in('nm_id', nms).in('cabinet_id', allowed);
            for (const a of (arts || []) as { nm_id: number; name: string }[]) articleNames[String(a.nm_id)] = a.name;
        }

        const rows = buildShipRows(orders, terms, date, { ffPrefix: FF_PREFIX, cabinetNames, articleNames, onlyCabinets: allowed });
        const total = totals(rows);
        if (body.dry === true) return json({ ok: true, dry: true, date, rows, total });

        const token = getTelegramToken();
        const chatId = getTelegramChatId('fbs');
        if (!token || !chatId) return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_FBS не заданы' }, 400);

        const eventType = `ff_shipments_${date}`;
        const logCab = allowed[0];
        if (body.test !== true && body.force !== true) {
            const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', logCab).eq('event_type', eventType).limit(1);
            if (dupes?.length) return json({ ok: true, skipped: 'already_sent', date });
        }

        const png = await renderFfShipmentsPng({ ffName: FF_LABEL, dateLabel: prettyDate(date), rows, total });
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', new Blob([png], { type: 'image/png' }), 'ff-shipments.png');
        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok) return json({ error: `Telegram HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}` }, 502);

        if (body.test !== true) {
            await admin.from('notification_log').insert({ cabinet_id: logCab, campaign_id: null, event_type: eventType, message_text: `ff shipments ${date}: ${total.count} шт, ${total.sum} ₽` });
        }
        return json({ ok: true, date, sent: true, rows: rows.length, total });
    } catch (e) {
        return json({ error: String((e as Error)?.message || e) }, 500);
    }
});
