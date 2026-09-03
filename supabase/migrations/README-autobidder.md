# Миграции автобиддера v2

Только файлы, на прод не применялись.

1. `20260904010000_autobidder_v2_schema.sql` — `pg_trgm`, таблицы §5, колонки `cabinets` и сущности §11.1, представление `adv_daily_stats_v` (`ctr`, `cpc`, `drr`).
2. `20260904011000_autobidder_v2_rls.sql` — RLS через `user_cabinet_access` (§11.2).

Токен рекламы в таблицах не хранится: только `cabinets.adv_token_secret_id` (Vault).

Таблица кабинетов в проекте — `cabinets` (как в спецификации). Рядом есть старые `advertising_campaigns` / `advertising_daily_stats` — эти миграции их не меняют.

## Имя `autobidder_rules`

В проде уже есть MVP-таблица `autobidder_rules` (`20260903200000_autobidder.sql`: `cabinet_id` + `campaign_id bigint`). v2 из `docs/autobidder.md` хочет то же имя (`campaign_id` → `adv_campaigns`). Миграции существующую таблицу не трогают: `CREATE TABLE IF NOT EXISTS` не пересоздаст её. RLS v2 для правил ставится только если `campaign_id` уже `uuid`.

Перед применением v2-схемы правил старую таблицу нужно переименовать или удалить отдельным шагом.

## Применение (когда будете готовы)

```bash
# локально
supabase db reset
# или SQL Editor / Management API — оба файла по порядку
```

После применения выдать себе роль:

```sql
insert into user_cabinet_access (user_id, cabinet_id, role)
values ('<auth.uid()>', '<cabinet uuid>', 'owner');
```

Проверка: под `viewer` — `select * from autobidder_rules` только своих кабинетов; insert должен быть запрещён.
