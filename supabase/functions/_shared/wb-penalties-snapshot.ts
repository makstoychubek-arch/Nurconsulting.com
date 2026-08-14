/**
 * Penalties snapshots for telegram-webhook (minimal).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasRuDayOrDdMm, parseRuDayToken, yesterdayBishkek } from './agent-ru-text.ts';

export type PenaltiesQuery = { date: string; cabinet?: string };

export function parsePenaltiesQuery(text: string, _strict = false): PenaltiesQuery | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  if (!/(штраф|удерж|penalt|help|помощь)/.test(t) && !hasRuDayOrDdMm(t)) return null;
  return { date: parseRuDayToken(t) || yesterdayBishkek() };
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
