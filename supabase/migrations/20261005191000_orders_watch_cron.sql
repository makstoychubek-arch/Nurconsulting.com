-- pg_cron: наблюдатель за новыми заказами FBS (orders-watch) раз в минуту; внутри функция опрашивает WB
-- несколько раз за минуту. Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role
-- (в репозиторий ключ не коммитим).
do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'orders-watch-1m' loop perform cron.unschedule(jid); end loop;
end $block$;

select cron.schedule('orders-watch-1m', '* * * * *', $$
  select net.http_post(
    url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/orders-watch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'),
    body := '{}'::jsonb, timeout_milliseconds := 10000);
$$);
