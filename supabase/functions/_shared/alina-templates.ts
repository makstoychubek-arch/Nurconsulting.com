// Короткие ответы как живой менеджер @Wildberries_OZON_barter.
// ТЗ шлём целиком; устройство кэшбека/бартера клиентам не объясняем.
// Простые тексты можно менять с сайта («Настройки раздач · Алина → Тексты»): переопределения лежат в alina_settings.texts,
// пустое значение означает стандартный текст. Подстановки пишутся в фигурных скобках: {товар}, {ключ}, {срок}.

export type TextDef = { id: string; group: string; label: string; vars: string[]; text: string };

/** Тексты, которые можно менять с сайта, со стандартным содержимым. */
export const TEXT_DEFS: TextDef[] = [
  { id: 'open', group: 'Начало', label: 'Ответ «актуально» без названия', vars: [], text: `Да, актуально 🙌
Высылаю ТЗ:` },
  { id: 'open_product', group: 'Начало', label: 'Ответ «актуально» с названием товара', vars: ['товар'], text: `Да, актуально 🙌 по «{товар}»
Высылаю ТЗ:` },
  { id: 'closed', group: 'Начало', label: 'Места на сегодня закончились', vars: [], text: `На сегодня места закончились 🙌 Напишите завтра — посмотрим` },
  { id: 'closed_full', group: 'Начало', label: 'Раздача закрыта', vars: [], text: `Сейчас мест нет, раздача закрыта. Как откроем — можно писать 🙌` },
  { id: 'need_type', group: 'Начало', label: 'Бартер или кэш', vars: [], text: `Бартер или кэш? 🙌` },
  { id: 'only_cashback', group: 'Начало', label: 'Сейчас только кэшбек', vars: [], text: `Сейчас только кэшбек 🙌 Бартер пока не открывали. Могу провести по кэшу — напишите «да», если ок` },
  { id: 'ask_ad_again', group: 'Начало', label: 'Просим модель и цвет', vars: [], text: `Напишите модель и цвет, который ищете — например «фонарь белый» 🙌` },
  { id: 'tz_cashback', group: 'Задание', label: 'ТЗ для кэшбека', vars: [], text: `ТЗ Для ОЗНАКОМЛЕНИЯ

1️⃣ Ключевой запрос после ознакомления

2️⃣ Добавьте в корзину 2-3 конкурентов из ПЕРВЫХ ПЯТИ В ВЫДАЧЕ ‼️

3️⃣ Далее найдите НАШ товар, отправьте скрин для утверждения, что это конкретно наш товар. Посмотрите фото, описание. Добавить бренд в избранное ❤️. Добавьте наш товар в корзину. Пришлите скрин корзины с конкурентами.

4️⃣ Оформите заказ через пол часа. Пришлите скрин заказа с ценой, городом и ожидаемой датой получения.

5️⃣ Заберите товар из ПВЗ. Пришлите скрин.

6️⃣ Согласуйте отзыв + 1 фото + 5 звёзд

📍 Важно скрины:
1) товар со строкой запроса
2) корзина с нашим товаром и 2 конкурентами
3) бренд в избранном
4) оформленный заказ (после согласования первых 3)

✅ После получения написать отзыв (согласовать!!) и прислать скрин отзыва из ЛК, фото товара, разорванные ШК (на товаре и пакете).

✅ Кешбек от вашей оплаты на 16 дней после получения товара при выполнении всех условий: опубликован отзыв, фото открытого товара, разрезанные шк 🙌` },
  { id: 'tz_barter', group: 'Задание', label: 'ТЗ для бартера', vars: ['срок'], text: `Высылаю ТЗ для ОЗНАКОМЛЕНИЯ

ВАЖНО!!! Заказать НУЖНО {срок}, если не делаете выкуп, то ваша заявка на бартер автоматически аннулируется и отдается другому блогеру

🇷🇺 Участвуем только с блогерами из России: заказ оформляется на пункт выдачи в России, перевод делаем на российский банк через СБП.

1. Ключевое слово для поиска после ознакомления

2. Если возникают сложности с поиском товара, то напишите мне и подскажу, какие фильтры установить, чтобы товар было проще найти.

3. Найти наш товар, попутно добавить 3-4 конкурентов с первой страницы и направить скрин для СОГЛАСОВАНИЯ ‼️‼️‼️

4. Через 20-30 минут удалить конкурентов с корзины, а наш товар заказать

5. Направить скрин заказа где видна цена, ПВЗ и дата доставки

6. Отправьте ваши реквизиты в формате: номер телефона + ФИО (перевод делаем через СБП) и ваш банк. Деньги переводим через 3 дней после заказа (если успеваете заказать до 22:00 по МСК)

7. Согласовать дату рекламной интеграции.

8. После получения товара ОБЯЗАТЕЛЬНО ОТПРАВИТЬ ‼️‼️‼️‼️фото с разрезанными штрихкодом вб ‼️

9. ‼️‼️‼️ ОБЯЗАТЕЛЬНО Согласовать с нами отзыв (дату, фото, текст). СРАЗУ НЕ ОСТАВЛЯТЬ ❌ В будущем можем попросить дополнить отзыв 🙌

10. Товар НЕЛЬЗЯ РАЗМЕЩАТЬ на продажу на ВБ РЕСЕЙЛ ‼️‼️🙌

11. Опубликовать РИЛС в запланированную дату.

12. Через 1-3 дня отправить статистику сторис и рилс.

ВАЖНО‼️‼️‼️
Товар НЕ ВОЗВРАЩАТЬ.
Все вопросы — @Wildberries_OZON_barter

Просим:
✅ хороший свет, без лишнего шума;
✅ реклама с 11 до 16 МСК;
✅ перед рекламой 2–3 личные сторис;
✅ ссылка на артикул в сторис;
✅ описание рилса с артикула.` },
  { id: 'key', group: 'Задание', label: 'Ключ для поиска', vars: ['ключ'], text: `Ключ для поиска:
«{ключ}»

Вбиваете в поиск именно этот ключ → наш товар → скрин (чтобы сверху был запрос) 🙌
По фото / артикулу не ищем` },
  { id: 'ask_filters', group: 'Задание', label: 'Предложение фильтров', vars: [], text: `Не находите? Скинуть фильтры с карточки?` },
  { id: 'approved_product', group: 'Этапы', label: 'Товар найден, корзина', vars: [], text: `Да, наш 👍 Корзина: наш + 2–3 конкурента из топа, бренд в избранное — и скрин` },
  { id: 'approved_cart', group: 'Этапы', label: 'Корзина принята, заказ', vars: [], text: `Ок. Через 20–30 мин конкурентов убираете, наш оформляете. Потом скрин заказа (цена, ПВЗ, дата)` },
  { id: 'ask_bank_cashback', group: 'Этапы', label: 'Реквизиты (кэшбек)', vars: [], text: `Приняла ✅ Реквизиты: телефон + ФИО + банк (СБП)` },
  { id: 'ask_bank_barter', group: 'Этапы', label: 'Реквизиты (бартер)', vars: [], text: `Приняла ✅ Реквизиты: телефон + ФИО + банк (СБП) — перевод после заказа` },
  { id: 'ask_pickup', group: 'Этапы', label: 'Ждём получения', vars: [], text: `Как заберёте — напишите/скиньте скрин. Отзыв сразу не публикуем, сначала согласуем` },
  { id: 'ask_review', group: 'Этапы', label: 'Просим черновик отзыва', vars: [], text: `Черновик отзыва сюда (текст + фото). Публикуем только после ок. Потом скрин из ЛК + ШК разрезанные` },
  { id: 'ask_reels', group: 'Этапы', label: 'Просим ссылку на рилс', vars: [], text: `Жду ссылку на рилс (описание с артикула) и потом статистику` },
  { id: 'got_ig', group: 'Этапы', label: 'Ссылку на рилс увидела', vars: [], text: `Приняла 🙌 Ссылку увидела` },
];

let overrides: Record<string, string> = {};

/** Переопределения из настроек: действуют, пока не заданы новые. Берутся только известные идентификаторы. */
export function setTextOverrides(o: Record<string, unknown> | null | undefined): void {
  const next: Record<string, string> = {};
  for (const d of TEXT_DEFS) {
    const v = o?.[d.id];
    if (typeof v === 'string' && v.trim()) next[d.id] = v;
  }
  overrides = next;
}

export function fillText(raw: string, vars: Record<string, string> = {}): string {
  return raw.replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Текст по идентификатору: переопределение из настроек или стандартный, с подстановками. */
export function tx(id: string, vars: Record<string, string> = {}): string {
  const def = TEXT_DEFS.find((d) => d.id === id);
  if (!def) throw new Error('unknown text ' + id);
  return fillText(overrides[id] ?? def.text, vars);
}

export const MSG_CLOSED = (): string => tx('closed');
export const MSG_CLOSED_FULL = (): string => tx('closed_full');
export const MSG_NEED_TYPE = (): string => tx('need_type');
export const MSG_ONLY_CASHBACK = (): string => tx('only_cashback');
export const MSG_ASK_AD_AGAIN = (): string => tx('ask_ad_again');
export const MSG_ASK_FILTERS = (): string => tx('ask_filters');
export const MSG_APPROVED_PRODUCT = (): string => tx('approved_product');
export const MSG_APPROVED_CART = (): string => tx('approved_cart');
export const MSG_ASK_BANK_CASHBACK = (): string => tx('ask_bank_cashback');
export const MSG_ASK_BANK_BARTER = (): string => tx('ask_bank_barter');
export const MSG_ASK_PICKUP = (): string => tx('ask_pickup');
export const MSG_ASK_REVIEW = (): string => tx('ask_review');
export const MSG_ASK_REELS = (): string => tx('ask_reels');
export const MSG_GOT_IG = (): string => tx('got_ig');
export const TZ_CASHBACK = (): string => tx('tz_cashback');

export function tzBarter(deadline?: string | null): string {
  const when = (deadline || '').trim() || 'в указанную дату ДО 22:00 ПО МСК';
  return tx('tz_barter', { срок: when });
}

/** Коротко, без лекций. Сразу ТЗ. */
export function msgOpenHuman(_deal: 'cashback' | 'barter', product?: string | null): string {
  const p = (product || '').trim();
  return p ? tx('open_product', { товар: p }) : tx('open');
}

export function msgKey(keyword: string): string {
  return tx('key', { ключ: keyword });
}

export function msgFiltersBatch(
  filters: { name: string; value: string }[],
  round: 1 | 2,
): string {
  const lines = filters.map((f) => `• ${f.name}: ${f.value}`);
  if (round === 1) {
    return (
      `Фильтры для поиска (поставьте в фильтрах WB):\n` +
      lines.join('\n') +
      `\n\nКлюч тот же, бренд не трогаем. Если снова не найдёте — напишите`
    );
  }
  return (
    `Ещё фильтры:\n` +
    lines.join('\n') +
    `\n\nПоставьте их + прошлые. Потом скрин поиска сверху с ключом 🙌`
  );
}

/** Приветствие: хотим заказ + модель/цвет (без «чем могу помочь»). */
export function msgAskAd(products: string[]): string {
  const list = products.filter(Boolean);
  if (list.length <= 1 && list[0]) {
    return `Привет 🙌 Хотите заказать «${list[0]}»? Напишите да — или другую модель/цвет`;
  }
  if (list.length) {
    return (
      `Привет 🙌 Хотите заказать? Какую модель и расцветку ищете?\n` +
      list.map((p) => `• ${p}`).join('\n')
    );
  }
  return 'Привет 🙌 Хотите заказать? Какую модель и расцветку ищете?';
}

export function msgColorUnavailable(
  colorLabel: string,
  alternatives: string[],
): string {
  const alt = alternatives.filter(Boolean);
  if (alt.length) {
    return (
      `На сегодня «${colorLabel}» нет в раздаче 🙌\n` +
      `Есть:\n` +
      alt.map((p) => `• ${p}`).join('\n') +
      `\nПодойдёт что-то из этого?`
    );
  }
  return `На сегодня «${colorLabel}» нет в раздаче 🙌 Напишите завтра — посмотрим`;
}
