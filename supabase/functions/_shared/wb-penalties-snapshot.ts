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

export type SalesReportMeta = {
  reportId: number;
  dateFrom: string;
  dateTo: string;
};

export type PenaltyLine = { reason: string; amount: number };

/** Только поля для агрегации штрафов — полный detailed JSON у крупных кабинетов (Zevina 1) не влезает в edge. */
export const PENALTY_DETAIL_FIELDS = [
  'rrdId',
  'penalty',
  'deduction',
  'docTypeName',
  'supplierOperName',
  'bonusTypeName',
] as const;

/** Недельный отчёт, который покрывает дату, иначе последний закрытый. */
export function pickSalesReport(reports: SalesReportMeta[], date: string): SalesReportMeta | null {
  const covering = reports
    .filter((r) => r.dateFrom <= date && date <= r.dateTo)
    .sort((a, b) => b.dateTo.localeCompare(a.dateTo));
  if (covering[0]) return covering[0];
  const closed = reports
    .filter((r) => r.dateTo < date)
    .sort((a, b) => b.dateTo.localeCompare(a.dateTo));
  return closed[0] ?? null;
}

export function addDaysYmd(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function prettyRuDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

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

async function financePost(token: string, path: string, body: Record<string, unknown>, timeoutMs = 60000): Promise<{ status: number; data: unknown }> {
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${FINANCE_API}${path}`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (res.status === 429) {
      lastErr = text.slice(0, 120);
      await new Promise((r) => setTimeout(r, 65000));
      continue;
    }
    if (res.status === 204 || !text.trim()) return { status: res.status, data: [] };
    if (!res.ok) throw new Error(`WB finance ${res.status}: ${text.slice(0, 160)}`);
    return { status: res.status, data: JSON.parse(text) };
  }
  throw new Error(`WB finance 429: ${lastErr}`);
}

export async function fetchWeeklyPenaltyBundle(
  token: string,
  date: string,
): Promise<{
  rows: PenaltyLine[];
  periodFrom: string;
  periodTo: string;
  reportId: number | null;
  weekOpen: boolean;
}> {
  const listFrom = addDaysYmd(date, -28);
  const listed = await financePost(token, '/api/finance/v1/sales-reports/list', {
    dateFrom: listFrom,
    dateTo: date,
  });
  const reports: SalesReportMeta[] = (Array.isArray(listed.data) ? listed.data : [])
    .map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        reportId: Number(rec.reportId ?? rec.report_id ?? 0),
        dateFrom: String(rec.dateFrom ?? rec.date_from ?? '').slice(0, 10),
        dateTo: String(rec.dateTo ?? rec.date_to ?? '').slice(0, 10),
      };
    })
    .filter((r) => r.reportId && r.dateFrom && r.dateTo);

  const picked = pickSalesReport(reports, date);
  if (!picked) {
    return { rows: [], periodFrom: date, periodTo: date, reportId: null, weekOpen: true };
  }
  const weekOpen = !(picked.dateFrom <= date && date <= picked.dateTo);
  const detailed = await financePost(
    token,
    `/api/finance/v1/sales-reports/detailed/${picked.reportId}`,
    {
      limit: 100000,
      rrdId: 0,
      fields: [...PENALTY_DETAIL_FIELDS],
    },
    90000,
  );
  const raw = Array.isArray(detailed.data) ? detailed.data as Record<string, unknown>[] : [];
  return {
    rows: aggregatePenaltyRows(raw),
    periodFrom: picked.dateFrom,
    periodTo: picked.dateTo,
    reportId: picked.reportId,
    weekOpen,
  };
}

/** До 3 страниц detailed report — ближе к cron, без 61с паузы. */
async function fetchPenaltyTotalChat(
  token: string,
  date: string,
): Promise<{ total: number; truncated: boolean }> {
  const bundle = await fetchWeeklyPenaltyBundle(token, date);
  return {
    total: bundle.rows.reduce((s, r) => s + r.amount, 0),
    truncated: false,
  };
}

export function aggregatePenaltyRows(raw: Record<string, unknown>[]): PenaltyLine[] {
  const byReason = new Map<string, number>();
  for (const r of raw) {
    const penalty = parseMoney(ffield(r, 'penalty'));
    const deduction = parseMoney(ffield(r, 'deduction'));
    const docType = String(ffield(r, 'docTypeName', 'doc_type_name') || '');
    const operName = String(ffield(r, 'supplierOperName', 'supplier_oper_name') || '');
    const bonusName = String(ffield(r, 'bonusTypeName', 'bonus_type_name') || '');
    const blob = `${docType} ${operName} ${bonusName}`.toLowerCase();

    const excluded = EXCLUDED_DEDUCTION_NAMES.some((n) =>
      operName.includes(n) || bonusName.includes(n)
    );

    let amount = 0;
    if (penalty > 0) amount += penalty;
    if (deduction > 0 && !excluded) amount += deduction;
    if (amount <= 0 && !blob.includes('штраф') && !blob.includes('удерж')) continue;
    if (amount <= 0) continue;

    const reason = (bonusName || operName || docType || 'Удержание').trim();
    byReason.set(reason, (byReason.get(reason) || 0) + amount);
  }
  return [...byReason.entries()]
    .map(([reason, amount]) => ({ reason, amount }))
    .sort((a, b) => b.amount - a.amount);
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
