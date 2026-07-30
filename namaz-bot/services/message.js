'use strict';

/**
 * Ханафи / Центральная Азия (сунна муаккада + для Аср сунна до фарда).
 * Порядок: сунна до → фард → сунна после → витр (Иша).
 */
const PRAYER_RAKATS = {
  Fajr: { before: 2, fard: 2, after: 0, witr: 0 },
  Dhuhr: { before: 4, fard: 4, after: 2, witr: 0 },
  Asr: { before: 4, fard: 4, after: 0, witr: 0 },
  Maghrib: { before: 0, fard: 3, after: 2, witr: 0 },
  Isha: { before: 0, fard: 4, after: 2, witr: 3 },
};

/**
 * Короткое напоминание с индивидуальными ракатами.
 * @param {{ key: string, name: string, time: string, until: string, untilLabel: string }} prayer
 */
function formatReminder(prayer) {
  const r = PRAYER_RAKATS[prayer.key] || { before: 0, fard: 4, after: 0, witr: 0 };
  return [
    `🕌 ${prayer.name} через 10 мин (${prayer.time})`,
    formatRakats(r),
    `с ${prayer.time} до ${prayer.until}`,
  ].join('\n');
}

function formatRakats(r) {
  const parts = [];
  if (r.before) parts.push(`${r.before} сунна`);
  parts.push(`${r.fard} фард`);
  if (r.after) parts.push(`${r.after} сунна`);
  if (r.witr) parts.push(`${r.witr} витр`);
  return parts.join(' + ');
}

module.exports = { formatReminder, PRAYER_RAKATS, formatRakats };
