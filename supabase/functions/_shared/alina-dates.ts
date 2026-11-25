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
