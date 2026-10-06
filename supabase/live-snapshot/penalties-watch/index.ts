// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Мгновенный сторож штрафов + алерты маркировки → NR / Штрафы.
// Cron: 12:00 и 17:00 Бишкек (06:00 и 11:00 UTC).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMarkingPhotoAlerts } from '../_shared/marking-alerts.ts';
import { checkPenaltyGuard, formatGuardAlert, getGuardConfig } from '../_shared/penalty-guard.ts';
import { getTelegramChatId, getTelegramToken, isTelegramConfigured, telegramConfigError } from '../_shared/telegram-routing.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
import { fetchSalesTotals } from '../_shared/wb-sales-snapshot.ts';
import { CABINET_TOKEN_SELECT, isValidWbToken, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { fetchMarkingViolations, fetchPenaltyQuick, todayIso } from '../_shared/wb-penalties-snapshot.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
const ALERT_USER = (Deno.env.get('PENALTIES_ALERT_USERNAME') ?? Deno.env.get('TELEGRAM_ALERT_USERNAME') ?? 'maraWuW').replace(/^@/, '');
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const body = await req.json().catch(()=>({}));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force))) {
    return json({
      error: 'Unauthorized'
    }, 401);
  }
  if (!isTelegramConfigured('penalties')) {
    return json({
      error: telegramConfigError('penalties')
    }, 400);
  }
  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId('penalties');
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  const today = todayIso();
  const guardConfig = getGuardConfig();
  const results = [];
  const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true);
  for (const cab of cabinets || []){
    const cabResult = {
      cabinet: cab.name
    };
    if (!isValidWbToken(pickCabinetToken(cab, 'default'))) {
      cabResult.skipped = 'invalid_token';
      results.push(cabResult);
      continue;
    }
    try {
      const { total, rows } = await fetchPenaltyQuick(cab, today);
      cabResult.penalty_total = total;
      let turnover = 0;
      try {
        const sales = await fetchSalesTotals(pickCabinetToken(cab, 'default'), today);
        turnover = sales.buyoutSum || sales.ordersSum;
      } catch (e) {
        cabResult.sales_error = String(e).slice(0, 80);
      }
      const guard = checkPenaltyGuard(total, turnover, guardConfig);
      cabResult.guard = guard;
      if (guard.triggered) {
        const eventType = `penalty_guard_${today}_${cab.name.replace(/\s+/g, '_')}`;
        const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cab.id).eq('event_type', eventType).limit(1);
        if (!dupes?.length || body?.force) {
          let text = formatGuardAlert(cab.name, today, guard, ALERT_USER);
          if (rows.length) {
            const fmt = (n)=>Math.round(n).toLocaleString('ru-RU');
            text += '\n\n<b>Строки:</b>';
            for (const r of rows.slice(0, 5)){
              text += `\n• ${esc(r.reason.slice(0, 50))} — ${fmt(r.amount)}`;
            }
          }
          const sent = await sendTg(tgToken, tgChatId, text);
          if (sent) {
            await admin.from('notification_log').insert({
              cabinet_id: cab.id,
              event_type: eventType,
              message_text: text
            });
          }
          cabResult.guard_sent = sent;
        } else {
          cabResult.guard_sent = false;
        }
      }
      const violations = await fetchMarkingViolations(cab, today);
      if (violations.length) {
        cabResult.marking_photos = await sendMarkingPhotoAlerts(admin, tgToken, tgChatId, cab.id, cab.name, today, violations);
      }
    } catch (e) {
      cabResult.error = String(e);
    }
    results.push(cabResult);
    await sleep(2000);
  }
  return json({
    ok: true,
    date: today,
    guardConfig,
    results
  });
});
async function sendTg(token, chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });
  return res.ok;
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
function json(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: {
      ...CORS,
      'Content-Type': 'application/json'
    }
  });
}
