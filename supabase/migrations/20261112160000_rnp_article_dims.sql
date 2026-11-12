-- Габариты упаковки артикула из карточки WB (см) и вес (кг): для литража, хранения в день и логистики за шт в шапке РНП.
-- Заполняет auto-sync вместе с остальными полями карточки (imt_id, название, предмет).
alter table public.rnp_articles
    add column if not exists dim_l_cm numeric,
    add column if not exists dim_w_cm numeric,
    add column if not exists dim_h_cm numeric,
    add column if not exists weight_kg numeric;

comment on column public.rnp_articles.dim_l_cm is 'Длина упаковки по карточке WB, см';
comment on column public.rnp_articles.dim_w_cm is 'Ширина упаковки по карточке WB, см';
comment on column public.rnp_articles.dim_h_cm is 'Высота упаковки по карточке WB, см';
comment on column public.rnp_articles.weight_kg is 'Вес упаковки по карточке WB, кг';
