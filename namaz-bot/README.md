# Карина — WhatsApp-бот напоминаний о намазе

Бот 24/7 напоминает в WhatsApp-группу за **10 минут** до каждого намаза (Бишкек).

## Стек

- Node.js (LTS)
- [Green API](https://green-api.com) — отправка в WhatsApp
- [Aladhan API](https://aladhan.com/prayer-times-api) — времена намазов
- `node-cron` — ежедневное обновление в 00:05
- `pm2` — автозапуск / автоперезапуск

## Быстрый старт

```bash
cd namaz-bot
cp .env.example .env
# заполни GREEN_API_* в .env
npm install
```

### Узнать ID группы

```bash
npm run get-group-id
```

Скопируй id вида `...@g.us` в `GREEN_API_GROUP_CHAT_ID`.

### Запуск

```bash
npm start
```

### Постоянная работа (pm2)

```bash
npm install -g pm2
pm2 start index.js --name namaz-bot
pm2 save
pm2 startup
```

Проверка после ребута: `pm2 status`.

## Поведение

1. **Первый старт** — одно приветствие в группу (флаг в `.data/greeting-sent`, повторно не шлёт).
2. **Каждый день в 00:05** (`Asia/Bishkek`) — запрос 5 намазов: Фаджр, Зухр, Аср, Магриб, Иша.
3. За 10 минут до каждого — сообщение вида:  
   `Через 10 минут время намаза Зухр (13:30) 🕌`
4. Если бот перезапустился днём — подтягивает сегодняшнее расписание и ставит таймеры только на ещё не прошедшие намазы.

## Отказоустойчивость

- Aladhan: до 5 попыток с паузой 5 минут; ошибки → `logs/errors.log`
- Green API: 1 повтор через 30 секунд при ошибке отправки
- Все действия → `logs/bot.log` с ISO-таймстампом

## Переменные окружения

| Переменная | Описание |
|---|---|
| `GREEN_API_URL` | Базовый URL (по умолчанию `https://api.green-api.com`) |
| `GREEN_API_ID_INSTANCE` | ID инстанса |
| `GREEN_API_TOKEN` | Токен инстанса |
| `GREEN_API_GROUP_CHAT_ID` | ID группы `...@g.us` |
| `CITY` / `COUNTRY` / `TIMEZONE` | По умолчанию Bishkek / Kyrgyzstan / Asia/Bishkek |
| `PRAYER_METHOD` | Метод Aladhan (по умолчанию `3` = MWL) |

Ключи Мара берёт в кабинете [green-api.com](https://green-api.com) после привязки WhatsApp по QR.
