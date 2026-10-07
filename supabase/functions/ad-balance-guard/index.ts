// Supabase Edge Function: ad-balance-guard (cron каждые 10 минут)
// Для каждой записи ad_balance_guards:
//   * работает и баланс <= pause_below (один раз в сутки после запуска) или час внутри окна stop..resume (UTC) -> пауза
//   * на паузе от сторожа: окно закончилось, либо наступил ближайший resume_hour_utc после паузы -> запуск
// Деньги не пополняет, ставки и бюджеты не меняет.
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, json } from '../_shared/akylai-server.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { CABINET_TOKEN_SELECT, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { ADV_API } from '../_shared/wb-advert-bids.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { sendTelegramMessage } from '../_shared/notify-once.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** Ближайший момент с нужным часом UTC (ровно :00) не раньше момента паузы. */
function nextResume(pausedAt: string | null, hourUtc: number): Date {
    const base = pausedAt ? new Date(pausedAt) : new Date(0);
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hourUtc, 0, 0));
    if (d < base) d.setUTCDate(d.getUTCDate() + 1);
    return d;
}

async function wb(token: string, path: string) {
    const res = await fetch(ADV_API + path, { headers: { Authorization: token } });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* пустой ответ */ }
    return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (!isServiceAuthorized(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) return json({ error: 'Unauthorized' }, 401);
    const admin = adminClient();
    const { data: guards } = await admin.from('ad_balance_guards').select('*').eq('active', true);
    const out: any[] = [];
    for (const g of guards || []) {
        const { data: cab } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).eq('id', g.cabinet_id).maybeSingle();
        const token = cab ? pickCabinetToken(cab, 'promotion') : '';
        if (token.length < 50) { out.push({ id: g.campaign_id, skipped: 'no_token' }); continue; }
        const info = await wb(token, `/api/advert/v2/adverts?ids=${g.campaign_id}`);
        const status = Number(info.data?.adverts?.[0]?.status);
        const bal = await wb(token, `/adv/v1/budget?id=${g.campaign_id}`);
        const total = Number(bal.data?.total);
        if (!Number.isFinite(status) || !Number.isFinite(total)) { out.push({ id: g.campaign_id, skipped: 'no_data' }); continue; }
        let note = '';
        const now = new Date();
        const h = now.getUTCHours();
        const stop = g.stop_hour_utc, resume = g.resume_hour_utc;
        const inWindow = stop != null && resume != null ? (stop <= resume ? h >= stop && h < resume : h >= stop || h < resume) : false;
        const resumedToday = g.state === 'resumed' && g.state_date === today();
        const balanceHit = g.pause_below != null && total <= g.pause_below && !resumedToday;
        if (status === 9 && (inWindow || balanceHit)) {
            const r = await wb(token, `/adv/v0/pause?id=${g.campaign_id}`);
            if (r.ok) {
                await admin.from('ad_balance_guards').update({ state: 'paused', state_date: today(), paused_at: now.toISOString() }).eq('cabinet_id', g.cabinet_id).eq('campaign_id', g.campaign_id);
                note = `пауза, баланс ${Math.round(total)}${inWindow ? ' (по времени)' : ''}`;
            }
        } else if (g.state === 'paused' && status === 11 && total > 100) {
            const windowMode = stop != null && resume != null;
            const resumeOk = windowMode ? !inWindow : (resume != null && now >= nextResume(g.paused_at, resume));
            if (resumeOk) {
                const r = await wb(token, `/adv/v0/start?id=${g.campaign_id}`);
                if (r.ok) {
                    await admin.from('ad_balance_guards').update({ state: 'resumed', state_date: today() }).eq('cabinet_id', g.cabinet_id).eq('campaign_id', g.campaign_id);
                    note = `запуск, баланс ${Math.round(total)}`;
                }
            }
        }
        if (note) {
            out.push({ id: g.campaign_id, note });
            try {
                const tg = getTelegramToken(), chat = getTelegramChatId('ads');
                if (tg && chat) await sendTelegramMessage(tg, chat, `РК ${g.campaign_id}: ${note}`);
            } catch (_) { /* уведомление не критично */ }
        } else out.push({ id: g.campaign_id, status, total });
    }
    return json({ ok: true, results: out });
});
