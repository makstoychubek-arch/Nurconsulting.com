---
title: Сводный отчёт NR Space
description: Evidence-страница поверх тех же таблиц, что считает дашборд.
---

# Сводный отчёт

Период задаётся фильтрами дашборда. Источник — `raw_finance_report` и остатки FBO/FBS.

```sql finance
SELECT
  sale_dt,
  nm_id,
  doc_type_name,
  retail_price_withdisc_rub,
  ppvz_for_pay,
  delivery_rub,
  storage_fee,
  penalty,
  deduction
FROM raw_finance_report
WHERE sale_dt BETWEEN '${inputs.from}' AND '${inputs.to}'
```

```sql stocks
SELECT scheme, SUM(qty) AS qty
FROM rnp_stocks_now
GROUP BY scheme
```

<BigValue data={finance} value=ppvz_for_pay title="К перечислению" />
<LineChart data={finance} x=sale_dt y=retail_price_withdisc_rub />
<DataTable data={stocks} />
