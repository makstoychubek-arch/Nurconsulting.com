'use strict';

const log = require('./logger');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function baseUrl() {
  const apiUrl = (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/\/$/, '');
  const id = requireEnv('GREEN_API_ID_INSTANCE');
  const token = requireEnv('GREEN_API_TOKEN');
  return `${apiUrl}/waInstance${id}`;
}

function token() {
  return requireEnv('GREEN_API_TOKEN');
}

/**
 * Участники группы (без своего номера), для тега @всех.
 */
async function getGroupMentionPhones(chatId) {
  const url = `${baseUrl()}/getGroupData/${token()}`;
  const data = await postJson(url, { groupId: chatId });
  const participants = Array.isArray(data?.participants) ? data.participants : [];

  let selfPhone = '';
  try {
    const wa = await getJson(`${baseUrl()}/getWaSettings/${token()}`);
    selfPhone = String(wa?.phone || '').replace(/\D/g, '');
  } catch {
    /* ignore */
  }

  const phones = [];
  for (const p of participants) {
    const id = String(p.id || p.phoneNumber || '');
    const phone = id.replace(/@c\.us$/i, '').replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
    if (!phone) continue;
    if (selfPhone && phone === selfPhone) continue;
    phones.push(phone);
  }
  return [...new Set(phones)];
}

/**
 * Отправка текста в WhatsApp-группу через Green API.
 * По умолчанию тегает всех участников (@номер).
 * При ошибке — одна повторная попытка через 30 секунд.
 */
async function sendMessage(message, chatId = process.env.GREEN_API_GROUP_CHAT_ID, opts = {}) {
  if (!chatId) throw new Error('Missing env: GREEN_API_GROUP_CHAT_ID');

  const tagAll = opts.tagAll !== false;
  let text = message;
  if (tagAll) {
    try {
      const phones = await getGroupMentionPhones(chatId);
      if (phones.length) {
        const tags = phones.map((p) => `@${p}`).join(' ');
        text = `${tags}\n${message}`;
      }
    } catch (err) {
      log.error('Не удалось получить участников для тега', err);
    }
  }

  const url = `${baseUrl()}/sendMessage/${token()}`;
  const payload = { chatId, message: text };

  try {
    await postJson(url, payload);
    log.info(`WhatsApp sent → ${chatId}: ${text}`);
    return true;
  } catch (err) {
    log.error('WhatsApp send failed, retry in 30s', err);
    await sleep(30_000);
    try {
      await postJson(url, payload);
      log.info(`WhatsApp sent (retry) → ${chatId}: ${text}`);
      return true;
    } catch (err2) {
      log.error('WhatsApp send failed after retry', err2);
      return false;
    }
  }
}

async function getChats() {
  return getJson(`${baseUrl()}/getChats/${token()}`);
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`Green API HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`Green API HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  if (data && typeof data === 'object' && data.idMessage === undefined && data.error) {
    throw new Error(`Green API error: ${JSON.stringify(data)}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage, getChats, getGroupMentionPhones };
