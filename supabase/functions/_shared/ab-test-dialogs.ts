/**
 * А/Б тесты — понимание человеческого языка + живые варианты ответов.
 * Каждый сценарий: 5 разных формулировок, чтобы бот не звучал как шаблон.
 */

export type AbIntent =
  | 'list'
  | 'detail'
  | 'report'
  | 'rotate'
  | 'winner'
  | 'help'
  | 'how_start'
  | 'unknown';

export type AbParsed = {
  intent: AbIntent;
  nmId?: number;
  confidence: number;
};

export function pickVariant<T>(variants: readonly T[]): T {
  return variants[Math.floor(Math.random() * variants.length)]!;
}

/** Вытащить артикул из свободной фразы. */
export function extractNmId(text: string): number | undefined {
  const t = String(text || '');
  const labeled = t.match(
    /(?:^|[\s,.:;!?/\\|])(?:арт(?:икул)?\.?|nm\.?|nmid|тест(?:а|у|ом)?|карточк[а-яё]*|товар[а-яё]*|sku)\s*[:#№]?\s*(\d{5,12})(?=$|[\s,.:;!?/\\|])/i,
  );
  if (labeled) return Number(labeled[1]);
  const afterVerb = t.match(
    /(?:^|[\s,.:;!?/\\|])(?:отч[её]т|ротац[а-яё]*|смен[а-яё]*|переключ[а-яё]*|результат[а-яё]*|статус|как\s+там)\s+(?:по\s+)?(?:арт\.?\s*)?(\d{5,12})(?=$|[\s,.:;!?/\\|])/i,
  );
  if (afterVerb) return Number(afterVerb[1]);
  // одиночный артикул в коротком сообщении
  const bare = t.match(/^\s*(?:арт\.?\s*)?(\d{5,12})\s*[?.!]?\s*$/i);
  if (bare) return Number(bare[1]);
  const any = t.match(/(?:^|[\s,.:;!?/\\|])(\d{6,12})(?=$|[\s,.:;!?/\\|])/);
  if (any && !/\d{1,2}[./]\d{1,2}/.test(t)) return Number(any[1]);
  return undefined;
}

/** Распознать намерение человека в чате А/Б. */
export function parseAbIntent(raw: string): AbParsed {
  const text = String(raw || '').trim();
  const lower = text.toLowerCase().replace(/ё/g, 'е');
  const nmId = extractNmId(text);

  if (!text) return { intent: 'help', confidence: 0.2 };

  // помощь / как пользоваться
  if (
    /^(help|помощь|\?|команды)$/i.test(text.trim()) ||
    /(^|[^а-яa-z0-9])(help|помощь|что\s+умеешь|как\s+пользоваться|какие\s+команды|что\s+можно|подскажи\s+как)([^а-яa-z0-9]|$)/.test(
      lower,
    )
  ) {
    return { intent: 'help', nmId, confidence: 0.95 };
  }

  // как запустить
  if (
    /(как\s+(запуст|запуск|создать|сделать|начать)[а-яё]*|запусти\s+тест|хочу\s+запустить|новый\s+тест|создай\s+тест)/.test(
      lower,
    )
  ) {
    return { intent: 'how_start', nmId, confidence: 0.9 };
  }

  // ротация
  if (
    /(ротац|смени\s+фото|поменяй\s+фото|переключ[а-яё]*\s+(вариант|фото)|следующ[а-яё]*\s+(вариант|фото)|крутани|прокрути|ротани)/.test(
      lower,
    )
  ) {
    return { intent: 'rotate', nmId, confidence: nmId ? 0.95 : 0.7 };
  }

  // отчёт / результаты
  if (
    /(отчет|отчёт|результат|сводк|итог|цифр|статистик|покажи\s+цифр|скинь\s+отчет|скинь\s+отчёт)/.test(
      lower,
    )
  ) {
    return { intent: 'report', nmId, confidence: nmId ? 0.95 : 0.75 };
  }

  // победитель
  if (/(победител|выигрыва|кто\s+лучше|лидер|кто\s+впереди|какой\s+вариант\s+лучше)/.test(lower)) {
    return { intent: 'winner', nmId, confidence: nmId ? 0.95 : 0.8 };
  }

  // детали по артикулу / статусу одного теста
  if (
    nmId &&
    /(тест|арт|статус|как\s+там|что\s+с|карточка|варианты|ctr|показы)/.test(lower)
  ) {
    return { intent: 'detail', nmId, confidence: 0.9 };
  }
  if (nmId && text.replace(/\D/g, '').length >= 6 && text.length <= 24) {
    return { intent: 'detail', nmId, confidence: 0.85 };
  }

  // список
  if (
    /(тесты|какие\s+тесты|что\s+крутится|активн[а-яё]*\s+тест|список\s+тест|что\s+тестиру|покажи\s+тест|все\s+тест|а\s*\/\s*б|ab\s*тест)/.test(
      lower,
    ) ||
    /^(тесты|тест|ab|а\/б)\s*[?.!]?\s*$/i.test(text.trim())
  ) {
    return { intent: 'list', confidence: 0.9 };
  }

  if (nmId) return { intent: 'detail', nmId, confidence: 0.6 };
  if (/(тест|ab|а\s*\/\s*б)/.test(lower)) return { intent: 'list', confidence: 0.5 };

  return { intent: 'unknown', nmId, confidence: 0.2 };
}

export function wantsAbQuery(text: string): boolean {
  const p = parseAbIntent(text);
  if (p.confidence >= 0.5) return true;
  const lower = text.toLowerCase();
  return /(тест|тесты|ab|а\s*\/\s*б|арт|nm|отчет|отчёт|ротац|вариант|фото\s+на\s+карточ|победител|ctr|крутится)/i.test(
    lower,
  );
}

// ─── 5 вариантов на каждый сценарий ─────────────────────────────────────────

const HELP_VARIANTS = [
  [
    '🧪 <b>А/Б — коротко</b>',
    '',
    '• <code>тесты</code> — что сейчас крутится',
    '• <code>тест 123</code> / просто артикул — статус + варианты',
    '• <code>отчёт 123</code> — цифры + фото в чат',
    '• <code>ротация 123</code> — сменить главное фото сейчас',
    '',
    'Можно по-человечески: «как там 123», «кто выигрывает», «смени фото».',
    'Сайт: https://nurcon.kg/ab-testing',
  ].join('\n'),
  [
    'Ок, по А/Б умею так:',
    '',
    'список — <code>тесты</code>',
    'по артикулу — <code>тест 456</code> или просто номер',
    'отчёт с фото — <code>отчёт 456</code>',
    'сменить фото — <code>ротация 456</code>',
    '',
    'Запуск нового — на сайте https://nurcon.kg/ab-testing',
  ].join('\n'),
  [
    'Пиши как удобно 👇',
    '«какие тесты» · «статус 789» · «скинь отчёт по 789» · «переключи фото 789»',
    '',
    'Или команды: <code>тесты</code> / <code>тест арт</code> / <code>отчёт арт</code> / <code>ротация арт</code>',
  ].join('\n'),
  [
    '🧪 Этот чат — про А/Б фото.',
    'Спрошу список, статус, отчёт с вариантами или принудительную ротацию.',
    'Пример: <code>как там 123456789</code>',
    'Создать тест: https://nurcon.kg/ab-testing',
  ].join('\n'),
  [
    'Нужен список? → <code>тесты</code>',
    'Цифры + фото? → <code>отчёт &lt;арт&gt;</code>',
    'Сменить главное фото? → <code>ротация &lt;арт&gt;</code>',
    'Кто лидирует? → <code>кто лучше &lt;арт&gt;</code>',
  ].join('\n'),
] as const;

const HOW_START_VARIANTS = [
  'Запуск только с сайта: https://nurcon.kg/ab-testing → «Создать А/Б тест» → карточка → ≥2 фото → старт. Сюда сами прилетят варианты и отчёты.',
  'Новый тест крутим на nurcon.kg/ab-testing. Минимум 2 фото, интервал от 60 мин. После старта альбом вариантов придёт в этот чат.',
  'Из Telegram новый тест не создаём (нужны фото/РК). Открой https://nurcon.kg/ab-testing, собери варианты — дальше отчёты уже здесь.',
  'Схема: сайт → мастер А/Б → артикул + фото → «Создать тест». Бот здесь показывает статус, отчёт и может сменить фото.',
  'Чтобы запустить: зайди на https://nurcon.kg/ab-testing, загрузи 2+ варианта. Когда тест поедет — напиши «тесты» или артикул.',
] as const;

const LIST_EMPTY_VARIANTS = [
  '🧪 Сейчас активных А/Б нет.\nЗапуск — https://nurcon.kg/ab-testing\nПосле старта варианты и отчёты приходят сюда.',
  'Пусто: ни одного живого теста.\nСоздай на сайте https://nurcon.kg/ab-testing — сюда прилетит альбом вариантов.',
  'Активных тестов нет. Завершённых тоже не вижу.\nНовый — на https://nurcon.kg/ab-testing.',
  'Пока тишина по А/Б. Когда запустите тест на сайте, сюда сами придут фото и отчёты.',
  'Нет активных. Напиши «как запустить» — подскажу шаги, или сразу https://nurcon.kg/ab-testing',
] as const;

const LIST_HEADER_VARIANTS = [
  '🧪 <b>Сейчас по А/Б</b>',
  '🧪 <b>Активные тесты</b>',
  'Вот что крутится:',
  '📋 <b>Список А/Б</b>',
  'Сводка по тестам:',
] as const;

const NOT_FOUND_VARIANTS = (nm: number) =>
  [
    `🧪 По арт. ${nm} теста не нашла — ни активного, ни свежего завершённого.`,
    `Нет А/Б по ${nm}. Проверь артикул или список: <code>тесты</code>`,
    `Арт. ${nm} в тестах не числится. Может, ещё не запускали?`,
    `Пусто по ${nm}. Запуск — на сайте, статус — командой <code>тесты</code>.`,
    `Не вижу тест ${nm}. Если только создали — подожди секунду и спроси ещё раз.`,
  ] as const;

const NEED_NM_VARIANTS = (what: string) =>
  [
    `Уточни артикул — без него не попаду. Например: «${what} 123456789».`,
    `Почти поняла задачу («${what}»), не хватает номера карточки. Кинь арт.`,
    `Какой nm? Можно просто число или «${what} 123…».`,
    `Скажи артикул своими словами — я подхвачу. Пример: <code>${what} 123456789</code>`,
    `Без арта мимо. Напиши: «${what} &lt;артикул&gt;» — и сразу сделаю.`,
  ] as const;

const DETAIL_HEADER_VARIANTS = (name: string, nm: number) =>
  [
    `🧪 <b>${name}</b> · арт. ${nm}`,
    `Статус А/Б: <b>${name}</b> (${nm})`,
    `По карточке ${nm} — <b>${name}</b>`,
    `Смотрю тест <b>${name}</b> · ${nm}`,
    `А/Б по ${nm}: <b>${name}</b>`,
  ] as const;

const REPORT_HEADER_VARIANTS = (name: string, nm: number) =>
  [
    `📊 Отчёт: <b>${name}</b> · арт. ${nm}`,
    `Цифры по А/Б <b>${name}</b> (${nm})`,
    `Результаты · ${nm} · <b>${name}</b>`,
    `Сводка теста <b>${name}</b>`,
    `📊 Арт. ${nm} — отчёт по вариантам`,
  ] as const;

const WINNER_LEAD_VARIANTS = (label: string, pct: number) =>
  [
    `Лидирует вариант <b>${label}</b> (~${pct}%).`,
    `Пока впереди <b>${label}</b> — вероятность ~${pct}%.`,
    `Фаворит сейчас — <b>${label}</b> (${pct}%).`,
    `Лучше выглядит вариант <b>${label}</b> ≈ ${pct}%.`,
    `По CTR тянет <b>${label}</b> (${pct}% шанс быть лучшим).`,
  ] as const;

const WINNER_UNCLEAR_VARIANTS = [
  'Пока рано называть победителя — мало данных или варианты близко.',
  'Лидер ещё не ясен: наберись показов или подожди пару ротаций.',
  'Цифры есть, но разрыв слабый — рано фиксировать победу.',
  'Однозначного победителя нет. Смотри CTR по вариантам ниже.',
  'Пока ничья по сути. Дай тесту ещё покрутиться.',
] as const;

const ROTATE_NEED_ACTIVE_VARIANTS = (nm: number) =>
  [
    `Активного теста по ${nm} нет — ротировать нечего.`,
    `По ${nm} тест не крутится. Список: <code>тесты</code>`,
    `Ротация только для active. Арт. ${nm} не в работе.`,
    `Не нашла живой тест ${nm} для смены фото.`,
    `${nm} не активен. Сначала запусти тест на сайте.`,
  ] as const;

const ROTATE_WAIT_VARIANTS = [
  '⏳ Секунду, меняю фото на WB…',
  '⏳ Кручу ротацию…',
  '⏳ Переключаю вариант на карточке…',
  '⏳ Сейчас сменю главное фото…',
  '⏳ Ротация пошла…',
] as const;

const ROTATE_OK_VARIANTS = (name: string, label: string) =>
  [
    `✅ Готово: «${name}» → вариант ${label} сейчас на WB.`,
    `✅ Фото сменила: ${name} показывает ${label}.`,
    `✅ Ротация ок — на карточке вариант ${label} («${name}»).`,
    `✅ Переключила на ${label}. Товар: ${name}.`,
    `✅ Главное фото обновлено → ${label} · ${name}.`,
  ] as const;

const ROTATE_FAIL_VARIANTS = (err: string) =>
  [
    `❌ Не вышло сменить фото: ${err}`,
    `❌ Ротация упала: ${err}`,
    `❌ WB не принял смену: ${err}`,
    `❌ Ошибка ротации — ${err}`,
    `❌ Не смогла переключить: ${err}`,
  ] as const;

const UNKNOWN_VARIANTS = [
  'Не уверенно считала. Напиши проще: «тесты», «как там 123», «отчёт 123» или «смени фото 123».',
  'Давай на одной волне — пример: «какие тесты» / «скинь отчёт по арт» / «кто лучше».',
  'Фразу не поймала. Можно «помощь» — покажу, как удобнее писать.',
  'Чуть мимо. Перефразируй как другу: что нужно по А/Б?',
  'Я рядом. Скажи задачу одним из: список · статус · отчёт · ротация · кто лучше.',
] as const;

export const abDialog = {
  help: () => pickVariant(HELP_VARIANTS),
  howStart: () => pickVariant(HOW_START_VARIANTS),
  listEmpty: () => pickVariant(LIST_EMPTY_VARIANTS),
  listHeader: () => pickVariant(LIST_HEADER_VARIANTS),
  notFound: (nm: number) => pickVariant(NOT_FOUND_VARIANTS(nm)),
  needNm: (cmd: string) => pickVariant(NEED_NM_VARIANTS(cmd)),
  detailHeader: (name: string, nm: number) => pickVariant(DETAIL_HEADER_VARIANTS(escapeHtml(name), nm)),
  reportHeader: (name: string, nm: number) => pickVariant(REPORT_HEADER_VARIANTS(escapeHtml(name), nm)),
  winnerLead: (label: string, pct: number) => pickVariant(WINNER_LEAD_VARIANTS(escapeHtml(label), pct)),
  winnerUnclear: () => pickVariant(WINNER_UNCLEAR_VARIANTS),
  rotateNeedActive: (nm: number) => pickVariant(ROTATE_NEED_ACTIVE_VARIANTS(nm)),
  rotateWait: () => pickVariant(ROTATE_WAIT_VARIANTS),
  rotateOk: (name: string, label: string) =>
    pickVariant(ROTATE_OK_VARIANTS(escapeHtml(name), escapeHtml(label))),
  rotateFail: (err: string) => pickVariant(ROTATE_FAIL_VARIANTS(escapeHtml(err.slice(0, 180)))),
  unknown: () => pickVariant(UNKNOWN_VARIANTS),
};

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Простая оценка лидера по CTR (для короткого winner-ответа). */
export function roughLeader(
  variants: Array<{ variant_label: string; impressions?: number; clicks?: number }>,
): { label: string; pct: number } | null {
  if (!variants.length) return null;
  let best: { label: string; ctr: number; impr: number } | null = null;
  let totalImpr = 0;
  for (const v of variants) {
    const impr = Number(v.impressions) || 0;
    const clk = Number(v.clicks) || 0;
    totalImpr += impr;
    const ctr = impr > 0 ? clk / impr : 0;
    if (!best || ctr > best.ctr) best = { label: String(v.variant_label), ctr, impr };
  }
  if (!best || totalImpr < 20) return null;
  // грубая «уверенность» от разрыва и объёма
  const pct = Math.min(95, Math.round(40 + best.ctr * 100 + Math.min(30, totalImpr / 50)));
  return { label: best.label, pct };
}
