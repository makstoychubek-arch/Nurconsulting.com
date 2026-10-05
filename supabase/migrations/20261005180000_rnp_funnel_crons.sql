-- Воронка WB для РНП: ночью и вечером догружаем последние 7 дней по всем артикулам кабинетов команды.
-- Раньше задачи rnp-morning-funnel-* не стояли в cron (воронка за свежие дни писалась только когда
-- кто-то открывал РНП), и в РНП оставались заказы из statistics-api (22 вместо 26 и т.п.).
-- 05:00 / 05:15 UTC = 11:00 / 11:15 Бишкек (вчерашняя воронка WB уже стабильна),
-- 13:00 / 13:15 UTC = 19:00 / 19:15 Бишкек (свежий сегодняшний день).
-- Перед запуском замените REPLACE_ME_SERVICE_ROLE_KEY на service_role (в репозиторий ключ не коммитим).
do $block$
declare
  jid bigint;
  j text;
begin
  foreach j in array array['rnp-morning-funnel-zevina-11-bishkek', 'rnp-morning-funnel-baza-11-bishkek',
                           'rnp-morning-funnel-evening-zevina', 'rnp-morning-funnel-evening-baza']
  loop
    for jid in select jobid from cron.job where jobname = j loop perform cron.unschedule(jid); end loop;
  end loop;
end $block$;

select cron.schedule('rnp-morning-funnel-zevina-11-bishkek', '0 5 * * *', $$
  select net.http_post(
    url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'),
    body := '{"group":"zevina","funnel_only":true,"notify":false}'::jsonb, timeout_milliseconds := 150000);
$$);
select cron.schedule('rnp-morning-funnel-baza-11-bishkek', '15 5 * * *', $$
  select net.http_post(
    url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'),
    body := '{"group":"baza","funnel_only":true,"notify":false}'::jsonb, timeout_milliseconds := 150000);
$$);
select cron.schedule('rnp-morning-funnel-evening-zevina', '0 13 * * *', $$
  select net.http_post(
    url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'),
    body := '{"group":"zevina","funnel_only":true,"notify":false}'::jsonb, timeout_milliseconds := 150000);
$$);
select cron.schedule('rnp-morning-funnel-evening-baza', '15 13 * * *', $$
  select net.http_post(
    url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/rnp-morning-fill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_ME_SERVICE_ROLE_KEY'),
    body := '{"group":"baza","funnel_only":true,"notify":false}'::jsonb, timeout_milliseconds := 150000);
$$);
