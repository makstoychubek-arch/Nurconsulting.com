-- pg_cron: Акылай проверяет новые отзывы каждые 30 минут.
-- Первый запуск по кабинету идёт сразу после подключения Telegram (akylai-bot),
-- этот крон — регулярная проверка. Перед запуском замените
-- REPLACE_ME_SERVICE_ROLE_KEY на service_role из Dashboard → Settings → API.

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'akylai-reviews-30m'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'akylai-reviews-30m',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/akylai-reviews',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
