# План: Edge Function `autobidder_tick`

Только первый срез: **Способ B + бюджеты + изоляция кабинетов**.  
Способ A, органика (4.1), расписание (7.2), `target_drr` и тиры — не в этом шаге.

По `docs/autobidder.md`: §3 (Способ B), §4.3–4.5, §11.3, §11.5.  
Код не пишем, пока не закрыты вопросы в конце.

---

## Что делает тик

Edge Function `autobidder-tick` (job `autobidder_tick`, cron `*/5`).  
Ручной запуск: `POST` с service_role, опционально `cabinet_id` / `rule_id` / `dry_run`.

Существующий `autobidder-run` не трогаем — это старый MVP.

**Обход (§11.3):** кабинеты с `adv_token_valid=true` и `adv_token_secret_id` — `Promise.allSettled`. Внутри кабинета правила **последовательно** (throttle уже в `wb-adv-proxy`). 401/403 одного кабинета → `adv_token_valid=false`, этот кабинет стоп, остальные идут.

**Стратегия в этом срезе:** только `min_sufficient`. `fetch_auction` = заглушка, всегда `null` → в формулах 4.3 всегда ветка `my_bid * (1 ± step_pct)` / `my_bid`.

**`get_ad_position`:** в промпте 4b нет JSON из DevTools → **заглушка** (в тестах подставляем `my_pos`). Живой `search.wb.ru` не угадываем.

---

## Порядок одного кабинета

1. Токен из Vault. `getBids` / любая 401 → кабинет помечаем невалидным, правила не крутим.
2. Считаем расход **сегодня (Бишкек)** по кабинету и по группе (§11.5).
3. Активные правила (`is_active`, `strategy=min_sufficient`).  
   `cluster_id` задан → один кластер; `NULL` → все активные `adv_clusters` кампании.
4. На каждый кластер:
   - `my_bid` = `getBids`
   - `my_pos` = заглушка / (позже) выдача
   - всегда пишем `serp_position_snapshots`
   - считаем `candidate` → `clamp` → hysteresis → `setBids` (если не DRY_RUN)
   - всегда пишем `bid_history` (`source='feedback'`, `applied` = ставка реально ушла в WB)

`DRY_RUN=true` (как в прокси): `setBids` не уходит, `applied=false`.

---

## Формула решения (чистая функция — под юнит-тесты)

Канон для таблицы:

`from=5`, `to=10`, `my_bid=100`, `step_pct=0.07`, `hysteresis=0.03`, `min_bid_floor=50`, `max_bid=150`, `target_bid=null`.

Позиция: **больше число = хуже**. Границы `from` и `to` входят в диапазон.

```
если бюджет группы исчерпан:     candidate = min_bid_floor
иначе если бюджет кабинета:      candidate = min_bid_floor
иначе если my_pos is NULL
      или my_pos > to:           candidate = my_bid * (1 + step_pct)
иначе если my_pos < from:        candidate = my_bid * (1 - step_pct)
иначе:                           candidate = my_bid

new_bid = clamp(candidate, min_bid_floor, max_bid)

если my_bid > 0 и abs(new_bid - my_bid) / my_bid < hysteresis:
    не вызывать setBids
```

`reason` (для журнала и тестов):

| Условие | reason |
|---|---|
| бюджет группы | `budget_cap_group` |
| бюджет кабинета | `budget_cap_cabinet` |
| `my_pos is NULL` | `pos_unknown` |
| `my_pos > to` | `pos_worse` |
| `my_pos < from` | `pos_better` |
| в диапазоне | `in_range` |
| после clamp `new_bid = max_bid` и хотели поднять | `max_bid_hit` |
| отсекли hysteresis | `hysteresis` |
| 401 кабинета | `token_invalid` |

Приоритет reason: бюджет группы → бюджет кабинета → (если упёрлись в потолок при подъёме) `max_bid_hit` → позиция → hysteresis.

Пока **не** шлём Telegram (это шаг 11.7): только `bid_history` + флаг токена.

---

## Бюджет (§11.5)

`org` в этом срезе не проверяем (колонки/лимита org в схеме нет).  
Считаем: **группа → кабинет**.

- Лимит кабинета: `cabinets.adv_daily_budget_cap`
- Лимит группы: `cabinet_groups.adv_daily_budget_cap` для `cabinets.adv_group_id`
- `NULL` / нет группы → проверки нет
- Расход: `sum(adv_daily_stats.spend)` за сегодня по кампаниям кабинета, строки с `cluster_key IS NULL`
- Оценка между синками: в этом срезе **0** (см. вопрос 7)
- Если `spend >= cap` → в этом тике `candidate = min_bid_floor` до полуночи Бишкека. **Правила в БД не меняем**

Если исчерпаны оба лимита — `reason=budget_cap_group`.

---

## Тест-кейсы

Общее правило, если не сказано иначе: канон выше, `DRY_RUN=false`, токен валидный, бюджеты не заданы.

| # | Вход | Новая ставка | reason | applied |
|---|---|---|---|---|
| 1 | `my_pos=15` (хуже `to=10`) | **107** | `pos_worse` | да |
| 2 | `my_pos=3` (лучше `from=5`) | **93** | `pos_better` | да |
| 3 | `my_pos=7` (в диапазоне) | **100** (без `setBids`) | `in_range` | нет |
| 4 | `my_pos=NULL` | **107** | `pos_unknown` | да |
| 5 | `my_pos=20`, `my_bid=145` → 145×1.07=155.15 → clamp | **150** | `max_bid_hit` | да |
| 6 | `my_pos=15`, `step_pct=0.02` → 102, 2% < 3% | **100** (без `setBids`) | `hysteresis` | нет |
| 7 | расход кабинета ≥ `adv_daily_budget_cap`, `my_bid=100` | **50** | `budget_cap_cabinet` | да |
| 8 | расход группы ≥ `cabinet_groups.adv_daily_budget_cap` | **50** | `budget_cap_group` | да |
| 9 | кабинет A: getBids 401; кабинет B: `my_pos=15`, `my_bid=100` | A: ставки нет; B: **107** | A `token_invalid`; B `pos_worse` | A нет; B да |

До границы диапазона (чтобы не спорить в коде):

| # | Вход | Ставка | reason |
|---|---|---|---|
| 10 | `my_pos=10` (= `to`) | 100, без apply | `in_range` |
| 11 | `my_pos=5` (= `from`) | 100, без apply | `in_range` |
| 12 | `my_pos=11` | 107 | `pos_worse` |
| 13 | кабинет уже на `min_bid_floor=50`, бюджет исчерпан | 50, без apply | `hysteresis` (дельта 0) |
| 14 | оба бюджета исчерпаны | 50 | `budget_cap_group` |

Кейс 9 — интеграционный (`allSettled`): у A `adv_token_valid=false`, B отработал.  
1–8 и 10–14 — юнит на чистую функцию, без WB.

---

## Что неясно в документе (нужны ответы до кода)

1. **Формат выдачи.** JSON из DevTools для `get_ad_position` не вставлен. Оставляем заглушку — так?
2. **NULL и `max_bid_hit`.** В 4.3 NULL = «хуже» (поднимаем). В 4.5 алерт только если `my_pos > to`. NULL + упор в потолок — это `max_bid_hit` или только `pos_unknown`?
3. **`max_bid = NULL`.** В схеме можно. Без потолка поднимать нельзя. Предлагаю: активное правило `min_sufficient` без `max_bid` — только держать/снижать, не поднимать. Ок?
4. **Шаг ≥ 1₽.** §3 говорит «5–10% или ≥1₽», 4.3 — только процент. При ставке 10₽ шаг 0.7₽. Берём строго 4.3 или `max(my_bid * step_pct, 1)`?
5. **Округление.** 100×1.07 = 107 ровно, 145×1.07 = 155.15. Округлять до 1₽ или до копеек, как в `getBids.bid`?
6. **`my_bid = 0`.** Hysteresis делит на `my_bid`. Если ставки ещё нет — считать шаг от `min_bid_floor` или пропускать кластер?
7. **Оценка расхода между синками.** 11.5 пишет «синк каждые 30 мин» + `bid × impressions`. Сейчас `sync_daily_stats` раз в сутки, живых показов между тиками нет. В этом срезе расход = сумма `adv_daily_stats` за сегодня, оценка = 0. Или нужен другой источник?
8. **«До 00:00».** Это только поведение тика (правила в БД не трогаем) — так и закладываю?
9. **Алерт 401 / бюджет.** 11.3/11.5 обещают алерт. Telegram — отдельный шаг. В этом срезе только журнал + `adv_token_valid`?
10. **`auto_bid` и правило на всю кампанию.** Тик только `manual_bid`? При `cluster_id IS NULL` — каждый активный кластер отдельно?
11. **Кабинеты без лимита и без группы.** Сейчас у всех четырёх `adv_daily_budget_cap` и `adv_group_id`, скорее всего, пустые — бюджетные кейсы на проде не сработают, пока не проставите цифры. Ок?

Когда будут ответы (хотя бы 1, 3, 4, 7, 9, 10) — можно писать `autobidder-tick` и юнит-тесты по таблице.
