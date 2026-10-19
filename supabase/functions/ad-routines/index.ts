// Supabase Edge Function: ad-routines
//
// Ежедневные шаги по рекламе по правилам владельца, без участия человека и ИИ. Cron:
//   { step: 'zevina' }   09:07 Бишкек: ставки и пополнение «сливных» по Zevina 1;
//   { step: 'morning' }  10:08: Baza и Elium, утреннее пополнение и ставки по цене заказа;
//   { step: 'evening' }  18:05: Baza и Elium, догон бюджета и контроль темпа.
// { dry_run: true } ничего не меняет, только возвращает решения. Работает только по service_role.
// Ставки уходят через очередь adv_ops (повторы и проверка есть), комментарии в РНП до 100 символов, отчёт в Telegram.
// deno-lint-ignore-file no-explicit-any

import { adminClient, CORS, json } from '../_shared/akylai-server.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { CABINET_TOKEN_SELECT, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { ADV_API, extractBidsFromAdvert } from '../_shared/wb-advert-bids.ts';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';
import { sendTelegramMessage } from '../_shared/notify-once.ts';
import {
    CAP_RULES, ZEVINA_BID_CEILING_KOP, ZEVINA_CABINET, ZEVINA_CAMPAIGNS, ZEVINA_MIN_BID_KOP,
    bidNote, eveningPaceVerdict, eveningTopup, morningBidVerdict, morningTopup, scaleBid, zevinaBidVerdict, zevinaTopup,
    type BidLine, type BidVerdict, type CapRule, type DayStat,
} from '../_shared/ad-routines.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Дата статистики WB считается по Москве.
const mskDate = (offsetDays = 0) => new Date(Date.now() + 3 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);

interface Ctx { admin: any; dry: boolean; lines: string[]; alerts: string[] }

async function wb(token: string, method: string, path: string, body?: unknown) {
    const res = await fetch(`${ADV_API}${path}`, {
        method, headers: { Authorization: token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* не json */ }
    return { ok: res.ok, status: res.status, data, text: text.slice(0, 200) };
}

async function tokenFor(admin: any, cabinetId: string): Promise<string> {
    const { data: cab } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).eq('id', cabinetId).maybeSingle();
    const t = cab ? pickCabinetToken(cab, 'promotion') : '';
    if (t.length < 50) throw new Error('нет токена WB');
    return t;
}

async function adverts(token: string, ids: number[]): Promise<Map<number, any>> {
    const r = await wb(token, 'GET', `/api/advert/v2/adverts?ids=${ids.join(',')}`);
    if (!r.ok) throw new Error(`WB adverts ${r.status}`);
    return new Map((r.data?.adverts || []).map((a: any) => [Number(a.id), a]));
}

async function budgetOf(token: string, id: number): Promise<number> {
    const r = await wb(token, 'GET', `/adv/v1/budget?id=${id}`);
    return r.ok ? Number(r.data?.total || 0) : 0;
}

async function balanceNet(token: string): Promise<number> {
    const r = await wb(token, 'GET', '/adv/v1/balance');
    return r.ok ? Number(r.data?.net || 0) : 0;
}

async function dayStat(admin: any, cabinetId: string, advertId: number, date: string): Promise<DayStat> {
    const { data } = await admin.from('advertising_daily_stats').select('spend, orders').eq('cabinet_id', cabinetId).eq('campaign_id', advertId).eq('stat_date', date);
    const rows = data || [];
    return { orders: rows.reduce((a: number, r: any) => a + Number(r.orders || 0), 0), spend: rows.reduce((a: number, r: any) => a + Number(r.spend || 0), 0) };
}

async function deposit(token: string, id: number, sum: number) {
    return wb(token, 'POST', `/adv/v1/budget/deposit?id=${id}`, { sum, type: 1, return: true });
}

async function ensureRunning(token: string, advert: any) {
    if (advert && Number(advert.status) === 11) return wb(token, 'GET', `/adv/v0/start?id=${advert.id}`);
    return null;
}

/** Ставки через очередь adv_ops, затем ждём, пока уйдут; в РНП одна короткая строка на артикул. */
async function applyBids(ctx: Ctx, cabinetId: string, advertId: number, changes: { nm_id: number; from: number; to: number }[], notePrefix: string, tail: string) {
    if (!changes.length) return;
    if (ctx.dry) return;
    const rows = changes.map((c) => ({ cabinet_id: cabinetId, advert_id: advertId, kind: 'set_bid', status: 'pending', payload: { nm_id: c.nm_id, placement: 'search', bid_kopecks: c.to } }));
    await ctx.admin.from('adv_ops').insert(rows);
    const today = mskDate();
    await ctx.admin.from('rnp_date_notes').insert(changes.map((c) => ({
        cabinet_id: cabinetId, nm_id: c.nm_id, note_date: today, author: 'ИИ-агент', note: bidNote(notePrefix, c.from, c.to, tail),
    })));
    // Запускаем отправку сразу, не дожидаясь минутного cron.
    try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/adv-ops-run`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }, body: '{}',
        });
    } catch { /* догонит cron */ }
}

async function noteMoney(ctx: Ctx, cabinetId: string, nm: number, text: string) {
    if (ctx.dry) return;
    await ctx.admin.from('rnp_date_notes').insert({ cabinet_id: cabinetId, nm_id: nm, note_date: mskDate(), author: 'ИИ-агент', note: text.slice(0, 100) });
}

function bidChanges(lines: BidLine[], v: BidVerdict, minKop: number, ceilingKop?: number) {
    if (v.mult === 1) return [];
    return lines.map((b) => ({ nm_id: b.nm_id, from: b.bid_kopecks, to: scaleBid(b.bid_kopecks, v.mult, minKop, ceilingKop) })).filter((c) => c.to !== c.from);
}

// ───────── Baza и Elium ─────────

async function capStep(ctx: Ctx, rule: CapRule, step: 'morning' | 'evening') {
    const token = await tokenFor(ctx.admin, rule.cabinetId);
    const adv = (await adverts(token, [rule.advertId])).get(rule.advertId);
    if (!adv) throw new Error('кампания не найдена');
    const bids = extractBidsFromAdvert(adv).filter((b) => b.placement === 'search').map((b) => ({ nm_id: b.nm_id, bid_kopecks: b.bid_kopecks }));
    const budget = await budgetOf(token, rule.advertId);
    const net = await balanceNet(token);
    const today = await dayStat(ctx.admin, rule.cabinetId, rule.advertId, mskDate());
    const yest = await dayStat(ctx.admin, rule.cabinetId, rule.advertId, mskDate(1));
    const prev = await dayStat(ctx.admin, rule.cabinetId, rule.advertId, mskDate(2));
    const parts: string[] = [];

    const amount = step === 'morning' ? morningTopup(rule, budget, today.spend, net) : eveningTopup(rule, budget, today.spend, net);
    if (amount > 0) {
        if (!ctx.dry) {
            const r = await deposit(token, rule.advertId, amount);
            if (!r.ok) ctx.alerts.push(`${rule.label}: пополнение ${amount} ₽ не прошло (${r.status})`);
            else {
                parts.push(`пополнил на ${amount} ₽`);
                if (bids[0]) await noteMoney(ctx, rule.cabinetId, bids[0].nm_id, `РК СПС ${step === 'morning' ? '10:00' : '18:00'}: бюджет +${amount} ₽`);
            }
        } else parts.push(`пополнил бы на ${amount} ₽`);
    }
    // Кампания на паузе (бюджета не было): запускаем, если деньги есть.
    if (!ctx.dry && Number(adv.status) === 11 && (amount > 0 || budget >= 300)) {
        const r = await ensureRunning(token, adv);
        if (r?.ok) parts.push('запустил');
    }

    const verdict = step === 'morning' ? morningBidVerdict(rule, yest, prev) : eveningPaceVerdict(rule, today.spend);
    if ((verdict as any).alert) ctx.alerts.push(`${rule.label}: ${verdict.reason}`);
    const changes = bidChanges(bids, verdict, rule.minBidKop);
    if (changes.length) {
        await applyBids(ctx, rule.cabinetId, rule.advertId, changes, `РК СПС ${step === 'morning' ? '10:00' : '18:00'}`, verdict.reason);
        parts.push(`ставки ${verdict.mult > 1 ? '+' : '−'}${Math.round(Math.abs(verdict.mult - 1) * 100)}%`);
    }
    const orders = step === 'morning' ? `вчера ${yest.orders} зак., ${Math.round(yest.spend)} ₽` : `сегодня ${Math.round(today.spend)} из ${rule.cap} ₽`;
    ctx.lines.push(`${rule.label}: ${orders}, остаток ${Math.round(budget + amount)} ₽${parts.length ? '; ' + parts.join(', ') : ''}`);
    return { rule: rule.key, budget, amount, verdict: verdict.reason, bids: changes.length };
}

// ───────── Zevina 1 ─────────

async function zevinaStep(ctx: Ctx) {
    const cab = ZEVINA_CABINET;
    const token = await tokenFor(ctx.admin, cab);
    const advs = await adverts(token, ZEVINA_CAMPAIGNS.map((c) => c.advertId));
    const net = await balanceNet(token);
    const y = mskDate(1);
    // ДРР кабинета за вчера: расход рекламы к выручке по заказам.
    const { data: spendRows } = await ctx.admin.from('advertising_daily_stats').select('spend').eq('cabinet_id', cab).eq('stat_date', y);
    const adSpend = (spendRows || []).reduce((a: number, r: any) => a + Number(r.spend || 0), 0);
    const { data: ordRows } = await ctx.admin.from('wb_orders').select('price').eq('cabinet_id', cab).eq('order_date', y).eq('is_return', false).range(0, 4999);
    const revenue = (ordRows || []).reduce((a: number, r: any) => a + Number(r.price || 0), 0);
    const ordersDay = (ordRows || []).length;
    const drr = revenue > 0 ? (adSpend / revenue) * 100 : 0;
    if (ordersDay < 100) ctx.alerts.push(`Zevina 1: заказов за вчера ${ordersDay}, меньше 100`);

    let toppedToday = 0;
    const out: any[] = [];
    const sum: string[] = [];
    for (const c of ZEVINA_CAMPAIGNS) {
        const adv = advs.get(c.advertId);
        if (!adv) continue;
        const yest = await dayStat(ctx.admin, cab, c.advertId, y);
        // Слив: три дня тратит и без заказов.
        let noOrders3 = false;
        if (c.drain) {
            let sp = 0, od = 0;
            for (const d of [1, 2, 3]) { const s = await dayStat(ctx.admin, cab, c.advertId, mskDate(d)); sp += s.spend; od += s.orders; }
            noOrders3 = sp > 0 && od === 0;
        }
        const verdict = zevinaBidVerdict(c, yest, drr, noOrders3);
        if ((verdict as any).alert) ctx.alerts.push(`${c.label}: ${verdict.reason}`);
        const bids = extractBidsFromAdvert(adv).filter((b) => b.placement === 'search').map((b) => ({ nm_id: b.nm_id, bid_kopecks: b.bid_kopecks }));
        const changes = bidChanges(bids, verdict, ZEVINA_MIN_BID_KOP, ZEVINA_BID_CEILING_KOP);
        if (changes.length) await applyBids(ctx, cab, c.advertId, changes, 'РК', `${verdict.reason}`);

        let note = '';
        if (c.topup) {
            const budget = await budgetOf(token, c.advertId);
            const t = zevinaTopup(budget, toppedToday, net - toppedToday);
            if (t.amount > 0) {
                if (ctx.dry) note = ` +${t.amount} ₽ (проба)`;
                else {
                    const r = await deposit(token, c.advertId, t.amount);
                    if (r.ok) {
                        toppedToday = t.spentToday; note = ` +${t.amount} ₽`;
                        if (changes[0] || bids[0]) await noteMoney(ctx, cab, (changes[0]?.nm_id ?? bids[0].nm_id), `РК ${c.label}: бюджет +${t.amount} ₽`.slice(0, 100));
                        if (Number(adv.status) === 11) await ensureRunning(token, adv);
                    } else ctx.alerts.push(`${c.label}: пополнение ${t.amount} ₽ не прошло (${r.status})`);
                }
            }
        }
        if (changes.length || note) sum.push(`${c.label}${changes.length ? ` ставки ${verdict.mult > 1 ? '+' : '−'}${Math.round(Math.abs(verdict.mult - 1) * 100)}%` : ''}${note}`);
        out.push({ advert: c.advertId, verdict: verdict.reason, bids: changes.length, topup: note });
    }
    ctx.lines.push(`Zevina 1: вчера ${ordersDay} зак., ДРР ${drr.toFixed(1)}%${sum.length ? '. ' + sum.join('; ') : ', ставки без изменений'}`);
    return out;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!(await isServiceAuthorized(req, serviceKey))) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as any));
    const step = String(body?.step || '');
    if (!['zevina', 'morning', 'evening'].includes(step)) return json({ error: 'step: zevina | morning | evening' }, 400);
    const ctx: Ctx = { admin: adminClient(), dry: body?.dry_run === true, lines: [], alerts: [] };
    const results: any[] = [];
    try {
        if (step === 'zevina') results.push(...await zevinaStep(ctx));
        else for (const rule of CAP_RULES) {
            try { results.push(await capStep(ctx, rule, step as 'morning' | 'evening')); await sleep(300); } catch (e) { ctx.alerts.push(`${rule.label}: ${String(e).slice(0, 120)}`); }
        }
    } catch (e) { ctx.alerts.push(`${step}: ${String(e).slice(0, 160)}`); }

    const title = step === 'zevina' ? 'РК 09:07' : step === 'morning' ? 'РК 10:00' : 'РК 18:00';
    const text = [`${title}${ctx.dry ? ' (проба, ничего не менял)' : ''}`, ...ctx.lines, ...ctx.alerts.map((a) => `Внимание: ${a}`)].join('\n');
    const tg = getTelegramToken(), chat = getTelegramChatId('ads');
    if (tg && chat && !ctx.dry) await sendTelegramMessage(tg, chat, text);
    return json({ ok: true, step, dry_run: ctx.dry, report: text, results });
});
