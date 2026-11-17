import { getAdminClient } from './alina-db.ts';
import { type AlinaSettings, loadAlinaSettings } from './alina-settings.ts';

type ManagerMessage = {
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string; last_name?: string };
  reply_to_message?: { message_id?: number };
  message_id?: number;
  text?: string;
};

type Row = {
  client_chat_id: number;
  business_connection_id: string;
  group_text?: string | null;
  client_login?: string | null;
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

async function postTelegram(token: string, body: object, method = 'sendMessage'): Promise<TelegramPost> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
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

// «Печатает…»: пока Алина «набирает» ответ, у клиента в чате виден индикатор. Пауза зависит от длины текста.
// Сбой индикатора ничего не ломает, сообщение всё равно уйдёт.
export function alinaTypingMs(text: string, maxMs = 3000): number {
  return Math.min(maxMs, Math.max(Math.min(800, maxMs), 500 + text.length * 30));
}

async function showTyping(token: string, chatId: number, connectionId: string, text: string, s: AlinaSettings): Promise<void> {
  if (!s.typing) return;
  await postTelegram(token, { chat_id: chatId, business_connection_id: connectionId, action: 'typing' }, 'sendChatAction');
  await new Promise((resolve) => setTimeout(resolve, alinaTypingMs(text, s.pauseMaxSec * 1000)));
}

// Реакция на сообщение в группе (как в ответах на отзывы): ❤ доставлено, 👎 не доставлено. Возвращает, поставилась ли.
async function react(token: string, chatId: number, messageId: number | undefined, emoji: string): Promise<boolean> {
  if (!messageId) return false;
  const result = await postTelegram(token, {
    chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji }],
  }, 'setMessageReaction');
  return result.kind === 'ok';
}

const HOLD_PHRASES = ['Минутку, уточню.', 'Секунду, сейчас уточню.', 'Сейчас спрошу и вернусь к вам.'];

/** Живая фраза «уточняю»: вариант выбирается по номеру обновления, имя клиента (если есть и включено) в начале. */
export function alinaHoldPhrase(name: string | undefined, seed: number, phrases: string[] = HOLD_PHRASES, useName = true): string {
  const list = phrases.length ? phrases : HOLD_PHRASES;
  const phrase = list[Math.abs(Math.trunc(seed) || 0) % list.length];
  const clean = (useName ? name || '' : '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 30);
  return clean ? `${clean}, ${phrase[0].toLowerCase()}${phrase.slice(1)}` : phrase;
}

function loginOf(username?: string): string | null {
  // Логин Telegram: 5–32 символа, латиница, цифры и «_».
  return username && /^[a-z][a-z0-9_]{4,31}$/i.test(username) ? `@${username}` : null;
}

function copyMarkup(login: string | null | undefined, enabled = true) {
  // В буфер копируется только логин с «@» (copy_text). У клиента без логина кнопки нет.
  return login && enabled ? { inline_keyboard: [[{ text: `Скопировать ${login}`, copy_text: { text: login } }]] } : undefined;
}

function personName(from: ManagerMessage['from']): string {
  return [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim() || (from?.username ? `@${from.username}` : 'менеджер');
}

export async function askAlinaManager(
  token: string,
  group: number,
  client: { chatId: number; connectionId: string; username?: string },
  question: string,
): Promise<boolean> {
  const settings = await loadAlinaSettings();
  const login = loginOf(client.username);
  const text = `${login ?? `Без логина · чат ${client.chatId}`}\n${question}\n\nОтветьте на это сообщение. Текст ответа будет отправлен клиенту.`;
  const sent = await postTelegram(token, { chat_id: group, text, reply_markup: copyMarkup(login, settings.copyButton) });
  if (sent.kind !== 'ok' || !sent.result?.message_id) return false;
  const { error } = await getAdminClient().from('alina_manager_questions').insert({
    group_id: group,
    group_message_id: sent.result.message_id,
    client_chat_id: client.chatId,
    business_connection_id: client.connectionId,
    client_login: login,
    group_text: text,
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
  const who = personName(message.from);
  const settings = await loadAlinaSettings();
  // Берёт ответ один менеджер: второй реплай на то же обращение ничего не отправит.
  let claim = db.from('alina_manager_questions')
    .update({ delivery_state: 'sending', answered_by: message.from?.id ?? null, answered_by_name: who })
    .match(key).eq('delivery_state', 'pending');
  if (testChat !== undefined) claim = claim.eq('client_chat_id', testChat);
  const { data: pending, error } = await claim
    .select('client_chat_id,business_connection_id,group_text,client_login').maybeSingle();
  if (error) throw error;
  if (!pending) return;
  const row = pending as Row;

  await showTyping(token, row.client_chat_id, row.business_connection_id, message.text!.trim(), settings);
  const sent = await postTelegram(token, {
    chat_id: row.client_chat_id,
    business_connection_id: row.business_connection_id,
    text: message.text!.trim(),
  });
  // Отказ Telegram: ответ точно не ушёл, заявку можно взять снова.
  // Таймаут: возможно, ушёл. Автоповтор дал бы клиенту дубль, поэтому «unconfirmed» и решение за менеджером.
  const state = sent.kind === 'ok' ? 'sent' : sent.kind === 'refused' ? 'pending' : 'unconfirmed';
  const { error: finishError } = await db.from('alina_manager_questions')
    .update({ delivery_state: state }).match(key).eq('delivery_state', 'sending');
  if (finishError) throw finishError;

  // Итог реакцией, без лишних сообщений. Если реакции в группе не работают, пишем коротко текстом.
  const fallback = {
    sent: 'Ответ отправлен клиенту.',
    pending: 'Ответ не доставлен: Telegram отказал. Можно ответить на сообщение ещё раз.',
    unconfirmed: '',
  }[state];
  const reacted = settings.reactions &&
    await react(token, group, message.message_id, state === 'sent' ? '❤' : state === 'pending' ? '👎' : '🤔');
  if (state === 'unconfirmed') {
    // Здесь молчать нельзя: повтор вручную мог бы дать клиенту дубль.
    await postTelegram(token, {
      chat_id: group, reply_parameters: { message_id: message.message_id },
      text: 'Неизвестно, дошёл ли ответ: Telegram не ответил вовремя. Проверьте клиентский чат и не повторяйте, пока не убедитесь, что ответа там нет.',
    });
  } else if (!reacted) {
    await postTelegram(token, { chat_id: group, reply_parameters: { message_id: message.message_id }, text: fallback });
  }
  if (state === 'sent' && row.group_text) {
    // Кто ответил, видно в самом обращении; кнопка копирования остаётся.
    await postTelegram(token, {
      chat_id: group, message_id: key.group_message_id,
      text: `${row.group_text.replace(/\n\nОтветьте на это сообщение[^]*$/, '')}\n\n✅ Ответил: ${who}`,
      reply_markup: copyMarkup(row.client_login, settings.copyButton),
    }, 'editMessageText');
  }
}

/** Напоминание: обращение без ответа дольше 10 минут. Менеджерам в группу, клиенту «ещё уточняю». Один раз. */
export async function remindAlinaManager(envToken: string, now = Date.now()): Promise<number> {
  const db = getAdminClient();
  const settings = await loadAlinaSettings(now);
  const cutoff = new Date(now - settings.remindMin * 60_000).toISOString();
  const { data: due, error } = await db.from('alina_manager_questions')
    .select('group_id,group_message_id')
    .eq('delivery_state', 'pending').eq('client_chat_id', alinaManagerTestChat)
    .is('reminded_at', null).lt('created_at', cutoff).limit(5);
  if (error) throw error;
  if (!due?.length) return 0;
  const { data: credentials } = await db.from('telegram_bot_secrets').select('token').eq('bot_id', 'alina').maybeSingle();
  const token = String(credentials?.token || envToken).trim();
  if (!token) throw new Error('Alina token unavailable');

  let done = 0;
  for (const item of due as Array<{ group_id: number; group_message_id: number }>) {
    // Сначала занимаем напоминание, потом шлём: параллельный запуск не пришлёт второе.
    const { data: claimed } = await db.from('alina_manager_questions')
      .update({ reminded_at: new Date(now).toISOString() })
      .match({ group_id: item.group_id, group_message_id: item.group_message_id })
      .eq('delivery_state', 'pending').is('reminded_at', null)
      .select('client_chat_id,business_connection_id').maybeSingle();
    if (!claimed) continue;
    const row = claimed as Row;
    await postTelegram(token, {
      chat_id: item.group_id, reply_parameters: { message_id: item.group_message_id },
      text: `Клиент ждёт ответа уже больше ${settings.remindMin} мин. Ответьте реплаем на это обращение.`,
    });
    const text = 'Ещё уточняю, скоро вернусь к вам.';
    await showTyping(token, row.client_chat_id, row.business_connection_id, text, settings);
    await postTelegram(token, { chat_id: row.client_chat_id, business_connection_id: row.business_connection_id, text });
    done++;
  }
  return done;
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
    // Как живой человек: прочитала, спросила менеджеров, ответила «печатает…» и текстом.
    const settings = await loadAlinaSettings();
    if (incoming.message_id && settings.read) {
      await postTelegram(token, {
        business_connection_id: connectionId, chat_id: alinaManagerTestChat, message_id: incoming.message_id,
      }, 'readBusinessMessage');
    }
    const posted = await askAlinaManager(token, alinaManagerTestGroup, {
      chatId: alinaManagerTestChat, connectionId, username: incoming.from?.username,
    }, 'ТЕСТ · Можно поговорить с менеджером?');
    const hold = posted
      ? alinaHoldPhrase(incoming.from?.first_name, update.update_id ?? 0, settings.phrases, settings.useName)
      : 'Тест: вопрос не удалось доставить в группу.';
    await showTyping(token, alinaManagerTestChat, connectionId, hold, settings);
    await postTelegram(token, { chat_id: alinaManagerTestChat, business_connection_id: connectionId, text: hold });
    return true;
  }

  await deliverAlinaManagerReply(token, alinaManagerTestGroup, groupReply!, alinaManagerTestChat);
  return true;
}
