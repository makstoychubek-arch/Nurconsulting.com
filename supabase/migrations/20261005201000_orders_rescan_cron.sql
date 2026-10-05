-- pg_cron: пересбор заказов (orders-rescan) раз в 10 минут, со сдвигом от auto-sync (:00 каждые 4 часа).
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role (в репозиторий ключ не коммитим).

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'orders-rescan-10m'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'orders-rescan-10m',
  '5,15,25,35,45,55 * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/orders-rescan',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
