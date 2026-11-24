// Напоминания Алины (владелец, 24 ноября 2026): за 2 часа до 22:00 МСК тем, кто ещё не прислал заказ; «ещё актуально?» тем, кто молчит 3 часа;
// после 22:30 МСК список не приславших заказ уходит в группу менеджеров (места сами не освобождаем). Запускается по расписанию, только сервис.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { managerGroupId } from '../_shared/alina-manager.ts';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const WAITING = ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order'];
const STEP: Record<string, string> = { tz_sent: 'скрин поиска', key_sent: 'скрин поиска', wait_product: 'скрин поиска', wait_cart: 'скрин корзины', wait_order: 'скрин заказа' };

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const dry = body.dry_run === true;
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const token = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    const now = Date.now();
    const msk = new Date(now + 3 * 3600_000);
    const hm = msk.getUTCHours() * 60 + msk.getUTCMinutes();
    const day = msk.toISOString().slice(0, 10);

    const { data: q } = await admin.from('alina_manager_questions').select('business_connection_id').not('business_connection_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const conn = String((q as { business_connection_id?: string } | null)?.business_connection_id || '');
    if (!conn || !token) return json({ ok: false, error: 'нет business_connection_id или токена' });

    const { data: leadsRaw } = await admin.from('alina_selfbuy_leads').select('id, chat_id, username, status, updated_at')
        .in('status', WAITING).gt('updated_at', new Date(now - 30 * 3600_000).toISOString()).limit(60);
    const leads = (leadsRaw || []) as Array<{ id: string; chat_id: number; username: string | null; status: string; updated_at: string }>;

    const done = async (chatId: number, kind: string) => {
        const { data } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', chatId).eq('event_type', 'nudge')
            .eq('payload->>kind', kind).eq('payload->>day', day).limit(1);
        return Boolean(data && data.length);
    };
    const send = async (chatId: number, text: string) => {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ chat_id: chatId, business_connection_id: conn, text }),
        }).catch(() => null);
        return Boolean(r?.ok);
    };
    const log = (chatId: number, kind: string, text: string) => admin.from('alina_selfbuy_events').insert([
        { event_type: 'nudge', chat_id: chatId, payload: { kind, day } },
        { event_type: 'chat_log', chat_id: chatId, payload: { dir: 'alina', text, kind: 'nudge' } },
    ]);

    const sent: string[] = [];
    const missed: string[] = [];
    for (const l of leads) {
        if (sent.length >= 10) break;
        // человек сейчас ведёт чат сам (последние 30 минут) или зовёт менеджера: не вмешиваемся
        const since30 = new Date(now - 30 * 60_000).toISOString();
        const { data: owner } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', l.chat_id).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'owner').gt('created_at', since30).limit(1);
        if (owner && owner.length) continue;
        const { data: lastClient } = await admin.from('alina_selfbuy_events').select('created_at').eq('chat_id', l.chat_id).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'client').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const idleMs = now - Date.parse(String((lastClient as { created_at?: string } | null)?.created_at || l.updated_at));
        const step = STEP[l.status] || 'скрин';

        if (hm >= 22 * 60 + 30) { missed.push(`${l.username ? '@' + l.username : l.chat_id} (${step})`); continue; }
        if (hm >= 20 * 60 && hm < 21 * 60 + 30 && !await done(l.chat_id, 'deadline')) {
            const text = `До 22:00 по Москве осталось около 2 часов. Жду ${step} 🙌`;
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'deadline', text); sent.push(`deadline ${l.username}`); } else if (dry) sent.push(`deadline ${l.username}`);
            continue;
        }
        if (idleMs > 3 * 3600_000 && hm >= 9 * 60 && hm < 21 * 60 && !await done(l.chat_id, 'idle')) {
            const text = 'Ещё актуально? Если нет, напишите, освобожу место 🙌';
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'idle', text); sent.push(`idle ${l.username}`); } else if (dry) sent.push(`idle ${l.username}`);
        }
    }
    // После 22:30 МСК: список не приславших заказ в группу менеджеров (один раз за день)
    let groupSent = false;
    if (missed.length && !dry) {
        const group = await managerGroupId();
        const { data: mark } = await admin.from('alina_selfbuy_events').select('id').eq('event_type', 'nudge').eq('payload->>kind', 'missed_list').eq('payload->>day', day).limit(1);
        if (group && !(mark && mark.length)) {
            const text = `Не прислали заказ до 22:00: ${missed.join(', ')}. Места сами не освобождаю, решите, кого снять.`;
            const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
                body: JSON.stringify({ chat_id: group, text }),
            }).catch(() => null);
            groupSent = Boolean(r?.ok);
            if (groupSent) await admin.from('alina_selfbuy_events').insert({ event_type: 'nudge', chat_id: 0, payload: { kind: 'missed_list', day } });
        }
    }
    return json({ ok: true, dry_run: dry, msk: msk.toISOString().slice(11, 16), waiting: leads.length, sent, missed, groupSent });
});
