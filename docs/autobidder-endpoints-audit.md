# Аудит эндпоинтов WB Promotion + раздел «Реклама»

10.09.2026. Спека: `docs/wb-openapi-promotion.md` (39 методов).  
Код сверен с `docs/autobidder.md` §2, `supabase/functions/_shared/wb-adv-proxy.ts`, `autobidder-tick`.  
В WB ничего не отправлял. Старую вкладку «Автобиддер» не менял.

Ветка: `cursor/ads-command-center-47f1`.

---

## 1. getV0BidsRecommendations — отдельно

**Сейчас не используем.** Нет хелпера в `ADV_HELPERS`, тик не зовёт, в §2 архитектуры пункта нет.

Официальный метод: `GET /api/advert/v0/bids/recommendations?nmId=&advertId=`.

Что отдаёт (по спеке):

- CPM: `base.competitiveBid` — «расчётная средняя ставка других продавцов»; `leadersBid`; `top2`; плюс `normQueries[]` с коридорами охвата `reachMax` / `reachMedium` / `reachMin` (bidKopecks).
- CPC: ставки на попадание в позиции **1–2 / 3–10 / 11–34**.

Это и есть официальная замена неофициальному парсингу аукциона (Способ A). Чужие живые CPM с `catalog-ads` больше не обязательны, чтобы получить «какая ставка примерно на нужном месте».

Оговорки, из-за которых тик пока на Способ B:

- Это **рекомендации / средние WB**, не снимок текущего аукциона. В §0 архитектуры прямо написано, что кабинетные CPM завышены — на этом стоит ценность биддера.
- Лимит 5 запросов / мин на кабинет. На каждый nm+advert — отдельный GET.
- Позицию своей карточки метод не отдаёт. Способ B (`get_ad_position` + hill climbing) всё равно нужен.
- Сейчас `fetchAuction` в тике — заглушка `null` → reason `pos_unknown`.

Когда подключать: хелпер `getBidsRecommendations` в `wb-adv-proxy.ts`, кэш на кабинет/кампанию, подставлять в `decideBid` как `target_bid` из §4.2 вместо парсера. Не вместо get-bids / setBids.

---

## 2. Таблица: 39 методов спеки

Колонки:

- **§2** — есть в таблице `docs/autobidder.md` §2
- **хелпер** — имя в `ADV_HELPERS` (`wb-adv-proxy.ts`)
- **тик** — реально зовёт `autobidder-tick`
- **ещё** — другой наш код (не тик)
- **зачем** — сейчас / на будущее / не берём

| # | Метод | Path | operationId | §2 | хелпер | тик | ещё | зачем |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/adv/v1/promotion/count` | `getV1PromotionCount` | нет | нет | нет | `wb-proxy`, `advertising-sync`, `check-campaigns-notify` | Сейчас: список РК для старого РК-дашборда. Тику v2 не нужен (`getAdverts` достаточно). |
| 2 | GET | `/api/advert/v2/adverts` | `getV2Adverts` | да | `getAdverts` | нет | `sync-campaigns`, `wb-proxy`, `wb-clusters`, `advertising-sync` | **Сейчас** — синка кампаний. Тик читает уже из БД. |
| 3 | POST | `/api/advert/v1/bids/min` | `postV1BidsMin` | нет | нет | нет | `wb-advert-bids.ts` (legacy `autobidder-run`) | Legacy. v2 не использует. На будущее: пол ставки при создании РК. |
| 4 | POST | `/adv/v2/seacat/save-ad` | `postV2SeacatSaveAd` | нет | нет | нет | — | На будущее: создать кампанию из UI. Не для текущего тика. |
| 5 | GET | `/adv/v1/supplier/subjects` | `getV1SupplierSubjects` | нет | нет | нет | — | На будущее: мастер создания РК. |
| 6 | POST | `/adv/v2/supplier/nms` | `postV2SupplierNms` | нет | нет | нет | — | На будущее: карточки для новой РК. |
| 7 | GET | `/adv/v0/delete` | `getV0Delete` | нет | нет | нет | — | На будущее / опасно. Не для автобиддера. |
| 8 | POST | `/adv/v0/rename` | `postV0Rename` | нет | нет | нет | — | На будущее: Командный центр, редкий UX. |
| 9 | GET | `/adv/v0/start` | `getV0Start` | да | `start` | нет | `wb-proxy` `advert_start`, UI РК и новый раздел «Реклама» | **Сейчас** — пауза/запуск с дашборда. Тик ставки не стартует. |
| 10 | GET | `/adv/v0/pause` | `getV0Pause` | да | `pause` | нет | `wb-proxy` `advert_pause`, UI | **Сейчас** — то же. |
| 11 | GET | `/adv/v0/stop` | `getV0Stop` | нет | нет | нет | — | На будущее. Завершение РК необратимо — не в тик. |
| 12 | PUT | `/adv/v0/auction/placements` | `putV0AuctionPlacements` | нет | нет | нет | — | На будущее: места размещения ручной ставки. |
| 13 | PATCH | `/api/advert/v1/bids` | `patchV1Bids` | нет | нет | нет | `wb-advert-bids.ts`, `autobidder-run` | **Legacy MVP** (не кластеры). v2 пишет только normquery v1. Не смешивать. |
| 14 | PATCH | `/adv/v0/auction/nms` | `patchV0AuctionNms` | нет | нет | нет | — | На будущее: состав карточек в РК. |
| 15 | GET | `/api/advert/v0/bids/recommendations` | `getV0BidsRecommendations` | нет | нет | нет | — | **На будущее = Способ A официально.** См. §1 этого файла. |
| 16 | GET | `/api/advert/v1/config` | `getV1Config` | да | `getConfig` | нет* | хелпер есть; тик на `main` ещё не зовёт (сверка cpmStep — в PR #91) | **Сейчас нужен** для шага ставки. |
| 17 | POST | `/adv/v0/normquery/get-bids` | `postV0NormqueryGetBids` | да | `getBids` | **да** | — | **Сейчас** — `my_bid` в тике. |
| 18 | POST | `/api/advert/v1/normquery/bids` | `postV1NormqueryBids` | да | `setBids` | **да** | — | **Сейчас** — единственный setBids v2. `DRY_RUN` режет. |
| 19 | POST | `/adv/v0/normquery/bids` | `postV0NormqueryBids` | нет (запрещён) | нет (ловит `isSetBidsWrite`) | нет | — | **Не брать.** В спеке «ставки в рублях». |
| 20 | DELETE | `/adv/v0/normquery/bids` | `deleteV0NormqueryBids` | да | нет | нет | — | На будущее: снять ставку с кластера / «в минус без фразы». |
| 21 | POST | `/adv/v0/normquery/get-minus` | `postV0NormqueryGetMinus` | да | `getMinus` | нет | — | На будущее: минус-фразы, шаг 7 плана. |
| 22 | POST | `/adv/v0/normquery/set-minus` | `postV0NormquerySetMinus` | да | `setMinus` | нет | — | На будущее: то же. |
| 23 | POST | `/adv/v0/normquery/list` | `postV0NormqueryList` | да | `listClusters` | нет | `sync-campaigns`, `wb-clusters` | **Сейчас** — синк кластеров. Тик читает `adv_clusters`. |
| 24 | GET | `/adv/v1/balance` | `getV1Balance` | нет | нет | нет | `wb-proxy` `advert_balance`, `check-campaigns-notify` | **Сейчас** — бейдж баланса в старом РК. Не кабинетный дневной cap §11.5. |
| 25 | GET | `/adv/v1/budget` | `getV1Budget` | нет | нет | нет | — | На будущее: бюджет **одной** РК (`id`=advertId). Не сумма кабинета. §11.5 остаётся на наших cap + `adv_daily_stats`. |
| 26 | POST | `/adv/v1/budget/deposit` | `postV1BudgetDeposit` | нет | нет | нет | — | **Не берём автоматически.** Пополнение только руками в ЛК. |
| 27 | GET | `/adv/v1/upd` | `getV1Upd` | нет | нет | нет | — | На будущее: история затрат / бухгалтерия. Не тик. |
| 28 | GET | `/adv/v1/payments` | `getV1Payments` | нет | нет | нет | — | На будущее: пополнения счёта. |
| 29 | GET | `/adv/v1/count` | `getV1Count` | нет | нет | нет | — | Медиа, другой хост. Не берём: не поисковые РК. |
| 30 | GET | `/adv/v1/adverts` | `getV1Adverts` | нет | нет | нет | — | Медиа. Не берём. |
| 31 | GET | `/adv/v1/advert` | `getV1Advert` | нет | нет | нет | — | Медиа. Не берём. |
| 32 | POST | `/adv/v0/normquery/stats` | `postV0NormqueryStats` | да | `getClusterStats` | нет | `wb-proxy`, `wb-clusters` | Сейчас для фраз в старом РК. v2 синкает daily. |
| 33 | GET | `/adv/v3/fullstats` | `getV3Fullstats` | да | `fullstats` | нет | `sync-daily-stats`, `advertising-sync`, `wb-proxy` | **Сейчас** — расход/показы. Тик читает `adv_daily_stats`. |
| 34 | POST | `/adv/v1/stats` | `postV1Stats` | нет | нет | нет | — | Медиа. Не берём. |
| 35 | POST | `/adv/v1/normquery/stats` | `postV1NormqueryStats` | да | `getClusterStatsDaily` | нет | `sync-daily-stats` | **Сейчас** — стата по кластерам за день. |
| 36 | GET | `/api/v1/calendar/promotions` | `getV1CalendarPromotions` | нет | нет | нет | — | Календарь акций, другой хост. Не автобиддер. |
| 37 | GET | `/api/v1/calendar/promotions/details` | `getV1CalendarPromotionsDetails` | нет | нет | нет | — | То же. |
| 38 | GET | `/api/v1/calendar/promotions/nomenclatures` | `getV1CalendarPromotionsNomenclatures` | нет | нет | нет | — | То же. |
| 39 | POST | `/api/v1/calendar/promotions/upload` | `postV1CalendarPromotionsUpload` | нет | нет | нет | — | То же. |

\* На этой ветке (`main` + UI) тик ещё без `loadAdvConfig`. Подключение кэша config — PR #91.

Прокси `normalizeAdvPath` пускает только `/adv/*` и `/api/advert/*`. Медиа (`advert-media-api`) и календарь (`dp-calendar-api`) через текущий adv-прокси не пройти.

---

## 3. Что тик дергает сейчас

`autobidder-tick/index.ts`:

1. `getBids` — `POST /adv/v0/normquery/get-bids`
2. `setBids` — `POST /api/advert/v1/normquery/bids` (если `apply` и не DRY_RUN)

Остальные хелперы прокси (`listClusters`, `getAdverts`, `fullstats`, `pause`/`start`, minus, stats) — для синка и UI, не для каждого тика.

---

## 4. Раздел «Реклама» — что сделано в UI

Старая вкладка **Автобиддер** (пишет в `autobidder_rules_legacy_mvp`, модалка, `autobidder-run`) **не тронута**.

Рядом:

- На вкладке РК переключатель **Кабинеты | Реклама**
- В деталке кабинета сегмент **Реклама** стоит рядом с Автобиддером и открывает тот же Командный центр

Командный центр (§11.6 + экраны §8):

- Верхние плитки: кабинеты, активные РК, расход сегодня, ДРР 7д, «сэкономлено» (пока «—», пока нет формулы из bid_history)
- Таблица: кабинет → кампании → кластеры; токен (зелёная/красная точка); расход/лимит; ДРР; в диапазоне / вне
- Массовые пауза / запуск (существующий `advert_pause` / `advert_start`, не новая Edge Function)
- «Применить форму» — пишет `autobidder_rules` v2, если есть uuid из `adv_campaigns`
- Форма правила: стратегия, диапазон позиций, max_bid **или** целевой ДРР, пол, шаг, гистерезис, органика, часы
- Журнал: график ставка + позиция (Chart.js) и лента `bid_history`

Данные: `cabinets` + привычные `advertising_campaigns` / `advertising_daily_stats` (чтобы таблица не была пустой), плюс v2 `adv_campaigns` / `adv_clusters` / `autobidder_rules` если синк уже наполнял.

Палитра и шрифты те же: Inter / Poppins, `widget-card`, `data-table`, `segment-tabs`, `adv-kpi-tile`, `--green/--red/--amber`. Новой темы нет.

Не сделано (и не обещали в этом шаге): Edge Function `adv_bulk_action`, живой Способ A, деплой тика, вставка trial-правила.

---

## 5. Как открыть

РК → сегмент **Реклама**. Либо в карточке кабинета: Обзор / Кампании / Товары / **Реклама** / Автобиддер.
