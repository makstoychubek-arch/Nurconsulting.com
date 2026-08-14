/**
 * Живые формулировки для тимчата — как реальные люди, не шаблон-бот.
 * Много вариантов на каждый интент, чтобы не звучать копипастой.
 */

/** Случайная живая формулировка — чтобы не звучать шаблоном. */
export function pick<T>(items: readonly T[], _salt = 0): T {
  if (!items.length) throw new Error("pick: empty");
  return items[Math.floor(Math.random() * items.length)];
}

export function antonConfirmCabinet(human: string): string {
  return pick([
    `Это ж ${human}, да?`,
    `Похоже на ${human} — верно?`,
    `${human}, правильно понял?`,
    `Глянь: кабинет ${human}?`,
    `Это ${human}? Если да — сразу гляну остаток`,
    `${human} имеешь в виду?`,
    `Так, берём ${human}?`,
    `Уточню: ${human}?`,
    `Кажется ${human}. Ок?`,
    `По ${human} копаем?`,
    `${human} — тот?`,
    `Беру ${human}, да?`,
    `Стоп, это ${human}?`,
  ]);
}

export function antonAskCabinets(): string {
  return pick([
    "По какому кабинету смотрим?",
    "Какой кабинет? Жми или напиши",
    "С какого кабинета остаток?",
    "Кабинет какой — база / элиум / уркунбаев…?",
    "Кидай кабинет — база, элиум, zevina…",
    "С какого ИП/кабинета?",
    "Где смотрим остаток?",
    "Кабинет ткни кнопкой или напиши",
    "Нужен кабинет, без него мимо",
    "С какого кабинета копаем?",
    "База? Элиум? Уркунбаев? Скажи",
    "Выбери кабинет — и дальше",
    "Кабинет коротко",
    "Точка какая — база / saai / элиум?",
  ]);
}

export function antonAskWarehouse(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `Ок, ${human}. Какой склад?`,
      `${human} — склад какой?`,
      `Принял ${human}. Куда смотрим — какой склад?`,
      `${human} есть. Склад?`,
      `По ${human} — какой склад FBS?`,
      `${human}. Жми склад`,
    ]);
  }
  return pick([
    `${human}. Какой склад FBS?`,
    `Кабинет ${human}. Склад какой нужен?`,
    `${human} — на каком складе остаток смотрим?`,
    `Склад по ${human}?`,
    `${human}: выбери склад кнопкой`,
    `Куда смотрим в ${human}?`,
    `${human} принял. Склад кидай`,
    `Остаток ${human} — с какого склада?`,
  ]);
}

export function antonAskProduct(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `Ок, ${human}. Какая модель/цвет?`,
      `${human} ясно. Что именно — модель и цвет?`,
      `Есть. Кинь модель+цвет, гляну`,
      `${human}. Товар какой?`,
      `Модель/цвет по ${human}?`,
      `Что ищем в ${human}?`,
    ]);
  }
  return pick([
    `${human}: по какому товару остаток? Модель и цвет`,
    `Кабинет ${human}. Напиши модель/цвет — скажу сколько`,
    `${human} — кидай артикул/модель/цвет`,
    `Что смотрим в ${human}? Модель + цвет`,
    `${human}. Без модели не попаду — напиши коротко`,
    `Товар для ${human}? Например «костюм черный»`,
    `${human}: какая позиция?`,
    `Скажи модель и цвет по ${human}`,
  ]);
}

export function antonWrongCabinet(): string {
  return pick([
    "Ок, какой тогда?",
    "Понял, не тот. Какой нужен?",
    "Ясно. Тогда какой кабинет?",
    "Не тот — кидай правильный",
    "Ок, меняем. Какой кабинет?",
    "Ладно. Кто тогда?",
    "Сбросил. Кабинет заново",
    "Другой значит. Какой?",
  ]);
}

export function antonCancel(): string {
  return pick([
    "Ок, отменил",
    "Ладно, стопнул",
    "Не продолжаю",
    "Стоп, закрыл",
    "Ок, выключаю",
    "Отмена принята",
    "Ладно, не трогаю",
    "Сбросил запрос",
  ]);
}

export function antonStocksLead(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([human, `${human}:`, `По ${human}`, `${human} →`]);
  }
  return pick([
    `${human} · FBS`,
    `${human}, остаток FBS:`,
    `Смотрю ${human}:`,
    `${human} — вот что есть:`,
    `По ${human} на FBS:`,
    `Глянул ${human}:`,
    `${human}, коротко:`,
    `Остатки ${human}:`,
  ]);
}

export function antonNoProduct(human: string, minimal: boolean): string {
  if (minimal) {
    return pick([
      `${human}\nне нашёл такой — кинь модель/цвет точнее`,
      `${human}\nхм, не бьётся. Какая модель и цвет?`,
      `${human}\nмимо. Уточни название`,
      `${human}\nне вижу позицию — напиши иначе`,
      `${human}\nдай модель+цвет ещё раз`,
    ]);
  }
  return pick([
    `${human}: не понял товар. Напиши модель/цвет, например «укороченный костюм черный»`,
    `${human}: такой позиции не вижу. Кинь модель и цвет иначе`,
    `По ${human} не нашёл. Пример: «блузка фонарь белый»`,
    `${human} — уточни товар, слишком общее`,
    `Не попал в артикул по ${human}. Модель + цвет?`,
    `${human}: нет совпадения. Напиши как в карточке`,
    `Хм, по ${human} пусто. Другое название?`,
    `${human}: давай точнее — фасон/цвет`,
  ]);
}

export function alinaSeesSheet(openLines: string[], mode: string): string {
  const head = pick([
    "Да, вижу таблицу на сегодня",
    "Ага, таблица открыта",
    "Смотрю план раздач — на месте",
    "Таблица на месте, гляжу",
    "Вижу план на сегодня",
    "Открыла таблицу",
    "Да, смотрю раздачи",
    "План перед глазами",
    "Есть, таблица живая",
    "Гляжу график — ок",
    "Да, всё вижу",
  ]);
  const modeLine = pick([
    `Сейчас ${mode}`,
    `Режим: ${mode}`,
    `Идёт ${mode}`,
    `По таблице — ${mode}`,
    `Формат сегодня: ${mode}`,
  ]);
  if (!openLines.length) {
    return pick([
      `${head}\n${modeLine}\nСвободных мест сегодня нет`,
      `${head}\n${modeLine}\nПока всё занято / закрыто`,
      `${head}\n${modeLine}\nСлотов свободно нет`,
      `${head}\n${modeLine}\nНа сегодня закрыто`,
      `${head}\n${modeLine}\nПусто по свободным — завтра`,
    ]);
  }
  const listHead = pick(["Открыто:", "Свободно:", "Есть места:", "Что открыто:", "Слоты:"]);
  return [head, modeLine, listHead, ...openLines].join("\n");
}

export function antonWbStockLead(cabinet: string): string {
  return pick([
    `Слышу. ${cabinet}, по складам WB:`,
    `${cabinet} — остатки WB:`,
    `Глянул ${cabinet}:`,
    `${cabinet}, что на складах:`,
    `По ${cabinet}:`,
    `${cabinet} →`,
    `Ок, ${cabinet}:`,
    `Смотрю ${cabinet} на WB:`,
  ]);
}

export function antonAskProductAllCabs(): string {
  return pick([
    "Ок, по всем. Какая модель/цвет?",
    "Все кабинеты. Что именно смотрим?",
    "Принял все. Кинь модель и цвет",
    "По всем кабинетам — какой товар?",
    "Ок. Модель+цвет, пройдусь по всем",
    "Все сразу. Что ищем?",
  ]);
}

export function antonNeedYesNo(human: string): string {
  return pick([
    `${human} — да или нет?`,
    `Это ${human}? Жми да/нет`,
    `Нужен короткий ответ: ${human} — верно?`,
    `${human}? Да / нет`,
    `Подтверди: ${human}?`,
    `Так и оставляем ${human}?`,
  ]);
}

export function antonPickWarehouseAgain(): string {
  return pick([
    "Какой склад? Жми или напиши название",
    "Склад не поймал — выбери ещё раз",
    "Напиши склад или ткни кнопку",
    "Склад заново, плиз",
    "Не понял склад — кнопкой удобнее",
    "Ещё раз склад?",
  ]);
}

export function antonPickCabinetAgain(): string {
  return pick([
    "Не поймал кабинет. Жми кнопку или напиши: база / элиум / уркунбаев…",
    "Кабинет какой? Можно кнопкой",
    "Уточни кабинет — база, элиум, zevina…",
    "Кабинет мимо — ещё раз",
    "Напиши кабинет коротко",
    "Кнопкой выбери кабинет",
  ]);
}

export function antonAskModelColor(): string {
  return pick([
    "Модель и цвет кинь коротко",
    "Что именно? Модель + цвет",
    "Напиши товар: модель и цвет",
    "Фасон/цвет — и гляну",
    "Какая позиция?",
    "Товар одной фразой",
  ]);
}

/** Амина — живые реплики вокруг РК */
export function aminaAskCabinet(): string {
  return pick([
    "Какой кабинет по РК?",
    "РК с какого кабинета?",
    "Кабинет кидай — база / saai / элиум…",
    "Где крутим рекламу?",
    "Кабинет?",
    "Точка по РК какая?",
    "С какого кабинета кампании?",
    "База / элиум / saai — кто?",
  ]);
}

export function aminaConfirmStart(n: number, cabinet: string): string {
  return pick([
    `${cabinet}: запустить ${n} РК? Напиши «да»`,
    `Ок, ${cabinet} — ${n} шт. Жми «да» или «отмена»`,
    `Запускаем ${n} в ${cabinet}? «да» = поехали`,
    `${n} РК · ${cabinet}. Подтверди «да»`,
    `Собрала ${n} по ${cabinet}. Пиши «да»`,
    `${cabinet}: ${n} на старт. «да»?`,
    `Готово к запуску ${n} · ${cabinet}. Нужно «да»`,
  ]);
}

export function aminaWaitingYes(): string {
  return pick([
    "Жду «да» или «отмена»",
    "Нужно короткое «да» — иначе не трогаю",
    "Подтверждение: «да» / «отмена»",
    "Без «да» не запущу",
    "Кидай «да» если ок",
    "Жду короткое «да»",
    "«да» — и жму. «отмена» — стоп",
  ]);
}

/** Сауле — заголовки продаж */
export function sauleSalesLead(cabinet?: string): string {
  if (cabinet) {
    return pick([
      `Сауле · ${cabinet}`,
      `${cabinet} — продажи:`,
      `Глянула ${cabinet}:`,
      `По ${cabinet}:`,
      `${cabinet}, коротко:`,
      `${cabinet} →`,
      `Цифры ${cabinet}:`,
      `Ок, ${cabinet}:`,
    ]);
  }
  return pick([
    "Сауле · продажи",
    "Продажи по кабинетам:",
    "Сводка продаж:",
    "Что по заказам:",
    "Коротко по цифрам:",
    "По продажам:",
    "Заказы/выкупы:",
  ]);
}

/** Сауле — цена: показать до/после и спросить */
export function saulePriceAsk(
  cabinet: string,
  vendor: string,
  before: string,
  after: string,
): string {
  const head = pick([
    `${cabinet} · ${vendor}`,
    `${vendor} (${cabinet})`,
    `Нашла: ${cabinet} · ${vendor}`,
    `Есть: ${vendor} · ${cabinet}`,
    `Вот: ${cabinet} / ${vendor}`,
  ]);
  const mid = pick([
    `до скидки ${before} · после ${after}`,
    `до ${before} · после ${after}`,
    `сейчас: до ${before}, после ${after}`,
  ]);
  const ask = pick([
    'что меняем — до или после? и новую цену',
    'до или после — и цену числом',
    'пиши: «после 3000» или «до 5000»',
    'новая цена: «после …» или «до …»',
    'кинь «после 2800» — сохраню',
  ]);
  return [head, mid, ask].join('\n');
}

export function saulePriceSaved(label: string, money: string): string {
  return pick([
    `сохранила · ${label} ${money}`,
    `готово · ${label} ${money}`,
    `ок, сохранила · ${label} ${money}`,
    `зафиксировала · ${label} ${money}`,
    `есть · ${label} ${money}`,
    `сделала · ${label} ${money}`,
  ]);
}

export function sauleAskProduct(): string {
  return pick([
    'Какой артикул? Модель/цвет или nm.',
    'Что меняем — модель и цвет, или nm?',
    'Кинь товар: лапша / фонарь / жилетка… или nm',
    'Артикул коротко: фасон + цвет',
    'Какую позицию? Можно по-человечески',
    'Товар одной фразой — и покажу до/после',
  ]);
}

export function sauleAmbiguousProducts(lines: string[]): string {
  const head = pick([
    'Несколько похожих — какой номер?',
    'Нашла несколько. Какой?',
    'Уточни номер:',
    'Близко несколько — ткни номер',
    'Какой из этих?',
  ]);
  return [head, ...lines].join('\n');
}

export function karinaNewsReact(title: string): string {
  const head = pick([
    'Карина · новости',
    'Свежее:',
    'Глянула:',
    'По площадкам:',
  ]);
  return pick([
    `${head}\n${title}\nСауле / Амина — как это у нас?`,
    `${head}\n«${title}»\nКто задевает — кидайте по зоне`,
    `${head}\n${title}\nКоротко: что делаем?`,
  ]);
}

export function teamAck(): string {
  return pick([
    'ага',
    'угу',
    'норм',
    'ок',
    'поняла',
    'принято',
    'ща',
    'есть',
  ]);
}

/** Алина — товар / слот */
export function alinaAskProduct(): string {
  return pick([
    'Какой товар? Цвет/модель — как в объявлении',
    'По какому артикулу / модели раздача?',
    'Напиши товар коротко: фонарь белый, лапша…',
    'Какую позицию берём?',
  ]);
}

export function alinaProductFound(name: string, slots?: number): string {
  if (slots != null) {
    return pick([
      `${name} — свободно ${slots}`,
      `Беру ${name}. Мест: ${slots}`,
      `${name} ок, слотов ${slots}`,
    ]);
  }
  return pick([
    `${name} — нашла`,
    `Ок, ${name}`,
    `Беру ${name}`,
  ]);
}

/** Муха — визуал по товару */
export function muhaAskProduct(): string {
  return pick([
    'Какой товар снимаем/рисуем? Модель + цвет',
    'Опиши позицию: фасон, цвет, вайб',
    'Что на фото — артикул или коротко модель/цвет?',
    'Кинь товар одной фразой',
  ]);
}

export function muhaPhotoBusy(): string {
  return pick([
    'Генерирую, минуту…',
    'Рисую, подожди чуть',
    'Ок, кручу картинку…',
    'Минуту — собираю кадр',
  ]);
}

export function muhaPhotoFail(): string {
  return pick([
    'Не вышло с фото. Опиши товар ещё: цвет, фасон, фон',
    'Сбой генерации. Кинь модель/цвет подробнее — попробую снова',
    'Картинку не собрал. Ещё раз коротко: что на кадре?',
    'Мимо. Уточни вайб: свет / ракурс / фон',
  ]);
}

export function muhaPhotoReady(): string {
  return pick([
    'Готово. Иначе — скажи свет/ракурс/фон',
    'Вот кадр. Правки — одной фразой',
    'Скинул. Нужен другой вайб — пиши',
    'Фото на месте. Докрутить?',
  ]);
}

/** Амина — РК привязанная к товару */
export function aminaAskProduct(): string {
  return pick([
    'По какому товару РК? Модель/цвет или nm',
    'Артикул кидай — подтяну кампании',
    'Какая позиция в рекламе?',
    'Товар коротко: лапша белая / жл темносиний…',
  ]);
}

/** Карина — координаторские реплики */
export function karinaHandoff(who: string, why: string): string {
  return pick([
    `${who}, глянь: ${why}`,
    `${who} — твоя зона. ${why}`,
    `Кидаю ${who}: ${why}`,
    `${who}, подхвати: ${why}`,
    `${who}, коротко по ${why}`,
    `${who} — твоё. ${why}`,
    `Эй ${who}, ${why}`,
    `${who}, на тебе: ${why}`,
  ]);
}

export function karinaVerdict(line: string): string {
  return pick([
    `Вердикт: ${line}`,
    `Коротко: ${line}`,
    `Итого: ${line}`,
    `Так: ${line}`,
    line,
  ]);
}
