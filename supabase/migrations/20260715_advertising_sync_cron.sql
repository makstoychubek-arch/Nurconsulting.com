-- pg_cron: фоновая синхронизация статистики рекламных кампаний каждые 6ч
-- (Promotion API строже по рейт-лимитам, поэтому реже, чем auto-sync-4h)
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role из Dashboard → Settings → API

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $block$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'advertising-sync-6h'
  loop
    perform cron.unschedule(jid);
  end loop;
end $block$;

select cron.schedule(
  'advertising-sync-6h',
  '0 */6 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/advertising-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'
    ),
    body    := '{}'::jsonb
  );
  $$
);
