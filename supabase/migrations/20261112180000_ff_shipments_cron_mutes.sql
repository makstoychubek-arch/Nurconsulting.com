-- 1. Карточка «Отправки FBS» для ФФ (АМАН ФФ): каждый день в 20:00 по Бишкеку (14:00 UTC).
--    Команда берётся у задания orders-rescan-10m (тот же ключ и вызов), меняем адрес функции.
select cron.schedule('ff-shipments-report-20h', '0 14 * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ff-shipments-report'),
    'body := ''{}''::jsonb', 'body := ''{}''::jsonb'));

-- 2. ИП Айзада и ОсОО Айлин Текстиль (Zevina 2) убраны из Telegram: ни один канал по ним больше не пишет.
--    Выключатель, а не удаление: вернуть можно, поставив muted = false. На сайте кабинеты остаются.
insert into public.telegram_channel_mutes (cabinet_id, channel, muted, updated_at)
select c.id, ch, true, now()
from public.cabinets c
cross join unnest(array['sales','penalties','ads','ab_tests','news','reviews','blockings','fbs']) as ch
where c.name in ('ИП Айзада', 'Zevina 2')
on conflict (cabinet_id, channel) do update set muted = true, updated_at = now();
