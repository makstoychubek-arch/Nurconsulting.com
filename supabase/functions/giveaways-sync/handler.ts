/**
 * Обмен таблицы «Раздачи» с листом Google для кабинетов из giveaway_sheets.
 * Порядок: занять обмен → прочитать лист → план (giveaways-sheet.ts) → записать лист → записать базу → отчёт.
 * Если запись в лист не прошла, база не трогается: следующий обмен начнёт с тех же данных. Все зависимости снаружи.
 */
import {
  detectLayout, hashCells, planSync, rowCells, SHEET_FIELDS,
  type DbRow, type Layout, type Plan, type SheetRow,
} from '../_shared/giveaways-sheet.ts';

export type Mapping = { cabinet_id: string; sheet_id: string; tab: string };

export type SheetIO = {
  readAll(sheetId: string, tab: string): Promise<string[][] | null>;
  writeCells(sheetId: string, tab: string, cells: Array<{ row: number; col: number; value: string }>): Promise<boolean>;
  append(sheetId: string, tab: string, rows: string[][]): Promise<number | null>; // номер первой дописанной строки
};

export type Db = {
  claim(cabinetId: string): Promise<boolean>;
  loadRows(cabinetId: string): Promise<DbRow[]>;
  insertRows(rows: Array<Record<string, unknown>>): Promise<boolean>;
  updateRow(id: string, patch: Record<string, unknown>): Promise<boolean>;
  removeRows(ids: string[]): Promise<boolean>;
  insertConflicts(cabinetId: string, items: Plan['conflicts']): Promise<void>;
  finish(cabinetId: string, stats: Record<string, unknown> | null, error: string | null): Promise<void>;
};

export type Stats = Record<string, number | boolean>;
export type SyncResult = { ok: boolean; busy?: boolean; error?: string; stats?: Stats };

const CHUNK = 200;

export function planStats(p: Plan): Stats {
  return {
    inserted: p.insertDb.length, updated: p.updateDb.length, deleted: p.deleteDb.length,
    wrote_cells: p.cellWrites.length, appended: p.append.length, conflicts: p.conflicts.length, skipped_delete: p.skippedDelete,
  };
}

export async function syncCabinet(m: Mapping, sheets: SheetIO, db: Db, now: () => string, opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  if (!await db.claim(m.cabinet_id)) return { ok: true, busy: true };
  const fail = async (error: string): Promise<SyncResult> => { await db.finish(m.cabinet_id, null, error); return { ok: false, error }; };
  try {
    const values = await sheets.readAll(m.sheet_id, m.tab);
    if (!values) return await fail('Лист не прочитался: проверьте доступ сервисного аккаунта к таблице');
    const layout: Layout | null = detectLayout(values);
    if (!layout) return await fail('В листе не найдена шапка «Раздачи» (ТОВАР, Ссылка ТГ, Дата заказа)');
    const sheet: SheetRow[] = values.slice(layout.headerRow).map((cells, i) => ({ row: layout.headerRow + 1 + i, cells: cells.map((c) => String(c ?? '')) }));
    const dbRows = await db.loadRows(m.cabinet_id);
    const plan = planSync({ layout, sheet, db: dbRows, cabinetId: m.cabinet_id });

    // Пробный прогон: только считаем, что изменилось бы, ничего не пишем
    if (opts.dryRun) return { ok: true, stats: planStats(plan) };

    // 1. Лист: ID, правки с сайта, шапка колонки ID
    const writes = plan.cellWrites.slice();
    const headerNeeded = layout.idCollides && (plan.cellWrites.some((w) => w.col === layout.idCol) || plan.append.length > 0);
    if (headerNeeded) writes.push({ row: layout.headerRow, col: layout.idCol, value: 'ID' });
    if (writes.length && !await sheets.writeCells(m.sheet_id, m.tab, writes)) return await fail('Не удалось записать в лист. База не менялась, повторю при следующем обмене');
    let appendedFrom: number | null = null;
    if (plan.append.length) {
      appendedFrom = await sheets.append(m.sheet_id, m.tab, plan.append.map((a) => a.cells));
      if (appendedFrom == null) return await fail('Не удалось дописать строки в лист. База не менялась');
    }

    // 2. База. Позиции в сетке уникальны, поэтому сначала освобождаем места: двигаемые и дописанные строки, удаляемые.
    const stamp = now();
    for (const mv of plan.move) await db.updateRow(mv.id, { pos: null });
    for (const a of plan.append) await db.updateRow(a.dbId, { pos: null });
    if (plan.deleteDb.length) await db.removeRows(plan.deleteDb);
    for (let i = 0; i < plan.insertDb.length; i += CHUNK) {
      const chunk = plan.insertDb.slice(i, i + CHUNK).map((r) => ({ ...r, synced_at: stamp }));
      if (!await db.insertRows(chunk)) return await fail('Не удалось сохранить строки из листа в базу');
    }
    for (const u of plan.updateDb) await db.updateRow(u.id, { ...u.patch, sheet_hash: u.sheet_hash, synced_at: stamp });
    for (const s of plan.stamp) await db.updateRow(s.id, { sheet_hash: s.sheet_hash, synced_at: stamp });
    for (const mv of plan.move) await db.updateRow(mv.id, { pos: mv.pos });
    for (let i = 0; i < plan.append.length; i++) {
      const a = plan.append[i];
      const cellsHash = hashCells(rowCells(layout, a.cells));
      const pos = appendedFrom != null && appendedFrom > 0 ? appendedFrom + i - layout.headerRow - 1 : null;
      await db.updateRow(a.dbId, { row_id: a.rowId, sheet_hash: cellsHash, synced_at: stamp, pos });
    }
    if (plan.conflicts.length) await db.insertConflicts(m.cabinet_id, plan.conflicts);

    const stats = planStats(plan);
    await db.finish(m.cabinet_id, stats, null);
    return { ok: true, stats };
  } catch {
    return await fail('Сбой обмена с листом. Повторю при следующем обмене');
  }
}

export { SHEET_FIELDS };
