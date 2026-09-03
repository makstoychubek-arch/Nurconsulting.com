// Supabase Edge Function: drr-autopilot
// Считает ДРР по advertising_daily_stats за сегодня/вчера.
// Если ДРР > порога — алерт в TELEGRAM_CHAT_ADS.
// Опционально pause=true + service_role: ставит РК на паузу через advert API
// (по умолчанию только алерт — безопасный режим).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getTelegramChatId, getTelegramToken } from '../_shared/telegram-routing.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADV_API = 'https://advert-api.wildberries.ru';
const DEFAULT_DRR = Number(Deno.env.get('DRR_AUTOPILOT_THRESHOLD')) || 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const started = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!bearer || (bearer !== serviceKey && !isServiceRoleJwt(bearer))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const threshold = Number(body.threshold ?? DEFAULT_DRR) || DEFAULT_DRR;
  const doPause = Boolean(body.pause);
  const testOnly = Boolean(body.test);
  const days = Math.min(7, Math.max(1, Number(body.days) || 1));

  const admin = createClient(supabaseUrl, serviceKey);
  const tgToken = getTelegramToken();
  const tgChat = getTelegramChatId('ads');

  if (testOnly) {
    const text = `✅ ДРР-автопилот на связи. Порог ${threshold}%. Режим: ${doPause ? 'алерт+пауза' : 'только алерт'}.`;
    const sent = tgToken && tgChat ? await sendTg(tgToken, tgChat, text) : false;
    return json({ ok: sent, chatId: tgChat, threshold });
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const { data: stats, error } = await admin
    .from('advertising_daily_stats')
    .select('cabinet_id, campaign_id, campaign_name, spend, orders, sum_price, stat_date')
    .gte('stat_date', fromStr)
    .lte('stat_date', toStr);
  if (error) return json({ error: error.message }, 500);

  type Agg = { cabinet_id: string; campaign_id: number; name: string; spend: number; sum_price: number; orders: number };
  const map = new Map<string, Agg>();
  for (const row of stats || []) {
    const key = `${row.cabinet_id}:${row.campaign_id}`;
    const cur = map.get(key) || {
      cabinet_id: row.cabinet_id,
      campaign_id: Number(row.campaign_id),
      name: String(row.campaign_name || row.campaign_id),
      spend: 0,
      sum_price: 0,
      orders: 0,
    };
    cur.spend += Number(row.spend) || 0;
    cur.sum_price += Number(row.sum_price) || 0;
    cur.orders += Number(row.orders) || 0;
    map.set(key, cur);
  }

  const { data: cabs } = await admin.from('cabinets').select('id, name, wb_token');
  const cabName = new Map((cabs || []).map((c) => [c.id, c.name]));
  const cabToken = new Map((cabs || []).map((c) => [c.id, c.wb_token]));

  const hot: Array<Record<string, unknown>> = [];
  for (const agg of map.values()) {
    if (agg.spend < 500) continue; // шум
    const drr = agg.sum_price > 0 ? (agg.spend / agg.sum_price) * 100 : agg.spend > 0 ? 999 : 0;
    if (drr < threshold) continue;
    hot.push({
      ...agg,
      drr: Math.round(drr * 10) / 10,
      cabinet: cabName.get(agg.cabinet_id) || agg.cabinet_id,
    });
  }
  hot.sort((a, b) => Number(b.drr) - Number(a.drr));

  const paused: string[] = [];
  const lines = [
    `🚨 ДРР-автопилот · порог ${threshold}% · ${fromStr}…${toStr}`,
    hot.length ? `Горячих РК: ${hot.length}` : 'Горячих РК нет — спокойно.',
    '',
  ];
  for (const h of hot.slice(0, 12)) {
    lines.push(
      `• ${h.cabinet} · ${h.name}\n  ДРР ${h.drr}% · расход ${Math.round(Number(h.spend))} ₽ · заказы ${h.orders}`,
    );
    if (doPause && h.campaign_id) {
      const token = sanitize(cabToken.get(String(h.cabinet_id)));
      if (token) {
        const ok = await pauseCampaign(token, Number(h.campaign_id));
        if (ok) {
          paused.push(String(h.name));
          lines.push('  → поставлена на паузу');
        }
      }
    }
  }
  if (doPause && paused.length) lines.push('', `Пауза: ${paused.length} РК`);

  let sent = false;
  if (tgToken && tgChat && (hot.length || body.force)) {
    sent = await sendTg(tgToken, tgChat, lines.join('\n'));
  }

  return json({
    ok: true,
    threshold,
    days,
    hot: hot.length,
    paused: paused.length,
    sent,
    ms: Date.now() - started,
    sample: hot.slice(0, 5),
  });
});

async function pauseCampaign(token: string, advertId: number): Promise<boolean> {
  try {
    const res = await fetch(`${ADV_API}/adv/v0/pause?id=${advertId}`, {
      method: 'GET',
      headers: { Authorization: token },
      signal: AbortSignal.timeout(12000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendTg(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3900) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function sanitize(raw: unknown): string {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim();
}

function isServiceRoleJwt(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const data = JSON.parse(atob(pad)) as { role?: string };
    return data.role === 'service_role';
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
