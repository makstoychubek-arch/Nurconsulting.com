// СНИМОК боевой функции «blockings-watch» (версия 31), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Радар заблокированных карточек WB → Telegram «Блокировки».
// GET /api/v1/analytics/banned-products/blocked
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchBlockedProducts } from '../_shared/wb-analytics-api.ts';
import { CABINET_TOKEN_SELECT, isValidWbToken, pickCabinetToken } from '../_shared/wb-cabinet-tokens.ts';
import { getTelegramChatId, getTelegramToken, isTelegramConfigured, telegramConfigError } from '../_shared/telegram-routing.ts';
import { isServiceAuthorized } from '../_shared/service-auth.ts';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nr-setup-key'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: CORS
  });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const body = await req.json().catch(()=>({}));
  if (!isServiceAuthorized(req, serviceKey, Boolean(body?.force || body?.bootstrap || body?.test || body?.verify))) {
    return json({
      error: 'Unauthorized'
    }, 401);
  }
  if (body?.test) {
    if (!isTelegramConfigured('blockings')) {
      return json({
        error: telegramConfigError('blockings')
      }, 400);
    }
    const text = '✅ Тест NR Space · канал «Блокировки»: алерты блок/разблок карточек будут приходить сюда.';
    const sent = await fetch(`https://api.telegram.org/bot${getTelegramToken()}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: getTelegramChatId('blockings'),
        text,
        parse_mode: 'HTML'
      })
    }).then((r)=>r.ok);
    return json({
      ok: sent,
      channel: 'blockings'
    });
  }
  if (body?.verify) {
    if (!isTelegramConfigured('blockings')) {
      return json({
        error: telegramConfigError('blockings')
      }, 400);
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    const result = await runBlockingsVerify(admin, getTelegramToken(), getTelegramChatId('blockings'), typeof body?.cabinet === 'string' ? body.cabinet : 'Baza');
    return json(result);
  }
  if (!isTelegramConfigured('blockings')) {
    return json({
      error: telegramConfigError('blockings')
    }, 400);
  }
  const tgToken = getTelegramToken();
  const tgChatId = getTelegramChatId('blockings');
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  const results = [];
  const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '').eq('nr_managed', true);
  for (const cab of cabinets || []){
    const cabResult = {
      cabinet: cab.name,
      events: []
    };
    const events = cabResult.events;
    try {
      const token = pickCabinetToken(cab, 'analytics');
      if (!isValidWbToken(token)) {
        cabResult.skipped = 'invalid_token';
        results.push(cabResult);
        continue;
      }
      const blocked = await fetchBlockedProducts(token);
      const blockedIds = new Set(blocked.map((b)=>b.nmId));
      const { data: prevRows } = await admin.from('card_block_states').select('nm_id, is_blocked, title, reason').eq('cabinet_id', cab.id);
      const prevByNm = new Map((prevRows || []).map((r)=>[
          Number(r.nm_id),
          r
        ]));
      const { data: initRow } = await admin.from('notification_log').select('id').eq('cabinet_id', cab.id).eq('event_type', 'blockings_initialized').limit(1);
      const bootstrap = Boolean(body?.bootstrap) || !initRow?.length;
      for (const item of blocked){
        const prev = prevByNm.get(item.nmId);
        if (prev?.is_blocked || bootstrap) continue;
        const text = [
          '🚫 <b>Блокировка карточки</b>',
          `Кабинет: <b>${esc(cab.name)}</b>`,
          `nmID: <code>${item.nmId}</code>`,
          item.vendorCode ? `Артикул: ${esc(item.vendorCode)}` : '',
          item.title ? esc(item.title.slice(0, 120)) : '',
          item.reason ? `Причина: ${esc(item.reason.slice(0, 200))}` : ''
        ].filter(Boolean).join('\n');
        const sent = await notifyOnce(admin, tgToken, tgChatId, cab.id, item.nmId, 'card_blocked', text);
        events.push(`blocked:${item.nmId}${sent ? '' : '(dedup)'}`);
      }
      for (const [nmId, prev] of prevByNm){
        if (!prev.is_blocked || bootstrap) continue;
        if (blockedIds.has(nmId)) continue;
        const text = [
          '✅ <b>Карточка разблокирована</b>',
          `Кабинет: <b>${esc(cab.name)}</b>`,
          `nmID: <code>${nmId}</code>`,
          prev.title ? esc(String(prev.title).slice(0, 120)) : ''
        ].filter(Boolean).join('\n');
        const sent = await notifyOnce(admin, tgToken, tgChatId, cab.id, nmId, 'card_unblocked', text);
        events.push(`unblocked:${nmId}${sent ? '' : '(dedup)'}`);
      }
      const now = new Date().toISOString();
      const upserts = blocked.map((b)=>({
          cabinet_id: cab.id,
          nm_id: b.nmId,
          brand: b.brand,
          title: b.title,
          vendor_code: b.vendorCode,
          reason: b.reason,
          is_blocked: true,
          last_seen_at: now
        }));
      for (const [nmId, prev] of prevByNm){
        if (prev.is_blocked && !blockedIds.has(nmId)) {
          upserts.push({
            cabinet_id: cab.id,
            nm_id: nmId,
            brand: '',
            title: String(prev.title ?? ''),
            vendor_code: '',
            reason: String(prev.reason ?? ''),
            is_blocked: false,
            last_seen_at: now
          });
        }
      }
      if (upserts.length) {
        await admin.from('card_block_states').upsert(upserts, {
          onConflict: 'cabinet_id,nm_id'
        });
      }
      if (bootstrap && !initRow?.length) {
        await admin.from('notification_log').insert({
          cabinet_id: cab.id,
          event_type: 'blockings_initialized',
          message_text: JSON.stringify({
            blocked: blocked.length
          })
        });
      }
      cabResult.blocked_count = blocked.length;
      if (bootstrap) cabResult.bootstrapped = true;
    } catch (e) {
      cabResult.error = String(e);
    }
    results.push(cabResult);
    await sleep(11000);
  }
  return json({
    ok: true,
    results
  });
});
/** E2E-проверка: блок (sample) + разблок (реальный diff) → TG «Блокировки». */ async function runBlockingsVerify(admin, tgToken, tgChatId, cabinetName) {
  const TEST_BLOCK_NM = 999000001;
  const TEST_UNBLOCK_NM = 999000002;
  try {
    const { data: cabinets } = await admin.from('cabinets').select(CABINET_TOKEN_SELECT).not('wb_token', 'is', null).gt('wb_token', '');
    const cab = (cabinets || []).find((c)=>c.name.toLowerCase() === cabinetName.toLowerCase());
    if (!cab?.id) return {
      ok: false,
      error: `Кабинет «${cabinetName}» не найден`
    };
    await admin.from('notification_log').delete().eq('cabinet_id', cab.id).eq('event_type', `card_blocked_${TEST_BLOCK_NM}`);
    await admin.from('notification_log').delete().eq('cabinet_id', cab.id).eq('event_type', `card_unblocked_${TEST_UNBLOCK_NM}`);
    await admin.from('card_block_states').delete().eq('cabinet_id', cab.id).eq('nm_id', TEST_BLOCK_NM);
    await admin.from('card_block_states').delete().eq('cabinet_id', cab.id).eq('nm_id', TEST_UNBLOCK_NM);
    const blockText = [
      '🚫 <b>Блокировка карточки</b> · <i>verify</i>',
      `Кабинет: <b>${esc(cab.name)}</b>`,
      `nmID: <code>${TEST_BLOCK_NM}</code>`,
      'Артикул: TEST-VERIFY',
      'Тестовая карточка — проверка алерта блокировки',
      'Причина: verify run (не реальная блокировка WB)'
    ].join('\n');
    const blockSent = await notifyOnce(admin, tgToken, tgChatId, cab.id, TEST_BLOCK_NM, 'card_blocked', blockText);
    const now = new Date().toISOString();
    await admin.from('card_block_states').upsert({
      cabinet_id: cab.id,
      nm_id: TEST_UNBLOCK_NM,
      brand: 'TEST',
      title: 'Тестовая карточка — проверка разблока',
      vendor_code: 'TEST-UNBLOCK',
      reason: 'verify seed',
      is_blocked: true,
      last_seen_at: now
    }, {
      onConflict: 'cabinet_id,nm_id'
    });
    const unblockText = [
      '✅ <b>Карточка разблокирована</b> · <i>verify</i>',
      `Кабинет: <b>${esc(cab.name)}</b>`,
      `nmID: <code>${TEST_UNBLOCK_NM}</code>`,
      'Тестовая карточка — проверка алерта разблока'
    ].join('\n');
    const unblockSent = await notifyOnce(admin, tgToken, tgChatId, cab.id, TEST_UNBLOCK_NM, 'card_unblocked', unblockText);
    await admin.from('card_block_states').upsert({
      cabinet_id: cab.id,
      nm_id: TEST_UNBLOCK_NM,
      brand: 'TEST',
      title: 'Тестовая карточка — проверка разблока',
      vendor_code: 'TEST-UNBLOCK',
      reason: '',
      is_blocked: false,
      last_seen_at: new Date().toISOString()
    }, {
      onConflict: 'cabinet_id,nm_id'
    });
    let liveBlocked = -1;
    const token = pickCabinetToken(cab, 'analytics');
    if (isValidWbToken(token)) {
      try {
        liveBlocked = (await fetchBlockedProducts(token)).length;
      } catch  {
        liveBlocked = -1;
      }
    }
    return {
      ok: blockSent && unblockSent,
      mode: 'verify',
      cabinet: cab.name,
      block_alert: blockSent,
      unblock_alert: unblockSent,
      live_blocked_count: liveBlocked,
      message: blockSent && unblockSent ? 'Оба алерта отправлены в TG «Блокировки»' : 'Проверьте TG — один из алертов не ушёл'
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e)
    };
  }
}
async function notifyOnce(admin, tgToken, tgChatId, cabinetId, nmId, eventType, text) {
  const fullType = `${eventType}_${nmId}`;
  const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cabinetId).eq('event_type', fullType).limit(1);
  if (dupes?.length) return false;
  const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: tgChatId,
      text,
      parse_mode: 'HTML'
    })
  });
  if (!res.ok) return false;
  await admin.from('notification_log').insert({
    cabinet_id: cabinetId,
    event_type: fullType,
    message_text: text
  });
  return true;
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
