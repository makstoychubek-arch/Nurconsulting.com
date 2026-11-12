-- Рекламная карточка по каждому кабинету в Telegram: каждое утро в 10:00 по Бишкеку (04:00 UTC), отчёт за вчера.
-- Данные рекламы WB приходят с задержкой, поэтому не в 07:00. Команду берём у orders-rescan-10m (тот же ключ и вызов).
select cron.schedule('ads-daily-report-10h', '0 4 * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ads-daily-report'),
    'body := ''{}''::jsonb', 'body := ''{}''::jsonb'));
