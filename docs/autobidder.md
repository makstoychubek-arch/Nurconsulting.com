# Автобиддер для NR Space — архитектура v2 (для внедрения через Cursor)

Дата: 04.09.2026. Стек: Supabase (Postgres + Edge Functions + pg_cron + Vault) + Vercel + существующий WB API proxy Edge Function.

---

## 0. Что это и зачем (для Cursor — контекст задачи)

Модуль автоматического управления ставками (CPM) в рекламных кампаниях Wildberries. Задача — держать карточку на нужных позициях в рекламной выдаче, платя **минимально достаточную** ставку, а не рекомендованную WB (рекомендации CPM в кабинете WB завышены в несколько раз — это подтверждают все игроки рынка, и на этом строится вся ценность биддеров).

Рынок: MPSTATS, MarketGuru, PromoPult, MP Manager, ProSells, ClickBidder. Все работают по одному принципу. Наша цель — сделать не хуже базового уровня и добавить 3 вещи, которых у MPSTATS нет (раздел 7).

---

## 1. Как устроен рекламный аукцион WB (факты)

- Поисковая реклама WB — аукцион CPM (цена за 1000 показов). Место выше получает тот, кто ставит больше.
- Ставки задаются **по поисковым кластерам** (нормализованные группы запросов, `normquery`), а не по отдельным словам. Это ключевое изменение 2025-26 гг. — весь дизайн ниже кластерный.
- Два типа кампаний: **Ручная ставка** (аукцион по кластерам, полный контроль) и **Единая ставка** (алгоритмическая, WB сам решает). Если оба включены на один товар — работает только одна. Биддер имеет смысл в основном для Ручной ставки.
- Позиция в рекламной выдаче ≠ только ставка: WB накладывает весовые коэффициенты (CTR карточки, цена, релевантность кластера). Поэтому "ставка выше конкурента на 1₽" не всегда даёт место выше — нужна обратная связь по реальной позиции (раздел 4).

---

## 2. Официальные эндпоинты WB Advertising API (проверены по OpenAPI-спецификации WB, SDK `eslazarev/wildberries-sdk`)

Базовый хост: `https://advert-api.wildberries.ru` (заголовок `Authorization: <token с правами "Продвижение">`)

| Назначение | Метод |
|---|---|
| Список/инфо по кампаниям | `GET /api/advert/v2/adverts` |
| Список активных/неактивных кластеров кампании | `POST /adv/v0/normquery/list` |
| Текущие ставки по кластерам | `POST /adv/v0/normquery/get-bids` |
| **Установить ставки по кластерам** | `POST /adv/v0/normquery/bids` (v0) или `POST /api/advert/v1/normquery/bids` (v1, в валюте аккаунта) |
| Удалить ставки кластеров | `DELETE /adv/v0/normquery/bids` |
| Статистика по кластерам (агрегат) | `POST /adv/v0/normquery/stats` |
| Статистика по кластерам по дням | `POST /adv/v1/normquery/stats` |
| Минус-фразы: получить / установить | `POST /adv/v0/normquery/get-minus`, `POST /adv/v0/normquery/set-minus` |
| Полная статистика кампаний (показы/клики/CPC/заказы) | `GET /adv/v3/fullstats` |
| Пауза / запуск | `POST /adv/v0/pause`, `POST /adv/v0/start` |

⚠️ Для Cursor: перед реализацией открыть актуальную OpenAPI-спеку WB раздела "Продвижение" (`dev.wildberries.ru`) и сгенерировать типы — версии v0/v1 сосуществуют, v1 предпочтительнее для новых интеграций. Rate limits указаны в спеке — в прокси нужен throttle.

---

## 3. Главный вопрос: откуда брать ставки конкурентов

Официальное API **не отдаёт** чужие ставки. Все биддеры на рынке решают это одним из двух способов. Реализуем оба, переключаемо.

### Способ A — парсинг рекламного аукциона (быстро, но неофициально)
Индустриальный стандарт всех биддеров ("парсинг ставок по мастер-фразе на аукционе WB в реальном времени", интервал 2-5 мин у MarketGuru/PromoPult). Используется публичный (без авторизации) эндпоинт выдачи WB, который для поискового запроса возвращает список рекламных карточек с их CPM и позициями. Исторически это `catalog-ads.wildberries.ru/api/v*/search?keyword=<фраза>`; версия и формат меняются — Cursor должен проверить актуальный ответ через DevTools на wildberries.ru при вводе запроса в поиск.

Что получаем: массив `{nm_id, cpm, position}` для целевого кластера — это и есть "реальные ставки конкурентов".
Риск: WB может изменить/закрыть эндпоинт или отдать капчу. Поэтому — Способ B как обязательный fallback.

### Способ B — замкнутый контур по реальной позиции (надёжно, только официальное API)
Не знаем чужих ставок — измеряем **свою** позицию и корректируем ставку итеративно (по сути PID-регулятор / hill climbing):
- Позиция хуже целевого диапазона → ставка `+step` (шаг адаптивный: 5-10% или ≥1₽)
- Позиция лучше диапазона → ставка `-step` (проверка "не переплачиваем ли")
- В диапазоне → шаг сужается, держим
- Упёрлись в `max_bid` → стоп + уведомление пользователю

Позицию по кластеру берём из публичной поисковой выдачи WB (эндпоинт `search.wb.ru/exactmatch/.../search?query=` возвращает список nm_id; наш nm_id + признак рекламного места). Тоже неофициально, но это чтение выдачи, а не аукциона — стабильнее.

**Рекомендация:** гибрид. Способ A даёт стартовую точку (сразу ставим "ставка конкурента на позиции N + 1₽"), Способ B — корректирует по факту, потому что из-за весовых коэффициентов WB "на 1₽ больше" ≠ гарантированная позиция.

---

## 4. Алгоритм тика (Edge Function `autobidder-tick`, pg_cron каждые 3-5 мин)

```
FOR each rule IN autobidder_rules WHERE is_active AND schedule_allows_now():
    camp     = rule.campaign
    cluster  = rule.cluster_key
    my_bid   = get_current_bid(camp, cluster)           -- POST normquery/get-bids
    
    -- 4.1 Органика: если и так в топе, реклама не нужна
    org_pos = get_organic_position(camp.nm_id, cluster)  -- поисковая выдача без рекламных блоков
    IF org_pos <= rule.organic_skip_threshold (напр. 5):
        set_bid(camp, cluster, rule.min_bid_floor)       -- держим минимальную, не сливаем
        log(reason='organic_top', ...)
        CONTINUE

    -- 4.2 Целевая ставка от аукциона (Способ A) — если доступен
    auction = fetch_auction(cluster)                     -- [{nm_id, cpm, position}]
    IF auction OK:
        competitor_at_target = auction.cpm_at_position(rule.target_pos_to)
        target_bid = competitor_at_target + rule.outbid_step (по умолчанию 1₽)
    ELSE:
        target_bid = NULL

    -- 4.3 Замкнутый контур по факту (Способ B) — всегда
    my_pos = get_ad_position(camp.nm_id, cluster)
    save serp_position_snapshot(...)
    IF my_pos IS NULL OR my_pos > rule.target_pos_to:     -- хуже нужного
        candidate = coalesce(target_bid, my_bid * (1 + rule.step_pct))
    ELIF my_pos < rule.target_pos_from:                   -- лучше нужного = переплата
        candidate = coalesce(target_bid, my_bid * (1 - rule.step_pct))
    ELSE:                                                 -- в диапазоне
        candidate = coalesce(target_bid, my_bid)          -- если аукцион говорит "можно дешевле" — снижаем

    -- 4.4 Ограничители
    new_bid = clamp(candidate, rule.min_bid_floor, rule.max_bid_effective)   -- см. 7.1 про max_bid_effective
    IF abs(new_bid - my_bid) / my_bid < rule.hysteresis (напр. 3%): CONTINUE  -- не дёргаем ставку по мелочи

    -- 4.5 Применение
    set_bid(camp, cluster, new_bid)                       -- POST normquery/bids
    log bid_history(rule, my_bid → new_bid, my_pos, reason, source='auction'|'feedback')
    IF new_bid == rule.max_bid_effective AND my_pos > rule.target_pos_to:
        notify(rule, 'Лимит ставки достигнут, конкуренция выросла')
```

### 4a. Каннибализация между своими кампаниями (подтверждено у MPSTATS)
Перед активацией правила — сравнить `cluster_key` с активными правилами того же кабинета через `pg_trgm` (`similarity() > 0.7`) → предупредить "кампании X и Y будут конкурировать друг с другом за показ по '{кластер}'" и предложить оставить одно правило.

### 4b. Тиры кластеров по сигналу спроса (подтверждено у PromoPult)
Кластеры внутри кампании автоматически раскладываются по группам с разным `max_bid`:
- **Заказы есть** → максимальная ставка (усиливаем)
- **Только корзины** → средняя
- **Показы без сигнала** → минимальная / кандидат в минус-фразы
- **Нет статистики (новый кластер)** → ставка по умолчанию на тест
Пересчёт тиров — раз в сутки по `POST /adv/v1/normquery/stats`.

---

## 5. Схема БД (Supabase / Postgres)

```sql
create extension if not exists pg_trgm;

create table adv_campaigns (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references cabinets(id),
  wb_campaign_id bigint not null,
  nm_id bigint not null,                       -- карточка, которую продвигаем
  campaign_type text not null check (campaign_type in ('manual_bid','auto_bid')),
  name text,
  status text not null default 'active',
  synced_at timestamptz,
  unique (cabinet_id, wb_campaign_id)
);

create table adv_clusters (                    -- кластеры кампании из normquery/list
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references adv_campaigns(id) on delete cascade,
  cluster_key text not null,                   -- нормализованный запрос
  is_active boolean default true,
  tier text default 'no_data' check (tier in ('orders','carts','impressions','no_data')),
  tier_updated_at timestamptz,
  unique (campaign_id, cluster_key)
);

create table autobidder_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references adv_campaigns(id) on delete cascade,
  cluster_id uuid references adv_clusters(id), -- NULL = правило на всю кампанию
  strategy text not null default 'min_sufficient'
    check (strategy in ('min_sufficient','max_visibility','fixed_position','target_drr')),
  target_pos_from int not null default 1,
  target_pos_to int not null default 20,
  max_bid numeric,                             -- ручной потолок (может быть NULL при strategy=target_drr)
  min_bid_floor numeric not null default 0,
  step_pct numeric not null default 0.07,
  hysteresis numeric not null default 0.03,
  outbid_step numeric not null default 1,
  organic_skip_threshold int default 5,
  target_drr_pct numeric,                      -- для strategy=target_drr, см. 7.1
  schedule jsonb,                              -- {"hours":[9..22],"boost":{"13":1.15,"18":1.15}} см. 7.2
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table bid_history (                     -- "Журнал продвижения"
  id bigserial primary key,
  rule_id uuid not null references autobidder_rules(id) on delete cascade,
  old_bid numeric, new_bid numeric not null,
  observed_pos int, organic_pos int,
  source text,                                 -- 'auction' | 'feedback' | 'organic_top' | 'schedule' | 'manual'
  reason text,
  applied boolean default true,
  created_at timestamptz default now()
);
create index on bid_history (rule_id, created_at desc);

create table serp_position_snapshots (
  id bigserial primary key,
  campaign_id uuid not null references adv_campaigns(id) on delete cascade,
  cluster_key text not null,
  ad_position int, organic_position int,
  captured_at timestamptz default now()
);
create index on serp_position_snapshots (campaign_id, cluster_key, captured_at desc);

create table auction_snapshots (               -- сырьё из Способа A, для истории и прогноза
  id bigserial primary key,
  cluster_key text not null,
  payload jsonb not null,                      -- [{nm_id, cpm, position}]
  captured_at timestamptz default now()
);

create table adv_daily_stats (
  campaign_id uuid not null references adv_campaigns(id) on delete cascade,
  cluster_key text,                            -- NULL = вся кампания
  date date not null,
  spend numeric default 0, impressions int default 0, clicks int default 0,
  carts int default 0, orders int default 0, revenue numeric default 0,
  primary key (campaign_id, cluster_key, date)
);
-- вычисляемые: ctr = clicks/impressions, cpc = spend/clicks, drr = spend/revenue
```

Токены рекламного API хранить только в Supabase Vault (`vault.create_secret`), в таблицах — только `secret_id`. Рекламные вызовы тратят реальные деньги — это критичнее read-only аналитики.

---

## 6. Задачи pg_cron

| Job | Интервал | Что делает |
|---|---|---|
| `autobidder_tick` | */3 или */5 мин | Раздел 4 |
| `sync_campaigns` | */30 мин | `GET adverts` + `normquery/list` → `adv_campaigns`, `adv_clusters` |
| `sync_daily_stats` | 1 раз/сутки 06:00 | `fullstats` + `normquery/stats` → `adv_daily_stats` |
| `recompute_tiers` | 1 раз/сутки после stats | Раздел 4b |
| `recompute_max_bid_from_drr` | 1 раз/сутки | Раздел 7.1 |
| `cleanup_snapshots` | 1 раз/сутки | удалять `serp_position_snapshots` и `auction_snapshots` старше 30 дней |

---

## 7. Чем сделать ЛУЧШЕ, чем MPSTATS (три конкретные гипотезы)

### 7.1 Целевой ДРР вместо ручного `max_bid` (у MPSTATS нет, есть у MarketGuru)
Пользователь MPSTATS должен сам угадать потолок ставки. Это слабое место — большинство селлеров не знают, какая ставка ещё окупается. В NR Space уже есть движок юнит-экономики (`wb-formulas.js`: цена, комиссия, логистика, себестоимость). Значит, потолок можно **вычислять**, а не спрашивать:

```
allowed_ad_spend_per_order = price * target_drr_pct / 100
expected_orders_per_1000_impr = CTR_cluster * CR_cluster * 1000   -- из adv_daily_stats
max_bid_effective = allowed_ad_spend_per_order * expected_orders_per_1000_impr
```
Пересчитывать ежедневно по свежим CTR/CR кластера. Пользователь задаёт одно число — "ДРР не выше 12%" — остальное считает система. Это и есть стратегия `target_drr`. **Это главное УТП против MPSTATS** — оно опирается на то, что у вас уже построено.

### 7.2 Почасовое расписание ставок из тепловой карты продаж
MPSTATS сам же отдаёт `sales_heatmap` по часам (мы её видели в отчётах по вашим SKU: пики продаж в 13:00 и 18:00, провал 01:00-06:00), но в автобиддере это не использует. Реализация: `schedule.boost = {"13":1.15,"18":1.15}` и `schedule.hours=[7..23]` → в тике `max_bid_effective *= boost[hour]`, ночью — ставка на `min_bid_floor` или пауза. Данные для heatmap уже в вашем RNP-дашборде.

### 7.3 Учёт органики (у MPSTATS не заявлено, есть у MarketGuru)
Раздел 4.1: если карточка органически в топ-5 по кластеру — не платить за рекламу на этой же позиции. Простейшая проверка, экономит заметную долю бюджета на "раскачанных" кластерах. Требует только чтения поисковой выдачи, которое и так нужно для Способа B.

Дополнительно (дешёвые улучшения):
- Автопредложение минус-фраз: кластеры с тиром `impressions` > 7 дней без корзин → кнопка "добавить в минус" (`set-minus`)
- Виджет "Сэкономлено": сумма `(max_bid − new_bid) × impressions/1000` по `bid_history` — наглядная ценность модуля для клиента
- Алерт при росте ДРР 3 дня подряд без роста заказов

---

## 8. UI (MVP, 4 экрана)

1. **Кампании** — таблица: кампания, тип, кластеров активных, статус биддера (в диапазоне / вне / лимит), ДРР 7д, расход 7д
2. **Правило** — форма: стратегия (4 варианта), диапазон позиций, `max_bid` ИЛИ целевой ДРР (переключатель), расписание (чекбоксы часов + буст пиков), порог органики
3. **Кластеры кампании** — таблица с тирами, статистикой, текущей ставкой, действиями "усилить / в минус"
4. **Журнал** — график позиция+ставка во времени (две серии) + таблица `bid_history` с фильтром по `source/reason`

---

## 9. План внедрения (порядок для Cursor)

1. Миграции БД (раздел 5) + Vault для токенов
2. Расширить WB proxy Edge Function неймспейсом `/adv/*` с throttle и retry
3. `sync_campaigns` + `sync_daily_stats` → экран 1 работает read-only
4. Способ B (замкнутый контур) + `autobidder_tick` со стратегией `min_sufficient` → первый рабочий биддер на официальном API
5. Журнал (экран 4) — без него клиент не увидит ценности
6. Способ A (парсер аукциона) как ускоритель, с автоматическим fallback на B при ошибке
7. Тиры кластеров (4b) + минус-фразы
8. `target_drr` (7.1) + расписание (7.2) + органика (7.3) — то, что отличает от MPSTATS

Тестировать на одной кампании одного кабинета с жёстким `max_bid` и дневным лимитом бюджета в WB, пока не наберётся 7 дней логов.

---

## 10. Что подтверждено источниками, а что — гипотеза

**Подтверждено** (базы знаний MPSTATS/PromoPult/MarketGuru/MP Manager, OpenAPI WB): принцип минимально достаточной ставки; диапазон позиций + max_bid; парсинг ставок конкурентов с аукциона каждые 2-5 мин как стандарт рынка; "перебить на 1₽"; завышенные рекомендации CPM в кабинете WB; кластерная модель ставок и эндпоинты `normquery/*`; конфликт Ручной/Единой ставки; тиры кластеров по заказам/корзинам/показам; учёт органики и целевой ДРР как фичи конкурентов; каннибализация своих кампаний у MPSTATS.

**Гипотеза / собственное проектирование**: схема БД; конкретный псевдокод и параметры (`step_pct`, `hysteresis`); формула `max_bid_effective` из ДРР; актуальный формат неофициальных эндпоинтов выдачи/аукциона (проверить в DevTools); утверждение, что WB накладывает весовые коэффициенты поверх ставки — подтверждено MPSTATS на уровне "позиция зависит от многих коэффициентов", но состав коэффициентов не раскрыт.

---

## 11. Мультикабинетное управление: 3–4+ кабинетов из одного окна

Контекст: у NR Space уже есть изоляция кабинетов (request-ID pattern) и Telegram-бот с 6 каналами отчётов. Автобиддер встраивается в эту модель, а не создаёт свою.

### 11.1 Модель данных — надстройка над разделом 5

```sql
-- Уже есть: cabinets(id, name, wb_token_secret_id, ...). Добавляем:
alter table cabinets add column adv_token_secret_id uuid;         -- отдельный токен с правами "Продвижение" (Vault)
alter table cabinets add column adv_token_valid boolean default true;
alter table cabinets add column adv_token_checked_at timestamptz;
alter table cabinets add column adv_daily_budget_cap numeric;     -- глобальный дневной лимит на кабинет
alter table cabinets add column adv_group_id uuid;                -- группа кабинетов (например "Уркунбаев: ZEVINA/AiLIN/Azars")

create table cabinet_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  adv_daily_budget_cap numeric                                    -- лимит на всю группу
);

-- Шаблоны правил — одно правило → применить к N кампаниям в M кабинетах
create table autobidder_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,                                             -- "Школьный сезон: топ-10, ДРР 12%"
  config jsonb not null                                           -- те же поля, что в autobidder_rules
);
alter table autobidder_rules add column template_id uuid references autobidder_templates(id);
-- Если template_id не NULL — правило "привязано": изменение шаблона обновляет все привязанные правила
```

### 11.2 Изоляция и доступ (RLS)
- Все таблицы раздела 5 уже содержат `campaign_id → cabinet_id`. RLS-политика: `cabinet_id IN (select cabinet_id from user_cabinet_access where user_id = auth.uid())`.
- Роли: `owner` (все кабинеты, бюджеты, токены), `ads_manager` (правила и ставки в назначенных кабинетах — роль для Ольги), `viewer` (только журнал и дашборд — для Инсии/клиентов).
- Токены кабинетов никогда не покидают Edge Function: фронт вызывает `/adv/*` прокси с `cabinet_id`, прокси сам достаёт секрет из Vault по `adv_token_secret_id`.

### 11.3 Планировщик — один тик на все кабинеты
Rate limits рекламного API WB считаются **на токен**, т.е. на кабинет. Значит:
- `autobidder_tick` обходит кабинеты **параллельно** (`Promise.allSettled` по кабинетам), внутри кабинета — последовательно с throttle.
- Ошибка/401 одного кабинета не останавливает остальные: ставим `adv_token_valid=false`, шлём алерт, идём дальше. (Ровно тот случай, что мы видели в MPSTATS-подключении — кабинет "Ольга В." с `valid:false` висит невалидным; у нас это должно подсвечиваться красным в тот же час, а не обнаруживаться случайно.)
- Отдельный job `check_tokens` раз в час: `GET /api/advert/v2/adverts` с лимитом 1 — жив ли токен.

### 11.4 Кросс-кабинетная каннибализация — то, чего нет у MPSTATS
MPSTATS ловит конфликт кампаний только внутри **одного** кабинета. У вас одна товарная линейка (ZEVINA, AiLIN, блузки BAZ.A) разведена по нескольким юрлицам-кабинетам. Реальный риск: кабинет Уркунбаев и кабинет Айлин Стиль одновременно торгуются за кластер "блузка школьная нарядная" и **поднимают ставку друг другу**. Ни один биддер на рынке это не увидит, потому что смотрит на один токен.

Реализация — расширить 4a: проверка `pg_trgm similarity` по `cluster_key` **по всем кабинетам группы**, а не только внутри кабинета. При конфликте:
- предупреждение в UI с указанием обоих кабинетов;
- опция "назначить главного": один кабинет биддится в целевой диапазон, второй получает правило `min_bid_floor` (присутствие без гонки);
- отчёт "сколько сэкономлено на снятии внутренней конкуренции".
Это **уникальное УТП для мультибрендовых селлеров и агентств** — вашей же аудитории как консалтинга.

### 11.5 Бюджеты в три уровня
`org → cabinet_group → cabinet → campaign`. Тик проверяет расход снизу вверх: если исчерпан лимит группы — все правила группы переводятся в `min_bid_floor` до 00:00, с алертом. Расход берётся из `adv_daily_stats` за сегодня (синк каждые 30 мин) + оценка по `bid × impressions` между синками.

### 11.6 Экран "Командный центр" (добавляется к 4 экранам раздела 8)
Одна таблица, строка = кабинет, раскрывается до кампаний → кластеров:

| Кабинет | Токен | Кампаний акт. | Расход сегодня / лимит | ДРР 7д | В диапазоне | Вне диапазона | Упёрлись в лимит | Действия |
|---|---|---|---|---|---|---|---|---|
| Уркунбаев | 🟢 | 6 | 4 200 / 8 000 ₽ | 11,2% | 14 | 3 | 1 | ⏸ ▶ ✎ |
| Айлин Стиль | 🟢 | 3 | 1 900 / 4 000 ₽ | 9,8% | 7 | 0 | 0 | ⏸ ▶ ✎ |
| BAZ.A (Бейшеев) | 🔴 401 | — | — | — | — | — | — | обновить токен |

Верхняя панель — цифры по всем кабинетам суммарно + "Сэкономлено за 7 дней". Цветные статусы, сортировка по "вне диапазона" и по ДРР — чтобы за 10 секунд увидеть, где проблема.

**Массовые действия** (у MPSTATS появились в 2025 — обязательный минимум): чекбоксы по кабинетам/кампаниям → пауза / запуск / применить шаблон / изменить max_bid на X% / выставить расписание. Всё через одну Edge Function `adv_bulk_action`, которая раскладывает действие по токенам.

### 11.7 Алерты в существующий Telegram-бот
Не строить новую нотификацию — у бота уже 6 каналов. Добавить типы событий, маршрутизация по кабинету:
- `token_invalid` — сразу, владельцу
- `max_bid_hit` — раз в час дайджестом, ads_manager
- `budget_cap_reached` (кабинет/группа) — сразу
- `cross_cabinet_conflict` — при обнаружении
- `drr_rising` (3 дня подряд без роста заказов) — утренний дайджест
Формат сообщения: кабинет → кампания → кластер → что произошло → кнопка-deeplink в Командный центр.

### 11.8 Дополнение к плану внедрения (раздел 9)
Шаги 1–5 делать сразу с `cabinet_id` и RLS (иначе переделывать). После шага 5 → **11.3 (параллельный тик + check_tokens)** и **11.6 (Командный центр)** — раньше, чем Способ A и тиры, потому что для 3–4 кабинетов контроль важнее скорости реакции. 11.4 (кросс-кабинетная каннибализация) — после 7.1, это ваша главная отличительная фича вместе с целевым ДРР.
