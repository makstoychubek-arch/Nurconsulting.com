/**
 * Ads / balance snapshots for telegram-webhook + /drr.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseRuDayToken, yesterdayBishkek } from './agent-ru-text.ts';

export function abTestsHelpText(): string {
  return [
    '🧪 <b>А/Б тесты</b>',
    '',
    '• <code>тесты</code> / «что крутится»',
    '• <code>тест 123</code> / «как там 123»',
    '• <code>отчёт 123</code> / «скинь результаты 123»',
    '• <code>ротация 123</code> / «смени фото 123»',
    '• «кто лучше 123» · «как запустить»',
    '',
    'Сайт: https://nurcon.kg/ab-testing',
  ].join('\n');
}

export function adsHelpText(): string {
  return [
    '📣 <b>Реклама</b>',
    '• <code>баланс</code> — балансы РК по кабинетам',
    '• <code>реклама 12.07</code> / <code>вчера</code> — статистика дня из advertising_daily_stats',
  ].join('\n');
}

export function penaltiesHelpText(): string {
  return [
    '⚠ <b>Штрафы</b>',
    '• <code>штрафы вчера</code> / <code>штрафы 12.07</code>',
  ].join('\n');
}

export type AdsQuery = { mode: 'balance' | 'day'; date?: string; cabinet?: string };

export function parseAdsQuery(text: string): AdsQuery | null {
  const t = text.toLowerCase();
  if (/баланс|balance/.test(t)) return { mode: 'balance' };
  if (/реклам|рк|ads|ctr|расход/.test(t)) {
    return { mode: 'day', date: parseRuDayToken(t) || yesterdayBishkek() };
  }
  return null;
}

export async function fetchAllBalances(
  admin: SupabaseClient,
): Promise<Array<{ name: string; balance: number }>> {
  const { data: cabs } = await admin.from('cabinets').select('id, name').order('name');
  const out: Array<{ name: string; balance: number }> = [];
  for (const c of cabs || []) {
    const { data } = await admin
      .from('cabinet_advert_balance')
      .select('balance')
      .eq('cabinet_id', c.id)
      .maybeSingle();
    out.push({ name: c.name, balance: Number(data?.balance) || 0 });
  }
  return out;
}

export function formatBalanceReply(
  rows: Array<{ name: string; balance: number }>,
): string {
  if (!rows.length) return '📣 Балансы РК: нет данных';
  return [
    '📣 <b>Баланс РК</b>',
    '',
    ...rows.map(
      (r) => `• ${r.name}: ${Math.round(r.balance).toLocaleString('ru-RU')} ₽`,
    ),
  ].join('\n');
}

export type AdsDayRow = {
  name: string;
  spend: number;
  views: number;
  clicks: number;
  orders?: number;
  sumPrice?: number;
};

/** Дневная реклама из advertising_daily_stats (заполняет advertising-sync). */
export async function fetchAdsDayRows(
  admin: SupabaseClient,
  date: string,
  cabinet?: string,
): Promise<AdsDayRow[]> {
  const { data: cabs } = await admin.from('cabinets').select('id, name').order('name');
  const cabList = (cabs || []).filter((c) =>
    !cabinet || String(c.name).toLowerCase().includes(cabinet.toLowerCase())
  );
  if (!cabList.length) return [];

  const ids = cabList.map((c) => c.id);
  const { data: stats, error } = await admin
    .from('advertising_daily_stats')
    .select('cabinet_id, spend, views, clicks, orders, sum_price')
    .eq('stat_date', date)
    .in('cabinet_id', ids);
  if (error) throw new Error(error.message);

  const byCab = new Map<string, AdsDayRow>();
  for (const c of cabList) {
    byCab.set(c.id, {
      name: c.name,
      spend: 0,
      views: 0,
      clicks: 0,
      orders: 0,
      sumPrice: 0,
    });
  }
  for (const row of stats || []) {
    const cur = byCab.get(row.cabinet_id);
    if (!cur) continue;
    cur.spend += Number(row.spend) || 0;
    cur.views += Number(row.views) || 0;
    cur.clicks += Number(row.clicks) || 0;
    cur.orders = (cur.orders || 0) + (Number(row.orders) || 0);
    cur.sumPrice = (cur.sumPrice || 0) + (Number(row.sum_price) || 0);
  }
  return [...byCab.values()];
}

export function formatAdsReply(date: string, rows: AdsDayRow[]): string {
  const [y, m, d] = date.split('-');
  const pretty = `${d}.${m}.${y}`;
  if (!rows.length) {
    return `📣 <b>Реклама за ${pretty}</b>\n\nНет данных (сначала advertising-sync).`;
  }
  const lines = [`📣 <b>Реклама за ${pretty}</b>`, ''];
  let any = false;
  for (const r of rows) {
    if (!r.spend && !r.views && !r.clicks) {
      lines.push(`• ${r.name}: нет статистики`);
      continue;
    }
    any = true;
    const ctr = r.views > 0 ? ((r.clicks / r.views) * 100).toFixed(2) : '0';
    const drr = (r.sumPrice || 0) > 0
      ? ((r.spend / (r.sumPrice || 1)) * 100).toFixed(1)
      : r.spend > 0
      ? '∞'
      : '0';
    lines.push(
      `• ${r.name}: ${Math.round(r.spend).toLocaleString('ru-RU')} ₽ · CTR ${ctr}% · ДРР ${drr}% · зак. ${r.orders || 0}`,
    );
  }
  if (!any) {
    lines.push('', 'Синк мог ещё не прогнаться за этот день.');
  }
  return lines.join('\n');
}

export type DrrHotRow = {
  cabinet: string;
  name: string;
  spend: number;
  orders: number;
  sumPrice: number;
  drr: number;
};

/** ДРР по кампаниям за день (как drr-autopilot, но без паузы). */
export async function fetchDrrBrief(
  admin: SupabaseClient,
  opts?: { date?: string; threshold?: number; limit?: number },
): Promise<{ date: string; threshold: number; hot: DrrHotRow[]; cabTotals: AdsDayRow[] }> {
  const date = opts?.date || yesterdayBishkek();
  const threshold = opts?.threshold ?? Number(Deno.env.get('DRR_AUTOPILOT_THRESHOLD') || 25);
  const limit = opts?.limit ?? 12;

  const cabTotals = await fetchAdsDayRows(admin, date);
  const { data: cabs } = await admin.from('cabinets').select('id, name');
  const cabName = new Map((cabs || []).map((c) => [c.id, c.name as string]));

  const { data: stats, error } = await admin
    .from('advertising_daily_stats')
    .select('cabinet_id, campaign_id, campaign_name, spend, orders, sum_price')
    .eq('stat_date', date);
  if (error) throw new Error(error.message);

  const hot: DrrHotRow[] = [];
  for (const row of stats || []) {
    const spend = Number(row.spend) || 0;
    if (spend < 500) continue;
    const sumPrice = Number(row.sum_price) || 0;
    const drr = sumPrice > 0 ? (spend / sumPrice) * 100 : spend > 0 ? 999 : 0;
    if (drr < threshold) continue;
    hot.push({
      cabinet: cabName.get(row.cabinet_id) || String(row.cabinet_id),
      name: String(row.campaign_name || row.campaign_id),
      spend,
      orders: Number(row.orders) || 0,
      sumPrice,
      drr: Math.round(drr * 10) / 10,
    });
  }
  hot.sort((a, b) => b.drr - a.drr);
  return { date, threshold, hot: hot.slice(0, limit), cabTotals };
}

export function formatDrrBrief(data: Awaited<ReturnType<typeof fetchDrrBrief>>): string {
  const [y, m, d] = data.date.split('-');
  const pretty = `${d}.${m}.${y}`;
  const lines = [
    `📊 <b>ДРР · ${pretty}</b> · порог ${data.threshold}%`,
    '',
  ];
  if (data.cabTotals.length) {
    lines.push('<b>По кабинетам</b>');
    for (const r of data.cabTotals) {
      const drr = (r.sumPrice || 0) > 0
        ? ((r.spend / (r.sumPrice || 1)) * 100).toFixed(1)
        : r.spend > 0
        ? '∞'
        : '0';
      lines.push(
        `• ${r.name}: ДРР ${drr}% · расход ${Math.round(r.spend).toLocaleString('ru-RU')} ₽ · зак. ${r.orders || 0}`,
      );
    }
    lines.push('');
  }
  if (!data.hot.length) {
    lines.push(`Горячих РК (>${data.threshold}%) нет.`);
  } else {
    lines.push(`<b>Горячие РК</b> (${data.hot.length})`);
    for (const h of data.hot) {
      lines.push(
        `• ${h.cabinet} · ${h.name}\n  ДРР ${h.drr}% · ${Math.round(h.spend).toLocaleString('ru-RU')} ₽ · зак. ${h.orders}`,
      );
    }
  }
  lines.push('', 'Пауза РК — через Амину после твоего «да». Автопилот: drr-autopilot.');
  return lines.join('\n');
}
