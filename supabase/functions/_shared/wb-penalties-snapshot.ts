/**
 * Penalties snapshots for telegram-webhook (minimal).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type PenaltiesQuery = { date: string; cabinet?: string };

export function parsePenaltiesQuery(text: string, _strict = false): PenaltiesQuery | null {
  const t = text.toLowerCase();
  if (!/(штраф|удерж|penalt|help|помощь|вчера|сегодня|\d{1,2}[./]\d{1,2})/.test(t)) return null;
  let date = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (/сегодня/.test(t)) date = new Date().toISOString().slice(0, 10);
  const m = t.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(new Date().getFullYear());
    date = `${y}-${mo}-${d}`;
  }
  return { date };
}

export async function fetchAllCabinetPenalties(
  _admin: SupabaseClient,
  date: string,
  _cabinet?: string,
): Promise<Array<{ name: string; total: number }>> {
  return [{ name: `все · ${date}`, total: 0 }];
}

export function formatPenaltiesReply(
  date: string,
  snapshots: Array<{ name: string; total: number }>,
  alertUser?: string,
): string {
  const total = snapshots.reduce((s, x) => s + (x.total || 0), 0);
  const lines = [`⚠ <b>Штрафы за ${date}</b>`, '', `Итого: ${total.toLocaleString('ru-RU')} ₽`];
  if (total > 0 && alertUser) lines.push(`@${alertUser}`);
  return lines.join('\n');
}
