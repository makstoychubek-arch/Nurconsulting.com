'use strict';

/** Фард-ракаты (ханафи / Центральная Азия). */
const FARD_RAKATS = {
  Fajr: 2,
  Dhuhr: 4,
  Asr: 4,
  Maghrib: 3,
  Isha: 4,
};

/**
 * Текст напоминания: фард + окно времени (с … до …).
 * @param {{ key: string, name: string, time: string, until: string, untilLabel: string }} prayer
 */
function formatReminder(prayer) {
  const rakats = FARD_RAKATS[prayer.key] ?? '?';
  const rakatWord = rakatLabel(rakats);
  return [
    `Через 10 минут время намаза ${prayer.name} (${prayer.time}) 🕌`,
    '',
    `Фард: ${rakats} ${rakatWord}`,
    `Начало: ${prayer.time}`,
    `До: ${prayer.until} (${prayer.untilLabel})`,
    '',
    'Не пропустите намаз.',
  ].join('\n');
}

function rakatLabel(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'ракаат';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'раката';
  return 'ракаатов';
}

module.exports = { formatReminder, FARD_RAKATS };
