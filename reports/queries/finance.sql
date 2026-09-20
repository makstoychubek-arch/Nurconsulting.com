-- Evidence / Metabase: те же поля, что считает wb-formulas.js
SELECT
    sale_dt,
    nm_id,
    vendor_code,
    doc_type_name,
    SUM(retail_price_withdisc_rub) AS sales_sum,
    SUM(ppvz_for_pay) AS to_transfer,
    SUM(delivery_rub) AS logistics,
    SUM(storage_fee) AS storage,
    SUM(penalty) AS penalty,
    SUM(deduction) AS deduction
FROM raw_finance_report
WHERE sale_dt >= current_date - 30
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC;
