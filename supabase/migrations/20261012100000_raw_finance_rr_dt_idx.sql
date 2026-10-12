-- Быстрый «Общий» РНП: сводки по кабинету фильтруют финотчёт по rr_dt, а индекса по нему не было (полный перебор ~10 с).
create index if not exists raw_finance_report_cab_rr_dt_idx on public.raw_finance_report (cabinet_id, rr_dt);
