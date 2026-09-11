# РНП перешёл на официальный финотчёт WB

Дата: 11.09.2026. Кабинеты считают в **KGS (сом)**.

Ночной `rnp-finance-sync` и `wb-proxy` `finance_report` больше не ходят в устаревший

`GET statistics-api /api/v5/supplier/reportDetailByPeriod`.

Вместо него:

`POST https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed`

с телом `{ dateFrom, dateTo, period: "daily", limit, rrdId }`.

Это тот же отчёт реализации, не новый источник цифр. Меняется труба: camelCase, деньги строками, явный **дневной** период. Сегодняшняя колонка по-прежнему часто пустая — отчёт запаздывает.

## Почему не list + detailed/{reportId}

`/sales-reports/list` и `/sales-reports/detailed/{reportId}` в доке WB помечены как «может быть недоступен по стране регистрации». Кабинеты кыргызские. Для РНП берём только наследник **по периоду**.

Штрафы в Telegram по-прежнему могут ходить через list/{reportId} — это отдельный пайплайн.

`reportId` daily не влезает в JS number. Наследник без reportId в URL эту ловушку почти не трогает; `rrdId` перед `JSON.parse` всё равно читаем как строку.

## Что кладём в лист

Как раньше, через `raw_finance_report` → `rnp_recompute_finance()` → `rnp_daily_data`:

| Поле WB v1 | Колонка сырой таблицы | В листе |
|---|---|---|
| `docTypeName` = Продажа / Возврат | `doc_type_name` | Продаж, шт / возвраты |
| `retailPriceWithDisc` | `retail_price_withdisc_rub` | Сумма продаж |
| `retailAmount` | `retail_amount` | Реализация (WB) |
| `forPay` | `ppvz_for_pay` | К перечислению |
| `deliveryService` | `delivery_rub` | Доставка |
| `penalty` / `deduction` | `penalty` / `deduction` | Штрафы / удержания |
| `paidStorage` | `storage_fee` | коэффициент сверки хранения |

Заказы по-прежнему из `wb_orders`. Лист **не** рисует продажи как «заказы × 0.65». Нет строки финотчёта — в ячейке 0, а не оценка выкупа.

## Что это не чинит

Пустой «сегодня», воронка только 7 дней, асинхронное хранение, нули РК до advertising-sync. Замена трубы, не новые продажи.
