-- Оформление листа Google (шрифт, кегль, высоты, ширины), чтобы «Раздачи» на сайте выглядели один в один.
alter table public.giveaway_sheets add column if not exists format jsonb;
alter table public.giveaway_sheets add column if not exists format_at timestamptz;
