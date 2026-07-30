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
 * Для каждого намаза считает окно: начало = время намаза, до = начало следующего
 * (для Фаджр — до восхода Sunrise).
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
      const sunrise = parseHm(timings.Sunrise);

      const base = PRAYERS.map(({ key, name }) => ({
        key,
        name,
        time: parseHm(timings[key]),
      }));

      const prayers = base.map((p, i) => {
        if (p.key === 'Fajr') {
          return { ...p, until: sunrise, untilLabel: 'восход' };
        }
        if (p.key === 'Isha') {
          return { ...p, until: base[0].time, untilLabel: 'Фаджр след. дня' };
        }
        const next = base[i + 1];
        return { ...p, until: next.time, untilLabel: next.name };
      });

      log.info(
        `Расписание намазов на ${date}: ` +
          prayers.map((p) => `${p.name} ${p.time}–${p.until}`).join(', '),
      );
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

function parseHm(raw) {
  const hhmm = String(raw || '').trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error(`Invalid time: "${raw}"`);
  }
  return hhmm;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchPrayerTimes, PRAYERS };
