-- pg_cron: серверная ротация фото А/Б тестов каждые 10 минут (не зависит от открытой вкладки браузера)
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из Dashboard → Settings → API

-- orders/impressions на ab_test_variants раньше никогда не обновлялись — теперь
-- ab-test-rotate считает реальные заказы и сумму продаж по каждому варианту.
alter table ab_test_variants add column if not exists revenue numeric default 0;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'ab-test-rotate-10min'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'ab-test-rotate-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/ab-test-rotate',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
