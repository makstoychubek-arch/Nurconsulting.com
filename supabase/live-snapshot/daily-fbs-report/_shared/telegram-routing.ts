// СНИМОК боевой функции «daily-fbs-report» (версия 22), снят 2026-10-06.
// Это скомпилированный код из Supabase, не исходник для деплоя. Зашитые ключи вырезаны.
// Маршрутизация Telegram-уведомлений по разным группам/чатам.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN          — один бот на все группы
//   TELEGRAM_GROUP_CHAT_ID      — запасной chat_id, если канал не задан
//   TELEGRAM_CHAT_SALES         — ежедневные отчёты по продажам
//   TELEGRAM_CHAT_PENALTIES     — штрафы и удержания
//   TELEGRAM_CHAT_ADS           — реклама: пауза/старт, баланс РК
//   TELEGRAM_CHAT_AB_TESTS      — завершение А/Б тестов
//   TELEGRAM_CHAT_NEWS          — новости портала продавца WB
//   TELEGRAM_CHAT_REVIEWS       — автоответы на отзывы WB
//   TELEGRAM_CHAT_BLOCKINGS     — блокировки карточек (NR / Блокировки)
//   TELEGRAM_CHAT_WAREHOUSE     — склад: хранение, возвраты (NR / Склад)
//   TELEGRAM_CHAT_TRIGGERS      — мониторинг новостей WB/Ozon (интернет)
//   TELEGRAM_CHAT_FBS           — ежедневный FBS-отчёт (Excel + сводка)
//
// Обратная совместимость:
//   TELEGRAM_CHANNEL_ID → ab_tests / fbs, если dedicated secret пуст
//   fbs → TELEGRAM_CHAT_WAREHOUSE, если TELEGRAM_CHAT_FBS и CHANNEL_ID пусты
export const TELEGRAM_CHANNEL_LABELS = {
  sales: 'Продажи',
  penalties: 'Штрафы',
  ads: 'Реклама',
  ab_tests: 'А/Б тесты',
  news: 'Новости WB',
  reviews: 'Отзывы',
  blockings: 'Блокировки',
  warehouse: 'Склад',
  triggers: 'Триггеры',
  fbs: 'FBS заказы'
};
const CHANNEL_ENV = {
  sales: 'TELEGRAM_CHAT_SALES',
  penalties: 'TELEGRAM_CHAT_PENALTIES',
  ads: 'TELEGRAM_CHAT_ADS',
  ab_tests: 'TELEGRAM_CHAT_AB_TESTS',
  news: 'TELEGRAM_CHAT_NEWS',
  reviews: 'TELEGRAM_CHAT_REVIEWS',
  blockings: 'TELEGRAM_CHAT_BLOCKINGS',
  warehouse: 'TELEGRAM_CHAT_WAREHOUSE',
  triggers: 'TELEGRAM_CHAT_TRIGGERS',
  fbs: 'TELEGRAM_CHAT_FBS'
};
const LEGACY_ENV = {
  ab_tests: 'TELEGRAM_CHANNEL_ID',
  fbs: 'TELEGRAM_CHANNEL_ID'
};
const ALL_CHANNELS = [
  'sales',
  'penalties',
  'ads',
  'ab_tests',
  'news',
  'reviews',
  'blockings',
  'warehouse',
  'triggers',
  'fbs'
];
export function getTelegramToken() {
  return (Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '').trim();
}
export function getTelegramChatId(channel) {
  const direct = (Deno.env.get(CHANNEL_ENV[channel]) ?? '').trim();
  if (direct) return direct;
  const legacyKey = LEGACY_ENV[channel];
  if (legacyKey) {
    const legacy = (Deno.env.get(legacyKey) ?? '').trim();
    if (legacy) return legacy;
  }
  if (channel === 'fbs') {
    const warehouse = (Deno.env.get('TELEGRAM_CHAT_WAREHOUSE') ?? '').trim();
    if (warehouse) return warehouse;
  }
  return (Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ?? '').trim();
}
export function isTelegramConfigured(channel) {
  return Boolean(getTelegramToken() && getTelegramChatId(channel));
}
export function getTelegramRoutingStatus() {
  const out = {};
  for (const channel of ALL_CHANNELS){
    const direct = (Deno.env.get(CHANNEL_ENV[channel]) ?? '').trim();
    const legacyKey = LEGACY_ENV[channel];
    const legacy = legacyKey ? (Deno.env.get(legacyKey) ?? '').trim() : '';
    const fallback = (Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ?? '').trim();
    let source = 'missing';
    let chatId = '';
    if (direct) {
      chatId = direct;
      source = 'dedicated';
    } else if (legacy) {
      chatId = legacy;
      source = 'legacy';
    } else if (fallback) {
      chatId = fallback;
      source = 'default';
    }
    out[channel] = {
      label: TELEGRAM_CHANNEL_LABELS[channel],
      envKey: CHANNEL_ENV[channel],
      chatId,
      configured: Boolean(getTelegramToken() && chatId),
      source
    };
  }
  return out;
}
export function telegramConfigError(channel) {
  const token = getTelegramToken();
  const chatId = getTelegramChatId(channel);
  if (!token) return 'TELEGRAM_BOT_TOKEN не задан';
  if (!chatId) {
    return `${CHANNEL_ENV[channel]} (или TELEGRAM_GROUP_CHAT_ID) не задан для канала «${TELEGRAM_CHANNEL_LABELS[channel]}»`;
  }
  return '';
}
