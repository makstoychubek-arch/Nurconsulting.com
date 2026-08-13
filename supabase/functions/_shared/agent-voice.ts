/**
 * Живые формулировки для тимчата — как реальные люди, не шаблон-бот.
 */

/** Случайная живая формулировка — чтобы не звучать шаблоном. */
export function pick<T>(items: readonly T[], _salt = 0): T {
  if (!items.length) throw new Error('pick: empty');
  return items[Math.floor(Math.random() * items.length)];
}

export function antonConfirmCabinet(human: string): string {
  return pick([
    `Это ж ${human}, да?`,
    `Похоже на ${human} — верно?`,
    `${human}, правильно понял?`,
    `Глянь: кабинет ${human}?`,
    `Это ${human}? Если да — сразу гляну остаток`,
  ]);
}

export function antonAskCabinets(): string {
  return pick([
    'По какому кабинету смотрим?',
    'Какой кабинет? Жми или напиши',
    'С какого кабинета остаток?',
    'Кабинет какой — база / элиум / уркунбаев…?',
  ]);
}

export function antonAskWarehouse(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `Ок, ${human}. Какой склад?`,
      `${human} — склад какой?`,
      `Принял ${human}. Куда смотрим — какой склад?`,
    ]);
  }
  return pick([
    `${human}. Какой склад FBS?`,
    `Кабинет ${human}. Склад какой нужен?`,
    `${human} — на каком складе остаток смотрим?`,
  ]);
}

export function antonAskProduct(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `Ок, ${human}. Какая модель/цвет?`,
      `${human} ясно. Что именно — модель и цвет?`,
      `Есть. Кинь модель+цвет, гляну`,
    ]);
  }
  return pick([
    `${human}: по какому товару остаток? Модель и цвет`,
    `Кабинет ${human}. Напиши модель/цвет — скажу сколько`,
  ]);
}

export function antonWrongCabinet(): string {
  return pick([
    'Ок, какой тогда?',
    'Понял, не тот. Какой нужен?',
    'Ясно. Тогда какой кабинет?',
  ]);
}

export function antonCancel(): string {
  return pick([
    'Ок, отменил',
    'Ладно, стопнул',
    'Не продолжаю',
  ]);
}

export function antonStocksLead(human: string, minimal: boolean): string {
  if (minimal) return human;
  return pick([
    `${human} · FBS`,
    `${human}, остаток FBS:`,
    `Смотрю ${human}:`,
  ]);
}

export function antonNoProduct(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `${human}\nне нашёл такой — кинь модель/цвет точнее`,
      `${human}\nхм, не бьётся. Какая модель и цвет?`,
    ]);
  }
  return `${human}: не понял товар. Напиши модель/цвет, например «укороченный костюм черный»`;
}

export function alinaSeesSheet(openLines: string[], mode: string): string {
  const head = pick([
    'Да, вижу таблицу на сегодня',
    'Ага, таблица открыта',
    'Смотрю план раздач — на месте',
  ]);
  const modeLine = pick([
    `Сейчас ${mode}`,
    `Режим: ${mode}`,
  ]);
  if (!openLines.length) {
    return pick([
      `${head}\n${modeLine}\nСвободных мест сегодня нет`,
      `${head}\n${modeLine}\nПока всё занято / закрыто`,
    ]);
  }
  return [head, modeLine, 'Открыто:', ...openLines].join('\n');
}

export function antonWbStockLead(cabinet: string): string {
  return pick([
    `Слышу. ${cabinet}, по складам WB:`,
    `${cabinet} — остатки WB:`,
    `Глянул ${cabinet}:`,
  ]);
}

export function antonAskProductAllCabs(): string {
  return pick([
    'Ок, по всем. Какая модель/цвет?',
    'Все кабинеты. Что именно смотрим?',
    'Принял все. Кинь модель и цвет',
  ]);
}

export function antonNeedYesNo(human: string): string {
  return pick([
    `${human} — да или нет?`,
    `Это ${human}? Жми да/нет`,
    `Нужен короткий ответ: ${human} — верно?`,
  ]);
}

export function antonPickWarehouseAgain(): string {
  return pick([
    'Какой склад? Жми или напиши название',
    'Склад не поймал — выбери ещё раз',
    'Напиши склад или ткни кнопку',
  ]);
}

export function antonPickCabinetAgain(): string {
  return pick([
    'Не поймал кабинет. Жми кнопку или напиши: база / элиум / уркунбаев…',
    'Кабинет какой? Можно кнопкой',
    'Уточни кабинет — база, элиум, zevina…',
  ]);
}

export function antonAskModelColor(): string {
  return pick([
    'Модель и цвет кинь коротко',
    'Что именно? Модель + цвет',
    'Напиши товар: модель и цвет',
  ]);
}
