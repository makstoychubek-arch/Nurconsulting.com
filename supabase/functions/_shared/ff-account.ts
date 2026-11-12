// Счёт ФФ (АМАН) по кабинету за день: отправки, хранение и штрафы ФФ. Чистая логика без Deno-API, тестируется в node.
// Те же цифры пишутся в ff_ledger (сайт) и в карточку Telegram, поэтому расходиться им не из чего.

import { shipRate, type FfTerm } from './ff-shipments.ts';

export interface FfStorageTerm extends FfTerm { daily_cap?: number | string | null; storage_mode?: string | null }

/** Хранение за день: фикс в сутки, если он задан на эту дату, иначе ставка за штуку × остаток FBS, не больше суточного лимита. */
export function storageForDay(terms: FfStorageTerm[], cabinetId: string, date: string, stock: number): number {
    let best = 0;
    for (const t of terms) {
        if (t.cabinet_id !== cabinetId || t.kind !== 'storage') continue;
        if (t.date_from > date || (t.date_to && t.date_to < date)) continue;
        let c: number;
        if (t.storage_mode === 'fixed') c = stock > 0 ? Number(t.value) : 0;
        else {
            c = stock * Number(t.value);
            if (t.daily_cap != null && t.daily_cap !== '' && c > Number(t.daily_cap)) c = Number(t.daily_cap);
        }
        if (c > best) best = c;   // у кабинета несколько записей ФФ с одной ставкой: берём одну, а не складываем
    }
    return Math.round(best * 100) / 100;
}

/** Отправки за день: заказы × цена отправки склада на дату. */
export function shipForDay(terms: FfTerm[], cabinetId: string, orders: { ff_name: string | null }[], date: string): { count: number; sum: number; rate: number | null } {
    let sum = 0, count = 0; const rates = new Set<number>();
    for (const o of orders) {
        if (!o.ff_name) continue;
        const r = shipRate(terms, cabinetId, o.ff_name, date);
        count += 1;
        if (r != null) { sum += r; rates.add(r); }
    }
    return { count, sum: Math.round(sum * 100) / 100, rate: rates.size === 1 ? [...rates][0] : null };
}

export interface LedgerRow { kind: string; amount: number | string; entry_date: string }

/** Долг: начисления минус оплаты и зачёты с даты начала счёта. */
export function debtFrom(rows: LedgerRow[], since: string): number {
    let d = 0;
    for (const r of rows) {
        if (String(r.entry_date).slice(0, 10) < since) continue;
        d += (r.kind === 'charge' ? 1 : -1) * Number(r.amount);
    }
    return Math.round(d * 100) / 100;
}

export const grp = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
