// Недельные выплаты («к выводу») из строк финотчёта WB без хранения самих строк.
// Формула та же, что в SQL rnp_cabinet_payouts: продажи и компенсации минус возвраты, плюс доплаты, минус логистика, хранение, штрафы, удержания, приёмка.
// deno-lint-ignore-file no-explicit-any

export type PayoutRow = {
    rr_dt?: string | null;
    supplier_oper_name?: string | null;
    ppvz_for_pay?: number | string | null;
    additional_payment?: number | string | null;
    delivery_rub?: number | string | null;
    storage_fee?: number | string | null;
    penalty?: number | string | null;
    deduction?: number | string | null;
    acceptance?: number | string | null;
};
export type WeekPayout = { week_start: string; week_end: string; pay_date: string; to_withdraw: number };

const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const DAY = 86400000;

export function weekStart(iso: string): string {
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    const dow = (d.getUTCDay() + 6) % 7; // понедельник = 0
    return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10);
}
const addDays = (iso: string, k: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + k * DAY).toISOString().slice(0, 10);

// Добавляет строки в накопитель по неделям (можно вызывать постранично).
export function addPayoutRows(acc: Map<string, number>, rows: PayoutRow[]): void {
    for (const r of rows) {
        if (!r.rr_dt) continue;
        const w = weekStart(String(r.rr_dt));
        const oper = String(r.supplier_oper_name || '');
        const pay = oper === 'Продажа' || oper === 'Добровольная компенсация при возврате' ? n(r.ppvz_for_pay) : oper === 'Возврат' ? -n(r.ppvz_for_pay) : 0;
        const v = pay + n(r.additional_payment) - n(r.delivery_rub) - n(r.storage_fee) - n(r.penalty) - n(r.deduction) - n(r.acceptance);
        acc.set(w, (acc.get(w) || 0) + v);
    }
}

export function toWeekPayouts(acc: Map<string, number>): WeekPayout[] {
    return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ws, v]) => ({
        week_start: ws, week_end: addDays(ws, 6), pay_date: addDays(ws, 14), to_withdraw: Math.round(v * 100) / 100,
    }));
}

// Окна по 4 недели от понедельника, чтобы неделя не делилась между запросами.
export function fourWeekWindows(fromMonday: string, toSunday: string): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    for (let s = fromMonday; s <= toSunday; s = addDays(s, 28)) {
        const e = addDays(s, 27);
        out.push({ from: s, to: e > toSunday ? toSunday : e });
    }
    return out;
}
