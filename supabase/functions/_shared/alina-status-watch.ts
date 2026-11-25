// Алина читает статусы менеджера в колонке «Статус» (шаги 2–3, 25 ноября 2026). Пока только наблюдение: ничего клиенту не отправляется.
import type { RazSheet } from './alina-razdachi.ts';
import { ALINA_STATUSES } from './alina-razdachi.ts';

/** Что Алина сказала бы клиенту, когда менеджер поставил статус. null: клиенту молчим. */
export const MANAGER_STATUS_REPLY: Record<string, string | null> = {
  'Отзыв согласован': 'Отзыв согласован ✅ Можно публиковать 🙌',
  'Отзыв опубликован': 'Спасибо, отзыв вижу ✅',
  'Рилс опубликован': 'Рилс вижу, спасибо ✅',
  'Выплачено': 'Выплата отправлена ✅ Проверьте, пожалуйста, поступление 🙌',
  'Менеджер ведёт': null,
  'Отказ': null,
};

export type StatusChange = { key: string; row: number; tg: string; model: string; date: string; from: string; to: string; reply: string | null; silence: boolean };

/** Ключ строки: ID из колонки «ID», иначе логин+дата+модель. */
function rowKey(r: { tg: string; model: string; date: string; cells: string[] }, idCol: number | undefined): string {
  const id = idCol != null ? String(r.cells[idCol] ?? '').trim() : '';
  return id ? `id:${id}` : `${r.tg}|${r.date}|${r.model}`;
}

/**
 * Сравнивает таблицу со снимком прошлого запуска. Первый запуск (prev === null) только строит снимок.
 * Изменения считаются, если статус стал статусом менеджера (не из списка Алины); последняя правка менеджера главнее.
 */
export function planStatusChanges(prev: Record<string, string> | null, sheet: RazSheet, idCol?: number): { snap: Record<string, string>; changes: StatusChange[] } {
  const snap: Record<string, string> = {};
  const changes: StatusChange[] = [];
  const sc = sheet.col.status;
  if (sc == null) return { snap, changes };
  for (const r of sheet.rows) {
    if (!r.tg) continue;
    const st = String(r.cells[sc] ?? '').trim();
    const key = rowKey(r, idCol);
    snap[key] = st;
    if (prev == null) continue;
    const was = prev[key] ?? '';
    if (st === was || !st || ALINA_STATUSES.includes(st)) continue;
    changes.push({ key, row: r.row, tg: r.tg, model: r.model, date: r.date, from: was, to: st, reply: MANAGER_STATUS_REPLY[st] ?? null, silence: st === 'Менеджер ведёт' || st === 'Отказ' });
  }
  return { snap, changes };
}
