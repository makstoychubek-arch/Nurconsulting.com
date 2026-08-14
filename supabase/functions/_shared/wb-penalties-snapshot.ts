/**
 * Penalties snapshots for telegram-webhook.
 * Interactive path: одна страница Finance API на кабинет (без 61с пагинации cron).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hasRuDayOrDdMm, isHelpOnly, parseRuDayToken, yesterdayBishkek, extractCabinetHint } from './agent-ru-text.ts';
import { isValidWbToken, sanitizeWbToken } from './wb-cabinet-tokens.ts';

const FINANCE_API = 'https://finance-api.wildberries.ru';

const EXCLUDED_DEDUCTION_NAMES = [
  'ВБ.Продвижение', 'WB Продвижение', 'ВБ.Медиа',
  'Перевод на баланс заёмщика', 'Погашение задолженности',
  'Погашение по займу', 'Продвижение через блогеров',
  'ВБ.Бренд-зона', 'Сторно платной приёмки',
  'НДС не облагается', 'Компенсация',
];

export type PenaltiesQuery = { date: string; cabinet?: string };

export function parsePenaltiesQuery(text: string, _strict = false): PenaltiesQuery | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  if (isHelpOnly(text)) return null;
  if (!/(штраф|удерж|penalt)/.test(t) && !hasRuDayOrDdMm(t)) return null;
  return {
    date: parseRuDayToken(t) || yesterdayBishkek(),
    cabinet: extractCabinetHint(text),
  };
}

export type PenaltySnapshot = { name: string; total: number; error?: string };

/** Сумма штрафов/удержаний за день по кабинетам (чат: до 3 страниц без минутного sleep). */
export async function fetchAllCabinetPenalties(
  admin: SupabaseClient,
  date: string,
  cabinet?: string,
): Promise<PenaltySnapshot[]> {
  const { data: cabs, error } = await admin
    .from('cabinets')
    .select('id, name, wb_token')
    .not('wb_token', 'is', null)
    .gt('wb_token', '')
    .order('name');
  if (error) throw new Error(error.message);

  const list = (cabs || []).filter((c) =>
    !cabinet || String(c.name).toLowerCase().includes(cabinet.toLowerCase())
  );

  const settled = await Promise.allSettled(
    list.map(async (c) => {
      const token = sanitizeWbToken(c.wb_token);
      if (!isValidWbToken(token)) {
        return { name: c.name, total: 0, error: 'нет токена' } satisfies PenaltySnapshot;
      }
      try {
        const { total, truncated } = await fetchPenaltyTotalChat(token, date);
        return {
          name: c.name,
          total,
          error: truncated ? 'неполно (лимит страниц)' : undefined,
        } satisfies PenaltySnapshot;
      } catch (e) {
        return {
          name: c.name,
          total: 0,
          error: String(e instanceof Error ? e.message : e).slice(0, 120),
        } satisfies PenaltySnapshot;
      }
    }),
  );

  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { name: list[i]?.name || '?', total: 0, error: String(s.reason).slice(0, 120) }
  );
}

/** До 3 страниц detailed report — ближе к cron, без 61с паузы. */
async function fetchPenaltyTotalChat(
  token: string,
  date: string,
): Promise<{ total: number; truncated: boolean }> {
  let total = 0;
  let rrdId = 0;
  let truncated = false;
  for (let page = 0; page < 3; page++) {
    const res = await fetch(`${FINANCE_API}/api/finance/v1/sales-reports/detailed`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateFrom: date, dateTo: date, limit: 100000, rrdId }),
      signal: AbortSignal.timeout(45000),
    });
    if (res.status === 204) break;
    const text = await res.text();
    if (!res.ok) throw new Error(`WB finance ${res.status}: ${text.slice(0, 160)}`);
    if (!text.trim()) break;
    const chunk = JSON.parse(text);
    if (!Array.isArray(chunk) || !chunk.length) break;
    total += aggregatePenaltyTotal(chunk);
    const last = chunk[chunk.length - 1] as Record<string, unknown>;
    const nextRrd = Number(last?.rrdId ?? last?.rrd_id ?? 0);
    if (chunk.length < 100000 || !nextRrd || nextRrd === rrdId) break;
    if (page === 2) {
      truncated = true;
      break;
    }
    rrdId = nextRrd;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { total, truncated };
}

function aggregatePenaltyTotal(raw: Record<string, unknown>[]): number {
  let total = 0;
  for (const r of raw) {
    const penalty = parseMoney(ffield(r, 'penalty'));
    const deduction = parseMoney(ffield(r, 'deduction'));
    const docType = String(ffield(r, 'docTypeName', 'doc_type_name') || '');
    const operName = String(ffield(r, 'supplierOperName', 'supplier_oper_name') || '');
    const bonusName = String(ffield(r, 'bonusTypeName', 'bonus_type_name') || '');

    const excluded = EXCLUDED_DEDUCTION_NAMES.some((n) =>
      operName.includes(n) || bonusName.includes(n)
    );

    let amount = 0;
    if (penalty > 0) amount += penalty;
    if (deduction > 0 && !excluded) amount += deduction;

    const docLower = docType.toLowerCase();
    if (amount <= 0 && !docLower.includes('штраф') && !docLower.includes('удерж')) continue;
    if (amount <= 0) continue;
    total += amount;
  }
  return total;
}

function ffield(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

function parseMoney(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function formatPenaltiesReply(
  date: string,
  snapshots: PenaltySnapshot[],
  alertUser?: string,
): string {
  const [y, m, d] = date.split('-');
  const pretty = `${d}.${m}.${y}`;
  const total = snapshots.reduce((s, x) => s + (x.total || 0), 0);
  const lines = [`⚠ <b>Штрафы за ${pretty}</b>`, ''];
  for (const s of snapshots) {
    if (s.error && s.error !== 'неполно (лимит страниц)') {
      lines.push(`• ${s.name}: ошибка — ${s.error}`);
    } else if (!s.total) {
      lines.push(`• ${s.name}: нет`);
    } else {
      const note = s.error === 'неполно (лимит страниц)' ? ' ≈' : '';
      lines.push(`• ${s.name}: ${Math.round(s.total).toLocaleString('ru-RU')} ₽${note}`);
    }
  }
  lines.push('', `Итого: ${Math.round(total).toLocaleString('ru-RU')} ₽`);
  if (total > 0 && alertUser) lines.push(`@${alertUser}`);
  return lines.join('\n');
}
