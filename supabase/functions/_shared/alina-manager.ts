import { getAdminClient } from './alina-db.ts';

type ManagerMessage = {
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean; username?: string };
  reply_to_message?: { message_id?: number };
  message_id?: number;
  text?: string;
};

export function alinaManagerGroup(): number | null {
  const value = Deno.env.get('ALINA_MANAGER_CHAT_ID')?.trim() || '';
  const id = Number(value);
  return /^-\d+$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

export function alinaManagerTopic(text: string): string | null {
  if (/(?:не тот|другой) артикул|заказал[аи]? не ту модель/i.test(text)) {
    return 'Клиент заказал другой вариант. Можно ли принять заказ или нужна замена?';
  }
  if (/(?:не приш[её]л|задержал[аи]?ся).{0,24}(?:перевод|выплат)|(?:перевод|выплат).{0,24}не приш[её]л/i.test(text)) {
    return 'Клиент сообщает, что выплата не поступила. Проверьте статус перевода.';
  }
  if (/когда.{0,32}(?:перевед|выплат|поступят деньги|придут деньги)|(?:через сколько|как долго).{0,24}(?:выплат|перевод|ждать деньги)/i.test(text)) {
    return 'Клиент спрашивает, когда будет выплата. Уточните дату перевода.';
  }
  if (/где чек|пришлите чек|чек перевода/i.test(text)) {
    return 'Клиент просит чек перевода.';
  }
  if (/позовите менеджера|можно (?:поговорить с менеджером|человека)|хочу (?:связаться|поговорить) с менеджером/i.test(text)) {
    return 'Клиент просит подключить менеджера. Посмотрите исходный диалог.';
  }
  return null;
}

type TelegramPost =
  | { kind: 'ok'; result: ManagerMessage }
  | { kind: 'refused' }   // Telegram ответил отказом: сообщение точно не отправлено
  | { kind: 'unknown' };  // таймаут, обрыв или 5xx: неизвестно, принял ли Telegram сообщение

async function postTelegram(token: string, body: object): Promise<TelegramPost> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    console.error('[alina-manager] Telegram unreachable or timed out');
    return { kind: 'unknown' };
  }
  if (response.status >= 500) {
    console.error('[alina-manager] Telegram server error', response.status);
    return { kind: 'unknown' };
  }
  let data: { ok?: boolean; result?: ManagerMessage } | null = null;
  try {
    data = await response.json();
  } catch {
    return response.ok ? { kind: 'unknown' } : { kind: 'refused' };
  }
  if (response.ok && data?.ok === true) return { kind: 'ok', result: data.result as ManagerMessage };
  // Причина отказа без токена и без текста сообщения: код, описание Telegram и чат.
  console.error('[alina-manager] Telegram refused', response.status, String((data as { description?: string } | null)?.description || ''), String((body as { chat_id?: unknown }).chat_id));
  return { kind: 'refused' };
}

export async function askAlinaManager(
  token: string,
  group: number,
  client: { chatId: number; connectionId: string; username?: string },
  question: string,
): Promise<boolean> {
  // Логин Telegram: 5–32 символа, латиница, цифры и «_». Иначе логина нет: пишем номер чата и кнопку не показываем.
  const login = client.username && /^[a-z][a-z0-9_]{4,31}$/i.test(client.username) ? `@${client.username}` : null;
  const sent = await postTelegram(token, {
    chat_id: group,
    text: `${login ?? `Без логина · чат ${client.chatId}`}\n${question}\n\nОтветьте на это сообщение. Текст ответа будет отправлен клиенту.`,
    // В буфер копируется только логин с «@» (copy_text). У клиента без логина кнопки нет.
    reply_markup: login ? { inline_keyboard: [[{ text: `Скопировать ${login}`, copy_text: { text: login } }]] } : undefined,
  });
  if (sent.kind !== 'ok' || !sent.result?.message_id) return false;
  const { error } = await getAdminClient().from('alina_manager_questions').insert({
    group_id: group,
    group_message_id: sent.result.message_id,
    client_chat_id: client.chatId,
    business_connection_id: client.connectionId,
  });
  return !error;
}

export async function relayAlinaManagerReply(token: string, group: number, message: ManagerMessage) {
  const original = message.reply_to_message?.message_id;
  const text = message.text?.trim();
  if (message.chat?.id !== group || !['group', 'supergroup'].includes(message.chat.type || '') ||
      !message.from?.id || message.from.is_bot || !original || !text || !token) return;

  const db = getAdminClient();
  const { data: bot, error: botError } = await db.from('telegram_bots')
    .select('is_enabled, deleted_at').eq('id', 'alina').maybeSingle();
  if (botError) throw botError;
  if (!bot?.is_enabled || bot.deleted_at) return;

  const { data: credentials, error: credentialError } = await db.from('telegram_bot_secrets')
    .select('token').eq('bot_id', 'alina').maybeSingle();
  if (credentialError) throw credentialError;
  const sendToken = String(credentials?.token || token).trim();
  if (!sendToken) return;

  await deliverAlinaManagerReply(sendToken, group, message);
}

async function deliverAlinaManagerReply(token: string, group: number, message: ManagerMessage, testChat?: number) {
  const db = getAdminClient();
  const key = { group_id: group, group_message_id: message.reply_to_message!.message_id! };
  let claim = db.from('alina_manager_questions')
    .update({ delivery_state: 'sending' }).match(key).eq('delivery_state', 'pending');
  if (testChat !== undefined) claim = claim.eq('client_chat_id', testChat);
  const { data: pending, error } = await claim.select('client_chat_id,business_connection_id').maybeSingle();
  if (error) throw error;
  if (!pending) return;

  const sent = await postTelegram(token, {
    chat_id: pending.client_chat_id,
    business_connection_id: pending.business_connection_id,
    text: message.text!.trim(),
  });
  // Отказ Telegram: ответ точно не ушёл, заявку можно взять снова.
  // Таймаут: возможно, ушёл. Автоповтор дал бы клиенту дубль, поэтому «unconfirmed» и решение за менеджером.
  const state = sent.kind === 'ok' ? 'sent' : sent.kind === 'refused' ? 'pending' : 'unconfirmed';
  const { error: finishError } = await db.from('alina_manager_questions')
    .update({ delivery_state: state }).match(key).eq('delivery_state', 'sending');
  if (finishError) throw finishError;
  const notice = {
    sent: 'Ответ отправлен клиенту.',
    pending: 'Ответ не доставлен: Telegram отказал. Можно ответить на сообщение ещё раз.',
    unconfirmed: 'Неизвестно, дошёл ли ответ: Telegram не ответил вовремя. Проверьте клиентский чат и не повторяйте, пока не убедитесь, что ответа там нет.',
  }[state];
  await postTelegram(token, { chat_id: group, reply_parameters: { message_id: message.message_id }, text: notice });
}

// Isolated end-to-end check for the owner's verified private Telegram chat.
export const alinaManagerTestChat = 7159099638;
export const alinaManagerTestGroup = -1004465341061;

export async function processAlinaManagerTest(envToken: string, update: {
  update_id?: number;
  business_message?: ManagerMessage & { business_connection_id?: string };
  message?: ManagerMessage;
}): Promise<boolean> {
  const incoming = update.business_message;
  const groupReply = update.message;
  const isTestQuestion = incoming?.chat?.type === 'private' &&
    incoming.chat.id === alinaManagerTestChat && incoming.from?.id === alinaManagerTestChat &&
    !incoming.from.is_bot && typeof incoming.business_connection_id === 'string' &&
    incoming.business_connection_id.length > 0 &&
    /^(?:тест:\s*)?можно поговорить с менеджером[?.!]*$/i.test(incoming.text?.trim() || '');
  // Ответить может любой менеджер группы со своего аккаунта (не только отправитель вопроса).
  // Доставляется только ответ на сообщение бота с записью в таблице заявок, и только в личку тестового клиента.
  const isTestReply = groupReply?.chat?.id === alinaManagerTestGroup &&
    typeof groupReply.from?.id === 'number' && !groupReply.from.is_bot &&
    groupReply.reply_to_message?.message_id && groupReply.text?.trim();
  if (!isTestQuestion && !isTestReply) return false;

  const db = getAdminClient();
  const { data: credentials, error } = await db.from('telegram_bot_secrets')
    .select('token').eq('bot_id', 'alina').maybeSingle();
  if (error) throw error;
  const token = String(credentials?.token || envToken).trim();
  if (!token) throw new Error('Alina token unavailable');

  if (isTestQuestion) {
    // Повторная доставка того же обновления не должна создать второй вопрос в группе.
    if (typeof update.update_id === 'number') {
      const { error: dupError } = await db.from('alina_selfbuy_events').insert({
        event_type: 'telegram_delivery', chat_id: alinaManagerTestChat,
        payload: { bot_id: 'alina', update_id: update.update_id },
      });
      if (dupError?.code === '23505') return true;
      if (dupError) throw dupError;
    }
    const connectionId = incoming.business_connection_id!;
    const posted = await askAlinaManager(token, alinaManagerTestGroup, {
      chatId: alinaManagerTestChat, connectionId, username: incoming.from?.username,
    }, 'ТЕСТ · Можно поговорить с менеджером?');
    await postTelegram(token, {
      chat_id: alinaManagerTestChat, business_connection_id: connectionId,
      text: posted ? 'Минутку, уточню.' : 'Тест: вопрос не удалось доставить в группу.',
    });
    return true;
  }

  await deliverAlinaManagerReply(token, alinaManagerTestGroup, groupReply!, alinaManagerTestChat);
  return true;
}
