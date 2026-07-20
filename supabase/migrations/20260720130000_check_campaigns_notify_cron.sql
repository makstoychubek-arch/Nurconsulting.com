-- pg_cron: фоновая проверка статусов РК + баланса кабинета каждые 10 минут,
-- с уведомлениями в Telegram. Полностью отдельное задание от advertising-sync
-- и ab-test-rotate — не трогает их логику/расписание.
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из
-- Dashboard → Settings → API (как и для остальных cron-заданий в проекте).

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'check-campaigns-notify-10min'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'check-campaigns-notify-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/check-campaigns-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
