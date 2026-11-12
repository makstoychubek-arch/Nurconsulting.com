// ads-daily-report: ежедневная рекламная карточка в Telegram, по одной на кабинет.
// Каждое утро в 10:00 по Бишкеку (04:00 UTC) за вчера: расход, корзины и заказы с РК, цена корзины и заказа, ДРР, динамика.
// Канал «Реклама» (TELEGRAM_CHAT_ADS). Кабинеты без рекламы за день и выключенные в канале «ads» пропускаются.
// Тело (необязательно): { date: 'YYYY-MM-DD', cabinets: ['Имя'], test: true (не пишет в журнал), force: true, dry: true }.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { shouldSendTelegram } from '../_shared/telegram-gates.ts';
import { cabinetLegalName } from '../_shared/wb-restock-reply.ts';
import { addStat, buildAdCard, emptyStat, hasAds, type AdStat } from '../_shared/ads-report.ts';
import { renderAdCardPng } from '../_shared/ads-card-png.ts';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const prettyDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const yesterdayBishkek = () => new Date(Date.now() + 6 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);
const dayBefore = (iso: string) => new Date(new Date(iso + 'T00:00:00Z').getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayBishkek();
    const only: string[] | null = Array.isArray(body.cabinets) ? body.cabinets.map(String) : null;
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);

    try {
        const { data: camps, error: cErr } = await admin.from('adv_campaigns').select('id, cabinet_id');
        if (cErr) throw new Error('adv_campaigns: ' + cErr.message);
        const cabOf = new Map<string, string>();
        for (const c of (camps || []) as { id: string; cabinet_id: string }[]) cabOf.set(String(c.id), String(c.cabinet_id));
        const cabIds = [...new Set(cabOf.values())];
        if (!cabIds.length) return json({ ok: true, skipped: 'no_campaigns' });

        const { data: cabs } = await admin.from('cabinets').select('id, name').in('id', cabIds);
        const nameOf = new Map<string, string>(((cabs || []) as { id: string; name: string }[]).map((c) => [String(c.id), c.name]));

        const prevDate = dayBefore(date);
        const { data: stats, error: sErr } = await admin.from('adv_daily_stats')
            .select('campaign_id, date, spend, carts, orders, clicks, impressions, revenue').in('date', [date, prevDate]).limit(50000);
        if (sErr) throw new Error('adv_daily_stats: ' + sErr.message);
        const dayBy = new Map<string, AdStat>(), prevBy = new Map<string, AdStat>();
        for (const r of (stats || []) as Record<string, unknown>[]) {
            const cab = cabOf.get(String(r.campaign_id));
            if (!cab) continue;
            const map = String(r.date).slice(0, 10) === date ? dayBy : prevBy;
            map.set(cab, addStat(map.get(cab) || emptyStat(), r as never));
        }

        const token = getTelegramToken();
        const chatId = getTelegramChatId('ads');
        const results: Record<string, unknown>[] = [];
        for (const cabId of cabIds) {
            const name = nameOf.get(cabId) || '';
            if (only && !only.includes(name)) continue;
            const legal = cabinetLegalName(name);
            const m = buildAdCard(dayBy.get(cabId) || emptyStat(), prevBy.get(cabId) || null);
            const res: Record<string, unknown> = { cabinet: legal, spend: m.spend, carts: m.carts, orders: m.orders, drr: m.drr };
            if (!hasAds(m)) { res.skipped = 'no_ads'; results.push(res); continue; }
            const gate = await shouldSendTelegram(admin, { channel: 'ads', cabinetId: cabId });
            if (!gate.ok) { res.skipped = gate.reason; results.push(res); continue; }
            if (body.dry === true) { results.push(res); continue; }
            if (!token || !chatId) return json({ error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ADS не заданы' }, 400);

            const eventType = `ads_daily_${date}`;
            if (body.test !== true && body.force !== true) {
                const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cabId).eq('event_type', eventType).limit(1);
                if (dupes?.length) { res.skipped = 'already_sent'; results.push(res); continue; }
            }
            const png = await renderAdCardPng({ cabinet: legal, dateLabel: prettyDate(date), m });
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('photo', new Blob([png], { type: 'image/png' }), 'ads.png');
            const tg = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
            if (!tg.ok) { res.error = `Telegram HTTP ${tg.status}`; results.push(res); continue; }
            if (body.test !== true) {
                await admin.from('notification_log').insert({ cabinet_id: cabId, campaign_id: null, event_type: eventType, message_text: `ads ${date}: расход ${m.spend}, корзин ${m.carts}, заказов ${m.orders}` });
            }
            res.sent = true;
            results.push(res);
        }
        return json({ ok: true, date, results });
    } catch (e) {
        return json({ error: String((e as Error)?.message || e) }, 500);
    }
});
