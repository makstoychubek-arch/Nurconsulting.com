# Аудит Telegram-ботов NR Space

Дата снимка: 2026-08-14 (обновление gap-pass) · первый снимок: 2026-08-13  
Репозиторий: ветка `cursor/bot-wow-contact-47f1` / `telegram-router`  
Проект Supabase: `fiukyfyhotctvfdidktx`  

**Важно:** раздел «Как есть» местами устарел. Утверждения про «отсутствующие» `wb-ads-snapshot` / `review-moderation` неверны — файлы есть (ads/penalties раньше были stub-нулями; reviews — stub). Смотри §0.

В репозитории параллельно живут **две** Telegram-системы:

1. **Команда агентов** — `telegram-router` (`?bot=…`) — основной предмет аудита  
2. **Уведомления/каналы** — `telegram-webhook` (продажи, штрафы, РК, отзывы) — отдельный бот Карины

---

## 0. GAPS vs docs/skills — 2026-08-14

### Закрыто в этом проходе
| Gap | Было | Стало |
|---|---|---|
| Ads day в канале | `fetchAdsDayRows` всегда 0 | `advertising_daily_stats` |
| Штрафы interactive | всегда total 0 | Finance API (1 стр./кабинет) |
| `/drr` | alias `/ads` | реальный ДРР + горячие РК |
| Skills oversell | FBW / ответы на отзывы как write | честные формулировки |
| Review stub shapes | ломали webhook (`total`, truthy object) | формы под callers |
| Daily sales/penalties chat | только `TELEGRAM_GROUP_CHAT_ID` | `getTelegramChatId` + fallback |

### Ещё открыто
| Gap | Почему |
|---|---|
| Полная модерация отзывов → WB | Нужен живой Feedbacks answer path |
| 309 OpenAPI в чате | Registry есть; агенты на typed helpers; `wbOpenApiExtra` dead |
| FBW stocks | Старый API снят; analytics не подключены |
| Каналы news/blockings/warehouse/triggers/fbs | Routing есть, handlers нет |
| `agent_standing_tasks` | Таблица есть, runtime не читает |
| Planning = frozen JSON | Не live Excel |
| Role-ops `shortJson` | Сырой UX |

### Модули, которых не было в аудите 13.08
`agent-self-skills`, `agent-fuzzy`, `agent-sales-discuss`, `agent-planning-catalog`, `agent-ru-text`, `agent-wb-role-ops`, `agent-wb-openapi-*`, `bot-contact`, `wb-ads-snapshot`, `wb-penalties-snapshot`, wow-команды в fast-commands.

---

## 1. АРХИТЕКТУРА

### 1.1. Из каких файлов/модулей состоит система

#### Edge Functions

| Путь | Назначение |
|---|---|
| `supabase/functions/telegram-router/index.ts` | Роутер команды агентов (мультибот, `?bot=`) |
| `supabase/functions/telegram-webhook/index.ts` | Старый webhook Карины (каналы уведомлений) |
| `supabase/functions/agent-ad-schedule-runner/index.ts` | Cron автозапуска РК по расписанию |

#### Shared-модули агентов

| Путь | Назначение |
|---|---|
| `supabase/functions/_shared/agent-team.ts` | План команды, пинги, hops, peer-talk |
| `supabase/functions/_shared/agent-personas.ts` | Системные промпты, живые отклики на имя |
| `supabase/functions/_shared/agent-voice.ts` | Вариативные короткие фразы |
| `supabase/functions/_shared/agent-actions.ts` | РК: выбор / «да» / запуск-пауза |
| `supabase/functions/_shared/agent-ad-schedule.ts` | Ежедневный автозапуск РК |
| `supabase/functions/_shared/agent-fast-commands.ts` | `/sales` `/ads` `/drr` `/fbs` `/pulse` `/разбор` `/help` |
| `supabase/functions/_shared/agent-qa.ts` | Умный QA тимчата (таблица / фото / остатки) |
| `supabase/functions/_shared/agent-fbs-stock.ts` | Диалог Антона по FBS-остаткам |
| `supabase/functions/_shared/agent-wb-context.ts` | Факты WB для LLM |
| `supabase/functions/_shared/telegram-routing.ts` | Chat ID каналов уведомлений (не `?bot=`) |
| `supabase/functions/_shared/wb-cabinet-tokens.ts` | Выбор/санитизация WB-токена кабинета |

#### Алина CRM / Муха

| Путь | Назначение |
|---|---|
| `supabase/functions/_shared/alina-selfbuy.ts` | CRM раздач, Business, лиды |
| `supabase/functions/_shared/alina-brain.ts` | LLM-мозг Алины (CRM) |
| `supabase/functions/_shared/alina-sheet-plan.ts` | Google Sheet план раздач |
| `supabase/functions/_shared/alina-wb-photo.ts` | Главное фото карточки WB |
| `supabase/functions/_shared/alina-vision.ts` | Проверка скринов |
| `supabase/functions/_shared/alina-templates.ts` | Шаблоны ответов CRM |
| `supabase/functions/_shared/muha-photos.ts` | AI-генерация фото |

#### Тесты (есть)

- `supabase/functions/_shared/agent-team_test.ts`
- `supabase/functions/_shared/agent-actions_test.ts`
- `supabase/functions/_shared/agent-fast-commands_test.ts`

#### Миграции таблиц агентов

- `supabase/migrations/20260811083830_agent_tables.sql` — `agent_chat_history`, `agent_standing_tasks`
- `supabase/migrations/20260811120000_agent_pending_actions.sql`
- `supabase/migrations/20260811092000_alina_selfbuy_crm.sql` (+ бартер/sheets позже)
- `supabase/migrations/20260812094500_alina_barter_cashback.sql`
- `supabase/migrations/20260812095500_alina_cabinet_sheets.sql`
- `supabase/migrations/20260813093000_agent_ad_schedules.sql`

---

### 1.2. Поток одного сообщения

```
Пользователь пишет в Telegram
  → Telegram шлёт update на webhook
  → POST {SUPABASE_URL}/functions/v1/telegram-router?bot=<agent>
  → handler всегда отвечает HTTP 200 "ok" (чтобы TG не ретраил)
  → тяжёлая работа через runWork / EdgeRuntime.waitUntil (если есть)
  → ответ уходит sendMessage / sendPhoto токеном нужного бота
```

#### Порядок веток в `telegram-router/index.ts`

| # | Шаг | Что происходит |
|---|---|---|
| 0 | `?bot=` | `normalizeBotKey`; без bot / без токена → выход |
| 1 | Dedup | `update_id` в памяти isolate, TTL ~5 мин |
| 2 | `callback_query` | Только Антон + FBS-кнопки |
| 3 | Business connection | Подключение рабочего аккаунта к Алине |
| 4 | Разбор message | `business_message \|\| message`; боты/пусто → skip |
| 5 | Fast-команды | `/sales` `/ads` `/fbs` `/selfbuy` `/help` |
| 6 | Активный FBS-диалог | Антон продолжает уточнения/кнопки |
| 7 | Pending РК / автозапуск | Амина: выбор → «да»; «запомни каждый день» |
| 8 | Оффер Алины / CRM | ЛС клиента / Telegram Business |
| 9 | Business hard stop | Остальной business в тим-LLM не идёт |
| 10 | Team Smart QA | Таблица / фото WB / остатки (+ старт FBS) |
| 11 | Name ping | «Антон» без задачи → короткий живой отклик |
| 12 | LLM team plan | `buildTeamPlan` → `runAgentTurn` → hops |

#### Hop-цепочка внутри `runAgentTurn`

1. Проверки: есть токен, hop < max, агент ещё не в `visited`  
2. Шорткаты: статистика Алины / генерация фото Мухи  
3. Параллельно: история чата + WB-контекст  
4. Сборка system prompt + вызов OpenAI  
5. Отправка ответа в чат + `saveMessage`  
6. Если не конец: следующий по `@` / имени или по плану → рекурсивный turn  

`MAX_AGENT_HOPS` берётся из env `AGENT_CHAT_MAX_HOPS` (clamp 1–5, default 3).

---

### 1.3. Где хранится история / контекст

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `agent_chat_history` | История тимчата для LLM | `id`, `chat_id`, `sender`, `text`, `created_at` |
| `agent_pending_actions` | Диалоги с подтверждением (РК, FBS) | `chat_id`, `agent_key`, `action_type`, `status`, `cabinet_id`, `cabinet_name`, `payload` jsonb, `expires_at`, `result_text` |
| `agent_standing_tasks` | Задумана как «стоячие задачи» | `agent_type`, `task_description`, `is_active` — **в рантайме не используется** |
| `agent_ad_schedules` | Ежедневный автозапуск РК | `chat_id`, `cabinet_id`, `campaign_ids[]`, `campaign_names[]`, `run_hour`, `run_minute`, `timezone` (`Asia/Bishkek`), `last_run_on`, `is_active` |
| `alina_selfbuy_leads` | Лиды CRM Алины | user/chat, статус, продукт, банк, даты, deal_type… |
| `alina_selfbuy_events` | События CRM | `lead_id`, `chat_id`, `event_type`, `payload` |
| `alina_campaign` | Текущий оффер раздачи | open/slots/keyword/cashback… |
| `alina_cabinet_sheets` | Привязка кабинета к Google Sheet | `cabinet_key`, `sheet_id`, `is_active` |

#### Как история попадает в модель

```ts
// telegram-router/index.ts
async function loadRecentHistory(chatId: number, limit = 6) {
  // order created_at desc, limit 6, затем reverse → хронология
}

function formatHistory(history) {
  // "sender: text" , text обрезан до 160 символов
}

async function saveMessage(chatId, sender, text) {
  // insert в agent_chat_history; sender ≤ 80, text ≤ 4000
}
```

- По умолчанию в промпт идёт **6** последних сообщений чата  
- Фильтра по агенту **нет** — история общая на `chat_id`  
- Pending/CRM — отдельные таблицы, не смешиваются с `agent_chat_history`

---

## 2. АГЕНТЫ

Фактически **6 ролей**: Карина (координатор) + 5 специалистов.  
Плюс `alina2` — второй токен CRM Алины.

Telegram usernames (`agent-team.ts` → `BOT_USERNAMES`):

| Ключ | @username |
|---|---|
| saule | `saulexxx_bot` |
| amina | `aminaakd_bot` |
| anton | `antonnnxx_bot` |
| alina | `alinaaaxx_bot` |
| muha | `muxxxha_bot` |
| karina | *(пустая строка — только по имени, не по @)* |

---

### 2.1. Как определяется, кто отвечает

1. **Каждый бот** получает свой webhook: `?bot=saule|amina|anton|alina|muha|karina`  
2. **План** `buildTeamPlan` (`agent-team.ts`):  
   entities `@` → `detectMentionedAgents` → `detectNamedAgents` → `detectTopicalAgents` → max N (обычно 3)  
   Если никто не найден → `["karina"]`  
3. **Оркестратор** `resolveSpeakAndOrchestrator`:  
   - говорит первый агент из плана, у кого есть токен (`speakAs`)  
   - если говорит Карина, а webhook не её — оркестрирует Сауле (чтобы не было 5 ответов)  
4. **Спец-ветки без полного LLM** (или с коротким ответом):  
   - fast-команды → фиксированный `agentKey`  
   - `tryTeamSmartQa` → Алина (таблица/фото) / Антон (остатки/FBS)  
   - pending РК / «запомни» → Амина  
   - активный FBS-диалог → Антон  
5. Чужой webhook при «чужом» интенте часто **глотает** апдейт (`handled: true` без reply), чтобы не было хора ботов  

#### Тематический роутинг (`detectTopicalAgents`)

| Тема в тексте | Агент |
|---|---|
| продажи / отмены / цены / выкуп* | Сауле |
| реклама / рк / cpc / ставка / аукцион | Амина |
| логист / fbs / склад / отгруз / остаток | Антон |
| самовыкуп / раздачи / таблица выкупов / главное фото карточки | Алина |
| фотовorонка / креатив / инфографика / «фото» (не карточка WB) | Муха |

\* «выкуп» внутри «самовыкуп» / раздач не уводит на Сауле.

#### Fast-команды → агент

| Команда | Агент |
|---|---|
| `/sales` | saule |
| `/ads` (и старт/пауза) | amina |
| `/fbs` | anton |
| `/selfbuy` | alina |
| `/help` `/ping` `/cabinets` | saule (мета) |

---

### 2.2. Системные промпты

Файл: `supabase/functions/_shared/agent-personas.ts`

- `AGENT_PROMPTS` — персона каждого агента  
- `HUMAN_STYLE` — общие правила тона  
- `TEAM_ACCESS_BRIEF` — что доступно по данным  
- `TEAM_PING` — кого можно пинговать  

| Агент | Роль сейчас |
|---|---|
| **karina** | Старший координатор, сводит картину, ставит задачи |
| **saule** | Продажи WB: заказы, выкупы, отмены, топы, цены |
| **amina** | Реклама/РК: список → выбор → «да»; автозапуск по «запомни» |
| **anton** | Логистика, остатки WB/FBS, склады продавца |
| **alina** | Раздачи/выкупы, Google-таблица, главное фото карточки |
| **muha** | Контент; AI-фото только по явной просьбе «нарисуй/сгенерируй» |

Ключевые правила `HUMAN_STYLE` (суть):
- живой сотрудник в чате, не колл-центр и не «я ИИ»  
- на «ты», коротко (1–5 строк)  
- цифры только из блока ФАКТЫ  
- пустое «да?» / «слушаю?» запрещено  
- чужая зона — одной фразой кинуть коллеге по имени или `@`

---

### 2.3. Видит ли один агент другого?

**Частично да — через общий чат, не через отдельную «память действий».**

| Механизм | Изоляция |
|---|---|
| `agent_chat_history` по `chat_id` | Общая: все sender’ы (user + любой агент) |
| Hop-цепочка | Коллеге передаётся текст предыдущего ответа (`peerTalkBrief` + `userMessage`) |
| `visited` Set | Один агент не отвечает дважды в одной цепочке |
| Pending / schedules | Привязаны к `agent_key`, но лежат в общих таблицах |

Итого: агент в LLM-ходе видит недавнюю переписку чата и (если его позвали) реплику коллеги. Отдельного shared memory «что Амина запустила час назад» в промпте нет — только если это попало в `agent_chat_history` или в спец-таблицы по интенту.

---

### 2.4. Роутинг `?bot=` — как в коде

```ts
// supabase/functions/telegram-router/index.ts

const BOT_TOKENS: Record<string, string> = {
  karina: (Deno.env.get("KARINA_BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim(),
  saule: (Deno.env.get("SAULE_BOT_TOKEN") || "").trim(),
  amina: (Deno.env.get("AMINA_BOT_TOKEN") || "").trim(),
  anton: (Deno.env.get("ANTON_BOT_TOKEN") || "").trim(),
  alina: (Deno.env.get("ALINA_BOT_TOKEN") || "").trim(),
  alina2: (Deno.env.get("ALINA_SECOND_BOT_TOKEN") || "").trim(),
  muha: (Deno.env.get("MUHA_BOT_TOKEN") || "").trim(),
};

function normalizeBotKey(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "saule" || (t.startsWith("sau") && t.length <= 6 && /л|le|ле/.test(t))) {
    return "saule";
  }
  if (["karina", "amina", "anton", "alina", "alina2", "muha"].includes(t)) return t;
  return t;
}

// В serve():
const triggeringBot = normalizeBotKey(url.searchParams.get("bot"));
if (!triggeringBot) {
  console.error("[telegram-router] missing ?bot=");
  return ok();
}
if (!BOT_TOKENS[triggeringBot] && triggeringBot !== "karina") {
  console.error(`[telegram-router] unknown/empty bot=${triggeringBot}`);
  return ok();
}
```

Паттерн webhook URL:

```text
{SUPABASE_URL}/functions/v1/telegram-router?bot=anton
{SUPABASE_URL}/functions/v1/telegram-router?bot=alina
… аналогично для saule / amina / muha / karina
```

Отдельно (не агент-роутер):

```text
{SUPABASE_URL}/functions/v1/telegram-webhook
```

---

## 3. ИНТЕГРАЦИИ С WB / OZON API

### 3.1. Где происходят запросы

#### Пути, связанные с агентами

| Файл | Куда ходит |
|---|---|
| `_shared/agent-ad-schedule.ts` | `advert-api.wildberries.ru/adv/v0/start\|pause` |
| `_shared/agent-fbs-stock.ts` | `marketplace-api…/api/v3/warehouses`, `/api/v3/stocks/{id}`; `content-api…/content/v2/get/cards/list` |
| `_shared/agent-wb-context.ts` | `statistics-api` (продажи); РК/FBS-брифы из таблиц БД |
| `_shared/alina-wb-photo.ts` | Публичный CDN `basket-*.wbbasket.ru` (без токена продавца) |
| `_shared/agent-actions.ts` | Через `runAdvertIds` из `agent-ad-schedule.ts` |

#### Рядом (не агент-чат, но тот же WB-стек)

| Файл | Назначение |
|---|---|
| `supabase/functions/wb-proxy/index.ts` | Прокси для фронта (user JWT → кабинет → WB) |
| `supabase/functions/auto-sync/index.ts` | Cron синк остатков/заказов |
| `supabase/functions/advertising-sync/index.ts` | Cron синк РК (логика дублирует куски wb-proxy) |
| `supabase/functions/morning-digest/index.ts` | Утренний дайджест |

**Ozon seller API в коде агентов нет.**  
Упоминания Ozon встречаются в текстах/новостях, не как интеграция остатков/рекламы.

---

### 3.2. Retry / 429 / таймауты

| Механизм | Есть? | Доп. |
|---|---|---|
| `AbortSignal.timeout` | Да | На агентских путях обычно 10–25 с |
| Retry по `Retry-After` | Нет | По репо в functions не найдено |
| Обработка 429 | Точечно | В `auto-sync`, `wb-sales-snapshot` — sleep/retry |
| 429 в agent-путях | По сути нет | `agent-ad-schedule` / `agent-fbs-stock` / `agent-wb-context` — fail или пауза 350 мс между РК |
| wb-proxy | Мапит 429 | Своей retry-петли для агентов нет (агенты proxy и не вызывают) |

Пример прямого вызова РК (агенты):

```ts
// agent-ad-schedule.ts
const res = await fetch(
  `https://advert-api.wildberries.ru/adv/v0/${verb}?id=${advertId}`,
  {
    method: 'GET',
    headers: { Authorization: token },
    signal: AbortSignal.timeout(20000),
  },
);
```

---

### 3.3. Как хранятся и передаются токены

- В таблице **`cabinets`**: поле `wb_token` (и опционально `wb_token_analytics` / `wb_token_promotion`)  
- Санитизация/выбор: `_shared/wb-cabinet-tokens.ts` (`sanitizeWbToken`, `pickCabinetToken`, длина ≥ 50)  
- **Агенты и cron** читают токен из БД service-role клиентом и вызывают WB **напрямую** (`Authorization: <token>`)  
- **`wb-proxy`** — другой путь: user JWT → кабинет пользователя → WB; для service-role cron не подходит (это прямо написано в комментарии `advertising-sync`)  

Агенты **не** ходят в WB через `wb-proxy`.

---

## 4. МОДЕЛЬ / GPT

### 4.1. Какая модель

**Тимчат (`telegram-router` → `askOpenAI`):**

```ts
model: Deno.env.get("OPENAI_MODEL") || "gpt-4o"
temperature: 0.75
max_tokens: 320
presence_penalty: 0.3
frequency_penalty: 0.35
```

**CRM-мозг Алины (`alina-brain.ts`):**

```ts
ALINA_BRAIN_MODEL || OPENAI_MODEL || "gpt-4o-mini"
```

Итого по умолчанию:
- команда в группе → **gpt-4o**  
- более свободный диалог Алины с клиентом → **gpt-4o-mini** (если env не переопределён)

---

### 4.2. Как формируется промпт

В `askOpenAI` уходят 4 сообщения:

1. **system** — персона (`AGENT_PROMPTS`) + `actionsCapabilityBrief()` + `teamBriefForPrompt` + owner/peer brief + анти-шаблон + last-hop правило  
2. **system** — `ФАКТЫ WB (по всем кабинетам):\n…` (`buildAgentWbContext` + иногда `teamQaFactsForAgent` / CRM stats Алины)  
3. **system** — `Недавняя история чата…` (`formatHistory`)  
4. **user** — текст задачи (до 2000 символов)  

История:
- `loadRecentHistory(chatId, limit = 6)`  
- в промпте каждая реплика: `sender: text` с `text` ≤ 160 символов  

При ответе коллеге (`fromAgent`):
- в system добавляется `peerTalkBrief`  
- в user — «вопрос владельца» + реплика коллеги + «ты — {агент}»

---

## 5. ИЗВЕСТНЫЕ ПРОБЛЕМЫ / ЗАМЕЧАНИЯ ПО КОДУ

### 5.1. TODO / FIXME / закомментированное

В `supabase/functions` по зоне agents/telegram **явных TODO/FIXME/XXX не найдено**.

`agent_standing_tasks` создана миграцией, но **ни один runtime-модуль её не читает/не пишет** (только комментарий в роутере про «standing tasks»).

---

### 5.2. Битые / отсутствующие импорты

В **`telegram-webhook/index.ts`** импортируются файлы, которых **нет** на диске в `_shared/`:

- `../_shared/wb-ads-snapshot.ts` — отсутствует  
- `../_shared/wb-penalties-snapshot.ts` — отсутствует  
- `../_shared/review-moderation.ts` — отсутствует  

При этом есть:
- `wb-sales-snapshot.ts` — есть  
- `telegram-routing.ts` — есть  

Относительные импорты **telegram-router** к `_shared/agent-*` / `alina-*` / `muha-*` сходятся.

---

### 5.3. Обработка ошибок

Паттерн роутера: **не ронять Telegram webhook**.

- Внешний `try/catch` → `console.error` → всё равно `200 ok`  
- `sendTelegramMessage` / `sendTelegramPhoto` / `answerCallbackQuery` / `saveMessage` / `askOpenAI` — локальные try/catch, soft-fail  
- Фоновые задачи: `runWork(task.catch(...))`  
- Многие WB-вызовы в агентах: при ошибке текст «не смог…» или пустой факт, без жёсткого abort всего чата  

То есть запросы не всегда «в надежде» — ошибки часто глотаются и логируются, но пользователь/цепочка может получить укороченный/пустой результат.

---

### 5.4. Логирование

Есть, в основном stdout Edge Function:

- префикс `[telegram-router]`  
- `console.log`: dedup, skip оркестрации, turn (`agent/hop/from/plan/chat`)  
- `console.error`: sendMessage fail, OpenAI fail (JSON обрезается ~300 символов), saveMessage, wb context, exceptions  

Дополнительно для Алины Business/CRM: события в `alina_selfbuy_events` / raw event helpers.

Структурированного APM, трассировки request-id или отдельного лог-хранилища в коде агентов нет.

---

### 5.5. Прочие факты состояния

- Dedup `update_id` — **только в памяти isolate**; после cold start «забывает»  
- «Пополнить РК» в речи пользователя **не равно** API пополнения бюджета: через API делается start/pause кампаний; баланс — в ЛК WB  
- FBS-остатки агента = Marketplace stocks продавца, не `wb_stocks` FBO (FBO используется в другом QA-пути Антона без слова «фбс»)  

---

## 6. ДЕПЛОЙ

| Вопрос | Текущее состояние |
|---|---|
| Где крутится код ботов | **Supabase Edge Functions**, проект `fiukyfyhotctvfdidktx` |
| Не Vercel | `vercel.json` есть для фронта/rewrites дашборда; **боты туда не деплоятся** |
| Как обновляют после изменений | `supabase functions deploy <name> --project-ref fiukyfyhotctvfdidktx` (часто через `npx supabase`) |
| Примеры функций | `telegram-router`, `agent-ad-schedule-runner`, `telegram-webhook`, плюс sync/report crons |
| Разделение тест/прод | **Одного прод-проекта**; отдельного staging ref для ботов в репо нет |
| Мягкий «test» | У части service/cron функций флаги `body.test` / `force` и `NR_SETUP_SECRET` |
| Telegram webhooks | На URL Edge Function; у Алины — ещё `business_message`; у Антона — `callback_query` |
| Автозапуск РК | pg_cron job `agent-ad-schedule-5min` (`*/5 * * * *`) → `agent-ad-schedule-runner` |

Секреты (токены ботов, `OPENAI_*`, `SUPABASE_*`, Google SA и т.д.) лежат в **Supabase Function Secrets**, не в git.

---

## Краткая схема «как есть»

```text
[Пользователь в TG]
        │
        ▼
[Несколько ботов: saule/amina/anton/alina/muha/(karina)]
        │  каждый webhook:
        │  /functions/v1/telegram-router?bot=<name>
        ▼
[telegram-router]
  ├─ fast cmd / pending РК / FBS dialog / Alina CRM
  ├─ tryTeamSmartQa (факты без LLM или с фото)
  └─ buildTeamPlan → runAgentTurn → OpenAI
        │
        ├─ история: agent_chat_history (6 msg)
        ├─ факты: agent-wb-context + QA/CRM
        └─ WB API напрямую из cabinets.wb_token
        │
        ▼
[Ответ токеном speakAs-бота в тот же chat_id]
```

Параллельно:

```text
[Каналы уведомлений]
  telegram-webhook
    sales / ads / penalties / ab_tests — рабочие парсеры
    reviews — moderation STUB (кнопки честно отказывают)
```

---

*Конец аудита. §0 Gaps обновлён 2026-08-14; нижние разделы первого снимка могут частично расходиться — при конфликте верить §0.*
