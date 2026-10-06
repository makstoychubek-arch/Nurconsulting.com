// Тумблеры функций по кабинету (таблица cabinet_features).
// Нет строки = функция включена. Пауза «на N часов» хранится как paused_until
// и заканчивается сама. Диагностика (last_run_at / last_status / last_error)
// пишется функциями через recordFeatureRun и показывается в настройках кабинета.
//
// Ошибка чтения тумблера никогда не отключает функцию: при сбое базы считаем «включено»,
// чтобы авария таблицы не остановила ответы на отзывы и ставки.
// deno-lint-ignore-file no-explicit-any

export type FeatureKey = 'reviews' | 'sync' | 'ads' | 'ab_rotation' | 'rnp_morning' | 'order_alerts';

// agent — одно имя на функцию, везде одинаковое. Карина — главный агент (координатор), ведёт системные функции.
export const FEATURES: { key: FeatureKey; title: string; hint: string; agent: string }[] = [
    { key: 'reviews', title: 'Ответы на отзывы', hint: 'Отвечает на отзывы покупателей', agent: 'Акылай' },
    { key: 'ads', title: 'РК и автоставки', hint: 'Ведёт ставки рекламных кампаний', agent: 'Амина' },
    { key: 'order_alerts', title: 'Уведомления о заказах', hint: 'Сообщает о новых заказах', agent: 'Антон' },
    { key: 'sync', title: 'Автосинхронизация', hint: 'Выгрузка данных WB', agent: 'Карина' },
    { key: 'ab_rotation', title: 'Ротация А/Б-тестов', hint: 'Смена фото в тестах', agent: 'Карина' },
    { key: 'rnp_morning', title: 'Утреннее заполнение РНП', hint: 'Утренняя и вечерняя выгрузка в РНП', agent: 'Карина' },
];

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);

export type FeatureRow = {
    cabinet_id: string;
    feature: string;
    enabled: boolean;
    paused_until: string | null;
    last_run_at?: string | null;
    last_status?: string | null;
    last_error?: string | null;
};

/** Работает ли функция прямо сейчас по строке тумблера (нет строки = работает). */
export function isFeatureOn(row: Pick<FeatureRow, 'enabled' | 'paused_until'> | null | undefined, now = Date.now()): boolean {
    if (!row) return true;
    if (row.enabled === false) return false;
    if (row.paused_until && new Date(row.paused_until).getTime() > now) return false;
    return true;
}

/** Почему функция выключена: для диагностики на экране. */
export function featureOffReason(row: Pick<FeatureRow, 'enabled' | 'paused_until'> | null | undefined, now = Date.now()): string | null {
    if (!row || isFeatureOn(row, now)) return null;
    if (row.enabled === false) return 'Отключено вручную до включения';
    return 'Временная пауза до ' + new Date(row.paused_until as string).toISOString();
}

/** Включена ли функция кабинета. При ошибке базы — true. */
export async function featureActive(admin: any, cabinetId: string, feature: FeatureKey): Promise<boolean> {
    try {
        const { data, error } = await admin
            .from('cabinet_features').select('enabled, paused_until')
            .eq('cabinet_id', cabinetId).eq('feature', feature).maybeSingle();
        if (error) return true;
        return isFeatureOn(data);
    } catch (_) {
        return true;
    }
}

/** Из списка кабинетов оставляет те, где функция включена. Один запрос на весь список. */
export async function filterFeatureActive<T extends { id?: string; cabinet_id?: string }>(
    admin: any, rows: T[], feature: FeatureKey,
): Promise<T[]> {
    const ids = rows.map((r) => String(r.id ?? r.cabinet_id ?? '')).filter(Boolean);
    if (!ids.length) return rows;
    try {
        const { data, error } = await admin
            .from('cabinet_features').select('cabinet_id, enabled, paused_until')
            .eq('feature', feature).in('cabinet_id', ids);
        if (error || !Array.isArray(data)) return rows;
        const off = new Set(data.filter((r: any) => !isFeatureOn(r)).map((r: any) => r.cabinet_id));
        return rows.filter((r) => !off.has(String(r.id ?? r.cabinet_id ?? '')));
    } catch (_) {
        return rows;
    }
}

/** Записать итог запуска функции для диагностики. Ошибка записи функцию не ломает. */
export async function recordFeatureRun(
    admin: any, cabinetId: string, feature: FeatureKey,
    status: 'ok' | 'error' | 'skipped', error?: string | null,
): Promise<void> {
    try {
        await admin.from('cabinet_features').upsert({
            cabinet_id: cabinetId,
            feature,
            last_run_at: new Date().toISOString(),
            last_status: status,
            last_error: error ? String(error).slice(0, 300) : null,
        }, { onConflict: 'cabinet_id,feature' });
    } catch (e) {
        console.error('[cabinet-features] record failed:', (e as Error)?.message || e);
    }
}
