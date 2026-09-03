-- pg_cron: автобиддер каждые 30 минут. Бюджет не трогает — только ставки.
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из
-- Dashboard → Settings → API (как и для остальных cron-заданий в проекте).

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'autobidder-run-30min'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'autobidder-run-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/autobidder-run',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
