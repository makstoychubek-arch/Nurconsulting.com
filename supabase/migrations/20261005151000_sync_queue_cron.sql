-- pg_cron: воркер очереди загрузки истории (sync-queue-tick) раз в минуту.
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из
-- Dashboard → Settings → API (в репозиторий ключ не коммитим).

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'sync-queue-tick-1m'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'sync-queue-tick-1m',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/sync-queue-tick',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
