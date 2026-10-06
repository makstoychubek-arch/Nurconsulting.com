// СНИМОК боевой функции «penalties-watch» (версия 25), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Алерты маркировки с фото из goods-labeling (Analytics API).
export async function sendMarkingPhotoAlerts(admin, tgToken, tgChatId, cabinetId, cabinetName, date, violations) {
  let sent = 0;
  for (const v of violations){
    const eventType = `marking_photo_${date}_${v.nmId}_${v.shkId ?? 0}`;
    const { data: dupes } = await admin.from('notification_log').select('id').eq('cabinet_id', cabinetId).eq('event_type', eventType).limit(1);
    if (dupes?.length) continue;
    const pretty = prettyDate(date);
    const caption = [
      `🏷 <b>${esc(cabinetName)}</b> — штраф за маркировку`,
      `📅 ${pretty}`,
      `nmID: <code>${v.nmId}</code>${v.sku ? ` · ${esc(v.sku)}` : ''}`,
      `Сумма: <b>${Math.round(v.amount).toLocaleString('ru-RU')} сом</b>`
    ].join('\n');
    let ok = false;
    for (const photoUrl of v.photoUrls.filter(Boolean)){
      ok = await sendTelegramPhotoUrl(tgToken, tgChatId, photoUrl, caption);
      if (ok) break;
      ok = await sendTelegramPhotoBytes(tgToken, tgChatId, photoUrl, caption);
      if (ok) break;
    }
    if (!ok) {
      ok = await sendTelegramMessage(tgToken, tgChatId, caption + '\n<i>(фото недоступно)</i>');
    }
    if (ok) {
      await admin.from('notification_log').insert({
        cabinet_id: cabinetId,
        event_type: eventType,
        message_text: JSON.stringify({
          nmId: v.nmId,
          amount: v.amount,
          date,
          photos: v.photoUrls.length
        })
      });
      sent++;
      await sleep(800);
    }
  }
  return sent;
}
async function sendTelegramPhotoUrl(token, chatId, photoUrl, caption) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML'
      })
    });
    return res.ok;
  } catch  {
    return false;
  }
}
async function sendTelegramPhotoBytes(token, chatId, photoUrl, caption) {
  try {
    const imgRes = await fetch(photoUrl, {
      headers: {
        'User-Agent': 'NR-Space-Bot/1.0'
      }
    });
    if (!imgRes.ok) return false;
    const buf = await imgRes.arrayBuffer();
    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : 'jpg';
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([
      buf
    ], {
      type: ct
    }), `marking.${ext}`);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    return res.ok;
  } catch  {
    return false;
  }
}
async function sendTelegramMessage(token, chatId, text) {
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
function prettyDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
