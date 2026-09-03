/**
 * Cron: каждые 5 мин. Запускает/паузит РК по agent_ad_schedules (время Asia/Bishkek).
 */
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import {
  bishkekNowParts,
  dueSchedulesNow,
  markScheduleRan,
  runAdvertIds,
} from '../_shared/agent-ad-schedule.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-nr-setup-key',
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function notifyChat(chatId: number, text: string): Promise<void> {
  const token = (
    Deno.env.get('AMINA_BOT_TOKEN') ||
    Deno.env.get('KARINA_BOT_TOKEN') ||
    Deno.env.get('TELEGRAM_BOT_TOKEN') ||
    ''
  ).trim();
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error('[agent-ad-schedule-runner] tg', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force || body?.test))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const now = bishkekNowParts();
  if (body?.test) {
    return json({ ok: true, bishkek: now, message: 'agent-ad-schedule-runner alive' });
  }

  const due = await dueSchedulesNow();
  const results: Array<Record<string, unknown>> = [];

  for (const row of due) {
    const action = row.action_type === 'advert_pause' ? 'pause' : 'start';
    const ran = await runAdvertIds({
      cabinetId: row.cabinet_id,
      campaignIds: (row.campaign_ids || []).map(Number),
      action,
    });
    await markScheduleRan(row.id, now.date);
    const text = [
      `Амина · авто${action === 'start' ? 'запуск' : 'пауза'} ${now.hhmm}`,
      `${row.cabinet_name || ran.cabinetName}: ок ${ran.ok.length}` +
        (ran.fail.length ? `, ошибки ${ran.fail.length}` : ''),
      ran.fail.length ? ran.fail.slice(0, 4).join('\n') : '',
    ].filter(Boolean).join('\n');
    await notifyChat(Number(row.chat_id), text);
    results.push({
      id: row.id,
      cabinet: row.cabinet_name,
      ok: ran.ok.length,
      fail: ran.fail.length,
    });
  }

  return json({
    ok: true,
    bishkek: now,
    due: due.length,
    results,
  });
});
