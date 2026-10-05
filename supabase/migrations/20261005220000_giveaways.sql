-- Раздачи (кэшбек / блогеры / бартер): шаблон из рабочей таблицы «Список БЛУЗКИ», раздел «Товары → Раздачи».
-- Таблица только для команды (staff): в ней Telegram-ссылки и реквизиты выплат.
create table if not exists public.giveaways (
    id               uuid primary key default gen_random_uuid(),
    cabinet_id       uuid not null references public.cabinets(id) on delete cascade,
    kind             text not null default 'КЭШБЕК',        -- Вид: КЭШБЕК / БЛОГЕР / БАРТЕРЩИК / ОТКАЗ
    tg_link          text,                                   -- Ссылка ТГ
    order_date       date,                                   -- Дата заказа
    order_price      numeric,                                -- Цена в заказе
    cash_amount      numeric,                                -- Размер кэша
    pickup_planned   date,                                   -- Примерная дата забора
    pickup_date      date,                                   -- Фактическая дата забора
    ad_date          date,                                   -- Дата рекламы
    barcode_cut      boolean not null default false,         -- Разрезанный ШК
    review_date      date,                                   -- Дата публикации отзыва
    review_kind      text,                                   -- Вид отзыва (например, ЗАПАС)
    requisites       text,                                   -- Реквизиты (куда платить)
    cash_status      text,                                   -- Кэш выплачен: Готов к выплате / Да / Нет / Отмена
    review_status    text,                                   -- Отзыв опубликован: Да / Нет / Отмена
    responsible      text,                                   -- Ответственный
    keyword          text,                                   -- Ключ
    article          text,                                   -- Артикул (название)
    nm_id            bigint,
    filters          text,                                   -- Фильтры
    comment          text,                                   -- Чёрный список / комментарии
    reels_views      integer,                                -- Просмотры рилс
    reels_link       text,                                   -- Ссылка на Reels
    created_by       uuid default auth.uid(),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists giveaways_cabinet_date_idx on public.giveaways (cabinet_id, order_date desc);

alter table public.giveaways enable row level security;

drop policy if exists "giveaways_staff_all" on public.giveaways;
create policy "giveaways_staff_all" on public.giveaways
    for all to authenticated
    using (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()))
    with check (public.is_staff() and cabinet_id in (select public.current_user_cabinet_ids()));

revoke all on public.giveaways from anon, authenticated;
grant select, insert, update, delete on public.giveaways to authenticated;

create or replace function public.giveaways_touch() returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end $$;

drop trigger if exists giveaways_touch_trg on public.giveaways;
create trigger giveaways_touch_trg before update on public.giveaways
    for each row execute function public.giveaways_touch();
