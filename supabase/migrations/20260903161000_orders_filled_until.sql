-- Курсор «назад» (orders_backfilled_to) не закрывает дыру между последним
-- историческим днём и окном Pass B (сегодня/вчера). Без forward-курсора
-- у Базы после 20 июля заказы больше не докачивались.
alter table public.cabinets
    add column if not exists orders_filled_until date;

comment on column public.cabinets.orders_filled_until is
    'Самый поздний день, до которого auto-sync уже проверил историю заказов (не включая окно Pass B).';
