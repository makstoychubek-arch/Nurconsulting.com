-- Заказы из воронки продаж WB (analytics sales-funnel/products) для любых дней, не только последних 7.
-- Сверено 05.10.2026 с отчётом WB «по данным поставщика» и с Raskpro: сентябрь, Zevina 1 —
-- воронка 11 369 заказов / 50 974 460, отчёт WB 11 403, Raskpro 11 375 / 50 990 856;
-- statistics-api отдаёт 10 331 (на ~9% меньше).
alter table public.rnp_daily_data
    add column if not exists funnel_orders_sum numeric;

alter table public.cabinets
    add column if not exists funnel_rescan_to date;

comment on column public.rnp_daily_data.funnel_orders_sum is
    'orderSum воронки WB за день по артикулу (руб. до СПП), как «Заказано, сумма» в аналитике WB.';
comment on column public.cabinets.funnel_rescan_to is
    'Следующий день для долива воронки заказов (orders-rescan): идёт назад по окну 62 дня.';
