-- Пересбор заказов за последние 30 дней: курсор по кабинету. См. функцию orders-rescan.
alter table public.cabinets
    add column if not exists orders_rescan_to date;

comment on column public.cabinets.orders_rescan_to is
    'Следующий день для пересбора заказов (orders-rescan): идёт назад по окну 30 дней и возвращается к позавчера.';
