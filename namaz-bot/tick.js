'use strict';

/**
 * Одноразовый тик: если сейчас (Бишкек) ровно «намаз − 10 мин» — шлёт напоминание.
 * Для cron / GitHub Actions / ручного запуска. Без приветствия.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { fetchPrayerTimes } = require('./services/prayerTimes');
const { formatReminder } = require('./services/message');
const { sendMessage } = require('./services/whatsapp');
const log = require('./services/logger');

const TIMEZONE = process.env.TIMEZONE || 'Asia/Bishkek';
const SENT_FILE = path.join(__dirname, '.data', 'sent.json');

function nowParts() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get('hour');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function shiftHm(hhmm, delta) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + delta;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function loadSent() {
  try {
    return JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSent(map) {
  fs.mkdirSync(path.dirname(SENT_FILE), { recursive: true });
  fs.writeFileSync(SENT_FILE, JSON.stringify(map, null, 2));
}

async function main() {
  const required = ['GREEN_API_ID_INSTANCE', 'GREEN_API_TOKEN', 'GREEN_API_GROUP_CHAT_ID'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);

  const now = nowParts();
  const dateKey = `${now.year}-${pad(now.month)}-${pad(now.day)}`;
  const nowHm = `${pad(now.hour)}:${pad(now.minute)}`;

  const prayers = await fetchPrayerTimes({
    city: process.env.CITY || 'Bishkek',
    country: process.env.COUNTRY || 'Kyrgyzstan',
    method: process.env.PRAYER_METHOD || '3',
    timezone: TIMEZONE,
  });

  const sent = loadSent();
  const actions = [];

  for (const prayer of prayers) {
    const remindHm = shiftHm(prayer.time, -10);
    if (remindHm !== nowHm) continue;

    const eventKey = `${dateKey}:${prayer.key}`;
    if (sent[eventKey]) {
      actions.push(`skip_dup:${prayer.key}`);
      continue;
    }

    const ok = await sendMessage(formatReminder(prayer));
    if (ok) {
      sent[eventKey] = new Date().toISOString();
      saveSent(sent);
      actions.push(`sent:${prayer.key}`);
    } else {
      actions.push(`failed:${prayer.key}`);
    }
  }

  log.info(`tick ${nowHm} → ${actions.join(', ') || 'noop'}`);
  console.log(JSON.stringify({ ok: true, now: nowHm, actions }));
}

main().catch((err) => {
  log.error('tick failed', err);
  process.exit(1);
});
