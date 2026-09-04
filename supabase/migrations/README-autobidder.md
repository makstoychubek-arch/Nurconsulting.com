# Миграции автобиддера v2

Только файлы, на прод не применялись.

1. `20260904010000_autobidder_v2_schema.sql` — `pg_trgm`, таблицы §5, колонки `cabinets` и сущности §11.1, представление `adv_daily_stats_v` (`ctr`, `cpc`, `drr`).
2. `20260904011000_autobidder_v2_rls.sql` — RLS через `user_cabinet_access` (§11.2).

Токен рекламы в таблицах не хранится: только `cabinets.adv_token_secret_id` (Vault).

Таблица кабинетов в проекте — `cabinets` (как в спецификации). Рядом есть старые `advertising_campaigns` / `advertising_daily_stats` — эти миграции их не меняют.

## Имя `autobidder_rules`

Если уже есть MVP-таблица `autobidder_rules` без колонки `cluster_id`, миграция переименовывает её в `autobidder_rules_legacy_mvp` (индексы, ограничения, политики — тоже). Данные не удаляются. FK `autobidder_log.rule_id` остаётся на legacy-таблице. После этого создаётся новая `autobidder_rules` по схеме v2.

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
