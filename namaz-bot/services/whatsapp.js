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
 * Отправка текста в WhatsApp-группу через Green API.
 * При ошибке — одна повторная попытка через 30 секунд.
 */
async function sendMessage(message, chatId = process.env.GREEN_API_GROUP_CHAT_ID) {
  if (!chatId) throw new Error('Missing env: GREEN_API_GROUP_CHAT_ID');

  const url = `${baseUrl()}/sendMessage/${token()}`;
  const payload = { chatId, message };

  try {
    await postJson(url, payload);
    log.info(`WhatsApp sent → ${chatId}: ${message}`);
    return true;
  } catch (err) {
    log.error('WhatsApp send failed, retry in 30s', err);
    await sleep(30_000);
    try {
      await postJson(url, payload);
      log.info(`WhatsApp sent (retry) → ${chatId}: ${message}`);
      return true;
    } catch (err2) {
      log.error('WhatsApp send failed after retry', err2);
      return false;
    }
  }
}

async function getChats() {
  const url = `${baseUrl()}/getChats/${token()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`getChats HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
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
  // Green API обычно отвечает { idMessage: "..." } при успехе
  if (data && typeof data === 'object' && data.idMessage === undefined && data.error) {
    throw new Error(`Green API error: ${JSON.stringify(data)}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { sendMessage, getChats };
