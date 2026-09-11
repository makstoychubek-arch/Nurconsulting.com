# setBids: v0 vs v1, валюта, GET config

10.09.2026. В WB **ничего не отправлял** (ни setBids, ни getConfig). Только код + спека.

Спека в `main`: [`docs/wb-openapi-promotion.md`](wb-openapi-promotion.md).  
Раздел 2 архитектуры теперь ссылается на неё, а не на краткий список из черновика.

---

## Какой путь у `setBids` сейчас

Уже **v1**. Это не баг. Переключать нечего.

```24:26:supabase/functions/_shared/wb-adv-proxy.ts
    // v1: ставка в валюте кабинета (bidMinorUnits). v0 в спеке — «в рублях», не использовать.
    setBids: { method: 'POST', path: '/api/advert/v1/normquery/bids' },
    getConfig: { method: 'GET', path: '/api/advert/v1/config' },
```

Хелпер шлёт `action: 'setBids'` → этот path. Тест `testSetBidsLive` проверяет URL  
`https://advert-api.wildberries.ru/api/advert/v1/normquery/bids`.

Тик (только если снять DRY_RUN) кладёт тело v1 — **без** поля `bid`, `bidMinorUnits` уже на сетке `cpmStep`:

```321:327:supabase/functions/autobidder-tick/index.ts
                    const setRes = await setBids(adv, {
                        bids: [{
                            advertId: Number(camp.wb_campaign_id),
                            nmId: Number(camp.nm_id),
                            normQuery: cl.cluster_key,
                            bidMinorUnits,
                        }],
                    });
```

`DRY_RUN=true` по умолчанию: `executeAdvRequest` для setBids **не ходит в WB**, отвечает `{ dry_run: true, payload }`.

---

## Что говорит спека

| | v0 `POST /adv/v0/normquery/bids` | v1 `POST /api/advert/v1/normquery/bids` |
|---|---|---|
| Описание метода | «устанавливает ставки **в рублях**» | «в валюте аккаунта продавца» |
| Поле ставки | `bid` (integer) | **`bidMinorUnits`** (integer, 0,01 валюты кабинета) |
| Имена полей | `advert_id`, `nm_id`, `norm_query` | `advertId`, `nmId`, `normQuery` |
| Кому можно | manual + CPM | manual + CPM |

У Baza / Elium / Zevina 1 кабинет в **KGS**. Если бы `setBids` бил в v0 и подставил 420 как «рубли», это была бы чужая валюта. Сейчас путь v1 — 420 KGS уходит как `bidMinorUnits: 42000`.

В тексте v0 есть противоречие: шапка «в рублях», описание поля `bid` — «базовые единицы валюты аккаунта». Не разбирать: **v0 не трогаем**, пишем только v1.

`isSetBidsWrite` по-прежнему ловит оба пути, чтобы случайный вызов v0 через `path:` тоже резался DRY_RUN.

---

## Что менять (и что нет)

**Не менять path.** Он уже `/api/advert/v1/normquery/bids`.

Три подчистки сделаны в `docs/autobidder-setbids-align.md` (ветка `cursor/setbids-align-47f1`):

1. Лишнее поле `bid` убрано. В теле только `bidMinorUnits`.
2. `newBid * 100` сверяется с `cpmStep` из `loadAdvConfig` (кэш на кабинет, TTL 60 с).
3. `ceilRub` переименован в `ceilBid`.

---

## GET `/api/advert/v1/config`

Добавлен хелпер. Живой WB не звал.

```ts
const res = await getAdvConfig(ctx);          // GET, без тела
const cfg = parseAdvConfig(res.data);
// cfg.currency      — "KGS"
// cfg.currencyCode  — 417
// cfg.cpmStep       — шаг CPM в минорных единицах (для setBids v1)
// cfg.cpcStep
// cfg.minTopUp
```

Пример из спеки (UZS): `{ currency: "UZS", currencyCode: 860, cpmStep: 100000, cpcStep: 500, minTopUp: 10000 }`.

Тик зовёт `loadAdvConfig` один раз на кабинет (если есть правила). Кэш 60 с, лимит WB 1 req/min.

---

## Спека в main

Влита: `git push origin cursor/wb-promo-openapi-47f1:main` → `a7d6443`.  
Читать: https://github.com/makstoychubek-arch/Nurconsulting.com/blob/main/docs/wb-openapi-promotion.md
