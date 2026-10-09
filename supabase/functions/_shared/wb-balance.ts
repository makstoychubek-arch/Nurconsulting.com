// Баланс продавца WB: GET finance-api.wildberries.ru/api/v1/account/balance (токен категории «Финансы»).
// Лимит WB — 1 запрос в минуту на аккаунт, поэтому по кабинету зовём один раз и не повторяем.
import { sanitizeWbToken } from './wb-cabinet-tokens.ts';

const BALANCE_URL = 'https://finance-api.wildberries.ru/api/v1/account/balance';

export type BalanceResult = { cabinet: string; status: 'saved' | 'exists' | 'no_token' | 'error'; error?: string };

/** Пишет баланс кабинетов за дату date (write-once: повторный запуск ничего не меняет). */
export async function snapshotWbBalances(
    admin: any,
    date: string,
    onlyCabinetId?: string | null,
): Promise<BalanceResult[]> {
    let q = admin.from('cabinets').select('id, name, wb_token').not('wb_token', 'is', null).gt('wb_token', '');
    if (onlyCabinetId) q = q.eq('id', onlyCabinetId);
    const { data: cabinets, error } = await q;
    if (error) throw new Error(error.message);

    const results: BalanceResult[] = [];
    for (const cab of cabinets || []) {
        const name = String(cab.name || cab.id);
        const { data: have } = await admin.from('wb_balance_daily').select('date').eq('cabinet_id', cab.id).eq('date', date).maybeSingle();
        if (have) { results.push({ cabinet: name, status: 'exists' }); continue; }
        const token = sanitizeWbToken(cab.wb_token);
        if (!token) { results.push({ cabinet: name, status: 'no_token' }); continue; }
        try {
            const res = await fetch(BALANCE_URL, { headers: { Authorization: token }, signal: AbortSignal.timeout(20000) });
            if (!res.ok) {
                const hint = res.status === 401 || res.status === 403 ? 'у токена нет категории «Финансы»' : '';
                results.push({ cabinet: name, status: 'error', error: `HTTP ${res.status} ${hint}`.trim() });
                continue;
            }
            const b = await res.json();
            const cur = Number(b?.current);
            if (!Number.isFinite(cur)) { results.push({ cabinet: name, status: 'error', error: 'нет поля current' }); continue; }
            const wd = Number(b?.for_withdraw);
            const { error: insErr } = await admin.from('wb_balance_daily').upsert({
                cabinet_id: cab.id, date, currency: b?.currency ?? null, current: cur,
                for_withdraw: Number.isFinite(wd) ? wd : null,
            }, { onConflict: 'cabinet_id,date', ignoreDuplicates: true });
            results.push(insErr ? { cabinet: name, status: 'error', error: insErr.message } : { cabinet: name, status: 'saved' });
        } catch (e) {
            results.push({ cabinet: name, status: 'error', error: String((e as Error)?.message || e) });
        }
    }
    return results;
}
