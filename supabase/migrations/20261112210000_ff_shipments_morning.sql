-- Карточка «Отправки FBS» для ФФ переносится на утро: 07:00 по Бишкеку (01:00 UTC), отчёт за вчера.
-- Вечерний вариант показывал неполный день. Старый отчёт «Карина» (daily-fbs-report-07-bishkek) выключен.
select cron.unschedule('ff-shipments-report-20h') where exists (select 1 from cron.job where jobname = 'ff-shipments-report-20h');
select cron.schedule('ff-shipments-report-07h', '0 1 * * *',
  replace(replace((select command from cron.job where jobname = 'orders-rescan-10m'),
    '/functions/v1/orders-rescan', '/functions/v1/ff-shipments-report'),
    'body := ''{}''::jsonb', 'body := ''{}''::jsonb'));
