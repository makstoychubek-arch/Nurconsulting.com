# Где в автобиддере ещё подразумеваются рубли

Не переписывал логику. Только список мест, которые надо сверить с **валютой кабинета продавца**.

**Факт (10.09.2026):** WB Advertising API отдаёт ставки в валюте кабинета. Zevina 1 — `currency: "KGS"`, ставка кластера `пиджак для женщин` = **420** (сомы, не рубли). Примечание внесено в `docs/autobidder.md` §1 и в комментарии колонок (`20260910060000_adv_bid_currency_comments.sql`).

Baza / Elium: валюту кабинета ещё не снимали с `get-bids`. Не считать их RUB по умолчанию.

---

## Код, который надо проверить (не менял)

| Файл | Что подразумевает рубли | Зачем сверять |
|---|---|---|
| `supabase/functions/_shared/autobidder-tick-decide.ts` | функция `ceilRub`; шаг `max(base * step_pct, 1)` как «1 ₽» | Округление и минимум шага — в **единицах валюты кабинета**, имя лжёт |
| `supabase/functions/_shared/autobidder-tick-decide_test.mts` | канон 100 / 50 / 150 без валюты | Примеры читаются как рубли |
| `supabase/functions/autobidder-tick/index.ts` | `max_bid`, `min_bid_floor`, `newBid * 100` → `bidMinorUnits` | минорные единицы = 1/100 валюты кабинета, не «копейки RUB» |
| `supabase/functions/_shared/wb-adv-proxy.ts` | комментарии / типы get-bids без валюты кабинета | в живом ответе есть `currency` |
| `supabase/functions/_shared/wb-adv-proxy_test.mts` | фикстуры `currency: 'RUB'` | образец OpenAPI, не Zevina 1 |
| `supabase/functions/_shared/wb-advert-bids.ts` | «1500 = 15 ₽», «значения &lt; 1000 почти всегда рубли» | старый bids v1; для KGS ложно |
| `supabase/functions/autobidder-run/index.ts` | `SPEND_NO_ORDERS_RUB = 300` | порог «слили 300 и нет заказов» в рублях |
| `supabase/migrations/20260904010000_autobidder_v2_schema.sql` | `max_bid` / `min_bid_floor` / `outbid_step` / `spend` / `revenue` без валюты | схема; комментарии добавлены отдельной миграцией, типы не менял |
| `supabase/functions/check-campaigns-notify/index.ts` | тексты «0 ₽», «остаток N ₽» | баланс РК в Telegram; у сом-кабинета враньё |

`target_drr` в коде тика ещё нет (только колонка `target_drr_pct`). Формула живёт в доке — см. ниже. Когда дойдёте до `recompute_max_bid_from_drr`: цена/маржа из RNP часто в **RUB**, ставка — в валюте кабинета. Смешивать нельзя.

RNP (`rnp-module.js`, `rnp-finance-sync`) курс ₽→сом считает **осознанно** — это не баг автобиддера, в список не включал.

---

## Документация, которая надо проверить (не менял формулировки ₽)

| Файл | Место | Зачем сверять |
|---|---|---|
| `docs/autobidder.md` | §1 «на 1₽»; §3 «+step ≥1₽»; «ставка конкурента + 1₽»; §4 `outbid_step` «по умолчанию 1₽»; §7.1 формула `price * target_drr_pct` (цена vs ставка); §11.6 макет «4 200 / 8 000 ₽» | Везде единица = валюта кабинета; `target_drr` ещё и смешение с ценой товара |
| `docs/autobidder-tick-impl.md` | «Шаг … 1₽»; «ceil до целого рубля» | То же, что `ceilRub` |
| `docs/autobidder-prompts.md` | `max_bid`, «жёсткий max_bid», «Сэкономлено» = `(max_bid − new_bid) × impressions/1000` | Числа и «экономия» без валюты |
| `docs/autobidder-trial-rule.md` | черновик раньше ставил `max_bid=80` как «80 ₽» | Уже поправлено на 500 KGS; не повторять 80 |

---

## Как проверять, не гадая

```text
POST /adv/v0/normquery/get-bids
{ "items": [{ "advert_id": <id>, "nm_id": <nm> }] }
```

Поле `bids[].currency` — истина для ставок этого кабинета. Бюджетные лимиты WB в той же валюте.
