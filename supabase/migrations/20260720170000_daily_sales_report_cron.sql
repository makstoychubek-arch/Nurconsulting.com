-- pg_cron: ежедневный отчёт по кабинетам в Telegram (заказы/выкупы/остатки
-- за вчера) в 09:00 UTC = 15:00 по Бишкеку. Отдельное задание, не трогает
-- существующие кроны. Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY
-- на service_role из Dashboard → Settings → API.

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'daily-sales-report-15-bishkek'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'daily-sales-report-15-bishkek',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/daily-sales-report',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
