-- Расписание загрузки Ozon. Команду берём у существующего задания orders-rescan-10m (тот же ключ и вызов),
-- меняем адрес функции и тело запроса. Загрузка только читает из Ozon.
-- Остатки и отправления за последние 3 дня: каждые 30 минут. Товары, цены, комиссии, габариты: раз в 6 часов.
select cron.schedule('ozon-sync-30m', '7,37 * * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ozon-sync'),
    'body := ''{}''::jsonb', 'body := ''{"parts":["stocks","postings"],"days":3}''::jsonb'));

select cron.schedule('ozon-sync-products-6h', '17 */6 * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ozon-sync'),
    'body := ''{}''::jsonb', 'body := ''{"parts":["products"]}''::jsonb'));
