// Оповещения владельцу: из снимка системы собираем сообщения по темам.
// Чистая логика без сети и базы, чтобы её можно было проверить тестом. Дедупликацию делает функция admin-alerts.

export type AlertSetting = { enabled: boolean; threshold: number | null; value: number | null };
export type AlertCabinet = { id: string; name: string; nr_managed: boolean; has_wb: boolean; adv_ok: boolean | null; last_sync: string | null; sync_error: string | null };
export type AlertSnapshot = {
    now: Date;
    settings: Record<string, AlertSetting>;
    cabinets: AlertCabinet[];
    jobs: { title: string; status: string }[];
    bots: { id: string; title: string; status: string }[];
    dbBytes: number;
    planBytes: number;
    access: { id: number; action: string; target: string | null; detail: string | null }[];
    /** Обмен «Раздач» с листом Google по кабинетам. */
    sheets?: { name: string; error: string | null; last_sync: string | null }[];
    /** Расход ChatGPT за месяц и последняя ошибка. */
    llm?: { costUsd: number; budgetUsd: number; lastError: string | null; lastErrorAt: string | null } | null;
    /** Вебхук Алины в Telegram: очередь недоставленного и последняя ошибка. */
    alinaHook?: { pending: number; error: string | null; errorAt: string | null } | null;
};
export type Alert = { key: string; fingerprint: string; text: string };

const on = (s: AlertSnapshot, key: string): AlertSetting | null => {
    const v = s.settings[key];
    return v && v.enabled ? v : null;
};

export function buildAlerts(s: AlertSnapshot): Alert[] {
    const out: Alert[] = [];
    const managed = s.cabinets.filter((c) => c.nr_managed);

    const ai = on(s, 'ai_balance');
    if (ai && ai.value != null && ai.threshold != null && ai.value < ai.threshold) {
        out.push({ key: 'ai_balance', fingerprint: 'low', text: `Баланс ИИ почти закончился: осталось $${ai.value.toFixed(2).replace('.', ',')} (порог $${ai.threshold}). Пока он не пополнен, ответы на отзывы и вопросы не отправляются.` });
    }

    if (on(s, 'tokens')) {
        const bad = managed.filter((c) => c.adv_ok === false || !c.has_wb);
        if (bad.length) {
            out.push({
                key: 'tokens', fingerprint: bad.map((c) => c.id + (c.has_wb ? 'a' : 'w')).sort().join(','),
                text: 'Проблемы с токенами:\n' + bad.map((c) => `• ${c.name}: ${!c.has_wb ? 'нет токена WB' : 'токен рекламы не принят'}`).join('\n'),
            });
        }
    }

    const sync = on(s, 'sync');
    if (sync) {
        const hours = (sync.threshold ?? 36) * 3600 * 1000;
        const bad = managed.filter((c) => c.has_wb && (c.sync_error || !c.last_sync || s.now.getTime() - new Date(c.last_sync).getTime() > hours));
        if (bad.length) {
            out.push({
                key: 'sync', fingerprint: bad.map((c) => c.id).sort().join(','),
                text: 'Синхронизация с WB не проходит:\n' + bad.map((c) => `• ${c.name}: ${c.sync_error ? String(c.sync_error).slice(0, 80) : 'давно нет данных'}`).join('\n'),
            });
        }
    }

    if (on(s, 'jobs')) {
        const bad = s.jobs.filter((j) => j.status === 'bad');
        if (bad.length) out.push({ key: 'jobs', fingerprint: bad.map((j) => j.title).sort().join(','), text: 'Упали регулярные задачи:\n' + bad.map((j) => `• ${j.title}`).join('\n') });
    }

    if (on(s, 'bots')) {
        const bad = s.bots.filter((b) => b.status === 'offline' || b.status === 'no_token');
        if (bad.length) out.push({ key: 'bots', fingerprint: bad.map((b) => b.id + b.status).sort().join(','), text: 'Боты Telegram не отвечают:\n' + bad.map((b) => `• ${b.title}: ${b.status === 'no_token' ? 'нет токена' : 'не на связи'}`).join('\n') });
    }

    const db = on(s, 'db_full');
    if (db && s.planBytes > 0) {
        const pct = Math.round((s.dbBytes / s.planBytes) * 100);
        if (pct >= (db.threshold ?? 80)) out.push({ key: 'db_full', fingerprint: String(Math.floor(pct / 5)), text: `База заполнена на ${pct}%. Пора докупить место или почистить данные.` });
    }

    if (on(s, 'access') && s.access.length) {
        out.push({
            key: 'access', fingerprint: s.access.map((a) => a.id).join(','),
            text: 'Изменения доступа:\n' + s.access.map((a) => `• ${a.action === 'access_granted' ? 'выдан' : 'отозван'}: ${a.detail || '?'} → ${a.target || '?'}`).join('\n'),
        });
    }
    const gs = on(s, 'giveaway_sync');
    if (gs && s.sheets?.length) {
        const staleMs = (gs.threshold ?? 30) * 60 * 1000;
        const bad = s.sheets.filter((x) => x.error || !x.last_sync || s.now.getTime() - new Date(x.last_sync).getTime() > staleMs);
        if (bad.length) {
            out.push({
                key: 'giveaway_sync', fingerprint: bad.map((x) => x.name + (x.error ? String(x.error).slice(0, 30) : 'stale')).sort().join(','),
                text: 'Обмен «Раздач» с Google не проходит:\n' + bad.map((x) => `• ${x.name}: ${x.error ? String(x.error).slice(0, 100) : 'давно нет обмена'}`).join('\n'),
            });
        }
    }

    const llm = on(s, 'llm');
    if (llm && s.llm) {
        const { costUsd, budgetUsd, lastError, lastErrorAt } = s.llm;
        const todayErr = lastError && lastErrorAt && s.now.getTime() - new Date(lastErrorAt).getTime() < 24 * 3600 * 1000;
        if (budgetUsd > 0 && costUsd >= budgetUsd) {
            out.push({ key: 'llm', fingerprint: 'over', text: `Бюджет ChatGPT на месяц израсходован ($${costUsd.toFixed(2)} из $${budgetUsd.toFixed(2)}). Алина отвечает по шаблонам. Увеличьте бюджет в «Продвижение → Алина».` });
        } else if (budgetUsd > 0 && costUsd / budgetUsd * 100 >= (llm.threshold ?? 80)) {
            const pct = Math.round(costUsd / budgetUsd * 100);
            out.push({ key: 'llm', fingerprint: 'pct' + Math.floor(pct / 10), text: `ChatGPT: израсходовано ${pct}% месячного бюджета ($${costUsd.toFixed(2)} из $${budgetUsd.toFixed(2)}).` });
        } else if (todayErr && /insufficient_quota|invalid_api_key|incorrect_api_key/.test(String(lastError))) {
            out.push({ key: 'llm', fingerprint: String(lastError), text: `ChatGPT не отвечает: ${/quota/.test(String(lastError)) ? 'закончились деньги на счёте OpenAI' : 'ключ не принят'}. Алина отвечает по шаблонам.` });
        }
    }

    const hook = on(s, 'alina_hook');
    if (hook && s.alinaHook) {
        const limit = hook.threshold ?? 20;
        const recentErr = !!s.alinaHook.error && !!s.alinaHook.errorAt && s.now.getTime() - new Date(s.alinaHook.errorAt).getTime() < 15 * 60 * 1000;
        if (recentErr || s.alinaHook.pending > limit) {
            out.push({
                key: 'alina_hook', fingerprint: (recentErr ? String(s.alinaHook.error).slice(0, 40) : '') + (s.alinaHook.pending > limit ? 'q' : ''),
                text: `Алина: Telegram не доставляет сообщения (в очереди ${s.alinaHook.pending}${recentErr ? ', ошибка: ' + String(s.alinaHook.error).slice(0, 100) : ''}).`,
            });
        }
    }
    return out;
}

/** Слать ли сообщение: отпечаток изменился или прошло больше суток с прошлой отправки (напоминание). Пустой список очищает состояние. */
export function shouldSend(prevFingerprint: string, prevSentAt: string | null, fingerprint: string, now: Date, remindHours = 24): boolean {
    if (!fingerprint) return false;
    if (fingerprint !== prevFingerprint) return true;
    if (!prevSentAt) return true;
    return now.getTime() - new Date(prevSentAt).getTime() > remindHours * 3600 * 1000;
}
