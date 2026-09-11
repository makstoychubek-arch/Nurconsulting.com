'use strict';

require('dotenv').config();

const cron = require('node-cron');
const { fetchPrayerTimes } = require('./services/prayerTimes');
const { sendMessage } = require('./services/whatsapp');
const { formatReminder } = require('./services/message');
const log = require('./services/logger');

const TIMEZONE = process.env.TIMEZONE || 'Asia/Bishkek';

/** @type {NodeJS.Timeout[]} */
let reminderTimers = [];

function config() {
  return {
    city: process.env.CITY || 'Bishkek',
    country: process.env.COUNTRY || 'Kyrgyzstan',
    method: process.env.PRAYER_METHOD || '3',
    timezone: TIMEZONE,
  };
}

/** Локальные часы/минуты/секунды в TIMEZONE. */
function nowParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Миллисекунды до HH:MM сегодня + offsetMinutes. */
function msUntilToday(hhmm, offsetMinutes = 0) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const now = nowParts();
  const targetTotal = hh * 60 + mm + offsetMinutes;
  const nowTotal = now.hour * 60 + now.minute + now.second / 60;
  const diffMinutes = targetTotal - nowTotal;
  return Math.round(diffMinutes * 60 * 1000);
}

function clearReminderTimers() {
  for (const t of reminderTimers) clearTimeout(t);
  reminderTimers = [];
}

function scheduleReminders(prayers) {
  clearReminderTimers();
  const nowMs = Date.now();

  for (const prayer of prayers) {
    const delay = msUntilToday(prayer.time, -10);
    if (delay <= 0) {
      log.info(`Пропуск ${prayer.name} (${prayer.time}) — момент напоминания уже прошёл`);
      continue;
    }

    const fireAt = new Date(nowMs + delay).toISOString();
    log.info(`Таймер: ${prayer.name} в ${prayer.time}, напоминание через ${Math.round(delay / 1000)}с (≈ ${fireAt})`);

    const timer = setTimeout(async () => {
      await sendMessage(formatReminder(prayer));
    }, delay);

    reminderTimers.push(timer);
  }
}

async function refreshSchedule(reason) {
  log.info(`Обновление расписания (${reason})`);
  try {
    const prayers = await fetchPrayerTimes(config());
    scheduleReminders(prayers);
  } catch (err) {
    log.error('Не удалось обновить расписание намазов', err);
  }
}

function validateEnv() {
  const required = ['GREEN_API_ID_INSTANCE', 'GREEN_API_TOKEN', 'GREEN_API_GROUP_CHAT_ID'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Заполни .env: отсутствует ${missing.join(', ')}`);
  }
}

async function main() {
  validateEnv();
  log.info(`Карина стартует · ${TIMEZONE} · ${config().city}, ${config().country} · без приветствия`);

  await refreshSchedule('startup');

  cron.schedule(
    '5 0 * * *',
    () => {
      refreshSchedule('daily 00:05').catch((err) => log.error('daily refresh failed', err));
    },
    { timezone: TIMEZONE },
  );

  log.info('Планировщик активен (cron 00:05 + таймеры на намазы)');
}

main().catch((err) => {
  log.error('Fatal startup error', err);
  process.exit(1);
});
