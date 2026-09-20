-- Актуальные остатки FBO/FBS (имена таблиц как в РНП, если колонки другие — поправить локально)
SELECT
    COALESCE(scheme, stock_type, 'fbo') AS scheme,
    SUM(COALESCE(qty, quantity, amount, 0)) AS qty
FROM rnp_stocks_now
GROUP BY 1;
