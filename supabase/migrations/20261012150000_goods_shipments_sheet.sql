-- «Логистика» как таблица «В пути»: партия, метод, товар, карго, откуда, доставка, размеры колонками.
alter table public.goods_shipments
  add column if not exists batch text not null default '',
  add column if not exists method text not null default '',
  add column if not exists product text not null default '',
  add column if not exists origin text not null default '',
  add column if not exists cargo text not null default '',
  add column if not exists delivery text not null default '',
  add column if not exists price numeric,
  add column if not exists sizes jsonb not null default '{}'::jsonb,
  add column if not exists sort_idx integer not null default 0;
alter table public.goods_shipments drop constraint if exists goods_shipments_status_check;
