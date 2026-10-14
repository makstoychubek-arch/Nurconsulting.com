-- Поставки (Товары → Логистика): какой ФФ отправлял и сколько коробов; тариф «за короб» у ФФ (ff_terms.kind = 'box').
alter table public.goods_shipments add column if not exists ff_name text;
alter table public.goods_shipments add column if not exists boxes integer check (boxes is null or boxes >= 0);
alter table public.ff_terms drop constraint if exists ff_terms_kind_check;
alter table public.ff_terms add constraint ff_terms_kind_check check (kind in ('ship', 'storage', 'box'));
