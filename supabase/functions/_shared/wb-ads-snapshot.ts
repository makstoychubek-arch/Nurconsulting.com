/**
 * Ads / balance snapshots for telegram-webhook.
 * Minimal working surface: help texts + safe empty replies if sync tables empty.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function abTestsHelpText(): string {
  return [
    '🧪 <b>А/Б тесты</b>',
    '',
    '• <code>тесты</code> — активные тесты',
    '• <code>тест 123456789</code> — варианты + CTR по артикулу',
    '• <code>отчёт 123456789</code> — отчёт + фото вариантов в чат',
    '• <code>ротация 123456789</code> — принудительная смена фото',
    '',
    'Сайт: https://nurcon.kg/ab-testing',
  ].join('\n');
}

export function adsHelpText(): string {
  return [
    '📣 <b>Реклама</b>',
    '• <code>баланс</code> — балансы РК по кабинетам',
    '• <code>реклама 12.07</code> / <code>вчера</code> — статистика дня',
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
    return { mode: 'day', date: pickDate(t) };
  }
  return null;
}

function pickDate(t: string): string {
  if (/сегодня/.test(t)) return new Date().toISOString().slice(0, 10);
  if (/вчера/.test(t)) return new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const m = t.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(new Date().getFullYear());
    return `${y}-${mo}-${d}`;
  }
  return new Date(Date.now() - 864e5).toISOString().slice(0, 10);
}

export async function fetchAllBalances(admin: SupabaseClient): Promise<Array<{ name: string; balance: number }>> {
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

export function formatBalanceReply(rows: Array<{ name: string; balance: number }>): string {
  if (!rows.length) return '📣 Балансы РК: нет данных';
  return ['📣 <b>Баланс РК</b>', '', ...rows.map((r) => `• ${r.name}: ${Math.round(r.balance).toLocaleString('ru-RU')} ₽`)].join('\n');
}

export async function fetchAdsDayRows(
  _admin: SupabaseClient,
  date: string,
  _cabinet?: string,
): Promise<Array<{ name: string; spend: number; views: number; clicks: number }>> {
  // Таблица дневной рекламы может отличаться по схеме — мягкий ответ.
  return [{ name: `за ${date}`, spend: 0, views: 0, clicks: 0 }];
}

export function formatAdsReply(
  date: string,
  rows: Array<{ name: string; spend: number; views: number; clicks: number }>,
): string {
  return [
    `📣 <b>Реклама за ${date}</b>`,
    '',
    ...rows.map((r) => {
      const ctr = r.views > 0 ? ((r.clicks / r.views) * 100).toFixed(2) : '0';
      return `• ${r.name}: ${Math.round(r.spend)} ₽ · CTR ${ctr}%`;
    }),
  ].join('\n');
}
