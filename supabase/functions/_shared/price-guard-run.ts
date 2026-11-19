// Серверная защита смены цен: оценка по текущим ценам WB, код подтверждения для сотрудников. Зависимости передаются снаружи (WB, Telegram, база), поэтому логика проверяется без сети.
import { assessPriceChange, codeHash, CODE_TTL_MIN, fmtPct, itemsHash, makeCode, MAX_ATTEMPTS, summaryText, type Assessment, type CurrentPrice, type PriceItem } from './price-guard.ts';

export type GuardArgs = { cabinetId: string; cabName: string; userId: string; email: string; staff: boolean; items: PriceItem[]; confirm?: { id?: string; code?: string } };
export type GuardDeps = {
    // deno-lint-ignore no-explicit-any
    admin: any;
    currentPrices: (nmList: number[]) => Promise<Record<number, CurrentPrice>>;
    sendAdmin: (text: string) => Promise<boolean>;
    json: (data: unknown, status?: number) => Response;
};

/** Оценивает смену цен и при необходимости требует код подтверждения. response != null: ответ клиенту вместо отправки в WB. */
export async function guardPriceChange(p: GuardArgs, d: GuardDeps): Promise<{ response: Response | null; assessment: Assessment; confirmed: boolean }> {
    let current: Record<number, CurrentPrice> = {};
    try { current = await d.currentPrices(p.items.map((i) => i.nmID)); } catch (_) { /* текущие цены неизвестны: assess сочтёт изменение рискованным */ }
    const assessment = assessPriceChange(p.items, current);
    if (!assessment.needConfirm || !p.staff) return { response: null, assessment, confirmed: false };

    const hash = await itemsHash(p.items);
    const cf = p.confirm;
    if (cf?.id && cf?.code) {
        const { data: row } = await d.admin.from('price_confirmations').select('*').eq('id', cf.id).maybeSingle();
        const bad = !row || row.user_id !== p.userId || row.cabinet_id !== p.cabinetId || row.items_hash !== hash || row.used_at || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= MAX_ATTEMPTS;
        if (bad) return { response: d.json({ confirmRequired: true, confirmId: null, restart: true, error: 'Код недействителен или устарел. Запросите новый.' }), assessment, confirmed: false };
        if (await codeHash(String(cf.code).trim(), row.id, hash) !== row.code_hash) {
            const attempts = Number(row.attempts) + 1;
            await d.admin.from('price_confirmations').update({ attempts, used_at: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : null }).eq('id', row.id);
            return { response: d.json({ confirmRequired: true, confirmId: attempts >= MAX_ATTEMPTS ? null : row.id, restart: attempts >= MAX_ATTEMPTS, error: 'Неверный код', attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts) }), assessment, confirmed: false };
        }
        await d.admin.from('price_confirmations').update({ used_at: new Date().toISOString() }).eq('id', row.id);
        return { response: null, assessment, confirmed: true };
    }
    // Кода ещё нет: создаём и отправляем владельцу в Telegram, в WB пока ничего не уходит
    const code = makeCode();
    const { data: made, error: insErr } = await d.admin.from('price_confirmations').insert({
        cabinet_id: p.cabinetId, user_id: p.userId, items_hash: hash, code_hash: 'pending', expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    }).select('id').single();
    if (insErr || !made) return { response: d.json({ error: 'Не удалось создать код подтверждения. Повторите.' }, 500), assessment, confirmed: false };
    await d.admin.from('price_confirmations').update({ code_hash: await codeHash(code, made.id, hash) }).eq('id', made.id);
    const sent = await d.sendAdmin(
        `NR SPACE · НУЖНО ПОДТВЕРЖДЕНИЕ ЦЕН\nКто: ${p.email}\nКабинет: ${p.cabName}\n${summaryText(assessment)}\nНаибольшее снижение: ${fmtPct(-assessment.maxDrop)}\n\nКод: ${code} (действует ${CODE_TTL_MIN} минут)\nЕсли вы этого не делали, никому не сообщайте код и срочно смените пароль и токен.`);
    if (!sent) {
        await d.admin.from('price_confirmations').delete().eq('id', made.id);
        return { response: d.json({ error: 'Не удалось отправить код подтверждения в Telegram. Цены не изменены, обратитесь к владельцу.' }, 503), assessment, confirmed: false };
    }
    return { response: d.json({ confirmRequired: true, confirmId: made.id, count: assessment.count, maxDrop: assessment.maxDrop, minutes: CODE_TTL_MIN }), assessment, confirmed: false };
}

export async function notifyPriceChange(p: { email: string; cabName: string; staff: boolean; confirmed: boolean; assessment: Assessment }, sendAdmin: (t: string) => Promise<boolean>) {
    await sendAdmin(
        `NR SPACE · СМЕНА ЦЕН\nКто: ${p.email}${p.staff ? ' (команда)' : ''}\nКабинет: ${p.cabName}\n${summaryText(p.assessment)}\n${p.confirmed ? 'Подтверждено кодом' : (p.assessment.needConfirm ? 'Без кода (клиент кабинета)' : 'Изменение в пределах нормы')}`);
}
