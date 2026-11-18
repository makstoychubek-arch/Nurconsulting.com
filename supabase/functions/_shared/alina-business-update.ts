type BusinessMessage = {
    business_connection_id?: string;
    message_id?: number;
    chat?: { id?: number; type?: string };
    from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string; last_name?: string };
    sender_business_bot?: unknown;
    text?: string;
    caption?: string;
    photo?: { file_id?: string }[];
};

export function parseAlinaBusinessUpdate(update: {
    update_id?: number;
    business_message?: BusinessMessage;
} | null) {
    const message = update?.business_message;
    const updateId = update?.update_id;
    const messageId = message?.message_id;
    const chatId = message?.chat?.id;
    const user = message?.from;
    const connectionId = message?.business_connection_id;
    if (!message || message.chat?.type !== 'private' || !chatId || !user?.id ||
        typeof connectionId !== 'string' || !connectionId || !Number.isSafeInteger(chatId) ||
        !Number.isSafeInteger(user.id) || typeof updateId !== 'number' || !Number.isSafeInteger(updateId) ||
        typeof messageId !== 'number' || !Number.isSafeInteger(messageId)) return null;

    const ids = {
        chatId,
        connectionId,
        updateId,
        messageId,
    };
    if (message.sender_business_bot || user.is_bot) return null;
    if (user.id !== chatId) return { ...ids, kind: 'owner' as const };
    const text = (message.text || message.caption || '').trim();
    const photoFileId = message.photo?.at(-1)?.file_id;
    if (!text && !photoFileId) return null;

    return {
        ...ids,
        kind: 'client' as const,
        userId: user.id,
        username: user.username,
        fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
        text: text || 'скрин',
        photoFileId,
    };
}
