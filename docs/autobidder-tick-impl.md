# Итог: autobidder_tick (код + тесты)

Дата: 09.09.2026. По плану `docs/autobidder-tick-plan.md` и ответам на 11 вопросов.

## Ответы, которые зашиты в код

| # | Решение |
|---|---|
| 1 | `get_ad_position` — заглушка (`null`). Override: HTTP `positions: { "кластер": 15 }`. Живой JSON — шаг 7. |
| 2 | `my_pos = NULL` → reason всегда `pos_unknown`. Если ещё и упёрлись в потолок: `pos_unknown\|max_bid_hit`. |
| 3 | `max_bid` пустой — только держать/снижать, не поднимать. |
| 4 | Шаг `max(base * step_pct, 1)` ₽. |
| 5 | `Math.ceil` до целого рубля (155.15 → 156), потом clamp. |
| 6 | `my_bid = 0` — hysteresis не считаем, база = `min_bid_floor`. |
| 7 | Оценка расхода между синками = **0**. TODO после Способа A. |
| 8 | Бюджет режет только этот тик, правила в БД не меняем. |
| 9 | Журнал `bid_history` + `adv_token_valid`. Telegram — шаг 11.7. |
| 10 | Только `manual_bid`. `cluster_id = NULL` → все активные кластеры. |
| 11 | Без `adv_daily_budget_cap` бюджетные ветки молчат. |

`DRY_RUN=true` по умолчанию (`parseDryRun(undefined) === true`). Cron шлёт `{}` — ставки в WB не уходят.

## Что легло в репозиторий

| Файл | Зачем |
|---|---|
| `supabase/functions/_shared/autobidder-tick-decide.ts` | Чистая формула + заглушки A/позиции |
| `supabase/functions/_shared/autobidder-tick-decide_test.mts` | Кейсы 1–14 + доп. |
| `supabase/functions/autobidder-tick/index.ts` | Edge Function, обход кабинетов `Promise.allSettled` |
| `supabase/migrations/20260909200000_autobidder_tick_cron.sql` | `autobidder_tick` `*/5 * * * *` |
| `package.json` | Скрипт `test` гоняет новые юниты |

Старый `autobidder-run` не трогали.

Ручной запуск:

```bash
curl -sS -X POST \
  'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/autobidder-tick' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer SERVICE_ROLE" \
  -d '{"cabinet_id":"…","rule_id":"…","positions":{"кластер":15}}'
```

`dry_run: false` в теле — единственный способ реально поставить ставку (плюс `DRY_RUN=false` в секретах функции). Пока не включать.

## Тест-кейсы (факт прогона)

Канон: `from=5 to=10 bid=100 step=0.07 hyst=0.03 floor=50 max=150`.

| # | Вход | Ставка | reason | apply |
|---|---|---|---|---|
| 1 | pos=15 | 107 | `pos_worse` | да |
| 2 | pos=3 | 93 | `pos_better` | да |
| 3 | pos=7 | 100 | `in_range` | нет |
| 4 | pos=NULL | 107 | `pos_unknown` | да |
| 5 | pos=20, bid=145 → ceil 156 → clamp | 150 | `max_bid_hit` | да |
| 6 | pos=15, step=0.02 | 100 | `hysteresis` | нет |
| 7 | бюджет кабинета | 50 | `budget_cap_cabinet` | да |
| 8 | бюджет группы | 50 | `budget_cap_group` | да |
| 9 | A 401 / B pos=15 | A нет; B 107 | `token_invalid` / `pos_worse` | A нет; B да |
| 10 | pos=10 | 100 | `in_range` | нет |
| 11 | pos=5 | 100 | `in_range` | нет |
| 12 | pos=11 | 107 | `pos_worse` | да |
| 13 | bid=50 + бюджет кабинета | 50 | `hysteresis` | нет |
| 14 | оба бюджета | 50 | `budget_cap_group` | да |
| доп. | NULL + потолок (bid=145) | 150 | `pos_unknown\|max_bid_hit` | да |
| доп. | max_bid NULL, pos=15 | 100 | `hysteresis` | нет |
| доп. | bid=0 (есть max) | 54 | `pos_worse` | да |
| доп. | bid=0, max NULL | 0 | `pos_worse` | нет |

Прогон: `autobidder-tick-decide_test: ok`.

## Поведение на проде сейчас

Пока нет строк в `autobidder_rules` (v2) — тик пустой, журнал не растёт.  
Когда появятся правила, заглушка позиции даст `pos_unknown` и *желание* поднять ставку, но `applied=false` из‑за DRY_RUN.

## Не делали в этом шаге

Способ A, органика, расписание, `target_drr`, тиры, Telegram, живой `search.wb.ru`, оценка `bid×impressions` между синками.
