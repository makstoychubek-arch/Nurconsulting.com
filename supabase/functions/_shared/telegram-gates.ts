// Шлюз отправки в Telegram: удалённый бот и выключенный кабинет-канал
// не получают сообщения. Если таблиц ещё нет — пропускаем (fail-open).

export type TelegramGateChannel =
    | 'sales'
    | 'penalties'
    | 'ads'
    | 'ab_tests'
    | 'news'
    | 'reviews'
    | 'blockings'
    | 'warehouse'
    | 'triggers'
    | 'fbs';

// deno-lint-ignore no-explicit-any
export async function shouldSendTelegram(
    admin: any,
    opts: { botId?: string; channel: TelegramGateChannel; cabinetId?: string | null },
): Promise<{ ok: boolean; reason?: string }> {
    const botId = opts.botId || 'notify';
    try {
        const { data, error } = await admin
            .from('telegram_bots')
            .select('is_enabled, deleted_at')
            .eq('id', botId)
            .maybeSingle();
        if (!error && data) {
            if (data.deleted_at) return { ok: false, reason: 'bot_deleted' };
            if (data.is_enabled === false) return { ok: false, reason: 'bot_disabled' };
        }
    } catch {
        // таблица ещё не задеплоена
    }

    if (opts.cabinetId) {
        try {
            const { data, error } = await admin
                .from('telegram_channel_mutes')
                .select('muted')
                .eq('cabinet_id', String(opts.cabinetId))
                .eq('channel', opts.channel)
                .maybeSingle();
            if (!error && data && data.muted) return { ok: false, reason: 'cabinet_muted' };
        } catch {
            // ignore
        }
    }
    return { ok: true };
}
