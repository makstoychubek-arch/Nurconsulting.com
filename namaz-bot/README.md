# Карина — напоминания о намазе (WhatsApp)

Бот напоминает в WhatsApp-группу за **10 минут** до каждого намаза (Бишкек).

## Где крутится

**Не на Vercel.** Vercel у Nurconsulting — только сайт (HTML/JS). Там нельзя держать процесс 24/7.

Карина работает как остальные фоновые боты NR Space:

- **Supabase Edge Function** `namaz-remind`
- **pg_cron** каждую минуту → тик проверяет «сейчас намаз − 10 мин?» и шлёт в WhatsApp через Green API

Локальный `namaz-bot/` (Node + pm2) оставлен для отладки на своём VPS, если понадобится.

## Secrets в Supabase

Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Значение |
|---|---|
| `GREEN_API_ID_INSTANCE` | `710722697110` |
| `GREEN_API_TOKEN` | токен инстанса |
| `GREEN_API_GROUP_CHAT_ID` | `120363416791586746@g.us` |
| `GREEN_API_URL` | `https://api.green-api.com` (опционально) |

Опционально: `CITY`, `COUNTRY`, `TIMEZONE`, `PRAYER_METHOD`.

## Деплой

```bash
# 1) функция
supabase functions deploy namaz-remind --project-ref fiukyfyhotctvfdidktx

# 2) таблица + cron (в SQL Editor вставь миграцию
#    supabase/migrations/20260730120000_namaz_remind_cron.sql
#    и замени REPLACE_ME_SERVICE_ROLE_KEY на service_role)
```

## Проверка

```bash
curl -X POST 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/namaz-remind' \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"test":true}'
```

Первый обычный тик (без `test`) один раз отправит приветствие Карины в группу «11-жыл».

## Сообщения

- Приветствие: `Всем привет! Меня зовут Карина… 🕌`
- Напоминание: `Через 10 минут время намаза Зухр (13:30) 🕌`

Дедуп: таблица `namaz_bot_events` (ключ `greeting` и `YYYY-MM-DD:Dhuhr` и т.д.).

## Локальный pm2 (опционально)

```bash
cd namaz-bot
cp .env.example .env   # заполнить GREEN_API_*
npm install
pm2 start index.js --name namaz-bot
```
