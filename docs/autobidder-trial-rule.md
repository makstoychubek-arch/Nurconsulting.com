# Пробное правило для `autobidder-tick` (Zevina 1)

UI формы ещё нет. Первое правило — **только SQL** в SQL Editor. Скрипт **не выполнял**.

Факт-проверка кампании: `docs/autobidder-campaign-38634350.md`.

## Что берём

Кампания **реальная**, не тестовая выдумка. Кластер тоже **реальный** (из `get-bids`), не заглушка `пиджак женский квадратный`.

| Поле | Значение |
|---|---|
| Кабинет | Zevina 1 `21cffafa-bca2-4984-b5f8-5c426e6f538b` |
| Строка кампании | уже есть: `61cbf07f-f4d2-4c79-95a6-5f088062800e` |
| WB campaign | `38634350` — «287679331 Поиск пиджак квадрат шоко2» |
| `nm_id` | `287679331` (БД = `nm_settings` WB, не выдуман) |
| Тип / оплата | `manual_bid`, CPM, поиск |
| Статус WB / БД | **7 (завершена)**, не 9 |
| Кластер | `пиджак для женщин` — из `get-bids`, текущая ставка **420 KGS** |
| Запасной кластер | `пиджак женский коричневый` (вторая ставка, тоже 420) |
| Диапазон | позиции 5–10 |
| `max_bid` | **500** (валюта кабинета KGS; текущая ставка 420) |
| `min_bid_floor` | 100 |
| `step_pct` / `hysteresis` | 0.07 / 0.03 |

Ставки в WB **не уйдут**: `DRY_RUN=true`. В `bid_history` будет решение с `applied=false`.

Не вставлять кампанию заново и **не писать `status='active'`** — перетрёт факт `7`. Нужны только кластер + правило.

Тик смотрит `manual_bid` + активное правило, статус кампании не режет. На завершённой РК DRY_RUN всё равно отработает: `getBids` вернёт 420 по этому кластеру.

## SQL — вставить в SQL Editor и Run

https://supabase.com/dashboard/project/fiukyfyhotctvfdidktx/sql/new

```sql
-- Пробное правило v2. Кампания 38634350 уже в adv_campaigns.
-- Кластер реальный (get-bids). Ставки в WB не ставит (DRY_RUN).
-- Потом: is_active=false.

with camp as (
  select id
  from public.adv_campaigns
  where cabinet_id = '21cffafa-bca2-4984-b5f8-5c426e6f538b'
    and wb_campaign_id = 38634350
    and nm_id = 287679331
),
cl as (
  insert into public.adv_clusters (campaign_id, cluster_key, is_active)
  select id, 'пиджак для женщин', true
  from camp
  on conflict (campaign_id, cluster_key) do update set is_active = true
  returning id, campaign_id
)
insert into public.autobidder_rules (
  campaign_id,
  cluster_id,
  strategy,
  target_pos_from,
  target_pos_to,
  max_bid,
  min_bid_floor,
  step_pct,
  hysteresis,
  is_active
)
select
  cl.campaign_id,
  cl.id,
  'min_sufficient',
  5,
  10,
  500,
  100,
  0.07,
  0.03,
  true
from cl
returning id as rule_id, campaign_id, cluster_id;
```

Скопируйте `rule_id`. Если `camp` пустой — кампании нет в БД, сначала `sync-campaigns`, не выдумывать строку.

Проверка:

```sql
select
  r.id as rule_id,
  cab.name as cabinet,
  c.wb_campaign_id,
  c.nm_id,
  c.campaign_type,
  c.status,
  cl.cluster_key,
  r.target_pos_from,
  r.target_pos_to,
  r.max_bid,
  r.min_bid_floor,
  r.is_active
from public.autobidder_rules r
join public.adv_campaigns c on c.id = r.campaign_id
join public.cabinets cab on cab.id = c.cabinet_id
join public.adv_clusters cl on cl.id = r.cluster_id
where c.wb_campaign_id = 38634350;
```

Ожидание: `status=7`, `nm_id=287679331`, кластер `пиджак для женщин`.

## Прогнать тик вручную

`service_role`: Project Settings → API. Cron подхватит через ~5 минут; ручной вызов с `positions` нагляднее.

```bash
curl -sS -X POST \
  'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/autobidder-tick' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer СЮДА_SERVICE_ROLE" \
  -d '{
    "cabinet_id": "21cffafa-bca2-4984-b5f8-5c426e6f538b",
    "positions": { "пиджак для женщин": 15 }
  }'
```

Ожидание: `dry_run: true`, у Zevina 1 одно решение, `reason: pos_worse`, `old_bid` около **420**, `new_bid` около **450** (`ceil(420 * 1.07)`), `applied: false`.

Без `positions` заглушка даст `pos_unknown` и тоже строку в журнале (желание поднять, applied=false).

## Смотреть `bid_history`

```sql
select
  h.created_at,
  h.old_bid,
  h.new_bid,
  h.observed_pos,
  h.source,
  h.reason,
  h.applied
from public.bid_history h
join public.autobidder_rules r on r.id = h.rule_id
join public.adv_campaigns c on c.id = r.campaign_id
where c.wb_campaign_id = 38634350
order by h.created_at desc
limit 20;
```

`applied` должен быть `false`. Если `true` — `DRY_RUN` сняли, напишите.

## Выключить пробу

```sql
update public.autobidder_rules
set is_active = false
where campaign_id in (
  select id from public.adv_campaigns
  where cabinet_id = '21cffafa-bca2-4984-b5f8-5c426e6f538b'
    and wb_campaign_id = 38634350
);
```

## Коротко

| Вопрос | Ответ |
|---|---|
| 38634350 выдуманная? | Нет, одна из 475 Zevina 1 |
| `nm_id` 287679331 выдуман? | Нет |
| Кластер выдуманный? | Нет, из `get-bids` |
| Кампания сейчас живая? | Нет, status 7 |
| UI есть? | Нет, только SQL |
| Я вставила правило? | Нет |
| Ставки уйдут в WB? | Нет, пока `DRY_RUN` |
