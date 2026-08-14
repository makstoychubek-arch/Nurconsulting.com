/**
 * Ежедневный автозапуск РК (Амина): запомнить время + runner.
 */

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAdminClient } from './supabase-admin.ts';

export type AdScheduleRow = {
  id: string;
  chat_id: number;
  agent_key: string;
  action_type: 'advert_start' | 'advert_pause' | string;
  cabinet_id: string;
  cabinet_name: string | null;
  campaign_ids: number[];
  campaign_names: string[];
  run_hour: number;
  run_minute: number;
  timezone: string;
  is_active: boolean;
  last_run_on: string | null;
};

function admin(): SupabaseClient {
  return getAdminClient();
}

export function wantsRememberDailyAds(text: string): boolean {
  const t = text.toLowerCase();
  if (!/(запомни|запомнить|каждый\s+день|ежедневн|автоматом|автозапу|сам\s+запуска)/i.test(t)) {
    return false;
  }
  return /(день|время|запуска|рк|реклам|авто)/i.test(t) ||
    /(запомни|каждый\s+день|в\s+это)/i.test(t);
}

export function wantsListAdSchedules(text: string): boolean {
  return /(какие\s+авто|автозапуски|расписан.*(рк|реклам)|что\s+запомнила)/i.test(text);
}

export function wantsCancelAdSchedule(text: string): boolean {
  return /(отмени\s+авто|выключи\s+авто|стоп\s+авто|удали\s+расписан|не\s+запускай\s+каждый)/i.test(
    text,
  );
}

/** Текущие час:минута в Asia/Bishkek. */
export function bishkekNowParts(d = new Date()): {
  hour: number;
  minute: number;
  date: string;
  hhmm: string;
} {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { hour, minute, date, hhmm };
}

export async function getRecentDoneAdsAction(chatId: number): Promise<{
  action_type: string;
  cabinet_id: string;
  cabinet_name: string | null;
  campaign_ids: number[];
  campaign_names: string[];
} | null> {
  const db = admin();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('agent_pending_actions')
    .select('*')
    .eq('chat_id', chatId)
    .eq('agent_key', 'amina')
    .in('action_type', ['advert_start', 'advert_pause'])
    .eq('status', 'done')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.cabinet_id) return null;
  const payload = (data.payload || {}) as {
    selectedIds?: number[];
    items?: Array<{ id: number; name: string }>;
  };
  const ids = (payload.selectedIds || []).map(Number).filter((n) => Number.isFinite(n));
  if (!ids.length) return null;
  const nameById = new Map((payload.items || []).map((i) => [Number(i.id), String(i.name)]));
  return {
    action_type: String(data.action_type),
    cabinet_id: String(data.cabinet_id),
    cabinet_name: data.cabinet_name ? String(data.cabinet_name) : null,
    campaign_ids: ids,
    campaign_names: ids.map((id) => nameById.get(id) || String(id)),
  };
}

export async function saveDailyAdSchedule(opts: {
  chatId: number;
  tgUserId: number;
  actionType: string;
  cabinetId: string;
  cabinetName: string | null;
  campaignIds: number[];
  campaignNames: string[];
  hour?: number;
  minute?: number;
}): Promise<{ ok: boolean; reply: string }> {
  const db = admin();
  const now = bishkekNowParts();
  const hour = opts.hour ?? now.hour;
  const minute = opts.minute ?? now.minute;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  // деактивируем похожие активные на том же кабинете+действии
  await db
    .from('agent_ad_schedules')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('chat_id', opts.chatId)
    .eq('cabinet_id', opts.cabinetId)
    .eq('action_type', opts.actionType)
    .eq('is_active', true);

  const { error } = await db.from('agent_ad_schedules').insert({
    chat_id: opts.chatId,
    agent_key: 'amina',
    action_type: opts.actionType,
    cabinet_id: opts.cabinetId,
    cabinet_name: opts.cabinetName,
    campaign_ids: opts.campaignIds,
    campaign_names: opts.campaignNames,
    run_hour: hour,
    run_minute: minute,
    timezone: 'Asia/Bishkek',
    is_active: true,
    created_by_tg: opts.tgUserId,
    note: `каждый день ${hhmm} Asia/Bishkek`,
  });

  if (error) {
    return {
      ok: false,
      reply: `Не смогла запомнить расписание: ${error.message}`,
    };
  }

  const verb = opts.actionType === 'advert_pause' ? 'паузить' : 'запускать';
  const names = opts.campaignNames.slice(0, 8).map((n) => `• ${n}`).join('\n');
  return {
    ok: true,
    reply: [
      `Запомнила 👍`,
      `Каждый день в ${hhmm} (Бишкек) буду сама ${verb} по «${opts.cabinetName}»:`,
      names,
      opts.campaignNames.length > 8 ? `… и ещё ${opts.campaignNames.length - 8}` : '',
      `Отменить: «отмени автозапуск»`,
    ].filter(Boolean).join('\n'),
  };
}

export async function listActiveSchedules(chatId: number): Promise<string> {
  const db = admin();
  const { data } = await db
    .from('agent_ad_schedules')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_active', true)
    .order('run_hour')
    .order('run_minute');
  const rows = data || [];
  if (!rows.length) return 'Автозапусков нет. После запуска РК напиши «запомни каждый день».';
  const lines = rows.map((r) => {
    const hh = String(r.run_hour).padStart(2, '0');
    const mm = String(r.run_minute).padStart(2, '0');
    const verb = r.action_type === 'advert_pause' ? 'пауза' : 'запуск';
    return `• ${hh}:${mm} · ${r.cabinet_name || 'кабинет'} · ${verb} · ${(r.campaign_ids || []).length} РК`;
  });
  return ['Активные автозапуски:', ...lines].join('\n');
}

export async function cancelActiveSchedules(chatId: number, text: string): Promise<string> {
  const db = admin();
  let q = db
    .from('agent_ad_schedules')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('is_active', true);
  // если назвали кабинет — сузим
  const { resolveCabinet } = await import('./agent-actions.ts');
  const resolved = await resolveCabinet(text);
  if (resolved.match) {
    q = q.eq('cabinet_id', resolved.match.id);
  }
  const { data, error } = await q.select('id');
  if (error) return `Не смогла отменить: ${error.message}`;
  const n = data?.length || 0;
  if (!n) return 'Активных автозапусков не нашла.';
  return `Ок, отключила автозапуск (${n}).`;
}

export async function runAdvertIds(opts: {
  cabinetId: string;
  campaignIds: number[];
  action: 'start' | 'pause';
}): Promise<{ ok: number[]; fail: string[]; cabinetName: string }> {
  const db = admin();
  const { data: cab } = await db
    .from('cabinets')
    .select('wb_token, name')
    .eq('id', opts.cabinetId)
    .maybeSingle();
  const token = typeof cab?.wb_token === 'string'
    ? cab.wb_token.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim()
    : '';
  const cabinetName = String(cab?.name || 'кабинет');
  if (token.length < 50) {
    return { ok: [], fail: ['нет токена'], cabinetName };
  }
  const verb = opts.action;
  const newStatus = verb === 'start' ? 9 : 11;
  const ok: number[] = [];
  const fail: string[] = [];
  for (const advertId of opts.campaignIds.slice(0, 40)) {
    try {
      const res = await fetch(
        `https://advert-api.wildberries.ru/adv/v0/${verb}?id=${advertId}`,
        {
          method: 'GET',
          headers: { Authorization: token },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        fail.push(`${advertId}: ${res.status} ${t.slice(0, 80)}`);
      } else {
        ok.push(advertId);
        await db
          .from('advertising_campaigns')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('cabinet_id', opts.cabinetId)
          .eq('campaign_id', advertId);
      }
    } catch (e) {
      fail.push(`${advertId}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  return { ok, fail, cabinetName };
}

/** Расписания, которые пора выполнить сейчас (±2 минуты к 5-мин крону). */
export async function dueSchedulesNow(): Promise<AdScheduleRow[]> {
  const db = admin();
  const { hour, minute, date } = bishkekNowParts();
  const { data } = await db
    .from('agent_ad_schedules')
    .select('*')
    .eq('is_active', true);
  const rows = (data || []) as AdScheduleRow[];
  return rows.filter((r) => {
    if (r.last_run_on === date) return false;
    const t = r.run_hour * 60 + r.run_minute;
    const now = hour * 60 + minute;
    // окно 5 минут после целевого времени
    const diff = now - t;
    return diff >= 0 && diff < 5;
  });
}

export async function markScheduleRan(id: string, date: string): Promise<void> {
  const db = admin();
  await db
    .from('agent_ad_schedules')
    .update({ last_run_on: date, updated_at: new Date().toISOString() })
    .eq('id', id);
}
