-- Дашборд: dashboard_summary читал тысячи широких строк заказов и РНП-данных (около 5,9 с на кабинет с 17 тысячами заказов).
-- Покрывающие индексы дают чтение только из индекса, без обращения к строкам таблицы (в wb_orders каждая строка с большим json).
-- Занимают немного места и ускоряют только чтение.

create index if not exists wb_orders_dash_cover_idx
    on public.wb_orders (cabinet_id, order_date) include (price, is_return);

create index if not exists rnp_daily_dash_cover_idx
    on public.rnp_daily_data (cabinet_id, date) include (basket_count, funnel_order_conv, orders_count);

-- Точный дубль wb_orders_cabinet_date_idx: лишний индекс замедляет каждую запись заказов.
drop index if exists public.wb_orders_cabinet_id_order_date_idx;

analyze public.wb_orders;
analyze public.rnp_daily_data;
