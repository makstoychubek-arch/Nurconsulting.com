-- Ozon в NR Space: данные площадки лежат в своих таблицах рядом с WB, WB не трогаем.
-- Этап B1 плана docs/ozon-integration-plan.md: товары, остатки, заказы, связь артикулов, состояние загрузки.
-- Пишет только серверная функция ozon-sync (service role). Читать может участник кабинета.
-- Ключи Ozon хранятся в cabinets.ozon_client_id / ozon_api_key (уже есть) и наружу не отдаются.

create table if not exists public.ozon_products (
    cabinet_id   uuid        not null references public.cabinets(id) on delete cascade,
    product_id   bigint      not null,
    offer_id     text        not null,
    sku          bigint,
    name         text,
    barcode      text,
    price        numeric,
    old_price    numeric,
    min_price    numeric,
    currency     text        not null default 'KGS',
    commission_fbo_pct  numeric,
    commission_fbs_pct  numeric,
    acquiring    numeric,
    deliv_to_customer   numeric,
    volume_weight       numeric,
    width_mm     int,
    height_mm    int,
    depth_mm     int,
    weight_g     int,
    archived     boolean     not null default false,
    updated_at   timestamptz not null default now(),
    primary key (cabinet_id, product_id)
);
create index if not exists ozon_products_offer_idx on public.ozon_products (cabinet_id, offer_id);
create index if not exists ozon_products_barcode_idx on public.ozon_products (cabinet_id, barcode);

create table if not exists public.ozon_stocks (
    cabinet_id   uuid        not null references public.cabinets(id) on delete cascade,
    product_id   bigint      not null,
    offer_id     text        not null,
    scheme       text        not null check (scheme in ('fbo','fbs')),
    present      int         not null default 0,
    reserved     int         not null default 0,
    synced_at    timestamptz not null default now(),
    primary key (cabinet_id, product_id, scheme)
);
create index if not exists ozon_stocks_cabinet_idx on public.ozon_stocks (cabinet_id);

create table if not exists public.ozon_postings (
    cabinet_id     uuid        not null references public.cabinets(id) on delete cascade,
    posting_number text        not null,
    scheme         text        not null default 'fbo',
    order_id       bigint,
    status         text        not null,
    substatus      text,
    created_at     timestamptz not null,
    in_process_at  timestamptz,
    cancelled      boolean     not null default false,
    cancel_reason  text,
    city           text,
    warehouse_name text,
    currency       text        not null default 'KGS',
    total_amount   numeric     not null default 0,
    items          jsonb       not null default '[]'::jsonb,
    synced_at      timestamptz not null default now(),
    primary key (cabinet_id, posting_number)
);
create index if not exists ozon_postings_cab_date_idx on public.ozon_postings (cabinet_id, created_at desc);
create index if not exists ozon_postings_status_idx on public.ozon_postings (cabinet_id, status);

-- Связь артикулов WB и Ozon. Авто: по совпадению штрихкода (у вас он общий). Вручную правится в окне сопоставления.
create table if not exists public.mp_article_map (
    cabinet_id  uuid        not null references public.cabinets(id) on delete cascade,
    nm_id       bigint      not null,
    offer_id    text        not null,
    ozon_product_id bigint,
    method      text        not null default 'barcode' check (method in ('barcode','article','manual')),
    created_at  timestamptz not null default now(),
    primary key (cabinet_id, nm_id, offer_id)
);
create index if not exists mp_article_map_offer_idx on public.mp_article_map (cabinet_id, offer_id);

create table if not exists public.ozon_sync_state (
    cabinet_id   uuid        not null references public.cabinets(id) on delete cascade,
    part         text        not null,
    last_ok_at   timestamptz,
    last_try_at  timestamptz,
    last_error   text,
    rows_written int         not null default 0,
    primary key (cabinet_id, part)
);

do $$
declare t text;
begin
    foreach t in array array['ozon_products','ozon_stocks','ozon_postings','mp_article_map','ozon_sync_state']
    loop
        execute format('alter table public.%I enable row level security', t);
        execute format('drop policy if exists %I on public.%I', t || '_select', t);
        execute format('create policy %I on public.%I for select to authenticated using (public.can_access_cabinet(cabinet_id))', t || '_select', t);
        execute format('revoke all on public.%I from anon', t);
    end loop;
end $$;

comment on table public.ozon_products is 'Каталог Ozon кабинета (offer_id, sku, цена, комиссии, габариты). Пишет ozon-sync.';
comment on table public.ozon_stocks is 'Остатки Ozon по схемам FBO/FBS на момент synced_at.';
comment on table public.ozon_postings is 'Отправления Ozon (FBO/FBS): статус, сумма, состав в items. Отмены помечены cancelled.';
comment on table public.mp_article_map is 'Какой артикул Ozon (offer_id) соответствует какому nm_id WB.';
comment on table public.ozon_sync_state is 'Когда и что загрузили из Ozon, последняя ошибка.';
