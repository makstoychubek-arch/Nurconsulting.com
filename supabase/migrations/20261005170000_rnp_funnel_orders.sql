-- Заказы из воронки WB (sales-funnel/products/history, поле orderCount) — как есть, по артикулу и дню.
-- Раньше РНП подменял orders_count на «Корзина × Заказы %» (процент целый и округлённый, при малых
-- числах теряется до нескольких заказов, а у свежих дней воронка неполная). Новая колонка хранит
-- настоящее число рядом, чтобы сверить его с кабинетом WB, не меняя расчёт РНП.
-- Safe to re-run.
alter table public.rnp_daily_data add column if not exists funnel_orders integer;
