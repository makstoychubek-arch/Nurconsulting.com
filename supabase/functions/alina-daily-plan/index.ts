// Утренний план дня Алины: читает лист «Раздачи Пижам», пишет в группу менеджеров, сколько мест на сегодня по моделям, и ждёт реплай «ок».
// Только сервис (cron 09:00 МСК). body: { force: true } повторно отправить план за сегодня, { dry_run: true } показать текст.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { managerGroupId } from '../_shared/alina-manager.ts';
import { googleAccessToken } from '../_shared/alina-google-auth.ts';
import { secretOrEnv } from '../_shared/integration-secrets.ts';
import { isDayPlanApproved, mskDayKey } from '../_shared/alina-dayplan.ts';

const SHEET_ID = '1ZSdNfnflgwOQZFSm1qcvfOB94bnfipZu5fB3pDodrik';
const TAB = 'Раздачи Пижам';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!await isServiceAuthorized(req, serviceKey)) return json({ ok: false, error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const day = mskDayKey();
    const { data: cur } = await admin.from('alina_settings').select('value').eq('key', 'dayPlan').maybeSingle();
    const prev = (cur as { value?: Parameters<typeof isDayPlanApproved>[0] } | null)?.value;
    if (prev && isDayPlanApproved(prev, day) && prev.next?.day === day && body.dry_run !== true) {
        return json({ ok: true, skipped: 'план заранее согласован', status: 'approved' });
    }
    if (prev?.day === day && !body.force && body.dry_run !== true) {
        // План на сегодня уже отправлен. Не согласован больше часа: напоминаем реплаем на него (не чаще раза в час), пока не ответят «ок».
        const pv = (cur as { value?: { status?: string; message_id?: number; sent_at?: string; remind_at?: string } } | null)?.value;
        const last = Date.parse(String(pv?.remind_at || pv?.sent_at || ''));
        if (pv?.status === 'pending' && pv.message_id && Number.isFinite(last) && Date.now() - last > 55 * 60_000) {
            const group = await managerGroupId();
            const botToken = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
            if (group && botToken) {
                const rr = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
                    body: JSON.stringify({ chat_id: group, text: 'Жду «ок» на план дня (ответом на сообщение с планом). Пока его нет, клиентам на сегодня места не отдаю.', reply_parameters: { message_id: pv.message_id, allow_sending_without_reply: true } }),
                }).catch(() => null);
                if (rr?.ok) await admin.from('alina_settings').upsert({ key: 'dayPlan', value: { ...prev, remind_at: new Date().toISOString() } });
                return json({ ok: true, reminded: Boolean(rr?.ok) });
            }
        }
        return json({ ok: true, skipped: 'уже отправлен', status: prev.status });
    }

    const token = await googleAccessToken((await secretOrEnv('GOOGLE_SERVICE_ACCOUNT_JSON')) || '').catch(() => '');
    if (!token) return json({ ok: false, error: 'нет доступа к таблице' }, 503);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`'${TAB}'!A1:D500`)}?valueRenderOption=FORMATTED_VALUE`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
    if (!res?.ok) return json({ ok: false, error: 'таблица не прочиталась' }, 502);
    const rows = ((await res.json().catch(() => null))?.values || []) as string[][];
    const byModel = new Map<string, { total: number; free: number }>();
    for (const r of rows.slice(1)) {
        if (String(r[3] || '').trim() !== day) continue;
        const model = String(r[0] || '').trim();
        if (!model) continue;
        const e = byModel.get(model) || { total: 0, free: 0 };
        e.total++;
        if (!String(r[2] || '').trim()) e.free++;
        byModel.set(model, e);
    }
    const lines = [...byModel.entries()].map(([m, e]) => `• ${m.replace(/^Пижама\s+/i, '')}: ${e.total} (занято ${e.total - e.free}, свободно ${e.free})`);
    const total = [...byModel.values()].reduce((s, e) => s + e.total, 0);
    const text = lines.length
        ? `План на ${day}: всего мест ${total}\n${lines.join('\n')}\n\nЕсли план верный, ответьте «ок» на это сообщение (реплаем), и я открою места на сегодня. Пока ответа нет, на сегодня никого не беру.`
        : `На ${day} в таблице мест нет. Если так и должно быть, ответьте «ок» на это сообщение, иначе добавьте строки в «Раздачи Пижам».`;
    if (body.dry_run === true) return json({ ok: true, text });

    const group = await managerGroupId();
    const botToken = (Deno.env.get('ALINA_BOT_TOKEN') || '').trim();
    if (!group || !botToken) return json({ ok: false, error: 'нет группы менеджеров или токена' }, 503);
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ chat_id: group, text }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    if (d?.ok !== true) return json({ ok: false, error: String(d?.description || 'telegram не принял').slice(0, 120) }, 502);
    await admin.from('alina_settings').upsert({ key: 'dayPlan', value: { day, status: 'pending', message_id: d.result?.message_id ?? null, sent_at: new Date().toISOString() } });
    return json({ ok: true, day, message_id: d.result?.message_id ?? null });
});
