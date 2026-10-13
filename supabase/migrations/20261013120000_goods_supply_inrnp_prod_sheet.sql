-- Логистика: поставка может не иметь артикула WB (текст из таблицы), и показывается в РНП только по переключателю in_rnp.
-- Заказ на производство: группа строк (grp) = один заказ «артикул + расцветка» с общим количеством и процентовкой по размерам.

alter table public.goods_shipments alter column nm_id drop not null;
alter table public.goods_shipments add column if not exists article text not null default '';
alter table public.goods_shipments add column if not exists in_rnp boolean not null default false;

alter table public.production_orders add column if not exists grp uuid;
alter table public.production_orders add column if not exists color text not null default '';
alter table public.production_orders add column if not exists pct numeric;
alter table public.production_orders add column if not exists total_qty integer;
alter table public.production_orders add column if not exists sort_idx integer not null default 0;
create index if not exists production_orders_grp_idx on public.production_orders (cabinet_id, grp);
