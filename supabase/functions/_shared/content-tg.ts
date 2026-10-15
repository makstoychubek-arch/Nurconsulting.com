/** Импорт постов из Telegram-канала в очередь Контент-завода: чистые функции (без сети и базы). */

export type TgPhotoSize = { file_id: string; width?: number; height?: number; file_size?: number };
export type TgChannelMessage = {
    message_id: number;
    date?: number;
    media_group_id?: string;
    text?: string;
    caption?: string;
    photo?: TgPhotoSize[];
    video?: unknown;
    animation?: unknown;
    video_note?: unknown;
    document?: { mime_type?: string };
    chat: { id: number; title?: string; username?: string; type?: string };
    from?: { id: number; is_bot?: boolean };
};
export type TgUpdate = { update_id?: number; channel_post?: TgChannelMessage; edited_channel_post?: TgChannelMessage; message?: TgChannelMessage };

export type ParsedPost = {
    chatId: number;
    messageId: number;
    groupId: string | null;
    receivedAt: Date;
    text: string;
    kind: 'photo' | 'video' | 'text' | 'other';
    fileId: string | null;
    /** Группа или супергруппа: берём только посты администраторов (fromId проверяется отдельно). */
    isGroup: boolean;
    fromId: number | null;
    fromIsBot: boolean;
};

export type TgSourceRule = {
    mode: 'manual' | 'auto';
    target: 'feed' | 'story' | 'both';
    delay_minutes: number;
    daily_time: string | null;
    take_text: boolean;
    take_albums: boolean;
    strip_links: boolean;
    add_signature: boolean;
    signature: string | null;
};

export const IG_CAPTION_MAX = 2200;
const BISHKEK_OFFSET_MIN = 6 * 60;

export function parseChannelPost(update: TgUpdate): ParsedPost | null {
    const m = update.channel_post || update.message;
    if (!m || !m.chat || typeof m.chat.id !== 'number') return null;
    const ctype = String(m.chat.type || (update.channel_post ? 'channel' : ''));
    if (update.message && ctype !== 'group' && ctype !== 'supergroup') return null; // личные чаты не читаем
    const isGroup = ctype === 'group' || ctype === 'supergroup';
    const photo = Array.isArray(m.photo) && m.photo.length
        ? m.photo.slice().sort((a, b) => (b.file_size || (b.width || 0) * (b.height || 0)) - (a.file_size || (a.width || 0) * (a.height || 0)))[0]
        : null;
    const isVideo = !!(m.video || m.animation || m.video_note || (m.document && String(m.document.mime_type || '').startsWith('video/')));
    const kind: ParsedPost['kind'] = photo ? 'photo' : isVideo ? 'video' : (m.text ? 'text' : 'other');
    return {
        chatId: m.chat.id,
        messageId: m.message_id,
        groupId: m.media_group_id ? String(m.media_group_id) : null,
        receivedAt: new Date((m.date || Math.floor(Date.now() / 1000)) * 1000),
        text: String(m.caption || m.text || ''),
        kind,
        fileId: photo ? photo.file_id : null,
        isGroup,
        fromId: m.from && typeof m.from.id === 'number' ? m.from.id : null,
        fromIsBot: !!(m.from && m.from.is_bot),
    };
}

/** Убираем ссылки на Telegram, добавляем подпись кабинета, режем до лимита Instagram. */
export function cleanCaption(text: string, rule: Pick<TgSourceRule, 'strip_links' | 'add_signature' | 'signature'>): string {
    let t = String(text || '');
    if (rule.strip_links) {
        t = t.replace(/(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/\S+/gi, '');
        t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    }
    t = t.trim();
    const sig = String(rule.signature || '').trim();
    if (rule.add_signature && sig) t = t ? t + '\n\n' + sig : sig;
    return t.length > IG_CAPTION_MAX ? t.slice(0, IG_CAPTION_MAX - 1).trimEnd() + '…' : t;
}

export function titleFrom(text: string): string {
    const first = String(text || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
    return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : first;
}

/** Когда выложить: через N минут после поста или в заданное время дня (Бишкек, UTC+6). Не раньше чем через 5 минут. */
export function scheduleFor(receivedAt: Date, rule: Pick<TgSourceRule, 'delay_minutes' | 'daily_time'>, now: Date = new Date()): Date {
    const earliest = now.getTime() + 5 * 60000;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(rule.daily_time || ''));
    if (m) {
        const hh = Math.min(23, Number(m[1])), mm = Math.min(59, Number(m[2]));
        // сутки по Бишкеку: сдвигаем время в «местное» и обратно
        const local = new Date(receivedAt.getTime() + BISHKEK_OFFSET_MIN * 60000);
        let slot = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hh, mm) - BISHKEK_OFFSET_MIN * 60000;
        while (slot < receivedAt.getTime() || slot < earliest) slot += 86400000;
        return new Date(slot);
    }
    return new Date(Math.max(receivedAt.getTime() + Math.max(0, rule.delay_minutes) * 60000, earliest));
}

export type PlannedRow = { post_kind: 'feed' | 'story'; status: 'draft' | 'review' | 'scheduled'; note: string | null };

/** Какие записи создать из поста: учитывает тип, режим и «куда отправлять». */
export function planRows(post: Pick<ParsedPost, 'kind'>, rule: TgSourceRule): PlannedRow[] {
    if (post.kind === 'video' || post.kind === 'other') {
        return [{ post_kind: 'feed', status: 'draft', note: post.kind === 'video' ? 'Видео: публикуем вручную' : 'Тип поста не поддерживается' }];
    }
    if (post.kind === 'text') {
        if (!rule.take_text) return [];
        return [{ post_kind: 'feed', status: 'draft', note: 'Нет картинки: добавьте фото' }];
    }
    const kinds: Array<'feed' | 'story'> = rule.target === 'both' ? ['feed', 'story'] : [rule.target];
    return kinds.map((k) => ({ post_kind: k, status: rule.mode === 'auto' ? 'scheduled' as const : 'review' as const, note: null }));
}
