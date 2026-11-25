// Даты из слов клиента без внешних зависимостей (чтобы проверять в тестах).
const WD: Array<[RegExp, number]> = [[/понедельник/, 1], [/вторник/, 2], [/(?:^|\s)сред[ауы]?(?=\s|$|[.,!?])/, 3], [/четверг/, 4], [/пятниц/, 5], [/суббот/, 6], [/воскресень/, 0]];

/** «Вторник», «в среду», «до пятницы»: ближайший такой день после сегодняшнего (по Москве) в виде дд.мм.гггг, иначе пусто. */
export function weekdayDate(t: string, now = Date.now()): string {
  for (const [re, wd] of WD) {
    if (re.test(t)) {
      const todayWd = new Date(now + 3 * 3600_000).getUTCDay();
      let add = (wd - todayWd + 7) % 7;
      if (add === 0) add = 7;
      const d = new Date(now + 3 * 3600_000 + add * 86400_000);
      return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
    }
  }
  return '';
}

const MONTHS: Array<[RegExp, number]> = [[/январ/, 1], [/феврал/, 2], [/март/, 3], [/апрел/, 4], [/(?:^|\s)мая/, 5], [/июн/, 6], [/июл/, 7], [/август/, 8], [/сентябр/, 9], [/октябр/, 10], [/ноябр/, 11], [/декабр/, 12]];

/** Дата забора из слов клиента: «1 числа», «2 декабря», «до 3.12»: дд.мм.гггг по Москве, иначе пусто. День без месяца: ближайший такой день после сегодняшнего. */
export function pickupDateFromText(text: string, now = Date.now()): string {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const m = t.match(/(?:^|[^\d])(\d{1,2})\s*(?:-?го\s+)?(?:числа|число)?(?:[.\/](\d{1,2}))?(?=\s|$|[?.,!])/);
  if (!m) return '';
  const day = Number(m[1]);
  if (day < 1 || day > 31) return '';
  const today = new Date(now + 3 * 3600_000);
  let month = m[2] ? Number(m[2]) : 0;
  if (!month) for (const [re, n] of MONTHS) if (re.test(t)) { month = n; break; }
  let year = today.getUTCFullYear();
  if (!month) {
    month = today.getUTCMonth() + 1;
    if (day <= today.getUTCDate()) { month += 1; if (month > 12) { month = 1; year += 1; } }
  } else if (month < today.getUTCMonth() + 1 - 1) year += 1;
  if (month < 1 || month > 12) return '';
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}
