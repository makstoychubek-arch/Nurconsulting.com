// Supabase Edge Function: ad-autopilot
//
// Автопилот рекламы. Cron каждые 3 часа (и «Проверить сейчас» из раздела РК):
//   { }                          — прогон по всем кабинетам, где автопилот включён;
//   { cabinet_id }               — только один кабинет (владелец, команда, супер-админ);
//   { action: 'report' }         — суточная сводка в Telegram (cron раз в день).
// По каждому артикулу в отмеченных СРС-кампаниях сравнивает цену заказа за 3 полных дня с целевой
// и меняет ставку на шаг вверх/вниз. Пробный режим (dry_run) только пишет журнал.
// Кампании не включает и не выключает, бюджет не трогает.
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, isStaffUser, json, userFromRequest } from '../_shared/akylai-server.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { filterFeatureActive } from '../_shared/cabinet-features.ts';
import { CABINET_TOKEN_SELECT, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { ADV_API, setAdvertBids, type ExtractedBid } from '../_shared/wb-advert-bids.ts';
import { decideBid, economicsFromRows, nmStatsFromRows, DEFAULTS, type Params } from '../_shared/ad-autopilot.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { sendTelegramMessage } from '../_shared/notify-once.ts';

const MAX_CHANGES_PER_RUN = 60;
const COOLDOWN_HOURS = 11; // один артикул не чаще раза за ~полсуток: статистика WB приходит с задержкой

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => ymd(new Date(Date.now() - n * 86400_000));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function paramsOf(s: any): Params {
    return {
        targetShare: Number(s.target_share) || DEFAULTS.targetShare, maxDrrPct: Number(s.max_drr_pct) || DEFAULTS.maxDrrPct,
        minBidKop: Number(s.min_bid_kop) || DEFAULTS.minBidKop, maxBidKop: Number(s.max_bid_kop) || DEFAULTS.maxBidKop,
        stepPct: Number(s.step_pct) || DEFAULTS.stepPct, minClicks: Number(s.min_clicks) || DEFAULTS.minClicks,
    };
}

async function fetchAdverts(token: string, ids: number[]): Promise<any[]> {
    const res = await fetch(`${ADV_API}/api/advert/v2/adverts?ids=${ids.join(',')}&statuses=4%2C9%2C11`, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`WB adverts ${res.status}`);
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d?.adverts) ? d.adverts : [];
}

async function runCabinet(admin: any, settings: any, opts: { forceDry: boolean }) {
    const cabinetId = settings.cabinet_id as string;
    const dry = opts.forceDry || settings.dry_run !== false;
    const params = paramsOf(settings);
    const out: any = { cabinet_id: cabinetId, dry_run: dry, changes: 0, holds: 0, errors: [] as string[] };

    // Автопилот ведёт все работающие СРС-кампании кабинета; отключается вручную паузой кампании.
    const { data: camps } = await admin.from('advertising_campaigns').select('campaign_id').eq('cabinet_id', cabinetId).eq('payment_type', 'cpc').eq('status', 9);
    const ids = (camps || []).map((c: any) => Number(c.campaign_id)).filter((n: number) => n > 0);
    if (!ids.length) return { ...out, skipped: 'no_campaigns' };

    const { data: cab } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).eq('id', cabinetId).maybeSingle();
    const token = cab ? pickCabinetToken(cab, 'promotion') : '';
    if (token.length < 50) return { ...out, skipped: 'no_token' };

    const adverts = (await fetchAdverts(token, ids)).filter((a) => Number(a.status) === 9 && a.settings?.payment_type === 'cpc');
    if (!adverts.length) return { ...out, skipped: 'no_active_cpc' };

    // статистика по артикулам: 3 полных дня (сегодняшний ещё не закончился)
    const { data: statRows } = await admin.from('advertising_daily_stats').select('campaign_id, data')
        .eq('cabinet_id', cabinetId).in('campaign_id', adverts.map((a) => a.id)).gte('stat_date', daysAgo(3)).lte('stat_date', daysAgo(1));
    const stats = nmStatsFromRows(statRows || []);

    // экономика артикулов: РНП за период без свежих недель (выкупы приходят с задержкой) и себестоимость
    const nmIds = [...new Set(adverts.flatMap((a) => (a.nm_settings || []).map((n: any) => Number(n.nm_id))))];
    const { data: rnp } = await admin.from('rnp_daily_data')
        .select('nm_id, sales_count, orders_count, to_transfer, storage_sum, orders_sum')
        .eq('cabinet_id', cabinetId).in('nm_id', nmIds).gte('date', daysAgo(37)).lte('date', daysAgo(7));
    const { data: arts } = await admin.from('rnp_articles').select('nm_id, cost_price').eq('cabinet_id', cabinetId).in('nm_id', nmIds);
    const cost = new Map((arts || []).map((a: any) => [Number(a.nm_id), Number(a.cost_price) || 0]));
    const rnpBy = new Map<number, any[]>();
    for (const r of rnp || []) rnpBy.set(Number(r.nm_id), [...(rnpBy.get(Number(r.nm_id)) || []), r]);

    // недавно менявшиеся артикулы пропускаем
    const { data: recent } = await admin.from('ad_autopilot_log').select('nm_id').eq('cabinet_id', cabinetId).eq('applied', true)
        .in('action', ['raise', 'lower']).gte('created_at', new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString());
    const cooling = new Set((recent || []).map((r: any) => Number(r.nm_id)));

    const logRows: any[] = [];
    for (const adv of adverts) {
        const changes: ExtractedBid[] = [];
        const meta: any[] = [];
        for (const n of adv.nm_settings || []) {
            const nm = Number(n.nm_id);
            const search = Number(n.bids_kopecks?.search) || 0, rec = Number(n.bids_kopecks?.recommendations) || 0;
            const placement = search > 0 ? 'search' : 'recommendations';
            const bid = search > 0 ? search : rec;
            if (!(bid > 0) || cooling.has(nm)) { out.holds++; continue; }
            const econ = economicsFromRows(rnpBy.get(nm) || [], cost.get(nm) || 0);
            if (!econ) { out.holds++; continue; }
            const d = decideBid(stats.get(`${adv.id}:${nm}`) || { spend: 0, orders: 0, clicks: 0, views: 0 }, econ, bid, params);
            if (d.action === 'hold') { out.holds++; continue; }
            if (out.changes + changes.length >= MAX_CHANGES_PER_RUN) break;
            changes.push({ nm_id: nm, placement: placement as any, bid_kopecks: d.newBid });
            meta.push({ nm, bid, d });
        }
        if (!changes.length) continue;
        let applied = false;
        if (!dry) {
            const res = await setAdvertBids(token, Number(adv.id), changes);
            applied = res.ok;
            if (!res.ok) out.errors.push(`${adv.id}: WB ${res.status} ${res.body.slice(0, 120)}`);
            await sleep(1100);
        }
        for (const m of meta) {
            logRows.push({
                cabinet_id: cabinetId, campaign_id: adv.id, nm_id: m.nm, action: m.d.action, old_bid: m.bid, new_bid: m.d.newBid,
                reason: m.d.reason, cpo: m.d.cpo, target_cpo: Math.round(m.d.target), applied,
            });
        }
        out.changes += changes.length;
    }
    if (logRows.length) await admin.from('ad_autopilot_log').insert(logRows);
    return out;
}

async function dailyReport(admin: any, cabinets: any[]) {
    const tg = getTelegramToken(), chat = getTelegramChatId('ads');
    if (!tg || !chat) return { skipped: 'no_telegram' };
    for (const s of cabinets) {
        const { data: cab } = await admin.from('cabinets').select('name').eq('id', s.cabinet_id).maybeSingle();
        const since = new Date(Date.now() - 24 * 3600_000).toISOString();
        const { data: log } = await admin.from('ad_autopilot_log').select('action, applied').eq('cabinet_id', s.cabinet_id).gte('created_at', since);
        const up = (log || []).filter((l: any) => l.action === 'raise').length, down = (log || []).filter((l: any) => l.action === 'lower').length;
        const { data: ids } = await admin.from('advertising_campaigns').select('campaign_id').eq('cabinet_id', s.cabinet_id).eq('payment_type', 'cpc');
        const { data: day } = await admin.from('advertising_daily_stats').select('spend, orders').eq('cabinet_id', s.cabinet_id)
            .in('campaign_id', (ids || []).map((c: any) => c.campaign_id)).eq('stat_date', daysAgo(1));
        const spend = (day || []).reduce((a: number, r: any) => a + Number(r.spend || 0), 0);
        const orders = (day || []).reduce((a: number, r: any) => a + Number(r.orders || 0), 0);
        const mode = s.dry_run !== false ? 'пробный режим, ставки не менялись' : 'боевой режим';
        // Баланс кампаний: у кого кончились деньги, WB ставит кампанию на паузу сам.
        const { data: low } = await admin.from('advertising_campaigns').select('campaign_name, budget_total, status')
            .eq('cabinet_id', s.cabinet_id).in('status', [9, 11]).eq('payment_type', 'cpc').lt('budget_total', 300);
        const lowTxt = (low || []).length
            ? `\nМало денег на балансе: ${(low || []).map((c: any) => `${c.campaign_name} (${Math.round(Number(c.budget_total) || 0)})`).join(', ')}. Пополните в кабинете WB.`
            : '';
        const text = `Автопилот рекламы, ${cab?.name || ''}\nВчера: расход ${Math.round(spend)}, заказов ${orders}${orders ? `, цена заказа ${Math.round(spend / orders)}` : ''}\nСтавки за сутки: поднято ${up}, снижено ${down} (${mode})${lowTxt}`;
        await sendTelegramMessage(tg, chat, text);
    }
    return { sent: cabinets.length };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const admin = adminClient();
    const body = await req.json().catch(() => ({} as any));
    const service = isServiceAuthorized(req, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    let cabinetFilter: string | null = body?.cabinet_id ? String(body.cabinet_id) : null;
    let forceDry = false;
    if (!service) {
        const user = await userFromRequest(req);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        if (!cabinetFilter) return json({ error: 'cabinet_id required' }, 400);
        const { data: cab } = await admin.from('cabinets').select('user_id').eq('id', cabinetFilter).maybeSingle();
        if (!cab || (cab.user_id !== user.id && !(await isStaffUser(admin, user)))) return json({ error: 'Нет доступа к кабинету' }, 403);
        forceDry = body?.apply !== true; // из интерфейса по умолчанию «проверить»: ничего не меняем, пока не включён боевой режим
    }

    let q = admin.from('ad_autopilot_settings').select('*').eq('enabled', true);
    if (cabinetFilter) q = q.eq('cabinet_id', cabinetFilter);
    const { data: all } = await q;
    const active = await filterFeatureActive(admin, all || [], 'ads');

    if (body?.action === 'report') return json({ ok: true, ...(await dailyReport(admin, active)) });

    const results: any[] = [];
    for (const s of active) {
        try { results.push(await runCabinet(admin, s, { forceDry })); } catch (e) { results.push({ cabinet_id: s.cabinet_id, error: String(e).slice(0, 200) }); }
    }
    return json({ ok: true, results });
});
