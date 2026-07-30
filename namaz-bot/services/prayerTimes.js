'use strict';

const log = require('./logger');

const PRAYERS = [
  { key: 'Fajr', name: 'Фаджр' },
  { key: 'Dhuhr', name: 'Зухр' },
  { key: 'Asr', name: 'Аср' },
  { key: 'Maghrib', name: 'Магриб' },
  { key: 'Isha', name: 'Иша' },
];

/**
 * Запрос времён намаза на сегодня через Aladhan API.
 * При ошибке — до 5 попыток с паузой 5 минут.
 */
async function fetchPrayerTimes(config) {
  const { city, country, method, timezone } = config;
  const url =
    `https://api.aladhan.com/v1/timingsByCity` +
    `?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}` +
    `&method=${encodeURIComponent(method)}` +
    `&timezonestring=${encodeURIComponent(timezone)}`;

  const maxAttempts = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Aladhan HTTP ${res.status}: ${await res.text()}`);
      }
      const body = await res.json();
      if (body.code !== 200 || !body.data?.timings) {
        throw new Error(`Aladhan unexpected response: ${JSON.stringify(body)}`);
      }

      const timings = body.data.timings;
      const date = body.data.date?.readable || 'today';
      const prayers = PRAYERS.map(({ key, name }) => {
        const raw = String(timings[key] || '').trim();
        // Aladhan иногда возвращает "13:30 (EEST)" — берём только HH:MM
        const hhmm = raw.slice(0, 5);
        if (!/^\d{2}:\d{2}$/.test(hhmm)) {
          throw new Error(`Invalid time for ${key}: "${raw}"`);
        }
        return { key, name, time: hhmm };
      });

      log.info(`Расписание намазов на ${date}: ${prayers.map((p) => `${p.name} ${p.time}`).join(', ')}`);
      return prayers;
    } catch (err) {
      lastError = err;
      log.error(`Aladhan attempt ${attempt}/${maxAttempts} failed`, err);
      if (attempt < maxAttempts) {
        await sleep(5 * 60 * 1000);
      }
    }
  }

  throw lastError || new Error('Aladhan: all attempts failed');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchPrayerTimes, PRAYERS };
