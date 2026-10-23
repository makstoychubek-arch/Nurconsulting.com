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
    return out;
}

/** Слать ли сообщение: отпечаток изменился или прошло больше суток с прошлой отправки (напоминание). Пустой список очищает состояние. */
export function shouldSend(prevFingerprint: string, prevSentAt: string | null, fingerprint: string, now: Date, remindHours = 24): boolean {
    if (!fingerprint) return false;
    if (fingerprint !== prevFingerprint) return true;
    if (!prevSentAt) return true;
    return now.getTime() - new Date(prevSentAt).getTime() > remindHours * 3600 * 1000;
}
