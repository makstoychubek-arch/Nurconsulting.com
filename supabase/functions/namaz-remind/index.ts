// Supabase Edge Function: namaz-remind
// WhatsApp-бот «Карина» — напоминания о намазе за 10 минут (Бишкек).
//
// ЗАМОРОЖЕН: cron снят (миграция freeze_namaz_remind), функция отвечает
// frozen и ничего не шлёт. Чтобы включить: FROZEN=false + вернуть cron.
//
// Auth: service_role key only.
// Secrets: GREEN_API_ID_INSTANCE, GREEN_API_TOKEN, GREEN_API_GROUP_CHAT_ID
// Optional: GREEN_API_URL, CITY, COUNTRY, TIMEZONE, PRAYER_METHOD

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Поставь false и верни pg_cron namaz-remind-bishkek, чтобы снова слать в WhatsApp. */
const FROZEN = true;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRAYERS = [
    { key: 'Fajr', name: 'Фаджр', before: 2, fard: 2, after: 0, witr: 0 },
    { key: 'Dhuhr', name: 'Зухр', before: 4, fard: 4, after: 2, witr: 0 },
    { key: 'Asr', name: 'Аср', before: 4, fard: 4, after: 0, witr: 0 },
    { key: 'Maghrib', name: 'Магриб', before: 0, fard: 3, after: 2, witr: 0 },
    { key: 'Isha', name: 'Иша', before: 0, fard: 4, after: 2, witr: 3 },
] as const;

function formatReminder(prayer: Prayer): string {
    return [
        `🕌 ${prayer.name} через 10 мин (${prayer.time})`,
        formatRakats(prayer),
        `с ${prayer.time} до ${prayer.until}`,
    ].join('\n');
}

function formatRakats(p: { before: number; fard: number; after: number; witr: number }): string {
    const parts: string[] = [];
    if (p.before) parts.push(`${p.before} сунна`);
    parts.push(`${p.fard} фард`);
    if (p.after) parts.push(`${p.after} сунна`);
    if (p.witr) parts.push(`${p.witr} витр`);
    return parts.join(' + ');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    if (FROZEN) {
        return json({
            ok: true,
            frozen: true,
            message: 'Карина заморожена: напоминания о намазе отключены.',
        });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const authorized = Boolean(bearer) && (
        bearer === serviceKey ||
        isServiceRoleJwt(bearer)
    );
    if (!authorized) {
        return json({ error: 'Unauthorized' }, 401);
    }

    const greenId = Deno.env.get('GREEN_API_ID_INSTANCE') ?? '';
    const greenToken = Deno.env.get('GREEN_API_TOKEN') ?? '';
    const chatId = Deno.env.get('GREEN_API_GROUP_CHAT_ID') ?? '';
    const greenUrl = (Deno.env.get('GREEN_API_URL') || 'https://api.green-api.com').replace(/\/$/, '');
    if (!greenId || !greenToken || !chatId) {
        return json({ error: 'GREEN_API_ID_INSTANCE / GREEN_API_TOKEN / GREEN_API_GROUP_CHAT_ID не заданы' }, 400);
    }

    const timezone = Deno.env.get('TIMEZONE') || 'Asia/Bishkek';
    const city = Deno.env.get('CITY') || 'Bishkek';
    const country = Deno.env.get('COUNTRY') || 'Kyrgyzstan';
    const method = Deno.env.get('PRAYER_METHOD') || '3';

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const force = Boolean(body?.force);
    const test = Boolean(body?.test);
    const actions: string[] = [];

    try {
        // Приветствие отключено — в группе только напоминания по расписанию.
        if (test) {
            const text = '✅ Тест Карины: Green API подключён.';
            const ok = await sendWhatsApp(greenUrl, greenId, greenToken, chatId, text);
            return json({ ok, text, actions: ['test'] });
        }

        // Расписание на сегодня
        const now = nowParts(timezone);
        const dateKey = `${now.year}-${pad(now.month)}-${pad(now.day)}`;
        const nowHm = `${pad(now.hour)}:${pad(now.minute)}`;

        const prayers = await fetchPrayerTimes({ city, country, method, timezone });
        actions.push(`schedule:${prayers.map((p) => `${p.name}@${p.time}`).join(',')}`);

        // Если сейчас ровно «намаз − 10 мин» — шлём напоминание
        for (const prayer of prayers) {
            const remindHm = shiftHm(prayer.time, -10);
            if (remindHm !== nowHm && !force) continue;

            const eventKey = `${dateKey}:${prayer.key}`;
            if (!force) {
                const { data: existing } = await admin
                    .from('namaz_bot_events')
                    .select('event_key')
                    .eq('event_key', eventKey)
                    .maybeSingle();
                if (existing) {
                    actions.push(`skip_dup:${prayer.key}`);
                    continue;
                }
            }

            // force без совпадения времени — не спамим все 5, только если body.prayer задан
            if (force && remindHm !== nowHm) {
                const only = typeof body?.prayer === 'string' ? body.prayer : null;
                if (!only || only !== prayer.key) continue;
            }

            const text = formatReminder(prayer);
            const ok = await sendWhatsApp(greenUrl, greenId, greenToken, chatId, text);
            if (ok) {
                await admin.from('namaz_bot_events').upsert({
                    event_key: eventKey,
                    payload: { prayer: prayer.key, name: prayer.name, time: prayer.time, text },
                });
                actions.push(`sent:${prayer.key}`);
            } else {
                actions.push(`failed:${prayer.key}`);
            }
        }

        return json({
            ok: true,
            timezone,
            now: nowHm,
            date: dateKey,
            actions,
        });
    } catch (e) {
        console.error('[namaz-remind]', e);
        return json({ error: String(e), actions }, 500);
    }
});

type Prayer = {
    key: string;
    name: string;
    time: string;
    before: number;
    fard: number;
    after: number;
    witr: number;
    until: string;
    untilLabel: string;
};

async function fetchPrayerTimes(cfg: {
    city: string;
    country: string;
    method: string;
    timezone: string;
}): Promise<Prayer[]> {
    const url =
        `https://api.aladhan.com/v1/timingsByCity` +
        `?city=${encodeURIComponent(cfg.city)}` +
        `&country=${encodeURIComponent(cfg.country)}` +
        `&method=${encodeURIComponent(cfg.method)}` +
        `&timezonestring=${encodeURIComponent(cfg.timezone)}`;

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}: ${await res.text()}`);
            const body = await res.json();
            if (body.code !== 200 || !body.data?.timings) {
                throw new Error(`Aladhan unexpected: ${JSON.stringify(body)}`);
            }
            const timings = body.data.timings as Record<string, string>;
            const sunrise = parseHm(timings.Sunrise);
            const base = PRAYERS.map(({ key, name, before, fard, after, witr }) => ({
                key,
                name,
                before,
                fard,
                after,
                witr,
                time: parseHm(timings[key]),
            }));

            return base.map((p, i) => {
                if (p.key === 'Fajr') {
                    return { ...p, until: sunrise, untilLabel: 'восход' };
                }
                if (p.key === 'Isha') {
                    return { ...p, until: base[0].time, untilLabel: 'Фаджр след. дня' };
                }
                const next = base[i + 1];
                return { ...p, until: next.time, untilLabel: next.name };
            });
        } catch (e) {
            lastErr = e;
            console.warn(`[namaz-remind] Aladhan attempt ${attempt}/3`, e);
            if (attempt < 3) await sleep(2000);
        }
    }
    throw lastErr || new Error('Aladhan failed');
}

function parseHm(raw: string): string {
    const hhmm = String(raw || '').trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(hhmm)) throw new Error(`Invalid time: "${raw}"`);
    return hhmm;
}

async function sendWhatsApp(
    apiUrl: string,
    idInstance: string,
    token: string,
    chatId: string,
    message: string,
): Promise<boolean> {
    const url = `${apiUrl}/waInstance${idInstance}/sendMessage/${token}`;
    const tryOnce = async () => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message }),
        });
        const bodyText = await res.text();
        if (!res.ok) throw new Error(`Green API HTTP ${res.status}: ${bodyText}`);
        return true;
    };

    try {
        await tryOnce();
        return true;
    } catch (e) {
        console.warn('[namaz-remind] send failed, retry in 30s', e);
        await sleep(30_000);
        try {
            await tryOnce();
            return true;
        } catch (e2) {
            console.error('[namaz-remind] send failed after retry', e2);
            return false;
        }
    }
}

function nowParts(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const hour = get('hour');
    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: hour === 24 ? 0 : hour,
        minute: get('minute'),
        second: get('second'),
    };
}

function shiftHm(hhmm: string, deltaMinutes: number): string {
    const [h, m] = hhmm.split(':').map(Number);
    let total = h * 60 + m + deltaMinutes;
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function isServiceRoleJwt(token: string): boolean {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return false;
        const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json);
        return payload?.role === 'service_role';
    } catch {
        return false;
    }
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
