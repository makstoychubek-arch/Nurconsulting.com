# Пробное правило для `autobidder-tick` (Zevina 1)

UI формы правила ещё нет (это шаг 5 / экран 2). Сейчас первое правило — **только SQL** в SQL Editor. Ниже готовый скрипт: сам его не выполнял.

## Почему одного INSERT в `autobidder_rules` мало

Тик читает `autobidder_rules` → `adv_campaigns` (`manual_bid`) → `adv_clusters`.

Сейчас у всех кабинетов **0 строк** в `adv_campaigns` / `adv_clusters`.  
`sync-campaigns` по Zevina 1 отработал `ok`, но записал 0 кампаний: `getAdverts` v2 не отдаёт `nm_id`, а колонка `nm_id` обязательная — строки пропускаются. Кластеры сами не появятся, пока это не починим или не заведём кампанию руками.

Поэтому скрипт сразу кладёт: кампанию + один кластер + правило.

## Что берём для пробы

| Поле | Значение |
|---|---|
| Кабинет | Zevina 1 `21cffafa-bca2-4984-b5f8-5c426e6f538b` |
| WB campaign | `38634350` — «287679331 Поиск пиджак квадрат шоко2», manual, status 9 (из кэша РК) |
| `nm_id` | `287679331` (из названия кампании) |
| Кластер | `пиджак женский квадратный` — пробная фраза, не из `listClusters` |
| Диапазон | позиции 5–10 |
| `max_bid` | 80 ₽ (жёсткий потолок на пробу) |
| `min_bid_floor` | 30 ₽ |
| `step_pct` / `hysteresis` | 0.07 / 0.03 |

Ставки в WB **не уйдут**: `DRY_RUN=true`. В `bid_history` будет решение с `applied=false`.

Кластер выдуманный: `getBids` может не найти ставку → `my_bid=0`. Для первой строки журнала этого достаточно. Чтобы увидеть `pos_worse`, а не только `pos_unknown`, в HTTP передайте `positions` (ниже).

## SQL — вставить в SQL Editor и Run

https://supabase.com/dashboard/project/fiukyfyhotctvfdidktx/sql/new

```sql
-- Пробное правило v2, один кластер, Zevina 1.
-- Не ставит ставки в WB. Потом: is_active=false или delete.

with camp as (
  insert into public.adv_campaigns (
    cabinet_id, wb_campaign_id, nm_id, campaign_type, name, status, synced_at
  )
  values (
    '21cffafa-bca2-4984-b5f8-5c426e6f538b',
    38634350,
    287679331,
    'manual_bid',
    '287679331 Поиск пиджак квадрат шоко2',
    'active',
    now()
  )
  on conflict (cabinet_id, wb_campaign_id) do update set
    nm_id = excluded.nm_id,
    campaign_type = excluded.campaign_type,
    name = excluded.name,
    status = excluded.status,
    synced_at = now()
  returning id
),
cl as (
  insert into public.adv_clusters (campaign_id, cluster_key, is_active)
  select id, 'пиджак женский квадратный', true
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
  80,
  30,
  0.07,
  0.03,
  true
from cl
returning id as rule_id, campaign_id, cluster_id;
```

Скопируйте `rule_id` из результата.

Проверка, что связалось:

```sql
select
  r.id as rule_id,
  cab.name as cabinet,
  c.wb_campaign_id,
  c.nm_id,
  c.campaign_type,
  cl.cluster_key,
  r.target_pos_from,
  r.target_pos_to,
  r.max_bid,
  r.is_active
from public.autobidder_rules r
join public.adv_campaigns c on c.id = r.campaign_id
join public.cabinets cab on cab.id = c.cabinet_id
join public.adv_clusters cl on cl.id = r.cluster_id
where cab.name = 'Zevina 1';
```

## Прогнать тик вручную

`service_role`: Project Settings → API. Cron сам тоже подхватит через ~5 минут, но ручной вызов с `positions` нагляднее.

```bash
curl -sS -X POST \
  'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/autobidder-tick' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer СЮДА_SERVICE_ROLE" \
  -d '{
    "cabinet_id": "21cffafa-bca2-4984-b5f8-5c426e6f538b",
    "positions": { "пиджак женский квадратный": 15 }
  }'
```

Ожидание в ответе: `dry_run: true`, у Zevina 1 одно решение, `reason: pos_worse`, `new_bid` около 31–80 (если `my_bid=0` — база 30 + шаг ≥1, ceil), `applied: false`.

Без `positions` заглушка даст `pos_unknown` и тоже строку в журнале.

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
where c.cabinet_id = '21cffafa-bca2-4984-b5f8-5c426e6f538b'
order by h.created_at desc
limit 20;
```

`applied` должен быть `false`. Если `true` — сразу `dry_run` не тот, напишите.

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
| UI есть? | Нет, только SQL |
| Я вставила правило за вас? | Нет |
| Хватит одного INSERT в rules? | Нет, нужны ещё campaign + cluster |
| Ставки уйдут в WB? | Нет, пока `DRY_RUN` |
