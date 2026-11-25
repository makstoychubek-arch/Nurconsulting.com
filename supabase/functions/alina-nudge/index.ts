// Напоминания Алины (владелец, 24 ноября 2026): за 2 часа до 22:00 МСК тем, кто ещё не прислал заказ; «ещё актуально?» тем, кто молчит 3 часа;
// после 22:30 МСК список не приславших заказ уходит в группу менеджеров (места сами не освобождаем). Запускается по расписанию, только сервис.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { managerGroupId } from '../_shared/alina-manager.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';

/** Освободить строку клиента на сегодня (очистить логин в колонке C): только его строка на сегодняшнюю дату. */
async function releaseRow(token: string, username: string, dayKey: string): Promise<boolean> {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${base}/${encodeURIComponent(`'${TAB}'!A1:D400`)}?valueRenderOption=FORMATTED_VALUE`, { headers: H, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!res?.ok) return false;
    const rows = ((await res.json().catch(() => null))?.values || []) as string[][];
    const me = username.replace(/^@/, '').toLowerCase();
    const hit: number[] = [];
    rows.forEach((r, i) => {
        const tg = String(r[2] || '').replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim().toLowerCase();
        if (tg === me && String(r[3] || '').trim() === dayKey) hit.push(i + 1);
    });
    if (hit.length !== 1) return false; // не уверены, что строка одна: не трогаем
    // Логин и даты-заготовки (публикация отзыва K, плановая выплата S): иначе пустая строка не считалась бы свободной.
    const w = await fetch(`${base}:batchUpdate`, { method: 'POST', headers: H, signal: AbortSignal.timeout(15000), body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [
        { range: `'${TAB}'!C${hit[0]}`, values: [['']] }, { range: `'${TAB}'!K${hit[0]}`, values: [['']] }, { range: `'${TAB}'!S${hit[0]}`, values: [['']] },
    ] }) }).catch(() => null);
    return Boolean(w?.ok);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const WAITING = ['tz_sent', 'key_sent', 'wait_product', 'wait_cart', 'wait_order'];
const STEP: Record<string, string> = { tz_sent: 'ваше согласие с условиями', key_sent: 'скрин поиска', wait_product: 'скрин поиска', wait_cart: 'скрин корзины', wait_order: 'скрин заказа' };

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

    // Кого не трогаем (ведёт владелец вручную или тест): alina_settings.nudgeSkip, список логинов
    const { data: skipRow } = await admin.from('alina_settings').select('value').eq('key', 'nudgeSkip').maybeSingle();
    const skip = new Set(((skipRow as { value?: unknown } | null)?.value as string[] | undefined || []).map((x) => String(x).replace(/^@/, '').toLowerCase()));
    const sent: string[] = [];
    const missed: string[] = [];
    const released: string[] = [];
    let sheetToken = '';
    const dayKey = `${String(msk.getUTCDate()).padStart(2, '0')}.${String(msk.getUTCMonth() + 1).padStart(2, '0')}.${msk.getUTCFullYear()}`;
    // Напоминаем «до 22:00» и освобождаем строку только тем, у кого в таблице есть строка на СЕГОДНЯ (25 ноября 2026: Тамила получала «до 22:00», а её строку уже перенесли на 28.11).
    let todayTg: Set<string> | null = null;
    try {
        if (!sheetToken) sheetToken = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
        const rs = sheetToken ? await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:D1500`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${sheetToken}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null) : null;
        if (rs?.ok) {
            const vals = ((await rs.json().catch(() => null))?.values || []) as string[][];
            todayTg = new Set(vals.filter((r) => String(r[3] || '').trim().replace(/^(\d{2}\.\d{2})$/, `$1.${msk.getUTCFullYear()}`) === dayKey && String(r[2] || '').trim())
                .map((r) => String(r[2]).replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim().toLowerCase()));
        }
    } catch { todayTg = null; }
    for (const l of leads) {
        if (sent.length >= 10) break;
        if (todayTg && l.username && !todayTg.has(l.username.replace(/^@/, '').toLowerCase())) continue;
        if (l.username && skip.has(l.username.toLowerCase())) continue;
        // человек сейчас ведёт чат сам (последние 30 минут) или зовёт менеджера: не вмешиваемся
        const since30 = new Date(now - 30 * 60_000).toISOString();
        const { data: owner } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', l.chat_id).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'owner').gt('created_at', since30).limit(1);
        if (owner && owner.length) continue;
        // Клиент отказался или предлагает другие условия («не готова», «не буду», «не подходит»): не напоминаем, решает менеджер
        const { data: lastTexts } = await admin.from('alina_selfbuy_events').select('payload').eq('chat_id', l.chat_id).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'client').order('created_at', { ascending: false }).limit(4);
        if (((lastTexts || []) as Array<{ payload: { text?: string } }>).some((x) => /не\s+готов\S*|не\s+буд\S+|не\s+хочу|откаж\S*|не\s+подходит|не\s+согласн\S*|к\s+сожалению\s+я\s+не/i.test(String(x.payload?.text || '')))) continue;
        const { data: lastClient } = await admin.from('alina_selfbuy_events').select('created_at').eq('chat_id', l.chat_id).eq('event_type', 'chat_log')
            .eq('payload->>dir', 'client').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const idleMs = now - Date.parse(String((lastClient as { created_at?: string } | null)?.created_at || l.updated_at));
        const step = STEP[l.status] || 'скрин';

        if (hm >= 22 * 60 + 30) {
            // Дедлайн прошёл, заказа нет: освобождаем только его строку на сегодня (условие ТЗ: заявка аннулируется и отдаётся другому блогеру)
            const who = l.username ? '@' + l.username : String(l.chat_id);
            if (await done(l.chat_id, 'released')) continue;
            if (dry) { missed.push(`${who} (${step}) → освободить`); continue; }
            if (!sheetToken) sheetToken = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
            const ok = Boolean(sheetToken && l.username && await releaseRow(sheetToken, l.username, dayKey));
            if (!ok) { missed.push(`${who} (${step}, не смогла освободить)`); continue; }
            await admin.from('alina_selfbuy_leads').update({ status: 'closed', sheet_row: null, updated_at: new Date().toISOString() }).eq('id', l.id);
            const text = 'Время на заказ вышло (до 22:00 МСК), место освободила 🙏 Если ещё актуально, напишите, поставлю на другой день.';
            if (await send(l.chat_id, text)) await log(l.chat_id, 'released', text); else await admin.from('alina_selfbuy_events').insert({ event_type: 'nudge', chat_id: l.chat_id, payload: { kind: 'released', day } });
            released.push(`${who} (${step})`);
            continue;
        }
        if (hm >= 21 * 60 + 30 && hm < 21 * 60 + 55 && !await done(l.chat_id, 'lastcall')) {
            const text = `До 22:00 осталось около 30 минут. Жду ${step} 🙌`;
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'lastcall', text); sent.push(`lastcall ${l.username}`); } else if (dry) sent.push(`lastcall ${l.username}`);
            continue;
        }
        if (hm >= 20 * 60 && hm < 21 * 60 + 30 && !await done(l.chat_id, 'deadline')) {
            const text = `До 22:00 по Москве осталось около 2 часов. Жду ${step} 🙌`;
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'deadline', text); sent.push(`deadline ${l.username}`); } else if (dry) sent.push(`deadline ${l.username}`);
            continue;
        }
        // Напоминания тем, кто ищет или собирает заказ (владелец, 25 ноября 2026): через 40 минут тишины спрашиваем, как идёт, через 2 часа уточняем, актуально ли.
        const PING1: Record<string, string> = {
            tz_sent: 'Ознакомились с условиями? Если всё устраивает, напишите «согласна», и пришлю ключ 🙌',
            key_sent: 'Как поиск, нашли наш товар? Если не получается, напишите, подскажу 🙌',
            wait_product: 'Как поиск, нашли наш товар? Если не получается, напишите, подскажу 🙌',
            wait_cart: 'Как корзина? Пришлите скрин, когда будет готова 🙌',
            wait_order: 'Заказ оформили? Пришлите скрин, когда будет готов 🙌',
        };
        if (idleMs > 40 * 60_000 && idleMs < 2 * 3600_000 && hm >= 9 * 60 && hm < 21 * 60 && PING1[l.status] && !await done(l.chat_id, 'ping1')) {
            const text = PING1[l.status];
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'ping1', text); sent.push(`ping1 ${l.username}`); } else if (dry) sent.push(`ping1 ${l.username}`);
            continue;
        }
        if (idleMs > 2 * 3600_000 && hm >= 9 * 60 && hm < 21 * 60 && !await done(l.chat_id, 'idle')) {
            const text = 'Ещё актуально? Если нет, напишите, освобожу место 🙌';
            if (!dry && await send(l.chat_id, text)) { await log(l.chat_id, 'idle', text); sent.push(`idle ${l.username}`); } else if (dry) sent.push(`idle ${l.username}`);
        }
    }
    // Заказ должен был прийти (примерная дата забора = заказ + 3 дня): раз в день днём спрашиваем «забрали?» у тех, кто ждёт получения.
    if (hm >= 11 * 60 && hm < 19 * 60) {
        const { data: pk } = await admin.from('alina_selfbuy_leads').select('id, chat_id, username, sheet_target, updated_at').eq('status', 'wait_pickup').limit(60);
        for (const l of (pk || []) as Array<{ id: string; chat_id: number; username: string | null; sheet_target: string | null }>) {
            if (l.username && skip.has(l.username.toLowerCase())) continue;
            const ds = String(l.sheet_target || '').split('|')[2] || '';
            const m = ds.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (!m) continue;
            const due = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) + 3 * 86400_000;
            if (due > Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate())) continue;
            if (await done(l.chat_id, 'pickup_ask')) continue;
            const { data: ownerNow } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', l.chat_id).eq('event_type', 'chat_log').eq('payload->>dir', 'owner').gt('created_at', new Date(now - 30 * 60_000).toISOString()).limit(1);
            if (ownerNow && ownerNow.length) continue;
            const text = 'Здравствуйте! Заказ уже должен быть в пункте выдачи. Вы его забрали? 🙌';
            if (dry) { sent.push(`pickup_ask ${l.username}`); continue; }
            if (await send(l.chat_id, text)) { await log(l.chat_id, 'pickup_ask', text); sent.push(`pickup_ask ${l.username}`); }
        }
    }
    // Утреннее приглашение начать: у клиента закреплено место на сегодня (бронь с прошлых дней), но он ещё не писал. Один раз за день с 10:00 до 14:00 по Москве.
    if (hm >= 10 * 60 && hm < 14 * 60 && !dry) {
        if (!sheetToken) sheetToken = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
        const sr = sheetToken ? await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:E700`)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${sheetToken}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null) : null;
        const rows0 = ((await sr?.json().catch(() => null))?.values || []) as string[][];
        let started = 0;
        for (const r0 of rows0.slice(1)) {
            if (started >= 8) break;
            if (String(r0[3] || '').trim() !== dayKey || !String(r0[2] || '').trim() || String(r0[4] || '').trim()) continue;
            const un = String(r0[2]).replace(/^@/, '').trim();
            if (skip.has(un.toLowerCase())) continue;
            const { data: ld } = await admin.from('alina_selfbuy_leads').select('chat_id, status').ilike('username', un).order('updated_at', { ascending: false }).limit(1).maybeSingle();
            const chat = (ld as { chat_id?: number; status?: string } | null);
            if (!chat?.chat_id || !['closed', 'new', 'ask_ad'].includes(String(chat.status))) continue;
            if (await done(chat.chat_id, 'start_ask')) continue;
            const { data: today0 } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', chat.chat_id).eq('event_type', 'chat_log').gt('created_at', new Date(now - 6 * 3600_000).toISOString()).limit(1);
            if (today0 && today0.length) continue; // клиент или менеджер уже общаются сегодня
            const model = String(r0[0] || '').replace(/^Пижама\s+/i, '');
            const text = `Доброе утро! Сегодня ваше место на «${model}». Начинаем? Заказать нужно до 22:00 по Москве. Напишите «да», и пришлю условия 🙌`;
            if (await send(chat.chat_id, text)) { await log(chat.chat_id, 'start_ask', text); sent.push(`start_ask ${un}`); started++; }
        }
    }
    // 2 этап: клиент не прислал ШК или черновик отзыва больше суток, напоминаем раз в день днём; отзыв отправлен менеджеру, а ответа нет 3 часа: напоминаем в группу.
    if (hm >= 11 * 60 && hm < 19 * 60 && !dry) {
        const { data: st2 } = await admin.from('alina_selfbuy_leads').select('id, chat_id, username, status, updated_at, product_name').in('status', ['wait_shk', 'wait_review']).limit(60);
        for (const l of (st2 || []) as Array<{ id: string; chat_id: number; username: string | null; status: string; updated_at: string }>) {
            if (l.username && skip.has(l.username.toLowerCase())) continue;
            if (now - Date.parse(l.updated_at) < 24 * 3600_000) continue;
            const kind = l.status === 'wait_shk' ? 'shk_ask' : 'review_ask';
            if (await done(l.chat_id, kind)) continue;
            const text = l.status === 'wait_shk' ? 'Напоминаю: жду фото с разрезанными штрихкодами WB 🙌' : 'Напоминаю: жду черновик отзыва, фото и текст. Публиковать сразу не нужно 🙌';
            if (await send(l.chat_id, text)) { await log(l.chat_id, kind, text); sent.push(`${kind} ${l.username}`); }
        }
        const group2 = await managerGroupId();
        if (group2) {
            const { data: rv } = await admin.from('alina_selfbuy_events').select('chat_id, created_at').eq('event_type', 'review').lt('created_at', new Date(now - 3 * 3600_000).toISOString()).gt('created_at', new Date(now - 30 * 3600_000).toISOString()).limit(40);
            for (const e of (rv || []) as Array<{ chat_id: number; created_at: string }>) {
                if (await done(e.chat_id, 'review_remind')) continue;
                const { data: ans } = await admin.from('alina_selfbuy_events').select('id').eq('chat_id', e.chat_id).eq('event_type', 'chat_log').eq('payload->>dir', 'owner').gt('created_at', e.created_at).limit(1);
                if (ans && ans.length) continue;
                const { data: ld } = await admin.from('alina_selfbuy_leads').select('username').eq('chat_id', e.chat_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
                const who = (ld as { username?: string } | null)?.username ? '@' + (ld as { username: string }).username : String(e.chat_id);
                const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000), body: JSON.stringify({ chat_id: group2, text: `Отзыв от ${who} уже больше 3 часов ждёт согласования.` }) }).catch(() => null);
                if (r?.ok) await admin.from('alina_selfbuy_events').insert({ event_type: 'nudge', chat_id: e.chat_id, payload: { kind: 'review_remind', day } });
            }
        }
    }
    // После 22:30 МСК: список не приславших заказ в группу менеджеров (один раз за день)
    let groupSent = false;
    if ((missed.length || released.length) && !dry) {
        const group = await managerGroupId();
        const { data: mark } = await admin.from('alina_selfbuy_events').select('id').eq('event_type', 'nudge').eq('payload->>kind', 'missed_list').eq('payload->>day', day).limit(1);
        if (group && !(mark && mark.length)) {
            const text = [released.length ? `Не прислали заказ до 22:00, места освободила: ${released.join(', ')}.` : '', missed.length ? `Не смогла освободить (проверьте вручную): ${missed.join(', ')}.` : ''].filter(Boolean).join(' ');
            const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
                body: JSON.stringify({ chat_id: group, text }),
            }).catch(() => null);
            groupSent = Boolean(r?.ok);
            if (groupSent) await admin.from('alina_selfbuy_events').insert({ event_type: 'nudge', chat_id: 0, payload: { kind: 'missed_list', day } });
        }
    }
    return json({ ok: true, dry_run: dry, msk: msk.toISOString().slice(11, 16), waiting: leads.length, sent, missed, released, groupSent });
});
