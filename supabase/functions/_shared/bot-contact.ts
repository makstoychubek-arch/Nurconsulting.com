/**
 * Контакт бот↔человек: «услышал → уточнил → сделал».
 * Чтобы друг друга понимали: эхо намерения, мягкие вопросы, без канцелярита.
 */

export function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/** Короткие «приняла» — перед действием или в начале ответа. */
export function contactAck(taskLabel: string): string {
  const t = taskLabel.trim();
  return pickOne([
    `Ок, ${t}.`,
    `Поняла: ${t}.`,
    `Приняла — ${t}.`,
    `Слышу: ${t}. Сейчас.`,
    `Ясно, ${t}.`,
    `Договорились: ${t}.`,
  ]);
}

/** Если артикула не хватает — не «ошибка», а нормальный вопрос. */
export function contactNeedArticle(examples: string[]): string {
  const ex = examples.slice(0, 2).join('» или «');
  return pickOne([
    `Уточни артикул, пожалуйста. Например: «${ex}».`,
    `Без номера карточки мимо — кинь арт. Можно так: «${examples[0]}».`,
    `Какой nm/артикул? Напиши число или «${examples[0]}».`,
    `Почти поняла задачу, не хватает артикула. Пример: «${ex}».`,
    `Скажи артикул — и сразу сделаю. Формат: «${examples[0]}».`,
  ]);
}

/** Средняя уверенность: озвучить догадку и всё равно помочь / спросить. */
export function contactSoftCheck(guess: string): string {
  return pickOne([
    `Если правильно поняла — ${guess}. Если не то, перефразируй.`,
    `Беру так: ${guess}. Поправь, если ошиблась.`,
    `Кажется, нужно: ${guess}. Ок? Делаю.`,
    `Правильно: ${guess}? Иду по этому.`,
    `Считываю как «${guess}». Пиши иначе — поправлю курс.`,
  ]);
}

/** Непонятный запрос — приглашение к диалогу, не отшив. */
export function contactLost(hints: string[]): string {
  const h = hints.map((x) => `«${x}»`).join(', ');
  return pickOne([
    `Не уверенно считала фразу. Можно проще: ${h}.`,
    `Давай ещё раз по-простому — например ${h}.`,
    `Я рядом, но формулировку не поймала. Попробуй: ${h}.`,
    `Почти, но мимо. Напиши как другу: ${h}.`,
    `Уточни задачу одним из вариантов: ${h}.`,
  ]);
}

/** После успеха — короткий человеческий хвост. */
export function contactDoneTail(): string {
  return pickOne([
    'Если нужно ещё — напиши.',
    'Что-то ещё по этому?',
    'Готово. Могу сразу следующий шаг.',
    'Ок, на связи.',
    'Скажи, если копнуть глубже.',
  ]);
}

/** Подпись «как я тебя поняла» для конкретного интента А/Б. */
export function abTaskLabel(intent: string, nmId?: number): string {
  const nm = nmId ? ` арт. ${nmId}` : '';
  switch (intent) {
    case 'list':
      return 'смотрю активные А/Б';
    case 'detail':
      return `статус теста${nm}`;
    case 'report':
      return `отчёт с цифрами и фото${nm}`;
    case 'winner':
      return `кто лидирует${nm}`;
    case 'rotate':
      return `смена главного фото${nm}`;
    case 'how_start':
      return 'как запустить новый тест';
    case 'help':
      return 'шпаргалка по командам';
    default:
      return 'запрос по А/Б';
  }
}

export type ContactChannel = 'ab_tests' | 'sales' | 'ads' | 'penalties' | 'generic';

export function channelHelpContact(channel: ContactChannel): string {
  if (channel === 'ab_tests') {
    return pickOne([
      [
        'Давай на одной волне 👇',
        'Можешь писать как обычно:',
        '• «что крутится» / тесты',
        '• «как там 123…»',
        '• «скинь отчёт 123…»',
        '• «смени фото 123…»',
        '• «кто лучше 123…»',
        '',
        'Я повторю, как поняла, и сделаю. Если промахнусь — поправь словами.',
      ].join('\n'),
      [
        'Контакт простой: ты — своими словами, я — коротко подтверждаю и делаю.',
        'Примеры: тесты · как там &lt;арт&gt; · отчёт &lt;арт&gt; · смени фото &lt;арт&gt;',
        'Сайт для запуска: https://nurcon.kg/ab-testing',
      ].join('\n'),
    ]);
  }
  if (channel === 'sales') {
    return pickOne([
      'Пиши дату/кабинет своими словами: «вчера Baza», «продажи 12.07». Я подтвержу период и посчитаю.',
      'Формат свободный: вчера / сегодня / 19.07 + кабинет. Если что — уточню.',
    ]);
  }
  if (channel === 'ads') {
    return pickOne([
      'Можно: «баланс», «реклама вчера», «рк 12.07». Сначала скажу, что услышала.',
      'Баланс или день по РК — напиши как удобно, я уточню если дата кривая.',
    ]);
  }
  if (channel === 'penalties') {
    return pickOne([
      'Штрафы: «вчера», «штрафы 19.07». Подтвержу дату и выгружу.',
      'Скажи день — пришлю удержания. Без даты возьму вчера.',
    ]);
  }
  return 'Напиши задачу проще — уточню и сделаю.';
}

/** Склеить ack + тело ответа (без лишней пустоты). */
export function withContact(ack: string, body: string): string {
  const a = String(ack || '').trim();
  const b = String(body || '').trim();
  if (!a) return b;
  if (!b) return a;
  if (b.startsWith(a)) return b;
  return `${a}\n\n${b}`;
}
