# Маркетинг и продвижение — полный дамп OpenAPI WB

Источник: [dev.wildberries.ru/docs/openapi/promotion](https://dev.wildberries.ru/docs/openapi/promotion)

Это **все** разделы страницы: Кампании, Создание кампаний, Управление кампаниями, Поисковые кластеры, Финансы, Медиа, Статистика, Календарь акций.

Спека: официальный YAML `Маркетинг и продвижение` (`openapi: 3.0.1`, `version: promotion`) — 39 операций, 8 тегов, 77 схем. Снято 10.09.2026.

Сырой YAML (как у WB): [`docs/wb-openapi-promotion.yaml`](wb-openapi-promotion.yaml).

Токен: категория **Продвижение**, заголовок `Authorization` (`HeaderApiKey`).

Узнать больше о маркетинге и продвижении можно в [справочном центре](https://seller.wildberries.ru/instructions/category/59d92bd3-6ea0-40f2-b762-ca8835d7d42e?goBackOption=prevRoute&categoryId=479385c6-de01-4b4d-ad4e-ed941e65582e)

Методы маркетинга и продвижения позволяют:
  1. Получать информацию о кампаниях [продвижения](/openapi/promotion#tag/campaigns) и [медиакампаниях](/openapi/promotion#tag/media)
  2. [Создавать](/openapi/promotion#tag/creatingCampaigns) и [управлять](/openapi/promotion#tag/campaignManagement) кампаниями
  3. Управлять [финансами](/openapi/promotion#tag/finances) кампаний
  4. Выгружать [статистику](/openapi/promotion#tag/statistics) кампаний продвижения и медиакампаний
  5. Работать с [календарём акций](/openapi/promotion#tag/promoCalendar)

Данные синхронизируются с базой раз в 3 минуты. Статусы кампаний меняются раз в минуту. Ставки кампаний меняются раз в 30 секунд.

Вы можете протестировать методы продвижения в [песочнице](/sandbox). Также в песочнице доступны [специальные методы](/docs/openapi-other/sandbox-environment#tag/Prodvizhenie) для управления тестовым балансом

## Оглавление

1. [Кампании](#кампании) — 2 методов
2. [Создание кампаний](#создание-кампаний) — 4 методов
3. [Управление кампаниями](#управление-кампаниями) — 10 методов
4. [Поисковые кластеры](#поисковые-кластеры) — 7 методов
5. [Финансы](#финансы) — 5 методов
6. [Медиа](#медиа) — 3 методов
7. [Статистика](#статистика) — 4 методов
8. [Календарь акций](#календарь-акций) — 4 методов
9. [Схемы](#схемы-componentsschemas)
10. [Общие параметры / ответы](#общие-параметры-и-ответы)

## Сводка всех методов

| Раздел | Method | Path | Host | operationId | Кратко |
|---|---|---|---|---|---|
| Кампании | GET | `/adv/v1/promotion/count` | `advert-api.wildberries.ru` | `getV1PromotionCount` | Списки кампаний |
| Кампании | GET | `/api/advert/v2/adverts` | `advert-api.wildberries.ru` | `getV2Adverts` | Информация о кампаниях |
| Создание кампаний | POST | `/api/advert/v1/bids/min` | `advert-api.wildberries.ru` | `postV1BidsMin` | Минимальные ставки для карточек товаров |
| Создание кампаний | POST | `/adv/v2/seacat/save-ad` | `advert-api.wildberries.ru` | `postV2SeacatSaveAd` | Создать кампанию |
| Создание кампаний | GET | `/adv/v1/supplier/subjects` | `advert-api.wildberries.ru` | `getV1SupplierSubjects` | Предметы для кампаний |
| Создание кампаний | POST | `/adv/v2/supplier/nms` | `advert-api.wildberries.ru` | `postV2SupplierNms` | Карточки товаров для кампаний |
| Управление кампаниями | GET | `/adv/v0/delete` | `advert-api.wildberries.ru` | `getV0Delete` | Удаление кампании |
| Управление кампаниями | POST | `/adv/v0/rename` | `advert-api.wildberries.ru` | `postV0Rename` | Переименование кампании |
| Управление кампаниями | GET | `/adv/v0/start` | `advert-api.wildberries.ru` | `getV0Start` | Запуск кампании |
| Управление кампаниями | GET | `/adv/v0/pause` | `advert-api.wildberries.ru` | `getV0Pause` | Пауза кампании |
| Управление кампаниями | GET | `/adv/v0/stop` | `advert-api.wildberries.ru` | `getV0Stop` | Завершение кампании |
| Управление кампаниями | PUT | `/adv/v0/auction/placements` | `advert-api.wildberries.ru` | `putV0AuctionPlacements` | Изменение мест размещения в кампаниях с ручной ставкой |
| Управление кампаниями | PATCH | `/api/advert/v1/bids` | `advert-api.wildberries.ru` | `patchV1Bids` | Изменение ставок в кампаниях |
| Управление кампаниями | PATCH | `/adv/v0/auction/nms` | `advert-api.wildberries.ru` | `patchV0AuctionNms` | Изменение списка карточек товаров в кампаниях |
| Управление кампаниями | GET | `/api/advert/v0/bids/recommendations` | `advert-api.wildberries.ru` | `getV0BidsRecommendations` | Рекомендуемые ставки для карточек товаров и поисковых кластеров |
| Управление кампаниями | GET | `/api/advert/v1/config` | `advert-api.wildberries.ru` | `getV1Config` | Конфигурационные значения продвижения |
| Поисковые кластеры | POST | `/adv/v0/normquery/get-bids` | `advert-api.wildberries.ru` | `postV0NormqueryGetBids` | Список ставок поисковых кластеров |
| Поисковые кластеры | POST | `/api/advert/v1/normquery/bids` | `advert-api.wildberries.ru` | `postV1NormqueryBids` | Установить ставки для поисковых кластеров в валюте аккаунта продавца |
| Поисковые кластеры | POST | `/adv/v0/normquery/bids` | `advert-api.wildberries.ru` | `postV0NormqueryBids` | Установить ставки для поисковых кластеров |
| Поисковые кластеры | DELETE | `/adv/v0/normquery/bids` | `advert-api.wildberries.ru` | `deleteV0NormqueryBids` | Удалить ставки поисковых кластеров |
| Поисковые кластеры | POST | `/adv/v0/normquery/get-minus` | `advert-api.wildberries.ru` | `postV0NormqueryGetMinus` | Список минус-фраз кампаний |
| Поисковые кластеры | POST | `/adv/v0/normquery/set-minus` | `advert-api.wildberries.ru` | `postV0NormquerySetMinus` | Установка и удаление минус-фраз |
| Поисковые кластеры | POST | `/adv/v0/normquery/list` | `advert-api.wildberries.ru` | `postV0NormqueryList` | Списки активных и неактивных поисковых кластеров |
| Финансы | GET | `/adv/v1/balance` | `advert-api.wildberries.ru` | `getV1Balance` | Баланс |
| Финансы | GET | `/adv/v1/budget` | `advert-api.wildberries.ru` | `getV1Budget` | Бюджет кампании |
| Финансы | POST | `/adv/v1/budget/deposit` | `advert-api.wildberries.ru` | `postV1BudgetDeposit` | Пополнение бюджета кампании |
| Финансы | GET | `/adv/v1/upd` | `advert-api.wildberries.ru` | `getV1Upd` | Получение истории затрат |
| Финансы | GET | `/adv/v1/payments` | `advert-api.wildberries.ru` | `getV1Payments` | Получение истории пополнений счёта |
| Медиа | GET | `/adv/v1/count` | `advert-media-api.wildberries.ru` | `getV1Count` | Количество медиакампаний |
| Медиа | GET | `/adv/v1/adverts` | `advert-media-api.wildberries.ru` | `getV1Adverts` | Список медиакампаний |
| Медиа | GET | `/adv/v1/advert` | `advert-media-api.wildberries.ru` | `getV1Advert` | Информация о медиакампании |
| Статистика | POST | `/adv/v0/normquery/stats` | `advert-api.wildberries.ru` | `postV0NormqueryStats` | Статистика поисковых кластеров |
| Статистика | GET | `/adv/v3/fullstats` | `advert-api.wildberries.ru` | `getV3Fullstats` | Статистика кампаний |
| Статистика | POST | `/adv/v1/stats` | `advert-media-api.wildberries.ru` | `postV1Stats` | Статистика медиакампаний |
| Статистика | POST | `/adv/v1/normquery/stats` | `advert-api.wildberries.ru` | `postV1NormqueryStats` | Статистика по поисковым кластерам с детализацией по дням |
| Календарь акций | GET | `/api/v1/calendar/promotions` | `dp-calendar-api.wildberries.ru` | `getV1CalendarPromotions` | Список акций |
| Календарь акций | GET | `/api/v1/calendar/promotions/details` | `dp-calendar-api.wildberries.ru` | `getV1CalendarPromotionsDetails` | Детальная информация об акциях |
| Календарь акций | GET | `/api/v1/calendar/promotions/nomenclatures` | `dp-calendar-api.wildberries.ru` | `getV1CalendarPromotionsNomenclatures` | Список товаров для участия в акции |
| Календарь акций | POST | `/api/v1/calendar/promotions/upload` | `dp-calendar-api.wildberries.ru` | `postV1CalendarPromotionsUpload` | Добавить товар в акцию |

---

# Кампании

## GET `/adv/v1/promotion/count`

**Списки кампаний**  
`operationId`: `getV1PromotionCount` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает списки всех [рекламных кампаний](/openapi/promotion#tag/campaigns/operation/getV2Adverts) продавца с их ID. Кампании сгруппированы по типу и статусу, у каждой указана дата последнего изменения.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 4 запроса | 15 мин | 1 запрос |

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **adverts** (`array · nullable`) — Данные по кампаниям
    - **items** (`object`)
      - **type** (`integer`) — Тип кампании:
          - `8` — кампания с единой ставкой (**устаревший тип**)
          - `9` — кампания с единой или ручной ставкой. Тип ставки вы можете получить с помощью метода [Информация о кампаниях](./promotion#tag/campaigns/operation/getV2Adverts), поле `bid_type`
      - **status** (`integer`) — Статус кампании
      - **count** (`integer`) — Количество кампаний
      - **advert_list** (`array`) — Список кампаний
        - **items** (`object`)
          - **advertId** (`integer`) — ID кампании
          - **changeTime** (`string · date-time`) — Дата и время последнего изменения кампании
  - **all** (`integer`) — Общее количество кампаний всех статусов и типов

Пример:

```json
{
  "adverts": [
    {
      "type": 9,
      "status": 8,
      "count": 3,
      "advert_list": [
        {
          "advertId": 6485174,
          "changeTime": "2023-05-10T12:12:52.676254+03:00"
        },
        {
          "advertId": 6500443,
          "changeTime": "2023-05-10T17:08:46.370656+03:00"
        },
        {
          "advertId": 7936341,
          "changeTime": "2023-07-12T15:51:08.367478+03:00"
        }
      ]
    }
  ],
  "all": 3
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/api/advert/v2/adverts`

**Информация о кампаниях**  
`operationId`: `getV2Adverts` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает информацию о рекламных кампаниях с единой или ручной ставкой по их статусам, типам оплаты и ID.

 
[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `ids` | query | string | нет | ID кампаний, максимум 50 |
| `statuses` | query | string | нет | Статусы кампаний: |
| `payment_type` | query | string enum | нет | Тип оплаты: |

Детали параметров:

пример `ids`: `12345,23456,34567,45678,56789`

**`statuses`**

Статусы кампаний:
- `-1` — удалена, процесс удаления будет завершён в течение 10 минут
- `4` — готова к запуску
- `7` — завершена
- `8` — отменена
- `9` — активна
- `11` — на паузе

пример `statuses`: `-1,4,8`

**`payment_type`**

- **payment_type** (`string · enum: "cpm", "cpc"`)

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **adverts** **обязательное** (`array`) — Кампании
    - **items** (`object`)
      - **bid_type** **обязательное** (`string`) — Тип ставки:
          - `unified` — единая ставка
          - `manual` — ручная ставка
      - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **id** **обязательное** (`integer · int64`) — ID кампании
      - **nm_settings** **обязательное** (`array · nullable`) — Настройки товаров
        - **items** (`object`)
          - **bids_kopecks** **обязательное** — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **search** **обязательное** (`integer · int64`) — Ставка в поиске
            - **recommendations** **обязательное** (`integer · int64`) — Ставка в рекомендациях
          - **subject** **обязательное** (`object`) — Предмет
            - **id** **обязательное** (`integer · int64`) — ID предмета
            - **name** **обязательное** (`string`) — Название предмета
          - **nm_id** **обязательное** (`integer · int64`) — Артикул WB
      - **settings** **обязательное** (`object`) — Настройки кампании
        - **payment_type** **обязательное** (`string`) — Тип оплаты:
          - `cpm` — за показы
          - `cpc` — за клик
        - **name** **обязательное** (`string`) — Название кампании
        - **placements** **обязательное** (`object`) — Места размещения
          - **search** **обязательное** (`boolean`) — Размещение в поиске:
              - `false` — отключено
              - `true` — включено
          - **recommendations** **обязательное** (`boolean`) — Размещение в рекомендациях:
              - `false` — отключено
              - `true` — включено
      - **restrictions** **обязательное** (`object`) — Ограничения кампании
        - **can_change_nms** (`boolean`) — Можно ли изменять список товаров кампании:
            - `true` — да
            - `false` — нет
      - **status** **обязательное** (`integer · enum: -1, 4, 7, 8, 9, 11`) — Статус кампании:
        - `-1` — удалена, процесс удаления будет завершён в течение 10 минут
        - `4` — готова к запуску
        - `7` — завершена
        - `8` — отменена
        - `9` — активна
        - `11` — на паузе
      - **timestamps** **обязательное** (`object`) — Временные отметки
        - **created** **обязательное** (`string · date-time`) — Время создания кампании
        - **updated** **обязательное** (`string · date-time`) — Время последнего изменения кампании
        - **started** **обязательное** (`string · date-time · nullable`) — Время последнего запуска кампании
        - **deleted** **обязательное** (`string · date-time`) — Время удаления кампании. Если кампания не удалена, время указывается в будущем

Пример:

```json
{
  "adverts": [
    {
      "bid_type": "manual",
      "currency": "RUB",
      "id": 567456457,
      "nm_settings": [
        {
          "bids_kopecks": {
            "recommendations": 0,
            "search": 0
          },
          "nm_id": 123456789,
          "subject": {
            "id": 52,
            "name": "кошельки"
          }
        },
        {
          "bids_kopecks": {
            "recommendations": 11200,
            "search": 11200
          },
          "nm_id": 987654321,
          "subject": {
            "id": 54,
            "name": "ювелирные кольца"
          }
        }
      ],
      "restrictions": {
        "can_change_nms": true
      },
      "settings": {
        "name": "Кампания от 01.02.2024",
        "payment_type": "cpm",
        "placements": {
          "recommendations": false,
          "search": true
        }
      },
      "status": 7,
      "timestamps": {
        "created": "2024-02-01T09:57:38.500606+03:00",
        "deleted": "2024-02-05T14:29:32.633968+03:00",
        "started": "2024-02-05T12:38:10.212086+03:00",
        "updated": "2024-02-05T14:29:32.633968+03:00"
      }
    },
    {
      "bid_type": "manual",
      "currency": "RUB",
      "id": 28150154,
      "nm_settings": [
        {
          "bids_kopecks": {
            "recommendations": 0,
            "search": 1100
          },
          "nm_id": 5764746785,
          "subject": {
            "id": 69,
            "name": "платья"
          }
        }
      ],
      "restrictions": {
        "can_change_nms": false
      },
      "settings": {
        "name": "Кампания от 28.08.2025 ",
        "payment_type": "cpc",
        "placements": {
          "recommendations": false,
          "search": true
        }
      },
      "status": 11,
      "timestamps": {
        "created": "2025-08-28T09:50:57.611559+03:00",
        "deleted": "2100-01-01T00:00:00+03:00",
        "started": null,
        "updated": "2025-09-10T10:14:58.475499+03:00"
      }
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Создание кампаний

## POST `/api/advert/v1/bids/min`

**Минимальные ставки для карточек товаров**  
`operationId`: `postV1BidsMin` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает минимальные ставки для карточек товаров в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) — по типу оплаты и местам размещения.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 20 запросов | 3 сек | 5 запросов |
| Сервисный | 1 мин | 20 запросов | 3 сек | 5 запросов |
| Базовый с секретом | 1 мин | 20 запросов | 3 сек | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **advert_id** **обязательное** (`integer · int64`) — ID кампании
  - **nm_ids** **обязательное** (`array · minLength=1 · maxLength=100`) — Список артикулов WB
    - **items** (`integer · int64`)
  - **payment_type** **обязательное** (`string · enum: "cpm", "cpc"`) — Тип оплаты:
          - `cpm` — за показы
          - `cpc` — за клик
  - **placement_types** **обязательное** (`array`) — Места размещения:
      - `search` — поиск
      - `recommendation` — рекомендации
      - `combined` — поиск и рекомендации
    - **items** (`string · enum: "combined", "search", "recommendation"`)

Пример:

```json
{
  "advert_id": 98765432,
  "nm_ids": [
    12345678,
    87654321
  ],
  "payment_type": "cpm",
  "placement_types": [
    "combined",
    "search",
    "recommendation"
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **bids** **обязательное** (`array`) — Список карточек товаров со ставками
    - **items** (`object`)
      - **bids** **обязательное** (`array`) — Список ставок по местам размещения
        - **items** (`object`)
          - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **type** **обязательное** (`string · enum: "combined", "search", "recommendation"`) — Места размещения:
              - `search` — поиск
              - `recommendation` — рекомендации
              - `combined` — поиск и рекомендации
          - **value** **обязательное** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **nm_id** **обязательное** (`integer · int64`) — Артикул WB

Пример:

```json
{
  "bids": [
    {
      "bids": [
        {
          "currency": "RUB",
          "type": "combined",
          "value": 155
        },
        {
          "currency": "RUB",
          "type": "search",
          "value": 250
        },
        {
          "currency": "RUB",
          "type": "recommendation",
          "value": 250
        }
      ],
      "nm_id": 12345678
    },
    {
      "bids": [
        {
          "currency": "RUB",
          "type": "combined",
          "value": 155
        },
        {
          "currency": "RUB",
          "type": "search",
          "value": 250
        },
        {
          "currency": "RUB",
          "type": "recommendation",
          "value": 250
        }
      ],
      "nm_id": 87654321
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v2/seacat/save-ad`

**Создать кампанию**  
`operationId`: `postV2SeacatSaveAd` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод создаёт кампанию:
  - с ручной ставкой для продвижения товаров в поиске и/или рекомендациях
  - с единой ставкой для продвижения товаров одновременно в поиске и рекомендациях

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Сервисный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый с секретом | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса

Content-Type: `application/json`

- **body** (`object`)
  - **name** **обязательное** (`string`) — Название кампании
  - **nms** (`array`) — Карточки товаров для кампании. Доступные карточки товаров можно получить с помощью метода [Карточки товаров для кампаний](./promotion#tag/creatingCampaigns/operation/postV2SupplierNms). Максимум 50 товаров (`nm`)
    - **items** (`integer`) — Артикул WB (`nmId`)
  - **bid_type** (`string · enum: "manual", "unified" · default=manual`) — Тип ставки:
      - `manual` — ручная
      - `unified` — единая
  - **payment_type** (`string · enum: "cpm", "cpc" · default=cpm`) — Тип оплаты:
    - `cpm` — за показы
    - `cpc` — за клик. При создании с этим типом оплаты в кампании автоматически устанавливается минимальная ставка
  - **placement_types** (`array · default=['search']`) — Места размещения:
      - `search` — в поиске
      - `recommendations` — в рекомендациях
    
    Укажите только для кампании с ручной ставкой
    - **items** (`string · enum: "search", "recommendations"`)

Пример:

```json
{
  "name": "Телефоны",
  "nms": [
    146168367,
    200425104
  ],
  "bid_type": "manual",
  "placement_types": [
    "search",
    "recommendations"
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`integer`) — ID кампании
  пример: `1234567`

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`string`)

Пример:

```json
"Нет доступных категорий для рк. Создайте новую кампанию для попадания в текущие категории"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/supplier/subjects`

**Предметы для кампаний**  
`operationId`: `getV1SupplierSubjects` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает список [предметов](/openapi/work-with-products#tag/categoriesSubcategoriesAndCharacteristics/paths/~1content~1v2~1object~1all/get), которые можно добавить в рекламную [кампанию](/openapi/promotion#tag/campaigns/operation/getV2Adverts).

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 12 сек | 1 запрос | 12 сек | 5 запросов |
| Сервисный | 12 сек | 1 запрос | 12 сек | 5 запросов |
| Базовый с секретом | 12 сек | 1 запрос | 12 сек | 5 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `payment_type` | query | string | нет | Тип оплаты: |

Детали параметров:

**`payment_type`**

Тип оплаты:
- `cpm` — за показы
- `cpc` — за клик

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array · nullable`)
  - **items** (`object`)
    - **id** (`integer`) — ID предмета
    - **name** (`string`) — Предмет
    - **count** (`integer`) — Количество Артикулов WB (`nmId`) с таким предметом.

Пример `Array`:

```json
[
  {
    "name": "3D очки",
    "id": 2560,
    "count": 1899
  }
]
```

Пример `null`:

```json
null
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 404 — Не найдено

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v2/supplier/nms`

**Карточки товаров для кампаний**  
`operationId`: `postV2SupplierNms` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает список [карточек товаров](/openapi/work-with-products#tag/listings/paths/~1content~1v2~1get~1cards~1list/post), которые можно добавить в рекламную [кампанию](/openapi/promotion#tag/campaigns/operation/getV2Adverts). Для получения карточек необходимы ID [предметов](/openapi/promotion#tag/creatingCampaigns/operation/getV1SupplierSubjects), также доступных для добавления в кампанию.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Сервисный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый с секретом | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса

ID предметов, для которых нужно получить карточки товаров

Content-Type: `application/json`

- **body** (`array`)
  - **items** (`integer`)

Пример:

```json
[
  123,
  456,
  765,
  321
]
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array · nullable`) — Карточки товаров для кампаний
  - **items** (`object`)
    - **title** (`string`) — Название товара
      пример: `"Плед"`
    - **nm** (`integer`) — Артикул WB
      пример: `146168367`
    - **subjectId** (`integer`) — ID предмета
      пример: `765`

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример:

```json
"Ошибка обработки тела запроса"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Управление кампаниями

## GET `/adv/v0/delete`

**Удаление кампании**  
`operationId`: `getV0Delete` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод удаляет [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts) в статусе `4` — готова к запуску.

После удаления кампания некоторое время будет находиться в статусе `-1` — кампания в процессе удаления. Полное удаление кампании занимает от 3 до 10 минут.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `ResponseInvalidCampaignID`:

```json
{
  "error": "Некорректный ID кампании"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v0/rename`

**Переименование кампании**  
`operationId`: `postV0Rename` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод меняет название [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts). Это можно сделать в любой момент существования кампании.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса

Content-Type: `application/json`

- **body** (`object`)
  - **advertId** **обязательное** (`integer`) — ID кампании, в которой меняется название
  - **name** **обязательное** (`string`) — Новое название (максимум 100 символов)

Пример:

```json
{
  "advertId": 2233344,
  "name": "newname"
}
```

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример `InvalidRcIdAdv`:

```json
"Некорректный ID РК"
```

Пример `IncorrectName`:

```json
"Некорректное название"
```

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Ошибка обработки параметров запроса

Content-Type: `text/plain`

- **response** (`string`)

Пример `RequestBodyProcessErrorAdv`:

```json
"Ошибка обработки тела запроса"
```

Пример `CompanyNameChangeErr`:

```json
"Ошибка изменения названия кампании"
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v0/start`

**Запуск кампании**  
`operationId`: `getV0Start` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод запускает [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts) в статусах `4` — готово к запуску — или `11` — пауза.
Чтобы запустить кампанию, проверьте ее бюджет. Если бюджета недостаточно, [пополните его](/openapi/promotion#tag/finances/operation/postV1BudgetDeposit).

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

Детали параметров:

пример `id`: `1234`

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `IncorrectId`:

```json
{
  "error": "Invalid Advert: invalid advert"
}
```

Пример `AdvertNotFound`:

```json
{
  "error": "AdvertChangeStatus: Not Found: advert not found"
}
```

Пример `LowBudget`:

```json
{
  "error": "AdvertChangeStatus: Low Budget: not enough budget"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Статус не изменен

Content-Type: `text/plain`

- **response** (`string`)

Пример `StatusNoChangeAdv`:

```json
"Статус кампании не изменен"
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v0/pause`

**Пауза кампании**  
`operationId`: `getV0Pause` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод ставит [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts) в статусе `9` — активна — на паузу.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

Детали параметров:

пример `id`: `1234`

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `IncorrectId`:

```json
{
  "error": "Invalid Advert: invalid advert"
}
```

Пример `AdvertNotFound`:

```json
{
  "error": "AdvertChangeStatus: Not Found: advert not found"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Статус не изменен

Content-Type: `text/plain`

- **response** (`string`)

Пример `StatusNoChangeAdv`:

```json
"Статус кампании не изменен"
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v0/stop`

**Завершение кампании**  
`operationId`: `getV0Stop` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод завершает [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts) в статусах:
  - `9` — активна
  - `11` — пауза

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

Детали параметров:

пример `id`: `1234`

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `IncorrectId`:

```json
{
  "error": "Invalid Advert: invalid advert"
}
```

Пример `AdvertNotFound`:

```json
{
  "error": "AdvertChangeStatus: Not Found: advert not found"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Статус не изменен

Content-Type: `text/plain`

- **response** (`string`)

Пример `StatusNoChangeAdv`:

```json
"Статус кампании не изменен"
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## PUT `/adv/v0/auction/placements`

**Изменение мест размещения в кампаниях с ручной ставкой**  
`operationId`: `putV0AuctionPlacements` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод меняет места размещения в кампаниях с ручной ставкой и моделью оплаты за показы — `cpm`.

Для кампаний в статусах `4`, `9` и `11`.

 
[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Сервисный | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **placements** **обязательное** (`array · maxItems=50`) — Места размещения в кампаниях
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer · int64`) — ID кампании
      - **placements** **обязательное** (`object`) — Места размещения
        - **search** **обязательное** (`boolean`) — Размещение в поиске:
            - `false` — отключено
            - `true` — включено
        - **recommendations** **обязательное** (`boolean`) — Размещение в рекомендациях:
            - `false` — отключено
            - `true` — включено

Пример:

```json
{
  "placements": [
    {
      "advert_id": 12345,
      "placements": {
        "search": true,
        "recommendations": true
      }
    }
  ]
}
```

### Ответы

#### HTTP 204 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример `BadRequest`:

```json
{
  "detail": "can not deserialize response body",
  "origin": "camp-api-public-cache",
  "request_id": "9a929a81ea9dc1601fcc4be81f32c1cb",
  "status": 400,
  "title": "invalid payload"
}
```

Пример `BadAdvertPaymentType`:

```json
{
  "detail": "advert 12345 has payment type cpc, placements cannot be changed",
  "origin": "camp-api-public-cache",
  "request_id": "e53addfabe9274d5b8f77272ca085ac4",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## PATCH `/api/advert/v1/bids`

**Изменение ставок в кампаниях**  
`operationId`: `patchV1Bids` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод меняет ставки карточек товаров по артикулам WB в кампаниях:
  - с единой ставкой
  - с ручной ставкой
  - с моделью оплаты `cpc` — за клики

Для кампаний в статусах `4`, `9` и `11`.

В запросе укажите место размещения в параметре `placement`:
  - `combined` — в поиске и рекомендациях для кампаний с единой ставкой
  - `search `или `recommendations` — в поиске или рекомендациях для кампаний с ручной ставкой

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 5 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **bids** **обязательное** (`array · maxItems=50`) — Ставки в кампаниях
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer · int64`) — ID кампании
      - **nm_bids** **обязательное** (`array · maxItems=50`) — Ставки
        - **items** (`object`)
          - **nm_id** **обязательное** (`integer · int64`) — Артикул WB
          - **bid_kopecks** **обязательное** (`integer · int64`) — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **placement** **обязательное** (`string · enum: "search", "recommendations", "combined"`) — Место размещения:
              - `search` — в поиске (для кампаний с ручной ставкой)
              - `recommendations`— в рекомендациях (для кампаний с ручной ставкой)
              - `combined` — в поиске и рекомендациях (для кампаний с единой ставкой)

Пример:

```json
{
  "bids": [
    {
      "advert_id": 12345,
      "nm_bids": [
        {
          "nm_id": 13335157,
          "bid_kopecks": 250,
          "placement": "recommendations"
        }
      ]
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **bids** **обязательное** (`array`) — Результат отработки запроса
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer · int64`) — ID кампании
      - **nm_bids** **обязательное** (`array`) — Ставки
        - **items** (`object`)
          - **nm_id** **обязательное** (`integer · int64`) — Артикул WB
          - **bid_kopecks** **обязательное** (`integer · int64`) — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **placement** **обязательное** (`string`) — Место размещения:
              - `search` — в поиске
              - `recommendations`— в рекомендациях
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
{
  "bids": [
    {
      "advert_id": 12345,
      "nm_bids": [
        {
          "nm_id": 13335157,
          "bid_kopecks": 250,
          "placement": "recommendations"
        }
      ]
    }
  ],
  "currency": "RUB"
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "wrong bid value: 3; min: 150",
  "origin": "camp-api-public-cache",
  "request_id": "9a929a81ea9dc1601fcc4be81f32c1cb",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## PATCH `/adv/v0/auction/nms`

**Изменение списка карточек товаров в кампаниях**  
`operationId`: `patchV0AuctionNms` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод добавляет и удаляет карточки товаров в кампаниях.

Для кампаний в статусах `4`, `9` и `11`.

Для добавляемых товаров устанавливается текущая минимальная ставка.

 
[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Сервисный | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 1 запрос |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **nms** **обязательное** (`array · maxItems=20`) — Карточки товаров в кампаниях
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer · int64`) — ID кампании
      - **nms** **обязательное** (`object`) — Карточки товаров. Максимум 50 товаров для одной кампании
        - **add** — Карточки товаров, которые необходимо добавить
          - **items** (`integer`)
        - **delete** (`array`) — Карточки товаров, которые необходимо удалить
          - **items** (`integer`)

Пример:

```json
{
  "nms": [
    {
      "advert_id": 12345,
      "nms": {
        "add": [
          11111111,
          44444444
        ],
        "delete": [
          55555555
        ]
      }
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **nms** **обязательное** (`array`) — Результат отработки запроса
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer · int64`) — ID кампании
      - **nms** **обязательное** (`object`) — Карточки товаров
        - **added** **обязательное** (`array`) — Добавленные карточки товаров
          - **items** (`integer`)
        - **deleted** **обязательное** (`array`) — Удалённые карточки товаров
          - **items** (`integer`)

Пример:

```json
{
  "nms": [
    {
      "advert_id": 12345,
      "nms": {
        "added": [
          11111111,
          44444444
        ],
        "deleted": [
          55555555
        ]
      }
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "nomenclature 13335157 cannot be both added and deleted for advert 27247695",
  "origin": "camp-api-public-cache",
  "request_id": "6023d2950af564838f9b44a279d2140c",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/api/advert/v0/bids/recommendations`

**Рекомендуемые ставки для карточек товаров и поисковых кластеров**  
`operationId`: `getV0BidsRecommendations` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает рекомендуемые ставки для карточек товаров и поисковых кластеров кампании.
Можно использовать для кампаний с типами оплаты `cpm` — за показы и `cpc` — за клики.

 
[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Сервисный | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый с секретом | 1 мин | 5 запросов | 12 сек | 5 запросов |
| Базовый | 1 ч | 20 запросов | 3 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `nmId` | query | integer | да | Артикул WB |
| `advertId` | query | integer | да | ID кампании |

Детали параметров:

пример `nmId`: `123456789`

пример `advertId`: `987654321`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response**
  oneOf:
    - **oneOf[0]** (`object`)
      - **advertId** (`integer · int64`) — ID кампании
      - **base** (`object`) — Рекомендуемые ставки для карточек товаров
        - **competitiveBid** (`object`) — Конкурентная ставка — расчётная средняя ставка других продавцов, продающих аналогичные товары по похожей цене.
          У половины продавцов из расчёта ставка выше конкурентной, а другой половины — ниже
          - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **leadersBid** (`object`) — Лидерская ставка — средняя ставка с которой товары занимают лидирующие позиции в вашей категории товаров
          - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **top2** (`object`) — Топ-ставка
          - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances). Если `0`, для данного предмета топ-ставка не используется
      - **nmId** (`integer · int64`) — Артикул WB
      - **normQueries** (`array`) — Рекомендуемые ставки для поисковых кластеров
        - **items** (`object`)
          - **normQuery** (`string`) — Поисковый кластер
          - **reachMax** (`object`) — Максимальный охват: 76-100%
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
            - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
          - **reachMedium** (`object`) — Средний охват: 61-75%
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **reachMin** (`object`) — Минимальный охват: 50-60%
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **paymentType** (`string · enum: "cpm"`) — Тип оплаты:
          - `cpm` — за показы
    - **oneOf[1]** (`object`)
      - **advertId** (`integer · int64`) — ID кампании
      - **levels** (`array`) — Рекомендуемые ставки для карточек товаров
        - **items** (`object`)
          - **range1To2** **обязательное** — Ставка для попадания в позиции 1-2
            allOf:
              - **allOf[0]** (`object`)
                - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
          - **range3To10** **обязательное** — Ставка для попадания в позиции 3-10
            allOf:
              - **allOf[0]** (`object`)
                - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
          - **range11To34** **обязательное** — Ставка для попадания в позиции 11-34
            allOf:
              - **allOf[0]** (`object`)
                - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
      - **nmId** (`integer · int64`) — Артикул WB
      - **paymentType** (`string · enum: "cpc"`) — Тип оплаты:
          - `cpc` — за клики

Пример `V0BidsRecommendationsCpmResponse`:

```json
{
  "advertId": 987654321,
  "base": {
    "competitiveBid": {
      "bidKopecks": 39500
    },
    "leadersBid": {
      "bidKopecks": 66900
    },
    "top2": {
      "bidKopecks": 0
    }
  },
  "nmId": 123456789,
  "normQueries": [
    {
      "normQuery": "футболка",
      "reachMax": {
        "bidKopecks": 50500,
        "bidKopecksMin": 49500
      },
      "reachMedium": {
        "bidKopecks": 32000
      },
      "reachMin": {
        "bidKopecks": 32000
      }
    }
  ],
  "paymentType": "cpm"
}
```

Пример `V0BidsRecommendationsCpcResponse`:

```json
{
  "advertId": 12345678,
  "levels": [
    {
      "range11To34": {
        "bidKopecks": 628
      },
      "range1To2": {
        "bidKopecks": 2138
      },
      "range3To10": {
        "bidKopecks": 830
      }
    }
  ],
  "nmId": 123456789,
  "paymentType": "cpc"
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример `IncorrectTypeAdv`:

```json
"Некорректное значение параметра type"
```

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

Пример `IncorrectUsingMethods`:

```json
"Для получения информации передайте или список кампаний, или набор фильтров"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/api/advert/v1/config`

**Конфигурационные значения продвижения**  
`operationId`: `getV1Config` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает валюту, код валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) и допустимые шаги ставок для метода [POST /api/advert/v1/normquery/bids](/openapi/promotion#tag/searchClusters/operation/postV1NormqueryBids)

    Метод [доступен](https://dev.wildberries.ru/openapi/api-information#tag/authorization/Pravila-ispolzovaniya-tokenov-dostupa-k-API) по
        **Персональному** токену, 
        **Сервисному** токену

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- |
| 1 мин | 1 запрос | 1 мин | 10 запросов |

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **currencyCode** **обязательное** (`integer`) — Код валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cpmStep** **обязательное** (`integer · int64`) — Шаг ставки в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) для CPM-кампаний
  - **cpcStep** **обязательное** (`integer · int64`) — Шаг ставки в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) для кампаний CPC
  - **minTopUp** **обязательное** (`integer · int64`) — Минимальная сумма пополнения бюджета кампании в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
     Например, минимальная сумма пополнения бюджета при `"minTopUp": 10000` и `"currency": "UZS"` — 100 узбекских сум

Пример:

```json
{
  "cpcStep": 500,
  "cpmStep": 100000,
  "currency": "UZS",
  "currencyCode": 860,
  "minTopUp": 10000
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

Пример `Response403TokenType`:

```json
{
  "title": "forbidden",
  "detail": "base token is not allowed",
  "code": "base token is not allowed for this path",
  "requestId": "722199b2e15bbca48cc1d488a7989976",
  "origin": "ag-marketplace",
  "status": 403,
  "statusText": "Forbidden",
  "timestamp": "2026-05-25T02:47:09Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Поисковые кластеры

## POST `/adv/v0/normquery/get-bids`

**Список ставок поисковых кластеров**  
`operationId`: `postV0NormqueryGetBids` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает список поисковых кластеров со ставками по:
  - ID кампаний
  - артикулам WB

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

Пример:

```json
{
  "items": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **bids** **обязательное** (`array`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер
      - **bid** **обязательное** (`integer`) — Текущая ставка в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
      - **bid_kopecks** **обязательное** (`integer`) — Текущая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
      - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
{
  "bids": [
    {
      "advert_id": 1825035,
      "bid": 700,
      "bid_kopecks": 70000,
      "currency": "RUB",
      "nm_id": 983512347,
      "norm_query": "Фраза 1"
    },
    {
      "advert_id": 1825035,
      "bid": 9000,
      "bid_kopecks": 25000,
      "currency": "RUB",
      "nm_id": 983512347,
      "norm_query": "Фраза 2"
    },
    {
      "advert_id": 1825035,
      "bid": 9999,
      "bid_kopecks": 25000,
      "currency": "RUB",
      "nm_id": 983512347,
      "norm_query": "Фраза 3"
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/api/advert/v1/normquery/bids`

**Установить ставки для поисковых кластеров в валюте аккаунта продавца**  
`operationId`: `postV1NormqueryBids` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод [доступен](https://dev.wildberries.ru/openapi/api-information#tag/authorization/Pravila-ispolzovaniya-tokenov-dostupa-k-API) по
        **Персональному** токену, 
        **Сервисному** токену

Метод устанавливает ставки на поисковые кластеры в валюте [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
Можно использовать только для кампаний c ручной ставкой и моделью оплаты `cpm` — за показы.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 2 запроса | 500 мс | 4 запроса |
| Сервисный | 1 сек | 2 запроса | 500 мс | 4 запроса |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер
      - **bidMinorUnits** **обязательное** (`integer`) — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
        Допустимый шаг ставки указан в ответе метода [GET /api/advert/v1/config](./promotion#tag/campaignManagement/operation/getV1Config)

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **success** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
      - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **failed** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
      - **reason** **обязательное** (`string`) — Описание причины ошибки

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

Пример `Response403TokenType`:

```json
{
  "title": "forbidden",
  "detail": "base token is not allowed",
  "code": "base token is not allowed for this path",
  "requestId": "722199b2e15bbca48cc1d488a7989976",
  "origin": "ag-marketplace",
  "status": 403,
  "statusText": "Forbidden",
  "timestamp": "2026-05-25T02:47:09Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v0/normquery/bids`

**Установить ставки для поисковых кластеров**  
`operationId`: `postV0NormqueryBids` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод устанавливает ставки в рублях на поисковые кластеры.

Можно использовать только для кампаний с:
  - ручной ставкой
  - моделью оплаты `cpm` — за показы

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 2 запроса | 500 мс | 4 запроса |
| Сервисный | 1 сек | 2 запроса | 500 мс | 4 запроса |
| Базовый с секретом | 1 сек | 2 запроса | 500 мс | 4 запроса |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер
      - **bid** **обязательное** (`integer`) — Ставка за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
{
  "bids": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347,
      "norm_query": "Фраза 1",
      "bid": 1000
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## DELETE `/adv/v0/normquery/bids`

**Удалить ставки поисковых кластеров**  
`operationId`: `deleteV0NormqueryBids` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод удаляет ставки с поисковых кластеров.

Можно использовать только для кампаний с:
  - ручной ставкой
  - моделью оплаты `cpm` — за показы

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер

Пример:

```json
{
  "bids": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347,
      "norm_query": "Фраза 1"
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v0/normquery/get-minus`

**Список минус-фраз кампаний**  
`operationId`: `postV0NormqueryGetMinus` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает список минус-фраз по:
  - ID кампаний
  - артикулам WB

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

Пример:

```json
{
  "items": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **items** (`array`)
    - **items** (`object`)
      - **advert_id** (`integer`) — ID кампании
      - **nm_id** (`integer`) — Артикул WB
      - **norm_queries** (`array`) — Список минус-фраз
        - **items** (`string`)

Пример:

```json
{
  "items": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347,
      "norm_queries": [
        "Фраза 1"
      ]
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v0/normquery/set-minus`

**Установка и удаление минус-фраз**  
`operationId`: `postV0NormquerySetMinus` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод устанавливает и удаляет минус-фразы в кампаниях c единой и ручной ставкой.

  Отправка пустого массива удаляет все минус-фразы

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **norm_queries** **обязательное** (`array · maxItems=1000`)
    - **items** (`string`) — Поисковый кластер

Пример:

```json
{
  "advert_id": 1825035,
  "nm_id": 983512347,
  "norm_queries": [
    "Фраза 1"
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v0/normquery/list`

**Списки активных и неактивных поисковых кластеров**  
`operationId`: `postV0NormqueryList` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод возвращает списки активных и неактивных поисковых кластеров, по которым было не меньше 100 показов.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Сервисный | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый с секретом | 1 сек | 5 запросов | 200 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB

Пример:

```json
{
  "items": [
    {
      "advertId": 123456789,
      "nmId": 987654321
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **items** **обязательное** (`array · nullable`)
    - **items** (`object`)
      - **advertId** (`integer · int64`) — ID кампании
      - **nmId** (`integer · int64`) — Артикул WB
      - **normQueries** (`object`) — Поисковые кластеры
        - **active** (`array · nullable`) — Активные поисковые кластеры
          - **items** (`string`)
        - **excluded** (`array · nullable`) — Неактивные поисковые кластеры
          - **items** (`string`)
        - **archived** (`array · nullable`) — Архивные поисковые кластеры
          - **items** (`string`)

Пример:

```json
{
  "items": [
    {
      "advertId": 123456789,
      "nmId": 987654321,
      "normQueries": {
        "active": null,
        "excluded": [
          "бест трикотаж",
          "горы футболка для мужчин",
          "одежда для моря",
          "одежда на море",
          "футболка дельфин",
          "футболка мужская с принтом светлая",
          "футболка поло",
          "футболка поло мужская",
          "футболка с воротником мужские"
        ],
        "archived": [
          "поло мужское",
          "поло мужское летнее"
        ]
      }
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "incorrect request body, please check API documentation",
  "origin": "camp-api-public-cache",
  "request_id": "33e7d9f3fc221648cdf096bf8e62e482",
  "status": 400,
  "title": "invalid request body"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Финансы

## GET `/adv/v1/balance`

**Баланс**  
`operationId`: `getV1Balance` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает информацию о:
  - счёте кабинета Продвижения WB. Его пополняет продавец.
  - балансе — максимальной сумме для оплаты кампании по взаиморасчету: удержании средств из будущих продаж. Баланс пополнить нельзя, он рассчитывается автоматически на основе отчётов по продвижению.
  - бонусных начислениях WB.

Информацию о бюджете кампаний можно получить в [отдельном методе](/openapi/promotion#tag/finances/operation/getV1Budget).

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Сервисный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **balance** (`integer`) — Счёт в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **net** (`integer`) — Баланс в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **bonus** (`integer`) — Бонусы в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cashbacks** (`array`) — Промо-бонусы
    - **items** (`object`)
      - **sum** (`integer`) — Промо-бонусы в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **percent** (`integer`) — Процент от суммы пополнения бюджета кампании, который можно оплатить промо-бонусами за один раз
      - **expiration_date** (`string · ISO 8601`) — Дата окончания действия промо-бонусов

Пример:

```json
{
  "balance": 11083,
  "net": 0,
  "currency": "RUB",
  "bonus": 15187,
  "cashbacks": [
    {
      "sum": 10672,
      "percent": 50,
      "expiration_date": "2026-04-17T10:46:02.176174Z"
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`string`)

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/budget`

**Бюджет кампании**  
`operationId`: `getV1Budget` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает информацию о бюджете [кампании](/openapi/promotion#tag/campaigns/operation/getV2Adverts) — максимальной сумме затрат на кампанию. Бюджет кампании можно [пополнить](/openapi/promotion#tag/finances/operation/postV1BudgetDeposit).

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 4 запроса | 250 мс | 4 запроса |
| Сервисный | 1 сек | 4 запроса | 250 мс | 4 запроса |
| Базовый с секретом | 1 сек | 4 запроса | 250 мс | 4 запроса |
| Базовый | 1 ч | 4 запроса | 15 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

Детали параметров:

пример `id`: `1`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **cash** (`integer`) — Поле не используется. Значение всегда 0.
  - **netting** (`integer`) — Поле не используется. Значение всегда 0.
  - **total** (`integer`) — Бюджет кампании в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
{
  "cash": 0,
  "netting": 0,
  "total": 500,
  "currency": "RUB"
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример `CampaignNotBelongSeller`:

```json
"кампания не принадлежит продавцу"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v1/budget/deposit`

**Пополнение бюджета кампании**  
`operationId`: `postV1BudgetDeposit` · write · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод пополняет [бюджет](/openapi/promotion#tag/finances/operation/getV1Budget) кампании. 

Чтобы запустить кампанию после пополнения бюджета, используйте метод [Запуск кампании](/openapi/promotion#tag/campaignManagement/operation/getV0Start).

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Сервисный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID кампании |

Детали параметров:

пример `id`: `1234567`

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **sum** (`integer`) — Общая сумма пополнения бюджета в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    пример: `5000`
  - **cashback_sum** (`integer`) — Сумма пополнения бюджета промо-бонусами.
    
    Пополнить можно только определённый процент от общей суммы, указанный в поле `percent` ответа метода получения [баланса](./promotion#tag/finances/operation/getV1Balance).
    
    Оставшаяся часть общей суммы спишется с указанного источника пополнения.
    Пополнить можно только определённый процент от общей суммы, указанный в поле `percent` ответа метода получения [баланса](./promotion#tag/finances/operation/getV1Balance).
    
    Оставшаяся часть общей суммы спишется с указанного источника пополнения.
    
    Списать промо-бонусы можно только для источников пополнения:
      - `0` — счёт
      - `1` — баланс
    пример: `1000`
  - **cashback_percent** (`integer`) — Процент от суммы пополнения, который можно пополнить промо-бонусами. Нужно указать значение поля percent из ответа метода получения [баланса](./promotion#tag/finances/operation/getV1Balance)
    
    Если вы указали `cashback_sum`, параметр `cashback_percent` становится обязательным
    пример: `50`
  - **type** (`integer`) — Тип источника пополнения:
    - `0` — Счёт
    - `1` — Баланс
    - `3` — Бонусы
    пример: `1`
  - **return** (`boolean`) — Флаг возврата ответа (`true` — в ответе вернется обновлённый размер бюджета кампании, `false` или не указать параметр вообще — не вернётся.)

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **total** (`integer`) — Размер обновлённого бюджета
  - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример `ResponseWithReturn`:

```json
{
  "total": 7289,
  "currency": "RUB"
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `MinimumDepositAmountError`:

```json
{
  "error": "Invalid Params: minimum deposit amount is 1000"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/upd`

**Получение истории затрат**  
`operationId`: `getV1Upd` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод формирует список фактических затрат на рекламные кампании за заданный период.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Сервисный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `from` | query | string | да | Начало интервала |
| `to` | query | string | да | Конец интервала.  |

Детали параметров:

пример `from`: `2023-07-31`

**`to`**

Конец интервала. 

(Минимальный интервал 1 день, максимальный 31)

пример `to`: `2023-08-02`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array`)
  - **items** (`object`)
    - **updNum** (`integer`) — Номер выставленного документа
    - **updTime** (`string · time-date · nullable`) — Время списания
    - **updSum** (`integer`) — Выставленная сумма в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **advertId** (`integer`) — ID кампании
    - **campName** (`string`) — Название кампании
    - **advertType** (`integer`) — Тип кампании
    - **paymentType** (`string`) — Источник списания:
       - `Баланс`
       - `Бонусы`
       - `Счёт`
       - `Кэшбэк`
    - **advertStatus** (`integer`) — Статус кампании:
      - `-1` — удалена, процесс удаления будет завершён в течение 10 минут
      - `4` — готова к запуску
      - `7` — завершена
      - `8` — отменена
      - `9` — активна
      - `11` — на паузе

Пример:

```json
[
  {
    "updNum": 0,
    "updTime": "2023-07-31T12:12:54.060536+03:00",
    "updSum": 24,
    "advertId": 3355881,
    "campName": "лук лучок",
    "advertType": 6,
    "paymentType": "Баланс",
    "advertStatus": 9
  },
  {
    "updNum": 0,
    "updTime": null,
    "updSum": 107,
    "advertId": 3366882,
    "campName": "золотая луковица",
    "advertType": 8,
    "paymentType": "Счет",
    "advertStatus": 11
  }
]
```

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/payments`

**Получение истории пополнений счёта**  
`operationId`: `getV1Payments` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — **Prod**
- `https://advert-api-sandbox.wildberries.ru` — **Sandbox**

Метод возвращает историю пополнений счёта **WB Продвижение** за заданный период.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Сервисный | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый с секретом | 1 сек | 1 запрос | 1 сек | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `from` | query | string | нет | Начало интервала |
| `to` | query | string | нет | Конец интервала.  |

Детали параметров:

пример `from`: `2023-07-31`

**`to`**

Конец интервала. 

(Минимальный интервал 1 день, максимальный 31)

пример `to`: `2023-08-02`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array`)
  - **items** (`object`)
    - **id** (`integer`) — ID платежа
    - **date** (`string · time-date`) — Дата платежа
    - **sum** (`integer`) — Сумма платежа
    - **type** (`integer`) — Тип источника списания:
      - `0` — Счёт
      - `1` — Баланс
      - `3` — Картой
    - **statusId** (`integer`) — Статус:
      - `0` — ошибка
      - `1` — обработано
    - **cardStatus** (`string`) — Статус операции при оплате картой:
      - `success` — успех
      - `fail` — неуспех
      - `pending` — в ожидании ответа
      - `unknown` — неизвестно
    - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
[
  {
    "id": 1036666,
    "date": "2022-02-04T09:06:47.985843Z",
    "sum": 600,
    "type": 0,
    "statusId": 1,
    "currency": "RUB",
    "cardStatus": ""
  },
  {
    "id": 55261296,
    "date": "2023-04-13T10:07:42",
    "sum": 1500,
    "type": 3,
    "statusId": 1,
    "currency": "RUB",
    "cardStatus": "succeeded"
  }
]
```

#### HTTP 204 — История пополнений счета не найдена

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`string`)

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Медиа

## GET `/adv/v1/count`

**Количество медиакампаний**  
`operationId`: `getV1Count` · read-only · category `advert`

Хосты:
- `https://advert-media-api.wildberries.ru` — prod

Метод возвращает количество [медиакампаний](/openapi/promotion#tag/media/operation/getV1Advert) продавца с группировкой по статусам.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Сервисный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый с секретом | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **all** (`integer`) — Общее количество медиакампаний всех статусов и типов
  - **adverts** (`object · nullable`)
    - **type** (`integer`) — Тип медиакампании:
      - `1` — размещение по дням
      - `2` — размещение по просмотрам
    - **status** (`integer`) — Статус медиакампании:
        - `1` — черновик
        - `2` — модерация
        - `3` — отклонена (с возможностью вернуть на модерацию)
        - `4` — готова к запуску
        - `5` — запланирована
        - `6` — на показах
        - `7` — завершена
        - `8` — отменена
        - `9` — приостановлена продавцом
        - `10` — пауза по дневному лимиту
        - `11` — пауза
    - **count** (`integer`) — Количество медиакампаний

Пример:

```json
{
  "all": 6,
  "adverts": {
    "type": 2,
    "status": 7,
    "count": 2
  }
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/adverts`

**Список медиакампаний**  
`operationId`: `getV1Adverts` · read-only · category `advert`

Хосты:
- `https://advert-media-api.wildberries.ru` — prod

Метод возвращает список всех [медиакампаний](/openapi/promotion#tag/media/operation/getV1Advert) продавца по их типам и статусам.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Сервисный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый с секретом | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `status` | query | string | нет | Статус медиакампании: |
| `type` | query | integer | нет | Тип медиакампании: |
| `limit` | query | integer | нет | Количество кампаний в ответе |
| `offset` | query | integer | нет | Смещение относительно первой медиакампании |
| `order` | query | string | нет | Порядок вывода ответа: |
| `direction` | query | string | нет | Порядок сортировки: |

Детали параметров:

**`status`**

Статус медиакампании:
  - `1` — черновик
  - `2` — модерация
  - `3` — отклонена (с возможностью вернуть на модерацию)
  - `4` — готова к запуску
  - `5` — запланирована
  - `6` — на показах
  - `7` — завершена
  - `8` — отменена
  - `9` — приостановлена продавцом
  - `10` — пауза по дневному лимиту
  - `11` — пауза

пример `status`: `1,3,7`

**`type`**

Тип медиакампании:
- `1` — размещение по дням
- `2` — размещение по просмотрам

пример `type`: `1`

пример `limit`: `1`

пример `offset`: `1`

**`order`**

Порядок вывода ответа:
- `create` — по времени создания медиакампании
- `id` — по ID медиакампании

пример `order`: `id`

**`direction`**

Порядок сортировки:
- `desc` — от большего к меньшему
- `asc` — от меньшего к большему

пример `direction`: `desc`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array`)
  - **items** (`object`)
    - **advertId** (`integer`) — ID медиакампании
    - **name** (`string`) — Название медиакампании
    - **brand** (`string`) — Название бренда
    - **type** (`integer`) — Тип медиакампании:
      - `1` — размещение по дням
      - `2` — размещение по просмотрам
    - **status** (`integer`) — Статус медиакампании:
        - `1` — черновик
        - `2` — модерация
        - `3` — отклонена (с возможностью вернуть на модерацию)
        - `4` — готова к запуску
        - `5` — запланирована
        - `6` — на показах
        - `7` — завершена
        - `8` — отменена
        - `9` — приостановлена продавцом
        - `10` — пауза по дневному лимиту
        - `11` — пауза
    - **createTime** (`string · date-time`) — Время создания медиакампании
    - **endTime** (`string · date-time`) — Время завершения медиакампании

Пример:

```json
[
  {
    "advertId": 123456,
    "name": "тост",
    "brand": "brand",
    "type": 2,
    "status": 8,
    "createTime": "2023-03-25T20:35:57.116943+03:00"
  },
  {
    "advertId": 54321,
    "name": "тест",
    "brand": "brandname",
    "type": 1,
    "status": 7,
    "createTime": "2023-07-24T16:48:20.935599+03:00",
    "endTime": "2023-07-25T20:35:50.104978Z"
  }
]
```

#### HTTP 204 — Медиакампании не найдены

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v1/advert`

**Информация о медиакампании**  
`operationId`: `getV1Advert` · read-only · category `advert`

Хосты:
- `https://advert-media-api.wildberries.ru` — prod

Метод возвращает информацию о кампании [WB Медиа](https://cmp.wildberries.ru/cmpf/list). Вместо карточек товаров в медиакампаниях продвигаются рекламные баннеры продавца на сайте и в приложении WB.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Сервисный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый с секретом | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `id` | query | integer | да | ID медиакампании |

Детали параметров:

пример `id`: `23569`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **advertId** (`integer`) — ID медиакампании
  - **name** (`string`) — Название медиакампании
  - **brand** (`string`) — Название бренда
  - **type** (`integer`) — Тип медиакампании:
    - `1` — размещение по дням
    - `2` — размещение по просмотрам
  - **status** (`integer`) — Статус медиакампании:
      - `1` — черновик
      - `2` — модерация
      - `3` — отклонена (с возможностью вернуть на модерацию)
      - `4` — готова к запуску
      - `5` — запланирована
      - `6` — на показах
      - `7` — завершена
      - `8` — отменена
      - `9` — приостановлена продавцом
      - `10` — пауза по дневному лимиту
      - `11` — пауза
  - **createTime** (`string · date-time`) — Время создания медиакампании
  - **extended** (`object`)
    - **reason** (`string · nullable`) — Комментарий модератора
    - **expenses** (`integer`) — Затраты
    - **from** (`string · date-time`) — Дата и время начала показа медиакампании
    - **to** (`string · date-time`) — Дата и время окончания показа медиакампании
    - **updated_at** (`string · date-time`) — Дата и время изменения кампании
    - **price** (`integer`) — Стоимость размещения по дням для типа `1`
    - **budget** (`integer`) — Остаток бюджета для типа `2`
    - **operation** (`integer`) — Источник списания:
        - `1` — баланс
        - `2` — счёт
    - **contract_id** (`integer`) — ID контракта, для продавцов на контракте
  - **items** (`array`) — Информация о баннере.
    
    Наличие в ответе тех или иных полей зависит от конфигурации медиакампании.
    - **items** (`object`)
      - **id** (`integer`) — ID баннера
      - **name** (`string`) — Бренд
      - **status** (`integer`) — Статус (такой же как у медиакампании)
      - **place** (`integer`) — Позиция на странице размещения
      - **budget** (`integer`) — Бюджет
      - **daily_limit** (`integer`) — Дневной лимит (для баннеров по показам)
      - **category_name** (`string`) — Название категории размещения
      - **cpm** (`integer`) — Ставка
      - **url** (`string`) — URL страницы, на которую попадает пользователь при клике по баннеру
      - **advert_type** (`integer`) — Тип продвижения:
        - `1` — баннер
        - `2` — всплывающее меню
        - `3` — почтовая рассылка
        - `4` — социальные сети
        - `5` — push-уведомления в мобильном приложении
      - **created_at** (`string · date-time`) — Дата создания баннера
      - **updated_at** (`string · date-time`) — Дата и время обновления баннера
      - **date_from** (`string · date-time`) — Дата начала работы баннера
      - **date_to** (`string · date-time`) — Дата завершения работы баннера
      - **nms** (`array`) — Подборка артикулов WB
        - **items** (`integer`)
      - **bottomText1** (`string`) — Текст под плашкой баннера
      - **bottomText2** (`string`) — 2-я строка с текстом под плашкой баннера
      - **message** (`string`) — Текст push-уведомления или рассылки
      - **additionalSettings** (`integer`) — Дополнительные настройки.
        
        Формат почтовой рассылки:
        - `1` — общий
        - `2` — частичный
        - `3` — уникальный
        
        Социальная сеть:
        - `1` — VK
        - `2` — OK (Одноклассники)
      - **receiversCount** (`integer`) — Кол-во получателей push-уведомлений
      - **subject_id** (`integer`) — ID родительской категории товара
      - **subject_name** (`string`) — Название родительской категории товара
      - **action_name** (`string`) — Название акции
      - **show_hours** (`array`) — Часы показа
        - **items** (`object`)
          - **From** (`integer`) — Начало показа
          - **To** (`integer`) — Конец показа
      - **Erid** (`string`) — Уникальный ID медиакампании для работы с ОРД

#### HTTP 204 — Медиакампания не найдена

#### HTTP 400 — Неправильный запрос

Content-Type: `text/plain`

- **response** (`string`)

Пример `InvalidRcIdAdv`:

```json
"Некорректный ID РК"
```

Пример `IncorrectName`:

```json
"Некорректное название"
```

Пример `IncorrectSupplierIdAdv`:

```json
"Некорректный ID продавца"
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Статистика

## POST `/adv/v0/normquery/stats`

**Статистика поисковых кластеров**  
`operationId`: `postV0NormqueryStats` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод формирует статистику по поисковым кластерам за указанный период.

Можно использовать для кампаний с моделями оплаты `cpm` — за показы и `cpc` — за клики.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Сервисный | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Базовый с секретом | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Базовый | 1 ч | 5 запросов | 12 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **from** **обязательное** (`string · date`) — Дата начала периода
    пример: `"2025-10-07"`
  - **to** **обязательное** (`string · date`) — Дата окончания периода
    пример: `"2025-10-08"`
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

Пример:

```json
{
  "from": "2025-10-07",
  "to": "2025-10-08",
  "items": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`) — Статистика по поисковым кластерам
  - **stats** **обязательное** (`array`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **stats** (`array`)
        - **items** (`object`)
          - **norm_query** (`string`) — Поисковый кластер
          - **views** (`integer · nullable`) — Количество просмотров.
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **clicks** (`integer`) — Количество кликов
          - **atbs** (`integer`) — Количество добавлений товаров в корзину
          - **orders** (`integer`) — Количество заказов
          - **ctr** (`number · double · nullable`) — Кликабельность — отношение числа кликов к количеству показов, %.
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **cpc** (`number · double`) — Стоимость одного клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **cpm** (`number · double · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **avg_pos** (`number · double`) — Средняя позиция товара на страницах поисковой выдачи
          - **shks** (`integer`) — Количество заказанных товаров, шт.
          - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании
          - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
{
  "stats": [
    {
      "advert_id": 1825035,
      "nm_id": 983512347,
      "stats": [
        {
          "atbs": 68,
          "avg_pos": 3.6,
          "clicks": 2090,
          "cpc": 471,
          "cpm": 813,
          "ctr": 107.23,
          "norm_query": "Фраза 1",
          "orders": 19,
          "views": 1949,
          "currency": "RUB"
        },
        {
          "atbs": 68,
          "avg_pos": 3.6,
          "clicks": 2090,
          "cpc": 471,
          "cpm": 813,
          "ctr": 107.23,
          "norm_query": "Фраза 2",
          "orders": 19,
          "views": 1949,
          "currency": "RUB"
        },
        {
          "atbs": 68,
          "avg_pos": 3.6,
          "clicks": 2090,
          "cpc": 471,
          "cpm": 813,
          "ctr": 107.23,
          "norm_query": "Фраза 3",
          "orders": 19,
          "views": 1949,
          "currency": "RUB"
        },
        {
          "atbs": 36,
          "avg_pos": 3.9,
          "clicks": 1847,
          "cpc": 278,
          "cpm": 445,
          "ctr": 96.4,
          "norm_query": "Фраза 4",
          "orders": 28,
          "views": 1916,
          "currency": "RUB"
        },
        {
          "atbs": 36,
          "avg_pos": 3.9,
          "clicks": 1847,
          "cpc": 278,
          "cpm": 445,
          "ctr": 96.4,
          "norm_query": "Фраза 5",
          "orders": 28,
          "views": 1916,
          "currency": "RUB"
        },
        {
          "atbs": 79,
          "avg_pos": 2.2,
          "clicks": 2468,
          "cpc": 106,
          "cpm": 819,
          "ctr": 145.01,
          "norm_query": "Фраза 6",
          "orders": 14,
          "views": 1702,
          "currency": "RUB"
        },
        {
          "atbs": 79,
          "avg_pos": 2.2,
          "clicks": 2468,
          "cpc": 106,
          "cpm": 819,
          "ctr": 145.01,
          "norm_query": "Фраза 7",
          "orders": 14,
          "views": 1702,
          "currency": "RUB"
        },
        {
          "atbs": 67,
          "avg_pos": 9.9,
          "clicks": 1166,
          "cpc": 250,
          "cpm": 837,
          "ctr": 70.33,
          "norm_query": "Фраза 8",
          "orders": 26,
          "views": 1658,
          "currency": "RUB"
        },
        {
          "atbs": 67,
          "avg_pos": 9.9,
          "clicks": 1166,
          "cpc": 250,
          "cpm": 837,
          "ctr": 70.33,
          "norm_query": "Фраза 9",
          "orders": 26,
          "views": 1658,
          "currency": "RUB"
        },
        {
          "atbs": 46,
          "avg_pos": 2,
          "clicks": 2927,
          "cpc": 122,
          "cpm": 468,
          "ctr": 186.43,
          "norm_query": "Фраза 10",
          "orders": 23,
          "views": 1570,
          "currency": "RUB"
        },
        {
          "atbs": 46,
          "avg_pos": 2,
          "clicks": 2927,
          "cpc": 122,
          "cpm": 468,
          "ctr": 186.43,
          "norm_query": "Фраза 11",
          "orders": 23,
          "views": 1570,
          "currency": "RUB"
        },
        {
          "atbs": 79,
          "avg_pos": 7.1,
          "clicks": 2447,
          "cpc": 67,
          "cpm": 426,
          "ctr": 163.9,
          "norm_query": "Фраза 12",
          "orders": 13,
          "views": 1493,
          "currency": "RUB"
        },
        {
          "atbs": 79,
          "avg_pos": 7.1,
          "clicks": 2447,
          "cpc": 67,
          "cpm": 426,
          "ctr": 163.9,
          "norm_query": "Фраза 13",
          "orders": 13,
          "views": 1493,
          "currency": "RUB"
        },
        {
          "atbs": 61,
          "avg_pos": 6,
          "clicks": 1391,
          "cpc": 370,
          "cpm": 980,
          "ctr": 99.29,
          "norm_query": "Фраза 14",
          "orders": 27,
          "views": 1401,
          "currency": "RUB"
        },
        {
          "atbs": 61,
          "avg_pos": 6,
          "clicks": 1391,
          "cpc": 370,
          "cpm": 980,
          "ctr": 99.29,
          "norm_query": "Фраза 15",
          "orders": 27,
          "views": 1401,
          "currency": "RUB"
        },
        {
          "atbs": 26,
          "avg_pos": 6.9,
          "clicks": 1029,
          "cpc": 88,
          "cpm": 459,
          "ctr": 77.43,
          "norm_query": "Фраза 16",
          "orders": 3,
          "views": 1329
        },
        {
          "atbs": 26,
          "avg_pos": 6.9,
          "clicks": 1029,
          "cpc": 88,
          "cpm": 459,
          "ctr": 77.43,
          "norm_query": "Фраза 17",
          "orders": 3,
          "views": 1329,
          "currency": "RUB"
        },
        {
          "atbs": 67,
          "avg_pos": 3.8,
          "clicks": 1371,
          "cpc": 448,
          "cpm": 534,
          "ctr": 104.18,
          "norm_query": "Фраза 18",
          "orders": 3,
          "views": 1316,
          "currency": "RUB"
        },
        {
          "atbs": 67,
          "avg_pos": 3.8,
          "clicks": 1371,
          "cpc": 448,
          "cpm": 534,
          "ctr": 104.18,
          "norm_query": "Фраза 19",
          "orders": 3,
          "views": 1316,
          "currency": "RUB"
        },
        {
          "atbs": 18,
          "avg_pos": 10,
          "clicks": 2944,
          "cpc": 472,
          "cpm": 839,
          "ctr": 256,
          "norm_query": "Фраза 20",
          "orders": 4,
          "views": 1150,
          "currency": "RUB"
        },
        {
          "atbs": 18,
          "avg_pos": 10,
          "clicks": 2944,
          "cpc": 472,
          "cpm": 839,
          "ctr": 256,
          "norm_query": "Фраза 21",
          "orders": 4,
          "views": 1150,
          "currency": "RUB"
        }
      ]
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "invalid payment_type value",
  "origin": "camp-api-public-cache",
  "request_id": "7e5cb1f106cc6e85b5b29eb2e8815da2",
  "status": 400,
  "title": "invalid payload"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

Пример `AccessDenied`:

```json
{
  "detail": "norm_query API not available",
  "origin": "camp-api-public-cache",
  "request_id": "60aaf2bc6164e84a9399fae9565b568a",
  "status": 403,
  "title": "request forbidden"
}
```

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/adv/v3/fullstats`

**Статистика кампаний**  
`operationId`: `getV3Fullstats` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод формирует статистику для кампаний независимо от типа.

Максимальный период в запросе — 31 день.

Для кампаний в статусах `7`, `9` и `11`.

В песочнице статистика кампаний доступна за последние 30 дней. Генерируется только для компаний в статусе `9`, тип `8`, 9 раз в сутки

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 3 запроса | 20 сек | 1 запрос |
| Сервисный | 1 мин | 3 запроса | 20 сек | 1 запрос |
| Базовый с секретом | 1 мин | 3 запроса | 20 сек | 1 запрос |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `ids` | query | string | да | ID кампаний, максимум 50 значений |
| `beginDate` | query | string | да | Дата начала интервала |
| `endDate` | query | string | да | Дата окончания интервала |

Детали параметров:

пример `ids`: `22161678,28449281,28155229`

пример `beginDate`: `2025-09-07`

пример `endDate`: `2025-09-08`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array`) — Статистика по кампаниям за период, указанный в запросе. По всем артикулам WB и платформам
  - **items** (`object`) — Статистика по одной кампании за период, указанный в запросе. По всем артикулам WB и платформам
    - **advertId** **обязательное** (`integer`) — ID кампании
    - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
    - **boosterStats**
      allOf:
        - **allOf[0]** (`array`) — Статистика по средней позиции товара (для кампаний с единой ставкой)
          - **items** (`object`)
            - **avg_position** **обязательное** (`integer`) — Средняя позиция товара
            - **date** **обязательное** (`string · date`) — Дата, за которую предоставлены данные
            - **nm** **обязательное** (`integer`) — Артикул WB
        - **allOf[1]** — Статистика по бустеру
    - **canceled** **обязательное** (`integer`) — Отмены, шт.
    - **clicks** **обязательное** (`integer`) — Количество кликов
    - **cpc** **обязательное** (`number · double`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **cr** **обязательное** (`number · double`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
    - **ctr** **обязательное** (`number · double`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
    - **days** **обязательное**
      allOf:
        - **allOf[0]** (`array`) — Статистка по дням
          - **items** (`object`)
            - **apps** **обязательное** (`array`) — Блок информации о платформе
              - **items** (`object`)
                - **appType** **обязательное** (`integer · enum: 1, 32, 64`) — Тип платформы:
                    - `1` — сайт
                    - `32` — Android
                    - `64` — IOS
                - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
                - **canceled** **обязательное** (`integer`) — Отмены, шт.
                - **clicks** **обязательное** (`integer`) — Количество кликов
                - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
                - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
                - **nms** **обязательное** (`array`) — Блок статистики по артикулам WB
                  - **items** (`object`)
                    - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
                    - **canceled** **обязательное** (`integer`) — Отмены, шт.
                    - **clicks** **обязательное** (`integer`) — Количество кликов
                    - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
                    - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
                    - **name** **обязательное** (`string`) — Название товара
                    - **nmId** **обязательное** (`integer`) — Артикул WB
                    - **orders** **обязательное** (`integer`) — Количество заказов
                    - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
                    - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **views** **обязательное** (`integer`) — Количество просмотров
                - **orders** **обязательное** (`integer`) — Количество заказов
                - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
                - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **views** **обязательное** (`integer`) — Количество просмотров
            - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
            - **canceled** **обязательное** (`integer`) — Отмены, шт.
            - **date** **обязательное** (`string · date-time`) — Дата, за которую представлены данные
            - **clicks** **обязательное** (`integer`) — Количество кликов
            - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству посещений кампании
            - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
            - **orders** **обязательное** (`integer`) — Количество заказов
            - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
            - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **views** **обязательное** (`integer`) — Количество просмотров
        - **allOf[1]** — Статистика с разбивкой по дням
    - **orders** **обязательное** (`integer`) — Количество заказов
    - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
    - **sum** **обязательное** (`number · double`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **sum_price** **обязательное** (`number · double`) — Сумма заказов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **views** **обязательное** (`integer`) — Количество просмотров
    - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

Пример:

```json
[
  {
    "advertId": 22161678,
    "atbs": 9,
    "boosterStats": [
      {
        "avg_position": 24,
        "date": "2025-09-07",
        "nm": 221725278
      },
      {
        "avg_position": 35,
        "date": "2025-09-08",
        "nm": 221725278
      }
    ],
    "canceled": 0,
    "clicks": 139,
    "cpc": 4.76,
    "cr": 0,
    "ctr": 10.12,
    "days": [
      {
        "apps": [
          {
            "appType": 1,
            "atbs": 0,
            "canceled": 0,
            "clicks": 1,
            "cpc": 10.19,
            "cr": 0,
            "ctr": 4.76,
            "nms": [
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 1,
                "cpc": 10.19,
                "cr": 0,
                "ctr": 4.76,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 10.19,
                "sum_price": 0,
                "views": 21
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 10.19,
            "sum_price": 0,
            "views": 21
          },
          {
            "appType": 32,
            "atbs": 1,
            "canceled": 0,
            "clicks": 54,
            "cpc": 4.26,
            "cr": 0,
            "ctr": 11.37,
            "nms": [
              {
                "atbs": 1,
                "canceled": 0,
                "clicks": 54,
                "cpc": 4.26,
                "cr": 0,
                "ctr": 11.37,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 230.08,
                "sum_price": 0,
                "views": 475
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 230.08,
            "sum_price": 0,
            "views": 475
          },
          {
            "appType": 64,
            "atbs": 1,
            "canceled": 0,
            "clicks": 20,
            "cpc": 6.91,
            "cr": 0,
            "ctr": 6.94,
            "nms": [
              {
                "atbs": 1,
                "canceled": 0,
                "clicks": 20,
                "cpc": 6.91,
                "cr": 0,
                "ctr": 6.94,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 138.23,
                "sum_price": 0,
                "views": 288
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 138.23,
            "sum_price": 0,
            "views": 288
          }
        ],
        "atbs": 2,
        "canceled": 0,
        "clicks": 75,
        "cpc": 5.05,
        "cr": 0,
        "ctr": 9.57,
        "date": "2025-09-07T00:00:00Z",
        "orders": 0,
        "shks": 0,
        "sum": 378.49,
        "sum_price": 0,
        "views": 784
      },
      {
        "apps": [
          {
            "appType": 32,
            "atbs": 5,
            "canceled": 0,
            "clicks": 45,
            "cpc": 3.58,
            "cr": 0,
            "ctr": 13.43,
            "nms": [
              {
                "atbs": 5,
                "canceled": 0,
                "clicks": 45,
                "cpc": 3.58,
                "cr": 0,
                "ctr": 13.43,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 161.02,
                "sum_price": 0,
                "views": 335
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 161.02,
            "sum_price": 0,
            "views": 335
          },
          {
            "appType": 64,
            "atbs": 2,
            "canceled": 0,
            "clicks": 19,
            "cpc": 6.05,
            "cr": 0,
            "ctr": 8.02,
            "nms": [
              {
                "atbs": 2,
                "canceled": 0,
                "clicks": 19,
                "cpc": 6.05,
                "cr": 0,
                "ctr": 8.02,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 114.95,
                "sum_price": 0,
                "views": 237
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 114.95,
            "sum_price": 0,
            "views": 237
          },
          {
            "appType": 1,
            "atbs": 0,
            "canceled": 0,
            "clicks": 0,
            "cpc": 0,
            "cr": 0,
            "ctr": 0,
            "nms": [
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 0,
                "cpc": 0,
                "cr": 0,
                "ctr": 0,
                "name": "постер 2",
                "nmId": 221725278,
                "orders": 0,
                "shks": 0,
                "sum": 6.79,
                "sum_price": 0,
                "views": 17
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 6.79,
            "sum_price": 0,
            "views": 17
          }
        ],
        "atbs": 7,
        "canceled": 0,
        "clicks": 64,
        "cpc": 4.42,
        "cr": 0,
        "ctr": 10.87,
        "date": "2025-09-08T00:00:00Z",
        "orders": 0,
        "shks": 0,
        "sum": 282.76,
        "sum_price": 0,
        "views": 589
      }
    ],
    "orders": 0,
    "shks": 0,
    "sum": 661.25,
    "sum_price": 0,
    "views": 1373,
    "currency": "RUB"
  },
  {
    "advertId": 28449281,
    "atbs": 1,
    "canceled": 0,
    "clicks": 9,
    "cpc": 35.94,
    "cr": 11.11,
    "ctr": 1.76,
    "days": [
      {
        "apps": [
          {
            "appType": 32,
            "atbs": 1,
            "canceled": 0,
            "clicks": 7,
            "cpc": 26.31,
            "cr": 14.29,
            "ctr": 2.41,
            "nms": [
              {
                "atbs": 1,
                "canceled": 0,
                "clicks": 5,
                "cpc": 33.02,
                "cr": 20,
                "ctr": 1.92,
                "name": "Футболка желтая",
                "nmId": 398309059,
                "orders": 1,
                "shks": 1,
                "sum": 165.1,
                "sum_price": 500,
                "views": 260
              },
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 2,
                "cpc": 9.53,
                "cr": 0,
                "ctr": 6.67,
                "name": "Футболка салатовая",
                "nmId": 301957154,
                "orders": 0,
                "shks": 0,
                "sum": 19.05,
                "sum_price": 0,
                "views": 30
              }
            ],
            "orders": 1,
            "shks": 1,
            "sum": 184.15,
            "sum_price": 500,
            "views": 290
          },
          {
            "appType": 64,
            "atbs": 0,
            "canceled": 0,
            "clicks": 2,
            "cpc": 62.87,
            "cr": 0,
            "ctr": 1.01,
            "nms": [
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 1,
                "cpc": 12.7,
                "cr": 0,
                "ctr": 5,
                "name": "Футболка салатовая",
                "nmId": 301957154,
                "orders": 0,
                "shks": 0,
                "sum": 12.7,
                "sum_price": 0,
                "views": 20
              },
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 1,
                "cpc": 113.03,
                "cr": 0,
                "ctr": 0.56,
                "name": "Футболка желтая",
                "nmId": 398309059,
                "orders": 0,
                "shks": 0,
                "sum": 113.03,
                "sum_price": 0,
                "views": 178
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 125.73,
            "sum_price": 0,
            "views": 198
          },
          {
            "appType": 1,
            "atbs": 0,
            "canceled": 0,
            "clicks": 0,
            "cpc": 0,
            "cr": 0,
            "ctr": 0,
            "nms": [
              {
                "atbs": 0,
                "canceled": 0,
                "clicks": 0,
                "cpc": 0,
                "cr": 0,
                "ctr": 0,
                "name": "Футболка желтая",
                "nmId": 398309059,
                "orders": 0,
                "shks": 0,
                "sum": 13.59,
                "sum_price": 0,
                "views": 22
              }
            ],
            "orders": 0,
            "shks": 0,
            "sum": 13.59,
            "sum_price": 0,
            "views": 22
          }
        ],
        "atbs": 1,
        "canceled": 0,
        "clicks": 9,
        "cpc": 35.94,
        "cr": 11.11,
        "ctr": 1.76,
        "date": "2025-09-08T00:00:00Z",
        "orders": 1,
        "shks": 1,
        "sum": 323.47,
        "sum_price": 500,
        "views": 510
      }
    ],
    "orders": 1,
    "shks": 1,
    "sum": 323.47,
    "sum_price": 500,
    "views": 510,
    "currency": "RUB"
  }
]
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`) — Ошибка
  - **errors** (`array`)
    - **items** (`object`)
      - **detail** (`string`) — Детали ошибки
      - **field** (`string`) — Параметр с ошибкой
  - **detail** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
  - **request_id** **обязательное** (`string`) — ID запроса
  - **status** **обязательное** (`integer`) — HTTP статус-код
  - **title** **обязательное** (`string`) — Заголовок ошибки
  - **type** (`string`) — Тип ошибки

Пример `InvalidEndDate`:

```json
{
  "detail": "invalid ids",
  "origin": "camp-api-public-cache",
  "request_id": "40a229f3775b03585b65420c787aaebe",
  "status": 400,
  "title": "invalid payload"
}
```

Пример `MaxDateRangeError`:

```json
{
  "errors": [
    {
      "detail": "max date range 31 days",
      "field": "begin and end"
    }
  ],
  "origin": "camp-api-public-cache",
  "request_id": "71ee30f53243d7bd09c2c00b131688b2",
  "status": 400,
  "title": "Invalid payload",
  "type": "bad request"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v1/stats`

**Статистика медиакампаний**  
`operationId`: `postV1Stats` · read-only · category `advert`

Хосты:
- `https://advert-media-api.wildberries.ru` — prod

Метод формирует статистику кампаний сервиса [WB Медиа](https://cmp.wildberries.ru/cmpf/statistics). Статистику можно группировать по датам и/или интервалам.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Сервисный | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый с секретом | 1 сек | 10 запросов | 100 мс | 10 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`array · minItems=1 · maxItems=100`)
  - **items**
    oneOf:
      - **oneOf[0]** (`object`)
        - **id** **обязательное** (`integer`) — ID кампании
        - **dates** **обязательное** (`array`) — Даты, за которые нужно получить информацию
          - **items** (`string · date`)
      - **oneOf[1]** (`object`)
        - **id** **обязательное** (`integer`) — ID кампании
        - **interval** **обязательное** (`object`) — Временной диапазон, за который необходимо выдать данные
          - **begin** (`string · date`) — Начало запрашиваемого периода
          - **end** (`string · date`) — Конец запрашиваемого периода
      - **oneOf[2]** (`object`)
        - **id** **обязательное** (`integer`) — ID кампании

Пример `RequestWithDate`:

```json
[
  {
    "id": 8960367,
    "dates": [
      "2023-10-07",
      "2023-10-06"
    ]
  },
  {
    "id": 9876543,
    "dates": [
      "2023-10-07",
      "2023-12-06"
    ]
  }
]
```

Пример `RequestWithInterval`:

```json
[
  {
    "id": 8960367,
    "interval": {
      "begin": "2023-10-08",
      "end": "2023-10-10"
    }
  },
  {
    "id": 78978565,
    "interval": {
      "begin": "2023-09-08",
      "end": "2023-09-11"
    }
  }
]
```

Пример `RequestWithoutParam`:

```json
[
  {
    "id": 107024
  }
]
```

Пример `RequestAggregate`:

```json
[
  {
    "id": 107024,
    "interval": {
      "begin": "2023-10-21",
      "end": "2023-10-21"
    }
  },
  {
    "id": 107024,
    "dates": [
      "2023-10-22",
      "2023-10-26"
    ]
  }
]
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`array`)
  - **items**
    oneOf:
      - **oneOf[0]** (`object`)
        - **interval** **обязательное** (`object`) — Период
          - **begin** (`string · date`) — Начало периода
          - **end** (`string · date`) — Конец периода
        - **stats** (`array`) — Блок статистики
          - **items** (`object`)
            - **item_id** (`integer`) — ID баннера
            - **item_name** (`string`) — Бренд
            - **category_name** (`string`) — Название категории
            - **advert_type** (`integer`) — Тип медиакампании:
                - `1` — размещение по дням
                - `2` — размещение по просмотрам
            - **place** (`integer`) — Место на странице
            - **views** (`integer`) — Количество просмотров
            - **clicks** (`integer`) — Количество кликов
            - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
            - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
            - **date_from** (`string · date-time`) — Время начала размещения
            - **date_to** (`string · date-time`) — Время завершения размещения
            - **subject_name** (`string`) — Родительская категория предмета
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **price** (`number`) — Стоимость размещения
            - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
            - **status** (`integer`) — Статус медиакампании
            - **daily_stats** (`array`)
              - **items** (`object`)
                - **date** (`string · date-time`) — Дата
                - **app_type_stats** (`array`) — Статистика по платформам
                  - **items** (`object`)
                    - **app_type** (`integer`) — Тип платформы:
                      - `1` — сайт
                      - `32` — Android
                      - `64` — IOS
                    - **stats** (`array`)
                      - **items** (`object`)
                        …
                        …
                        …
                        …
            - **expenses** (`number`) — Стоимость размещения баннера
            - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
            - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину
      - **oneOf[1]** (`object`)
        - **dates** **обязательное** (`array`) — Даты, за которые нужно получить информацию
          - **items** (`string · date`)
        - **stats** (`array`) — Блок статистики
          - **items** (`object`)
            - **item_id** (`integer`) — ID баннера
            - **item_name** (`string`) — Бренд
            - **category_name** (`string`) — Название категории
            - **advert_type** (`integer`) — Тип медиакампании:
                - `1` — размещение по дням
                - `2` — размещение по просмотрам
            - **place** (`integer`) — Место на странице
            - **views** (`integer`) — Количество просмотров
            - **clicks** (`integer`) — Количество кликов
            - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
            - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
            - **date_from** (`string · date-time`) — Время начала размещения
            - **date_to** (`string · date-time`) — Время завершения размещения
            - **subject_name** (`string`) — Родительская категория предмета
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **price** (`number`) — Стоимость размещения
            - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
            - **status** (`integer`) — Статус медиакампании
            - **daily_stats** (`array`)
              - **items** (`object`)
                - **date** (`string · date-time`) — Дата
                - **app_type_stats** (`array`) — Статистика по платформам
                  - **items** (`object`)
                    - **app_type** (`integer`) — Тип платформы:
                      - `1` — сайт
                      - `32` — Android
                      - `64` — IOS
                    - **stats** (`array`)
                      - **items** (`object`)
                        …
                        …
                        …
                        …
                        …
                        …
            - **expenses** (`number`) — Стоимость размещения баннера
            - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
            - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину
      - **oneOf[2]** (`object`)
        - **stats** (`array`) — Блок статистики
          - **items** (`object`)
            - **item_id** (`integer`) — ID баннера
            - **item_name** (`string`) — Бренд
            - **category_name** (`string`) — Название категории
            - **advert_type** (`integer`) — Тип медиакампании:
                - `1` — размещение по дням
                - `2` — размещение по просмотрам
            - **place** (`integer`) — Место на странице
            - **views** (`integer`) — Количество просмотров
            - **clicks** (`integer`) — Количество кликов
            - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
            - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
            - **date_from** (`string · date-time`) — Время начала размещения
            - **date_to** (`string · date-time`) — Время завершения размещения
            - **subject_name** (`string`) — Родительская категория предмета
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **price** (`number`) — Стоимость размещения
            - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
            - **status** (`integer`) — Статус медиакампании
            - **daily_stats** (`array`)
              - **items** (`object`)
                - **date** (`string · date-time`) — Дата
                - **app_type_stats** (`array`) — Статистика по платформам
                  - **items** (`object`)
                    - **app_type** (`integer`) — Тип платформы:
                      - `1` — сайт
                      - `32` — Android
                      - `64` — IOS
                    - **stats** (`array`)
                      - **items** (`object`)
                        …
                        …
                        …
                        …
            - **expenses** (`number`) — Стоимость размещения баннера
            - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
            - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину
      - **oneOf[3]** (`object`)
        - **advert_id** (`integer · int64`) — ID кампании
          пример: `111`
        - **error** (`string`) — Описание ошибки
          пример: `"кампания не найдена"`

Пример `RespStatMediaInterval`:

```json
[
  {
    "interval": {
      "begin": "2023-10-21",
      "end": "2023-10-25"
    },
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 11849,
        "clicks": 209,
        "cr": 0.48,
        "ctr": 1.76,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 4,
        "orders": 1,
        "price": 175000,
        "cpc": 837.32,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-21T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2017,
                    "clicks": 27,
                    "atbs": 1,
                    "ctr": 1.34
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 1.91,
        "cr2": 25
      }
    ]
  }
]
```

Пример `RespStatMediaDates`:

```json
[
  {
    "dates": [
      "2023-10-26",
      "2023-10-22"
    ],
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 4584,
        "clicks": 74,
        "cr": 1.35,
        "ctr": 1.61,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 2,
        "orders": 1,
        "price": 175000,
        "cpc": 2364.86,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-22T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2384,
                    "clicks": 33,
                    "atbs": 2,
                    "orders": 1,
                    "cr": 3.03,
                    "ctr": 1.38
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 2.7,
        "cr2": 50
      }
    ]
  }
]
```

Пример `RespStatMediaWithoutParam`:

```json
[
  {
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 11849,
        "clicks": 209,
        "cr": 0.48,
        "ctr": 1.76,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 4,
        "orders": 1,
        "price": 175000,
        "cpc": 837.32,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-21T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2017,
                    "clicks": 27,
                    "atbs": 1,
                    "ctr": 1.34
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 1.91,
        "cr2": 25
      }
    ]
  }
]
```

Пример `RespStatMediaAggregate`:

```json
[
  {
    "interval": {
      "begin": "2023-10-21",
      "end": "2023-10-25"
    },
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 11849,
        "clicks": 209,
        "cr": 0.48,
        "ctr": 1.76,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 4,
        "orders": 1,
        "price": 175000,
        "cpc": 837.32,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-21T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2017,
                    "clicks": 27,
                    "atbs": 1,
                    "ctr": 1.34
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 1.91,
        "cr2": 25
      }
    ]
  },
  {
    "dates": [
      "2023-10-26",
      "2023-10-22"
    ],
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 4584,
        "clicks": 74,
        "cr": 1.35,
        "ctr": 1.61,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 2,
        "orders": 1,
        "price": 175000,
        "cpc": 2364.86,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-22T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2384,
                    "clicks": 33,
                    "atbs": 2,
                    "orders": 1,
                    "cr": 3.03,
                    "ctr": 1.38
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 2.7,
        "cr2": 50
      }
    ]
  },
  {
    "stats": [
      {
        "item_id": 62237,
        "item_name": "Gloria Jeans",
        "category_name": "Детям",
        "advert_type": 1,
        "place": 2,
        "views": 11849,
        "clicks": 209,
        "cr": 0.48,
        "ctr": 1.76,
        "date_from": "2023-10-21T00:00:00+03:00",
        "date_to": "2023-10-27T23:59:59+03:00",
        "subject_name": "Одежда",
        "atbs": 4,
        "orders": 1,
        "price": 175000,
        "cpc": 837.32,
        "status": 6,
        "daily_stats": [
          {
            "date": "2023-10-21T00:00:00+03:00",
            "app_type_stats": [
              {
                "app_type": 1,
                "stats": [
                  {
                    "views": 2017,
                    "clicks": 27,
                    "atbs": 1,
                    "ctr": 1.34
                  }
                ]
              }
            ]
          }
        ],
        "expenses": 175000,
        "cr1": 1.91,
        "cr2": 25
      }
    ]
  }
]
```

Пример `RespStatCampaignNotFound`:

```json
[
  {
    "advert_id": 111,
    "error": "кампания не найдена"
  }
]
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **error** (`string`)

Пример `invalidAdvert`:

```json
{
  "error": "Некорректное тело запроса"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/adv/v1/normquery/stats`

**Статистика по поисковым кластерам с детализацией по дням**  
`operationId`: `postV1NormqueryStats` · read-only · category `advert`

Хосты:
- `https://advert-api.wildberries.ru` — prod

Метод формирует статистику по поисковым кластерам за указанный период с детализацией по дням.
Можно использовать для кампаний с моделями оплаты `cpm` — за показы и `cpc` — за клики.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Сервисный | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Базовый с секретом | 1 мин | 10 запросов | 6 сек | 20 запросов |
| Базовый | 1 ч | 2 запроса | 30 мин | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **from** **обязательное** (`string · date`) — Дата начала периода
    пример: `"2025-01-01"`
  - **to** **обязательное** (`string · date`) — Дата окончания периода периода
    пример: `"2025-01-31"`
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB

Пример:

```json
{
  "from": "2026-01-01",
  "to": "2026-01-30",
  "items": [
    {
      "advertId": 123456789,
      "nmId": 987654321
    }
  ]
}
```

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **items** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB
      - **dailyStats** (`array`) — Статистика с детализацией по дням
        - **items** (`object`)
          - **date** **обязательное** (`string · date`) — Дата
          - **stat** (`object`)
            - **normQuery** (`string`) — Поисковый кластер
            - **views** (`integer · nullable`) — Количество просмотров.
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **clicks** (`integer`) — Количество кликов
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **ctr** (`number · float · nullable`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах.
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **cpc** (`number · float`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **cpm** (`number · float · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **avgPos** (`number · float`) — Средняя позиция товара на страницах поисковой выдачи
            - **shks** (`integer`) — Количество заказанных товаров, шт.
            - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании

Пример:

```json
{
  "items": [
    {
      "advertId": 123456789,
      "dailyStats": [
        {
          "date": "2026-01-27",
          "stat": {
            "atbs": 39,
            "avgPos": 3.3,
            "clicks": 75,
            "cpc": 1.44,
            "cpm": 562.5,
            "ctr": 39.06,
            "normQuery": "Поисковый кластер 0",
            "orders": 9,
            "shks": 5,
            "spend": 108,
            "views": 192
          }
        },
        {
          "date": "2026-01-27",
          "stat": {
            "atbs": 71,
            "avgPos": 7.9,
            "clicks": 56,
            "cpc": 4.38,
            "cpm": 1290.95,
            "ctr": 29.47,
            "normQuery": "румяна для лица vivienne sabo",
            "orders": 2,
            "shks": 44,
            "spend": 245.28,
            "views": 190
          }
        },
        {
          "date": "2026-01-27",
          "stat": {
            "atbs": 39,
            "avgPos": 3.3,
            "clicks": 75,
            "cpc": 1.44,
            "cpm": 562.5,
            "ctr": 39.06,
            "normQuery": "Поисковый кластер 2",
            "orders": 9,
            "shks": 345345,
            "spend": 108,
            "views": 192
          }
        }
      ],
      "nmId": 987654321
    }
  ]
}
```

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

Пример:

```json
{
  "detail": "incorrect request body, please check API documentation",
  "origin": "camp-api-public-cache",
  "request_id": "33e7d9f3fc221648cdf096bf8e62e482",
  "status": 400,
  "title": "invalid request body"
}
```

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Календарь акций

## GET `/api/v1/calendar/promotions`

**Список акций**  
`operationId`: `getV1CalendarPromotions` · read-only · category `discountsandprices`

Хосты:
- `https://dp-calendar-api.wildberries.ru` — prod

Метод возвращает список [акций](/openapi/promotion#tag/promoCalendar/operation/getV1CalendarPromotionsDetails) в WB с датами и временем проведения.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца для всех методов категории **Календарь акций**:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Сервисный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый с секретом | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `startDateTime` | query | string | да | Начало периода, формат `YYYY-MM-DDTHH:MM:SSZ` |
| `endDateTime` | query | string | да | Конец периода, формат `YYYY-MM-DDTHH:MM:SSZ` |
| `allPromo` | query | boolean | да | Показать акции: |
| `limit` | query | integer | нет | Количество запрашиваемых акций |
| `offset` | query | integer | нет | После какого элемента выдавать данные |

Детали параметров:

пример `startDateTime`: `2023-09-01T00:00:00Z`

пример `endDateTime`: `2024-08-01T23:59:59Z`

**`allPromo`**

Показать акции:
  - `false` — доступные для участия
  - `true` — все акции

пример `limit`: `10`

пример `offset`: `0`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **promotions** (`array`) — Список акций
      - **items** (`object`)
        - **id** (`integer`) — ID акции
          пример: `123`
        - **name** (`string`) — Название акции
          пример: `"скидки"`
        - **startDateTime** (`string · date-time`) — Начало акции
          пример: `"2023-06-05T21:00:00Z"`
        - **endDateTime** (`string · date-time`) — Конец акции
          пример: `"2023-06-05T21:00:00Z"`
        - **type** (`string · enum: "regular", "auto"`) — Тип акции:
            - `regular` — акция
            - `auto` — автоакция

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Failed to parse data"`

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 402 — Требуется платёж

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки. Ошибка возвращается только сервисам из [Каталога решений для бизнеса](/business-solutions)

Пример:

```json
{
  "title": "payment required",
  "detail": "wb solution for business has insufficient funds on its balance. please top up the balance in the company's personal account https://dev.wildberries.ru/company"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/api/v1/calendar/promotions/details`

**Детальная информация об акциях**  
`operationId`: `getV1CalendarPromotionsDetails` · read-only · category `discountsandprices`

Хосты:
- `https://dp-calendar-api.wildberries.ru` — prod

Метод возвращает подробную информацию об [акции](/openapi/promotion#tag/promoCalendar/operation/getV1CalendarPromotionsDetails) по ID.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца для всех методов категории **Календарь акций**:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Сервисный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый с секретом | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `promotionIDs` | query | array[integer] | да | ID акций, по которым нужно вернуть информацию |

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **promotions** (`array`) — Список акций
      - **items** (`object`)
        - **id** (`integer`) — ID акции
          пример: `123`
        - **name** (`string`) — Название акции
          пример: `"ХИТЫ ГОДА"`
        - **description** (`string`) — Описание акции
          пример: `"В акции принимают участие самые популярные товары 2023 года. Карточки товаров будут выделены плашкой «ХИТ ГОДА», чтобы покупатели замечали эти товары среди других. Также они будут размещены под баннерами на главной странице и примут участие в PUSH-уведомлениях. С ценами для вступления в акцию вы можете ознакомиться ниже."`
        - **advantages** (`array`) — Преимущества акции
          - **items** (`string`)
        - **startDateTime** (`string`) — Начало акции
          пример: `"2023-06-05T21:00:00Z"`
        - **endDateTime** (`string`) — Конец акции
          пример: `"2023-06-05T21:00:00Z"`
        - **inPromoActionLeftovers** (`integer`) — Количество товаров с остатками, участвующих в акции
          пример: `45`
        - **inPromoActionTotal** (`integer`) — Общее количество товаров, участвующих в акции
          пример: `123`
        - **notInPromoActionLeftovers** (`integer`) — Количество товаров с остатками, не участвующих в акции
          пример: `3`
        - **notInPromoActionTotal** (`integer`) — Общее количество товаров, не участвующих в акции
          пример: `10`
        - **participationPercentage** (`integer`) — Уже участвующие в акции товары, %. Рассчитывается по товарам в акции и с остатком
          пример: `10`
        - **type** (`string · enum: "regular", "auto"`) — Тип акции:
            - `regular` — акция
            - `auto` — автоакция
          пример: `"auto"`
        - **exceptionProductsCount** (`integer · uint`) — Количество товаров, исключенных из автоакции до её старта. Только при `"type": "auto"`.
          
          В момент старта акции эти товары автоматически будут без скидки
          пример: `10`
        - **ranging** (`array`) — Ранжирование (если подключено)
          - **items** (`object`)
            - **condition** (`string`) — Тип [ранжирования](https://seller.wildberries.ru/help-center/article/A-385):
                - `productsInPromotion` — продвижение получат товары продавца, участвующие в акции
                - `calculateProducts` — продвижение получат любые товара продавца, предложенные к участию в акции
                - `allProducts` — продвижение получат все товары продавца
            - **participationRate** (`integer · uint · minimum=0 · maximum=100`) — Количество товаров продавца для перехода на следующий уровень ранжирования, %
            - **boost** (`integer · uint`) — Текущий уровень поднятия в поиске, %

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Failed to parse data"`

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 402 — Требуется платёж

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки. Ошибка возвращается только сервисам из [Каталога решений для бизнеса](/business-solutions)

Пример:

```json
{
  "title": "payment required",
  "detail": "wb solution for business has insufficient funds on its balance. please top up the balance in the company's personal account https://dev.wildberries.ru/company"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## GET `/api/v1/calendar/promotions/nomenclatures`

**Список товаров для участия в акции**  
`operationId`: `getV1CalendarPromotionsNomenclatures` · read-only · category `discountsandprices`

Хосты:
- `https://dp-calendar-api.wildberries.ru` — prod

Метод формирует список товаров, подходящих для участия в [акции](/openapi/promotion#tag/promoCalendar/operation/getV1CalendarPromotionsDetails). Эти товары можно добавить в акцию с помощью [отдельного метода](/openapi/promotion#tag/promoCalendar/operation/postV1CalendarPromotionsUpload).

  Данный метод неприменим для автоакций.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца для всех методов категории **Календарь акций**:

| Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- |
| 6 сек | 10 запросов | 600 мс | 5 запросов |

### Параметры

| Имя | Где | Тип | Обяз. | Описание |
|---|---|---|---|---|
| `promotionID` | query | integer | да | ID акции |
| `inAction` | query | boolean | да | Участвует в акции: |
| `limit` | query | integer | нет | Количество запрашиваемых товаров |
| `offset` | query | integer | нет | После какого элемента выдавать данные |

Детали параметров:

пример `promotionID`: `1`

**`inAction`**

Участвует в акции:
  - `true` — да
  - `false` — нет

пример `inAction`: `True`

пример `limit`: `10`

пример `offset`: `0`

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **nomenclatures** (`array`) — Список товаров
      - **items** (`object`)
        - **id** (`integer`) — Артикул WB
          пример: `162579635`
        - **inAction** (`boolean`) — Участвует в акции:
            - `true` — да
            - `false` — нет
          пример: `true`
        - **price** (`number · float`) — Текущая розничная цена
          пример: `1500`
        - **currencyCode** (`string`) — Валюта в формате ISO 4217
          пример: `"RUB"`
        - **planPrice** (`number · float`) — Плановая цена (цена во время акции)
          пример: `1000`
        - **discount** (`integer`) — Текущая скидка
          пример: `15`
        - **planDiscount** (`integer`) — Рекомендуемая скидка для участия в акции
          пример: `34`

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Invalid query params"`

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 402 — Требуется платёж

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки. Ошибка возвращается только сервисам из [Каталога решений для бизнеса](/business-solutions)

Пример:

```json
{
  "title": "payment required",
  "detail": "wb solution for business has insufficient funds on its balance. please top up the balance in the company's personal account https://dev.wildberries.ru/company"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Ошибка обработки параметров запроса

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки

Пример `PromoCompletedOrNotExist`:

```json
{
  "errorText": "Unprocessable entity"
}
```

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

## POST `/api/v1/calendar/promotions/upload`

**Добавить товар в акцию**  
`operationId`: `postV1CalendarPromotionsUpload` · write · category `discountsandprices`

Хосты:
- `https://dp-calendar-api.wildberries.ru` — prod

Метод создаёт задание на загрузку товара в [акцию](/openapi/promotion#tag/promoCalendar/operation/getV1CalendarPromotionsDetails).

Состояние загрузки можно проверить с помощью [отдельных методов](/openapi/work-with-products#tag/Ceny-i-skidki/paths/~1api~1v2~1history~1tasks/get).

  Данный метод неприменим для автоакций.

[Лимит запросов](https://dev.wildberries.ru/openapi/api-information#tag/introduction/Limity-zaprosov) на один аккаунт продавца для всех методов категории **Календарь акций**:

| Тип | Период | Лимит | Интервал | Всплеск |
| --- | --- | --- | --- | --- |
| Персональный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Сервисный | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый с секретом | 6 сек | 10 запросов | 600 мс | 5 запросов |
| Базовый | 1 ч | 1 запрос | 1 ч | 1 запрос |

### Тело запроса **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **data** (`object`) — Данные запроса
    - **promotionID** (`integer · minimum=1`) — ID акции
      пример: `1`
    - **uploadNow** (`boolean`) — Установить скидку:
        - `true` — сейчас
        - `false` — в момент старта акции
      пример: `true`
    - **nomenclatures** (`array · uniqueItems · minItems=1 · maxItems=1000`) — Артикулы WB, которые можно добавить в акцию
      - **items** (`integer · minimum=1`)

### Ответы

#### HTTP 200 — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **alreadyExists** (`boolean`) — Загрузка с такими данными уже существует
      пример: `false`
    - **uploadID** (`integer`) — ID загрузки
      пример: `11`

#### HTTP 400 — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Invalid query params"`

#### HTTP 401 — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

#### HTTP 402 — Требуется платёж

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки. Ошибка возвращается только сервисам из [Каталога решений для бизнеса](/business-solutions)

Пример:

```json
{
  "title": "payment required",
  "detail": "wb solution for business has insufficient funds on its balance. please top up the balance in the company's personal account https://dev.wildberries.ru/company"
}
```

#### HTTP 403 — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

#### HTTP 422 — Ошибка обработки параметров запроса

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Unprocessable entity"`

#### HTTP 429 — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

---

# Схемы (components.schemas)

## `400Response`

- **400Response** (`object`)
  - **error** (`string`)

## `AdvertBidsKopecks`

- **AdvertBidsKopecks** — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **search** **обязательное** (`integer · int64`) — Ставка в поиске
  - **recommendations** **обязательное** (`integer · int64`) — Ставка в рекомендациях

## `AdvertNMsSettings`

- **AdvertNMsSettings** (`object`)
  - **bids_kopecks** **обязательное** — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **search** **обязательное** (`integer · int64`) — Ставка в поиске
    - **recommendations** **обязательное** (`integer · int64`) — Ставка в рекомендациях
  - **subject** **обязательное** (`object`) — Предмет
    - **id** **обязательное** (`integer · int64`) — ID предмета
    - **name** **обязательное** (`string`) — Название предмета
  - **nm_id** **обязательное** (`integer · int64`) — Артикул WB

## `AdvertSettings`

- **AdvertSettings** (`object`) — Настройки кампании
  - **payment_type** **обязательное** (`string`) — Тип оплаты:
    - `cpm` — за показы
    - `cpc` — за клик
  - **name** **обязательное** (`string`) — Название кампании
  - **placements** **обязательное** (`object`) — Места размещения
    - **search** **обязательное** (`boolean`) — Размещение в поиске:
        - `false` — отключено
        - `true` — включено
    - **recommendations** **обязательное** (`boolean`) — Размещение в рекомендациях:
        - `false` — отключено
        - `true` — включено

## `AdvertSubcategory`

- **AdvertSubcategory** (`object`) — Предмет
  - **id** **обязательное** (`integer · int64`) — ID предмета
  - **name** **обязательное** (`string`) — Название предмета

## `BoosterStatsV3`

- **BoosterStatsV3** (`array`) — Статистика по средней позиции товара (для кампаний с единой ставкой)
  - **items** (`object`)
    - **avg_position** **обязательное** (`integer`) — Средняя позиция товара
    - **date** **обязательное** (`string · date`) — Дата, за которую предоставлены данные
    - **nm** **обязательное** (`integer`) — Артикул WB

## `DailyStats1`

- **DailyStats1** (`array`)
  - **items** (`object`)
    - **date** (`string · date-time`) — Дата
    - **app_type_stats** (`array`) — Статистика по платформам
      - **items** (`object`)
        - **app_type** (`integer`) — Тип платформы:
          - `1` — сайт
          - `32` — Android
          - `64` — IOS
        - **stats** (`array`)
          - **items** (`object`)
            - **views** (`integer`) — Количество просмотров
            - **clicks** (`integer`) — Количество кликов
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании

## `DailyStats2`

- **DailyStats2** (`array`)
  - **items** (`object`)
    - **date** (`string · date-time`) — Дата
    - **app_type_stats** (`array`) — Статистика по платформам
      - **items** (`object`)
        - **app_type** (`integer`) — Тип платформы:
          - `1` — сайт
          - `32` — Android
          - `64` — IOS
        - **stats** (`array`)
          - **items** (`object`)
            - **views** (`integer`) — Количество просмотров
            - **clicks** (`integer`) — Количество кликов
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **cr** (`number`) — CR(conversion rate) — отношение количества заказов к общему количеству посещений медиакампании
            - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании

## `DaysV3`

- **DaysV3** (`array`) — Статистка по дням
  - **items** (`object`)
    - **apps** **обязательное** (`array`) — Блок информации о платформе
      - **items** (`object`)
        - **appType** **обязательное** (`integer · enum: 1, 32, 64`) — Тип платформы:
            - `1` — сайт
            - `32` — Android
            - `64` — IOS
        - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
        - **canceled** **обязательное** (`integer`) — Отмены, шт.
        - **clicks** **обязательное** (`integer`) — Количество кликов
        - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
        - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
        - **nms** **обязательное** (`array`) — Блок статистики по артикулам WB
          - **items** (`object`)
            - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
            - **canceled** **обязательное** (`integer`) — Отмены, шт.
            - **clicks** **обязательное** (`integer`) — Количество кликов
            - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
            - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
            - **name** **обязательное** (`string`) — Название товара
            - **nmId** **обязательное** (`integer`) — Артикул WB
            - **orders** **обязательное** (`integer`) — Количество заказов
            - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
            - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **views** **обязательное** (`integer`) — Количество просмотров
        - **orders** **обязательное** (`integer`) — Количество заказов
        - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
        - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **views** **обязательное** (`integer`) — Количество просмотров
    - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
    - **canceled** **обязательное** (`integer`) — Отмены, шт.
    - **date** **обязательное** (`string · date-time`) — Дата, за которую представлены данные
    - **clicks** **обязательное** (`integer`) — Количество кликов
    - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству посещений кампании
    - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
    - **orders** **обязательное** (`integer`) — Количество заказов
    - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
    - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **views** **обязательное** (`integer`) — Количество просмотров

## `FullStatsError`

- **FullStatsError** (`object`) — Ошибка
  - **errors** (`array`)
    - **items** (`object`)
      - **detail** (`string`) — Детали ошибки
      - **field** (`string`) — Параметр с ошибкой
  - **detail** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
  - **request_id** **обязательное** (`string`) — ID запроса
  - **status** **обязательное** (`integer`) — HTTP статус-код
  - **title** **обязательное** (`string`) — Заголовок ошибки
  - **type** (`string`) — Тип ошибки

## `FullStatsItem`

- **FullStatsItem** (`object`) — Статистика по одной кампании за период, указанный в запросе. По всем артикулам WB и платформам
  - **advertId** **обязательное** (`integer`) — ID кампании
  - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
  - **boosterStats**
    allOf:
      - **allOf[0]** (`array`) — Статистика по средней позиции товара (для кампаний с единой ставкой)
        - **items** (`object`)
          - **avg_position** **обязательное** (`integer`) — Средняя позиция товара
          - **date** **обязательное** (`string · date`) — Дата, за которую предоставлены данные
          - **nm** **обязательное** (`integer`) — Артикул WB
      - **allOf[1]** — Статистика по бустеру
  - **canceled** **обязательное** (`integer`) — Отмены, шт.
  - **clicks** **обязательное** (`integer`) — Количество кликов
  - **cpc** **обязательное** (`number · double`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cr** **обязательное** (`number · double`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
  - **ctr** **обязательное** (`number · double`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
  - **days** **обязательное**
    allOf:
      - **allOf[0]** (`array`) — Статистка по дням
        - **items** (`object`)
          - **apps** **обязательное** (`array`) — Блок информации о платформе
            - **items** (`object`)
              - **appType** **обязательное** (`integer · enum: 1, 32, 64`) — Тип платформы:
                  - `1` — сайт
                  - `32` — Android
                  - `64` — IOS
              - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
              - **canceled** **обязательное** (`integer`) — Отмены, шт.
              - **clicks** **обязательное** (`integer`) — Количество кликов
              - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
              - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
              - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
              - **nms** **обязательное** (`array`) — Блок статистики по артикулам WB
                - **items** (`object`)
                  - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
                  - **canceled** **обязательное** (`integer`) — Отмены, шт.
                  - **clicks** **обязательное** (`integer`) — Количество кликов
                  - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                  - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
                  - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
                  - **name** **обязательное** (`string`) — Название товара
                  - **nmId** **обязательное** (`integer`) — Артикул WB
                  - **orders** **обязательное** (`integer`) — Количество заказов
                  - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
                  - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                  - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                  - **views** **обязательное** (`integer`) — Количество просмотров
              - **orders** **обязательное** (`integer`) — Количество заказов
              - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
              - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
              - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
              - **views** **обязательное** (`integer`) — Количество просмотров
          - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
          - **canceled** **обязательное** (`integer`) — Отмены, шт.
          - **date** **обязательное** (`string · date-time`) — Дата, за которую представлены данные
          - **clicks** **обязательное** (`integer`) — Количество кликов
          - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству посещений кампании
          - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
          - **orders** **обязательное** (`integer`) — Количество заказов
          - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
          - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **views** **обязательное** (`integer`) — Количество просмотров
      - **allOf[1]** — Статистика с разбивкой по дням
  - **orders** **обязательное** (`integer`) — Количество заказов
  - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
  - **sum** **обязательное** (`number · double`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **sum_price** **обязательное** (`number · double`) — Сумма заказов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **views** **обязательное** (`integer`) — Количество просмотров
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `GetAdverts`

- **GetAdverts** (`object`)
  - **adverts** **обязательное** (`array`) — Кампании
    - **items** (`object`)
      - **bid_type** **обязательное** (`string`) — Тип ставки:
          - `unified` — единая ставка
          - `manual` — ручная ставка
      - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **id** **обязательное** (`integer · int64`) — ID кампании
      - **nm_settings** **обязательное** (`array · nullable`) — Настройки товаров
        - **items** (`object`)
          - **bids_kopecks** **обязательное** — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **search** **обязательное** (`integer · int64`) — Ставка в поиске
            - **recommendations** **обязательное** (`integer · int64`) — Ставка в рекомендациях
          - **subject** **обязательное** (`object`) — Предмет
            - **id** **обязательное** (`integer · int64`) — ID предмета
            - **name** **обязательное** (`string`) — Название предмета
          - **nm_id** **обязательное** (`integer · int64`) — Артикул WB
      - **settings** **обязательное** (`object`) — Настройки кампании
        - **payment_type** **обязательное** (`string`) — Тип оплаты:
          - `cpm` — за показы
          - `cpc` — за клик
        - **name** **обязательное** (`string`) — Название кампании
        - **placements** **обязательное** (`object`) — Места размещения
          - **search** **обязательное** (`boolean`) — Размещение в поиске:
              - `false` — отключено
              - `true` — включено
          - **recommendations** **обязательное** (`boolean`) — Размещение в рекомендациях:
              - `false` — отключено
              - `true` — включено
      - **restrictions** **обязательное** (`object`) — Ограничения кампании
        - **can_change_nms** (`boolean`) — Можно ли изменять список товаров кампании:
            - `true` — да
            - `false` — нет
      - **status** **обязательное** (`integer · enum: -1, 4, 7, 8, 9, 11`) — Статус кампании:
        - `-1` — удалена, процесс удаления будет завершён в течение 10 минут
        - `4` — готова к запуску
        - `7` — завершена
        - `8` — отменена
        - `9` — активна
        - `11` — на паузе
      - **timestamps** **обязательное** (`object`) — Временные отметки
        - **created** **обязательное** (`string · date-time`) — Время создания кампании
        - **updated** **обязательное** (`string · date-time`) — Время последнего изменения кампании
        - **started** **обязательное** (`string · date-time · nullable`) — Время последнего запуска кампании
        - **deleted** **обязательное** (`string · date-time`) — Время удаления кампании. Если кампания не удалена, время указывается в будущем

## `NormQueryBidFailResponseItem`

- **NormQueryBidFailResponseItem** (`object`)
  - **advertId** **обязательное** (`integer`) — ID кампании
  - **nmId** **обязательное** (`integer`) — Артикул WB
  - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
  - **reason** **обязательное** (`string`) — Описание причины ошибки

## `PlacementType`

- **PlacementType** (`string · enum: "combined", "search", "recommendation"`) — Места размещения:
    - `search` — поиск
    - `recommendation` — рекомендации
    - `combined` — поиск и рекомендации

## `PromoItemsList`

- **PromoItemsList** (`object`)
  - **id** (`integer`) — Артикул WB
    пример: `162579635`
  - **inAction** (`boolean`) — Участвует в акции:
      - `true` — да
      - `false` — нет
    пример: `true`
  - **price** (`number · float`) — Текущая розничная цена
    пример: `1500`
  - **currencyCode** (`string`) — Валюта в формате ISO 4217
    пример: `"RUB"`
  - **planPrice** (`number · float`) — Плановая цена (цена во время акции)
    пример: `1000`
  - **discount** (`integer`) — Текущая скидка
    пример: `15`
  - **planDiscount** (`integer`) — Рекомендуемая скидка для участия в акции
    пример: `34`

## `RequestWithCampaignID`

- **RequestWithCampaignID** (`object`)
  - **id** **обязательное** (`integer`) — ID кампании

## `RequestWithDate`

- **RequestWithDate** (`object`)
  - **id** **обязательное** (`integer`) — ID кампании
  - **dates** **обязательное** (`array`) — Даты, за которые нужно получить информацию
    - **items** (`string · date`)

## `RequestWithInterval`

- **RequestWithInterval** (`object`)
  - **id** **обязательное** (`integer`) — ID кампании
  - **interval** **обязательное** (`object`) — Временной диапазон, за который необходимо выдать данные
    - **begin** (`string · date`) — Начало запрашиваемого периода
    - **end** (`string · date`) — Конец запрашиваемого периода

## `Response4XX`

- **Response4XX** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

## `ResponseAdvError1`

- **ResponseAdvError1** (`object`)
  - **error** (`string`)

## `ResponseFullStats`

- **ResponseFullStats** (`array`) — Статистика по кампаниям за период, указанный в запросе. По всем артикулам WB и платформам
  - **items** (`object`) — Статистика по одной кампании за период, указанный в запросе. По всем артикулам WB и платформам
    - **advertId** **обязательное** (`integer`) — ID кампании
    - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
    - **boosterStats**
      allOf:
        - **allOf[0]** (`array`) — Статистика по средней позиции товара (для кампаний с единой ставкой)
          - **items** (`object`)
            - **avg_position** **обязательное** (`integer`) — Средняя позиция товара
            - **date** **обязательное** (`string · date`) — Дата, за которую предоставлены данные
            - **nm** **обязательное** (`integer`) — Артикул WB
        - **allOf[1]** — Статистика по бустеру
    - **canceled** **обязательное** (`integer`) — Отмены, шт.
    - **clicks** **обязательное** (`integer`) — Количество кликов
    - **cpc** **обязательное** (`number · double`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **cr** **обязательное** (`number · double`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
    - **ctr** **обязательное** (`number · double`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
    - **days** **обязательное**
      allOf:
        - **allOf[0]** (`array`) — Статистка по дням
          - **items** (`object`)
            - **apps** **обязательное** (`array`) — Блок информации о платформе
              - **items** (`object`)
                - **appType** **обязательное** (`integer · enum: 1, 32, 64`) — Тип платформы:
                    - `1` — сайт
                    - `32` — Android
                    - `64` — IOS
                - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
                - **canceled** **обязательное** (`integer`) — Отмены, шт.
                - **clicks** **обязательное** (`integer`) — Количество кликов
                - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
                - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
                - **nms** **обязательное** (`array`) — Блок статистики по артикулам WB
                  - **items** (`object`)
                    - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
                    - **canceled** **обязательное** (`integer`) — Отмены, шт.
                    - **clicks** **обязательное** (`integer`) — Количество кликов
                    - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству кликов
                    - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
                    - **name** **обязательное** (`string`) — Название товара
                    - **nmId** **обязательное** (`integer`) — Артикул WB
                    - **orders** **обязательное** (`integer`) — Количество заказов
                    - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
                    - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                    - **views** **обязательное** (`integer`) — Количество просмотров
                - **orders** **обязательное** (`integer`) — Количество заказов
                - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
                - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
                - **views** **обязательное** (`integer`) — Количество просмотров
            - **atbs** **обязательное** (`integer`) — Количество добавлений товаров в корзину
            - **canceled** **обязательное** (`integer`) — Отмены, шт.
            - **date** **обязательное** (`string · date-time`) — Дата, за которую представлены данные
            - **clicks** **обязательное** (`integer`) — Количество кликов
            - **cpc** **обязательное** (`number`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **cr** **обязательное** (`number`) — CR (conversion rate) — отношение количества заказов к общему количеству посещений кампании
            - **ctr** **обязательное** (`number`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах
            - **orders** **обязательное** (`integer`) — Количество заказов
            - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
            - **sum** **обязательное** (`number`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **sum_price** **обязательное** (`number`) — Заказов на сумму в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **views** **обязательное** (`integer`) — Количество просмотров
        - **allOf[1]** — Статистика с разбивкой по дням
    - **orders** **обязательное** (`integer`) — Количество заказов
    - **shks** **обязательное** (`integer`) — Количество заказанных товаров, шт.
    - **sum** **обязательное** (`number · double`) — Затраты в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **sum_price** **обязательное** (`number · double`) — Сумма заказов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **views** **обязательное** (`integer`) — Количество просмотров
    - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `ResponseWithReturn`

- **ResponseWithReturn** (`object`)
  - **total** (`integer`) — Размер обновлённого бюджета
  - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `StandardizedBatchError`

- **StandardizedBatchError** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
    пример: `"some nms are not belong to advert"`
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"123e4567-e89b-12d3-a456-426614174000"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"Invalid Params"`

## `Stat`

- **Stat** (`object`)
  - **stats** (`array`) — Блок статистики
    - **items** (`object`)
      - **item_id** (`integer`) — ID баннера
      - **item_name** (`string`) — Бренд
      - **category_name** (`string`) — Название категории
      - **advert_type** (`integer`) — Тип медиакампании:
          - `1` — размещение по дням
          - `2` — размещение по просмотрам
      - **place** (`integer`) — Место на странице
      - **views** (`integer`) — Количество просмотров
      - **clicks** (`integer`) — Количество кликов
      - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
      - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **date_from** (`string · date-time`) — Время начала размещения
      - **date_to** (`string · date-time`) — Время завершения размещения
      - **subject_name** (`string`) — Родительская категория предмета
      - **atbs** (`integer`) — Количество добавлений товаров в корзину
      - **orders** (`integer`) — Количество заказов
      - **price** (`number`) — Стоимость размещения
      - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
      - **status** (`integer`) — Статус медиакампании
      - **daily_stats** (`array`)
        - **items** (`object`)
          - **date** (`string · date-time`) — Дата
          - **app_type_stats** (`array`) — Статистика по платформам
            - **items** (`object`)
              - **app_type** (`integer`) — Тип платформы:
                - `1` — сайт
                - `32` — Android
                - `64` — IOS
              - **stats** (`array`)
                - **items** (`object`)
                  - **views** (`integer`) — Количество просмотров
                  - **clicks** (`integer`) — Количество кликов
                  - **atbs** (`integer`) — Количество добавлений товаров в корзину
                  - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **expenses** (`number`) — Стоимость размещения баннера
      - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
      - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину

## `StatCampaignNotFound`

- **StatCampaignNotFound** (`object`)
  - **advert_id** (`integer · int64`) — ID кампании
    пример: `111`
  - **error** (`string`) — Описание ошибки
    пример: `"кампания не найдена"`

## `StatDate`

- **StatDate** (`object`)
  - **dates** **обязательное** (`array`) — Даты, за которые нужно получить информацию
    - **items** (`string · date`)
  - **stats** (`array`) — Блок статистики
    - **items** (`object`)
      - **item_id** (`integer`) — ID баннера
      - **item_name** (`string`) — Бренд
      - **category_name** (`string`) — Название категории
      - **advert_type** (`integer`) — Тип медиакампании:
          - `1` — размещение по дням
          - `2` — размещение по просмотрам
      - **place** (`integer`) — Место на странице
      - **views** (`integer`) — Количество просмотров
      - **clicks** (`integer`) — Количество кликов
      - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
      - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **date_from** (`string · date-time`) — Время начала размещения
      - **date_to** (`string · date-time`) — Время завершения размещения
      - **subject_name** (`string`) — Родительская категория предмета
      - **atbs** (`integer`) — Количество добавлений товаров в корзину
      - **orders** (`integer`) — Количество заказов
      - **price** (`number`) — Стоимость размещения
      - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
      - **status** (`integer`) — Статус медиакампании
      - **daily_stats** (`array`)
        - **items** (`object`)
          - **date** (`string · date-time`) — Дата
          - **app_type_stats** (`array`) — Статистика по платформам
            - **items** (`object`)
              - **app_type** (`integer`) — Тип платформы:
                - `1` — сайт
                - `32` — Android
                - `64` — IOS
              - **stats** (`array`)
                - **items** (`object`)
                  - **views** (`integer`) — Количество просмотров
                  - **clicks** (`integer`) — Количество кликов
                  - **atbs** (`integer`) — Количество добавлений товаров в корзину
                  - **orders** (`integer`) — Количество заказов
                  - **cr** (`number`) — CR(conversion rate) — отношение количества заказов к общему количеству посещений медиакампании
                  - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **expenses** (`number`) — Стоимость размещения баннера
      - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
      - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину

## `StatInterval`

- **StatInterval** (`object`)
  - **interval** **обязательное** (`object`) — Период
    - **begin** (`string · date`) — Начало периода
    - **end** (`string · date`) — Конец периода
  - **stats** (`array`) — Блок статистики
    - **items** (`object`)
      - **item_id** (`integer`) — ID баннера
      - **item_name** (`string`) — Бренд
      - **category_name** (`string`) — Название категории
      - **advert_type** (`integer`) — Тип медиакампании:
          - `1` — размещение по дням
          - `2` — размещение по просмотрам
      - **place** (`integer`) — Место на странице
      - **views** (`integer`) — Количество просмотров
      - **clicks** (`integer`) — Количество кликов
      - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
      - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **date_from** (`string · date-time`) — Время начала размещения
      - **date_to** (`string · date-time`) — Время завершения размещения
      - **subject_name** (`string`) — Родительская категория предмета
      - **atbs** (`integer`) — Количество добавлений товаров в корзину
      - **orders** (`integer`) — Количество заказов
      - **price** (`number`) — Стоимость размещения
      - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
      - **status** (`integer`) — Статус медиакампании
      - **daily_stats** (`array`)
        - **items** (`object`)
          - **date** (`string · date-time`) — Дата
          - **app_type_stats** (`array`) — Статистика по платформам
            - **items** (`object`)
              - **app_type** (`integer`) — Тип платформы:
                - `1` — сайт
                - `32` — Android
                - `64` — IOS
              - **stats** (`array`)
                - **items** (`object`)
                  - **views** (`integer`) — Количество просмотров
                  - **clicks** (`integer`) — Количество кликов
                  - **atbs** (`integer`) — Количество добавлений товаров в корзину
                  - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
      - **expenses** (`number`) — Стоимость размещения баннера
      - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
      - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину

## `Stats1`

- **Stats1** (`array`)
  - **items** (`object`)
    - **views** (`integer`) — Количество просмотров
    - **clicks** (`integer`) — Количество кликов
    - **atbs** (`integer`) — Количество добавлений товаров в корзину
    - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании

## `Stats2`

- **Stats2** (`array`)
  - **items** (`object`)
    - **views** (`integer`) — Количество просмотров
    - **clicks** (`integer`) — Количество кликов
    - **atbs** (`integer`) — Количество добавлений товаров в корзину
    - **orders** (`integer`) — Количество заказов
    - **cr** (`number`) — CR(conversion rate) — отношение количества заказов к общему количеству посещений медиакампании
    - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании

## `StatsBlok1`

- **StatsBlok1** (`object`)
  - **item_id** (`integer`) — ID баннера
  - **item_name** (`string`) — Бренд
  - **category_name** (`string`) — Название категории
  - **advert_type** (`integer`) — Тип медиакампании:
      - `1` — размещение по дням
      - `2` — размещение по просмотрам
  - **place** (`integer`) — Место на странице
  - **views** (`integer`) — Количество просмотров
  - **clicks** (`integer`) — Количество кликов
  - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
  - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
  - **date_from** (`string · date-time`) — Время начала размещения
  - **date_to** (`string · date-time`) — Время завершения размещения
  - **subject_name** (`string`) — Родительская категория предмета
  - **atbs** (`integer`) — Количество добавлений товаров в корзину
  - **orders** (`integer`) — Количество заказов
  - **price** (`number`) — Стоимость размещения
  - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
  - **status** (`integer`) — Статус медиакампании
  - **daily_stats** (`array`)
    - **items** (`object`)
      - **date** (`string · date-time`) — Дата
      - **app_type_stats** (`array`) — Статистика по платформам
        - **items** (`object`)
          - **app_type** (`integer`) — Тип платформы:
            - `1` — сайт
            - `32` — Android
            - `64` — IOS
          - **stats** (`array`)
            - **items** (`object`)
              - **views** (`integer`) — Количество просмотров
              - **clicks** (`integer`) — Количество кликов
              - **atbs** (`integer`) — Количество добавлений товаров в корзину
              - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
  - **expenses** (`number`) — Стоимость размещения баннера
  - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
  - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину

## `StatsBlok2`

- **StatsBlok2** (`object`)
  - **item_id** (`integer`) — ID баннера
  - **item_name** (`string`) — Бренд
  - **category_name** (`string`) — Название категории
  - **advert_type** (`integer`) — Тип медиакампании:
      - `1` — размещение по дням
      - `2` — размещение по просмотрам
  - **place** (`integer`) — Место на странице
  - **views** (`integer`) — Количество просмотров
  - **clicks** (`integer`) — Количество кликов
  - **cr** (`number`) — CR(conversion rate) — это отношение количества заказов к общему количеству посещений медиакампании
  - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
  - **date_from** (`string · date-time`) — Время начала размещения
  - **date_to** (`string · date-time`) — Время завершения размещения
  - **subject_name** (`string`) — Родительская категория предмета
  - **atbs** (`integer`) — Количество добавлений товаров в корзину
  - **orders** (`integer`) — Количество заказов
  - **price** (`number`) — Стоимость размещения
  - **cpc** (`number`) — (cost per click) — цена клика по продвигаемому товару
  - **status** (`integer`) — Статус медиакампании
  - **daily_stats** (`array`)
    - **items** (`object`)
      - **date** (`string · date-time`) — Дата
      - **app_type_stats** (`array`) — Статистика по платформам
        - **items** (`object`)
          - **app_type** (`integer`) — Тип платформы:
            - `1` — сайт
            - `32` — Android
            - `64` — IOS
          - **stats** (`array`)
            - **items** (`object`)
              - **views** (`integer`) — Количество просмотров
              - **clicks** (`integer`) — Количество кликов
              - **atbs** (`integer`) — Количество добавлений товаров в корзину
              - **orders** (`integer`) — Количество заказов
              - **cr** (`number`) — CR(conversion rate) — отношение количества заказов к общему количеству посещений медиакампании
              - **ctr** (`number`) — CTR (click-through rate) — показатель кликабельности, отношение числа кликов к количеству показов в рамках медиакампании
  - **expenses** (`number`) — Стоимость размещения баннера
  - **cr1** (`number`) — Отношение количества добавлений в корзину к количеству кликов
  - **cr2** (`integer`) — Отношение количества заказов к количеству добавлений в корзину

## `Timestamps`

- **Timestamps** (`object`) — Временные отметки
  - **created** **обязательное** (`string · date-time`) — Время создания кампании
  - **updated** **обязательное** (`string · date-time`) — Время последнего изменения кампании
  - **started** **обязательное** (`string · date-time · nullable`) — Время последнего запуска кампании
  - **deleted** **обязательное** (`string · date-time`) — Время удаления кампании. Если кампания не удалена, время указывается в будущем

## `V0BidRecommendationBase`

- **V0BidRecommendationBase** (`object`) — Рекомендуемые ставки для карточек товаров
  - **competitiveBid** (`object`) — Конкурентная ставка — расчётная средняя ставка других продавцов, продающих аналогичные товары по похожей цене.
    У половины продавцов из расчёта ставка выше конкурентной, а другой половины — ниже
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **leadersBid** (`object`) — Лидерская ставка — средняя ставка с которой товары занимают лидирующие позиции в вашей категории товаров
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **top2** (`object`) — Топ-ставка
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances). Если `0`, для данного предмета топ-ставка не используется

## `V0BidRecommendationBaseBid`

- **V0BidRecommendationBaseBid** (`object`)
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).

## `V0BidRecommendationBaseBidCompetitiveBid`

- **V0BidRecommendationBaseBidCompetitiveBid** (`object`) — Конкурентная ставка — расчётная средняя ставка других продавцов, продающих аналогичные товары по похожей цене.
  У половины продавцов из расчёта ставка выше конкурентной, а другой половины — ниже
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0BidRecommendationBaseBidLeadersBid`

- **V0BidRecommendationBaseBidLeadersBid** (`object`) — Лидерская ставка — средняя ставка с которой товары занимают лидирующие позиции в вашей категории товаров
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0BidRecommendationBaseBidTop2`

- **V0BidRecommendationBaseBidTop2** (`object`) — Топ-ставка
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances). Если `0`, для данного предмета топ-ставка не используется

## `V0BidRecommendationCPCLevels`

- **V0BidRecommendationCPCLevels** (`object`)
  - **range1To2** **обязательное** — Ставка для попадания в позиции 1-2
    allOf:
      - **allOf[0]** (`object`)
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
  - **range3To10** **обязательное** — Ставка для попадания в позиции 3-10
    allOf:
      - **allOf[0]** (`object`)
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
  - **range11To34** **обязательное** — Ставка для попадания в позиции 11-34
    allOf:
      - **allOf[0]** (`object`)
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).

## `V0BidRecommendationNormQuery`

- **V0BidRecommendationNormQuery** (`object`)
  - **normQuery** (`string`) — Поисковый кластер
  - **reachMax** (`object`) — Максимальный охват: 76-100%
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
    - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
  - **reachMedium** (`object`) — Средний охват: 61-75%
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **reachMin** (`object`) — Минимальный охват: 50-60%
    - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0BidRecommendationReachMax`

- **V0BidRecommendationReachMax** (`object`) — Максимальный охват: 76-100%
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
  - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).

## `V0BidRecommendationReachMedium`

- **V0BidRecommendationReachMedium** (`object`) — Средний охват: 61-75%
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0BidRecommendationReachMin`

- **V0BidRecommendationReachMin** (`object`) — Минимальный охват: 50-60%
  - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0BidsRecommendationsCpcResponse`

- **V0BidsRecommendationsCpcResponse** (`object`)
  - **advertId** (`integer · int64`) — ID кампании
  - **levels** (`array`) — Рекомендуемые ставки для карточек товаров
    - **items** (`object`)
      - **range1To2** **обязательное** — Ставка для попадания в позиции 1-2
        allOf:
          - **allOf[0]** (`object`)
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
      - **range3To10** **обязательное** — Ставка для попадания в позиции 3-10
        allOf:
          - **allOf[0]** (`object`)
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
      - **range11To34** **обязательное** — Ставка для попадания в позиции 11-34
        allOf:
          - **allOf[0]** (`object`)
            - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
  - **nmId** (`integer · int64`) — Артикул WB
  - **paymentType** (`string · enum: "cpc"`) — Тип оплаты:
      - `cpc` — за клики

## `V0BidsRecommendationsCpmResponse`

- **V0BidsRecommendationsCpmResponse** (`object`)
  - **advertId** (`integer · int64`) — ID кампании
  - **base** (`object`) — Рекомендуемые ставки для карточек товаров
    - **competitiveBid** (`object`) — Конкурентная ставка — расчётная средняя ставка других продавцов, продающих аналогичные товары по похожей цене.
      У половины продавцов из расчёта ставка выше конкурентной, а другой половины — ниже
      - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **leadersBid** (`object`) — Лидерская ставка — средняя ставка с которой товары занимают лидирующие позиции в вашей категории товаров
      - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **top2** (`object`) — Топ-ставка
      - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances). Если `0`, для данного предмета топ-ставка не используется
  - **nmId** (`integer · int64`) — Артикул WB
  - **normQueries** (`array`) — Рекомендуемые ставки для поисковых кластеров
    - **items** (`object`)
      - **normQuery** (`string`) — Поисковый кластер
      - **reachMax** (`object`) — Максимальный охват: 76-100%
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
        - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
      - **reachMedium** (`object`) — Средний охват: 61-75%
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **reachMin** (`object`) — Минимальный охват: 50-60%
        - **bidKopecks** (`integer`) — Рекомендуемая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **bidKopecksMin** (`integer`) — Минимальная ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **paymentType** (`string · enum: "cpm"`) — Тип оплаты:
      - `cpm` — за показы

## `V0DeleteNormQueryBidsRequest`

- **V0DeleteNormQueryBidsRequest** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер

## `V0DeleteNormQueryBidsRequestItem`

- **V0DeleteNormQueryBidsRequestItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **norm_query** **обязательное** (`string`) — Поисковый кластер

## `V0GetNormQueryBidsItem`

- **V0GetNormQueryBidsItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **norm_query** **обязательное** (`string`) — Поисковый кластер
  - **bid** **обязательное** (`integer`) — Текущая ставка в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
  - **bid_kopecks** **обязательное** (`integer`) — Текущая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0GetNormQueryBidsRequest`

- **V0GetNormQueryBidsRequest** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

## `V0GetNormQueryBidsRequestItem`

- **V0GetNormQueryBidsRequestItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB

## `V0GetNormQueryBidsResponse`

- **V0GetNormQueryBidsResponse** (`object`)
  - **bids** **обязательное** (`array`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер
      - **bid** **обязательное** (`integer`) — Текущая ставка в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
      - **bid_kopecks** **обязательное** (`integer`) — Текущая ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) за тысячу показов
      - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0GetNormQueryListRequest`

- **V0GetNormQueryListRequest** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB

## `V0GetNormQueryListRequestItem`

- **V0GetNormQueryListRequestItem** (`object`)
  - **advertId** **обязательное** (`integer · int64`) — ID кампании
  - **nmId** **обязательное** (`integer · int64`) — Артикул WB

## `V0GetNormQueryListResponse`

- **V0GetNormQueryListResponse** (`object`)
  - **items** **обязательное** (`array · nullable`)
    - **items** (`object`)
      - **advertId** (`integer · int64`) — ID кампании
      - **nmId** (`integer · int64`) — Артикул WB
      - **normQueries** (`object`) — Поисковые кластеры
        - **active** (`array · nullable`) — Активные поисковые кластеры
          - **items** (`string`)
        - **excluded** (`array · nullable`) — Неактивные поисковые кластеры
          - **items** (`string`)
        - **archived** (`array · nullable`) — Архивные поисковые кластеры
          - **items** (`string`)

## `V0GetNormQueryListResponseItem`

- **V0GetNormQueryListResponseItem** (`object`)
  - **advertId** (`integer · int64`) — ID кампании
  - **nmId** (`integer · int64`) — Артикул WB
  - **normQueries** (`object`) — Поисковые кластеры
    - **active** (`array · nullable`) — Активные поисковые кластеры
      - **items** (`string`)
    - **excluded** (`array · nullable`) — Неактивные поисковые кластеры
      - **items** (`string`)
    - **archived** (`array · nullable`) — Архивные поисковые кластеры
      - **items** (`string`)

## `V0GetNormQueryListResponseItemNormQueries`

- **V0GetNormQueryListResponseItemNormQueries** (`object`) — Поисковые кластеры
  - **active** (`array · nullable`) — Активные поисковые кластеры
    - **items** (`string`)
  - **excluded** (`array · nullable`) — Неактивные поисковые кластеры
    - **items** (`string`)
  - **archived** (`array · nullable`) — Архивные поисковые кластеры
    - **items** (`string`)

## `V0GetNormQueryMinusRequest`

- **V0GetNormQueryMinusRequest** (`object`)
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

## `V0GetNormQueryMinusRequestItem`

- **V0GetNormQueryMinusRequestItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB

## `V0GetNormQueryMinusResponse`

- **V0GetNormQueryMinusResponse** (`object`)
  - **items** (`array`)
    - **items** (`object`)
      - **advert_id** (`integer`) — ID кампании
      - **nm_id** (`integer`) — Артикул WB
      - **norm_queries** (`array`) — Список минус-фраз
        - **items** (`string`)

## `V0GetNormQueryMinusResponseItem`

- **V0GetNormQueryMinusResponseItem** (`object`)
  - **advert_id** (`integer`) — ID кампании
  - **nm_id** (`integer`) — Артикул WB
  - **norm_queries** (`array`) — Список минус-фраз
    - **items** (`string`)

## `V0GetNormQueryStatsItem`

- **V0GetNormQueryStatsItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **stats** (`array`)
    - **items** (`object`)
      - **norm_query** (`string`) — Поисковый кластер
      - **views** (`integer · nullable`) — Количество просмотров.
        
        Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
      - **clicks** (`integer`) — Количество кликов
      - **atbs** (`integer`) — Количество добавлений товаров в корзину
      - **orders** (`integer`) — Количество заказов
      - **ctr** (`number · double · nullable`) — Кликабельность — отношение числа кликов к количеству показов, %.
        
        Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
      - **cpc** (`number · double`) — Стоимость одного клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
      - **cpm** (`number · double · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
        
        Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
      - **avg_pos** (`number · double`) — Средняя позиция товара на страницах поисковой выдачи
      - **shks** (`integer`) — Количество заказанных товаров, шт.
      - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании
      - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0GetNormQueryStatsItemStat`

- **V0GetNormQueryStatsItemStat** (`object`)
  - **norm_query** (`string`) — Поисковый кластер
  - **views** (`integer · nullable`) — Количество просмотров.
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **clicks** (`integer`) — Количество кликов
  - **atbs** (`integer`) — Количество добавлений товаров в корзину
  - **orders** (`integer`) — Количество заказов
  - **ctr** (`number · double · nullable`) — Кликабельность — отношение числа кликов к количеству показов, %.
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **cpc** (`number · double`) — Стоимость одного клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cpm** (`number · double · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **avg_pos** (`number · double`) — Средняя позиция товара на страницах поисковой выдачи
  - **shks** (`integer`) — Количество заказанных товаров, шт.
  - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании
  - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0GetNormQueryStatsRequest`

- **V0GetNormQueryStatsRequest** (`object`)
  - **from** **обязательное** (`string · date`) — Дата начала периода
    пример: `"2025-10-07"`
  - **to** **обязательное** (`string · date`) — Дата окончания периода
    пример: `"2025-10-08"`
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB

## `V0GetNormQueryStatsResponse`

- **V0GetNormQueryStatsResponse** (`object`) — Статистика по поисковым кластерам
  - **stats** **обязательное** (`array`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **stats** (`array`)
        - **items** (`object`)
          - **norm_query** (`string`) — Поисковый кластер
          - **views** (`integer · nullable`) — Количество просмотров.
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **clicks** (`integer`) — Количество кликов
          - **atbs** (`integer`) — Количество добавлений товаров в корзину
          - **orders** (`integer`) — Количество заказов
          - **ctr** (`number · double · nullable`) — Кликабельность — отношение числа кликов к количеству показов, %.
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **cpc** (`number · double`) — Стоимость одного клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
          - **cpm** (`number · double · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
            
            Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
          - **avg_pos** (`number · double`) — Средняя позиция товара на страницах поисковой выдачи
          - **shks** (`integer`) — Количество заказанных товаров, шт.
          - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании
          - **currency** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0SetMinusNormQueryRequest`

- **V0SetMinusNormQueryRequest** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **norm_queries** **обязательное** (`array · maxItems=1000`)
    - **items** (`string`) — Поисковый кластер

## `V0SetNormQueryBidsRequest`

- **V0SetNormQueryBidsRequest** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advert_id** **обязательное** (`integer`) — ID кампании
      - **nm_id** **обязательное** (`integer`) — Артикул WB
      - **norm_query** **обязательное** (`string`) — Поисковый кластер
      - **bid** **обязательное** (`integer`) — Ставка за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V0SetNormQueryBidsRequestItem`

- **V0SetNormQueryBidsRequestItem** (`object`)
  - **advert_id** **обязательное** (`integer`) — ID кампании
  - **nm_id** **обязательное** (`integer`) — Артикул WB
  - **norm_query** **обязательное** (`string`) — Поисковый кластер
  - **bid** **обязательное** (`integer`) — Ставка за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V1GetNormQueryStatsRequest`

- **V1GetNormQueryStatsRequest** (`object`)
  - **from** **обязательное** (`string · date`) — Дата начала периода
    пример: `"2025-01-01"`
  - **to** **обязательное** (`string · date`) — Дата окончания периода периода
    пример: `"2025-01-31"`
  - **items** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB

## `V1GetNormQueryStatsResponse`

- **V1GetNormQueryStatsResponse** (`object`)
  - **items** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer · int64`) — ID кампании
      - **nmId** **обязательное** (`integer · int64`) — Артикул WB
      - **dailyStats** (`array`) — Статистика с детализацией по дням
        - **items** (`object`)
          - **date** **обязательное** (`string · date`) — Дата
          - **stat** (`object`)
            - **normQuery** (`string`) — Поисковый кластер
            - **views** (`integer · nullable`) — Количество просмотров.
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **clicks** (`integer`) — Количество кликов
            - **atbs** (`integer`) — Количество добавлений товаров в корзину
            - **orders** (`integer`) — Количество заказов
            - **ctr** (`number · float · nullable`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах.
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **cpc** (`number · float`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
            - **cpm** (`number · float · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
              
              Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
            - **avgPos** (`number · float`) — Средняя позиция товара на страницах поисковой выдачи
            - **shks** (`integer`) — Количество заказанных товаров, шт.
            - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании

## `V1GetNormQueryStatsResponseItem`

- **V1GetNormQueryStatsResponseItem** (`object`)
  - **advertId** **обязательное** (`integer · int64`) — ID кампании
  - **nmId** **обязательное** (`integer · int64`) — Артикул WB
  - **dailyStats** (`array`) — Статистика с детализацией по дням
    - **items** (`object`)
      - **date** **обязательное** (`string · date`) — Дата
      - **stat** (`object`)
        - **normQuery** (`string`) — Поисковый кластер
        - **views** (`integer · nullable`) — Количество просмотров.
          
          Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
        - **clicks** (`integer`) — Количество кликов
        - **atbs** (`integer`) — Количество добавлений товаров в корзину
        - **orders** (`integer`) — Количество заказов
        - **ctr** (`number · float · nullable`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах.
          
          Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
        - **cpc** (`number · float`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
        - **cpm** (`number · float · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
          
          Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
        - **avgPos** (`number · float`) — Средняя позиция товара на страницах поисковой выдачи
        - **shks** (`integer`) — Количество заказанных товаров, шт.
        - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании

## `V1GetNormQueryStatsResponseItemDailyStat`

- **V1GetNormQueryStatsResponseItemDailyStat** (`object`)
  - **date** **обязательное** (`string · date`) — Дата
  - **stat** (`object`)
    - **normQuery** (`string`) — Поисковый кластер
    - **views** (`integer · nullable`) — Количество просмотров.
      
      Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
    - **clicks** (`integer`) — Количество кликов
    - **atbs** (`integer`) — Количество добавлений товаров в корзину
    - **orders** (`integer`) — Количество заказов
    - **ctr** (`number · float · nullable`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах.
      
      Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
    - **cpc** (`number · float`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
    - **cpm** (`number · float · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
      
      Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
    - **avgPos** (`number · float`) — Средняя позиция товара на страницах поисковой выдачи
    - **shks** (`integer`) — Количество заказанных товаров, шт.
    - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании

## `V1GetNormQueryStatsResponseItemStat`

- **V1GetNormQueryStatsResponseItemStat** (`object`)
  - **normQuery** (`string`) — Поисковый кластер
  - **views** (`integer · nullable`) — Количество просмотров.
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **clicks** (`integer`) — Количество кликов
  - **atbs** (`integer`) — Количество добавлений товаров в корзину
  - **orders** (`integer`) — Количество заказов
  - **ctr** (`number · float · nullable`) — CTR (click-through rate) — отношение числа кликов к количеству показов в процентах.
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **cpc** (`number · float`) — Средняя стоимость клика в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cpm** (`number · float · nullable`) — Средняя стоимость за тысячу показов в базовых единицах валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
    
    Для кампаний с типом оплаты `cpc` — за клики — значение будет `null`
  - **avgPos** (`number · float`) — Средняя позиция товара на страницах поисковой выдачи
  - **shks** (`integer`) — Количество заказанных товаров, шт.
  - **spend** (`number · double`) — Затраты на продвижение товаров в конкретном поисковом кластере кампании

## `V1SetNormQueryBidsRequest`

- **V1SetNormQueryBidsRequest** (`object`)
  - **bids** **обязательное** (`array · maxItems=100`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер
      - **bidMinorUnits** **обязательное** (`integer`) — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
        Допустимый шаг ставки указан в ответе метода [GET /api/advert/v1/config](./promotion#tag/campaignManagement/operation/getV1Config)

## `V1SetNormQueryBidsRequestItem`

- **V1SetNormQueryBidsRequestItem** (`object`)
  - **advertId** **обязательное** (`integer`) — ID кампании
  - **nmId** **обязательное** (`integer`) — Артикул WB
  - **normQuery** **обязательное** (`string`) — Поисковый кластер
  - **bidMinorUnits** **обязательное** (`integer`) — Ставка в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
    Допустимый шаг ставки указан в ответе метода [GET /api/advert/v1/config](./promotion#tag/campaignManagement/operation/getV1Config)

## `V1SetNormQueryBidsResponse`

- **V1SetNormQueryBidsResponse** (`object`)
  - **success** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
      - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **failed** **обязательное** (`array`)
    - **items** (`object`)
      - **advertId** **обязательное** (`integer`) — ID кампании
      - **nmId** **обязательное** (`integer`) — Артикул WB
      - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
      - **reason** **обязательное** (`string`) — Описание причины ошибки

## `V1SetNormQueryBidsSuccessResponseItem`

- **V1SetNormQueryBidsSuccessResponseItem** (`object`)
  - **advertId** **обязательное** (`integer`) — ID кампании
  - **nmId** **обязательное** (`integer`) — Артикул WB
  - **normQuery** **обязательное** (`string`) — Поисковый кластер — это группа похожих поисковых запросов, по которым покупатели находят товары
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)

## `V2GetConfigResponse`

- **V2GetConfigResponse** (`object`)
  - **currency** **обязательное** (`string · ISO 4217`) — Валюта [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **currencyCode** **обязательное** (`integer`) — Код валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances)
  - **cpmStep** **обязательное** (`integer · int64`) — Шаг ставки в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) для CPM-кампаний
  - **cpcStep** **обязательное** (`integer · int64`) — Шаг ставки в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances) для кампаний CPC
  - **minTopUp** **обязательное** (`integer · int64`) — Минимальная сумма пополнения бюджета кампании в разменных единицах — 0,01 от базовой валюты [аккаунта продавца](https://cmp.wildberries.ru/campaigns/finances).
     Например, минимальная сумма пополнения бюджета при `"minTopUp": 10000` и `"currency": "UZS"` — 100 узбекских сум

## `response400`

- **response400** (`object`)
  - **detail** **обязательное** (`string`) — Детали ошибки
  - **origin** **обязательное** (`string`) — ID внутреннего сервиса WB
    пример: `"camp-api-public-cache"`
  - **request_id** **обязательное** (`string`) — Уникальный ID запроса
    пример: `"6023d2950af564838f9b44a279d2140c"`
  - **status** **обязательное** (`integer`) — HTTP статус-код
    пример: `400`
  - **title** **обязательное** (`string`) — Заголовок ошибки
    пример: `"invalid payload"`

---

# Общие параметры и ответы

## parameters

### `allPromo`

- in: `query` · name: `allPromo` · required: `True`

Показать акции:
  - `false` — доступные для участия
  - `true` — все акции

- **allPromo** (`boolean · default=False`)

### `endDateTime`

- in: `query` · name: `endDateTime` · required: `True`

Конец периода, формат `YYYY-MM-DDTHH:MM:SSZ`

- **endDateTime** (`string · date-time`)
  пример: `"2024-08-01T23:59:59Z"`

### `inAction`

- in: `query` · name: `inAction` · required: `True`

Участвует в акции:
  - `true` — да
  - `false` — нет

- **inAction** (`boolean · default=False`)
  пример: `true`

### `limitNomenclature`

- in: `query` · name: `limit` · required: `None`

Количество запрашиваемых товаров

- **limit** (`integer · uint · minimum=1 · maximum=1000`)
  пример: `10`

### `limitPromo`

- in: `query` · name: `limit` · required: `None`

Количество запрашиваемых акций

- **limit** (`integer · uint · minimum=1 · maximum=1000`)
  пример: `10`

### `offset`

- in: `query` · name: `offset` · required: `None`

После какого элемента выдавать данные

- **offset** (`integer · uint · minimum=0`)
  пример: `0`

### `promotionID`

- in: `query` · name: `promotionID` · required: `True`

ID акции

- **promotionID** (`integer`)
  пример: `1`

### `promotionIDs`

- in: `query` · name: `promotionIDs` · required: `True`

ID акций, по которым нужно вернуть информацию

- **promotionIDs** (`array · uniqueItems · minItems=1 · maxItems=100`)
  - **items** (`integer`)

### `startDateTime`

- in: `query` · name: `startDateTime` · required: `True`

Начало периода, формат `YYYY-MM-DDTHH:MM:SSZ`

- **startDateTime** (`string · date-time`)
  пример: `"2023-09-01T00:00:00Z"`

## responses

### `401` — Не авторизован

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "unauthorized",
  "detail": "token problem; token is malformed: could not base64 decode signature: illegal base64 data at input byte 84",
  "code": "07e4668e--a53a3d31f8b0-[UK-oWaVDUqNrKG]; 03bce=277; 84bd353bf-75",
  "requestId": "7b80742415072fe8b6b7f7761f1d1211",
  "origin": "ag-marketplace",
  "status": 401,
  "statusText": "Unauthorized",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

### `402` — Требуется платёж

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки. Ошибка возвращается только сервисам из [Каталога решений для бизнеса](/business-solutions)

Пример:

```json
{
  "title": "payment required",
  "detail": "wb solution for business has insufficient funds on its balance. please top up the balance in the company's personal account https://dev.wildberries.ru/company"
}
```

### `403` — Доступ запрещён

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример `Response403TokenCategory`:

```json
{
  "status": 403,
  "statusText": "Forbidden",
  "title": "Forbidden",
  "detail": "scope is not allowed for this resource",
  "requestId": "2dbf6fc9-bad8-4ef9-a058-c938a8553ba5",
  "origin": "ag-marketplace",
  "timestamp": "2026-09-03T13:55:15Z"
}
```

### `429` — Слишком много запросов

Content-Type: `application/problem+json`

- **response** (`object`)
  - **title** (`string`) — Заголовок ошибки
  - **detail** (`string`) — Детали ошибки
  - **code** (`string`) — Внутренний код ошибки
  - **requestId** (`string`) — Уникальный ID запроса
  - **origin** (`string`) — ID внутреннего сервиса WB
  - **status** (`number`) — HTTP статус-код
  - **statusText** (`string`) — Расшифровка HTTP статус-кода
  - **timestamp** (`string · date-time`) — Дата и время запроса

Пример:

```json
{
  "title": "too many requests",
  "detail": "limited by c122a060-a7fb-4bb4-abb0-32fd4e18d489",
  "code": "07e4668e-ac2242c5c8c5-[UK-4dx7JUdskGZ]",
  "requestId": "9d3c02cc698f8b041c661a7c28bed293",
  "origin": "ag-marketplace",
  "status": 429,
  "statusText": "Too Many Requests",
  "timestamp": "2024-09-30T06:52:38Z"
}
```

### `ErrParameterValuesIncorrect` — Ошибка обработки параметров запроса

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки

Пример `PromoCompletedOrNotExist`:

```json
{
  "errorText": "Unprocessable entity"
}
```

### `ErrorFailedParseData` — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Failed to parse data"`

### `ErrorWrongParameters` — Неправильный запрос

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Invalid query params"`

### `PromoSuccessResponse` — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **promotions** (`array`) — Список акций
      - **items** (`object`)
        - **id** (`integer`) — ID акции
          пример: `123`
        - **name** (`string`) — Название акции
          пример: `"скидки"`
        - **startDateTime** (`string · date-time`) — Начало акции
          пример: `"2023-06-05T21:00:00Z"`
        - **endDateTime** (`string · date-time`) — Конец акции
          пример: `"2023-06-05T21:00:00Z"`
        - **type** (`string · enum: "regular", "auto"`) — Тип акции:
            - `regular` — акция
            - `auto` — автоакция

### `PromosGetByIDSuccessResponse` — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **promotions** (`array`) — Список акций
      - **items** (`object`)
        - **id** (`integer`) — ID акции
          пример: `123`
        - **name** (`string`) — Название акции
          пример: `"ХИТЫ ГОДА"`
        - **description** (`string`) — Описание акции
          пример: `"В акции принимают участие самые популярные товары 2023 года. Карточки товаров будут выделены плашкой «ХИТ ГОДА», чтобы покупатели замечали эти товары среди других. Также они будут размещены под баннерами на главной странице и примут участие в PUSH-уведомлениях. С ценами для вступления в акцию вы можете ознакомиться ниже."`
        - **advantages** (`array`) — Преимущества акции
          - **items** (`string`)
        - **startDateTime** (`string`) — Начало акции
          пример: `"2023-06-05T21:00:00Z"`
        - **endDateTime** (`string`) — Конец акции
          пример: `"2023-06-05T21:00:00Z"`
        - **inPromoActionLeftovers** (`integer`) — Количество товаров с остатками, участвующих в акции
          пример: `45`
        - **inPromoActionTotal** (`integer`) — Общее количество товаров, участвующих в акции
          пример: `123`
        - **notInPromoActionLeftovers** (`integer`) — Количество товаров с остатками, не участвующих в акции
          пример: `3`
        - **notInPromoActionTotal** (`integer`) — Общее количество товаров, не участвующих в акции
          пример: `10`
        - **participationPercentage** (`integer`) — Уже участвующие в акции товары, %. Рассчитывается по товарам в акции и с остатком
          пример: `10`
        - **type** (`string · enum: "regular", "auto"`) — Тип акции:
            - `regular` — акция
            - `auto` — автоакция
          пример: `"auto"`
        - **exceptionProductsCount** (`integer · uint`) — Количество товаров, исключенных из автоакции до её старта. Только при `"type": "auto"`.
          
          В момент старта акции эти товары автоматически будут без скидки
          пример: `10`
        - **ranging** (`array`) — Ранжирование (если подключено)
          - **items** (`object`)
            - **condition** (`string`) — Тип [ранжирования](https://seller.wildberries.ru/help-center/article/A-385):
                - `productsInPromotion` — продвижение получат товары продавца, участвующие в акции
                - `calculateProducts` — продвижение получат любые товара продавца, предложенные к участию в акции
                - `allProducts` — продвижение получат все товары продавца
            - **participationRate** (`integer · uint · minimum=0 · maximum=100`) — Количество товаров продавца для перехода на следующий уровень ранжирования, %
            - **boost** (`integer · uint`) — Текущий уровень поднятия в поиске, %

### `ResponsePromoItemsLists` — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **nomenclatures** (`array`) — Список товаров
      - **items** (`object`)
        - **id** (`integer`) — Артикул WB
          пример: `162579635`
        - **inAction** (`boolean`) — Участвует в акции:
            - `true` — да
            - `false` — нет
          пример: `true`
        - **price** (`number · float`) — Текущая розничная цена
          пример: `1500`
        - **currencyCode** (`string`) — Валюта в формате ISO 4217
          пример: `"RUB"`
        - **planPrice** (`number · float`) — Плановая цена (цена во время акции)
          пример: `1000`
        - **discount** (`integer`) — Текущая скидка
          пример: `15`
        - **planDiscount** (`integer`) — Рекомендуемая скидка для участия в акции
          пример: `34`

### `UnprocessableEntity` — Ошибка обработки параметров запроса

Content-Type: `application/json`

- **response** (`object`)
  - **errorText** (`string`) — Текст ошибки
    пример: `"Unprocessable entity"`

### `UploadSuccessResponse` — Успешно

Content-Type: `application/json`

- **response** (`object`)
  - **data** (`object`) — Данные ответа
    - **alreadyExists** (`boolean`) — Загрузка с такими данными уже существует
      пример: `false`
    - **uploadID** (`integer`) — ID загрузки
      пример: `11`

## requestBodies

### `PromoSupplierTaskRequest` **обязательное**

Content-Type: `application/json`

- **body** (`object`)
  - **data** (`object`) — Данные запроса
    - **promotionID** (`integer · minimum=1`) — ID акции
      пример: `1`
    - **uploadNow** (`boolean`) — Установить скидку:
        - `true` — сейчас
        - `false` — в момент старта акции
      пример: `true`
    - **nomenclatures** (`array · uniqueItems · minItems=1 · maxItems=1000`) — Артикулы WB, которые можно добавить в акцию
      - **items** (`integer · minimum=1`)

