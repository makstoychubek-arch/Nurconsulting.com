-- Ежедневные шаги по рекламе без человека и без ИИ: функция ad-routines (правила владельца) по расписанию.
-- Время UTC: Бишкек = UTC+6. 09:07 Zevina 1, 10:08 Baza и Elium утро, 18:05 Baza и Elium вечер.
-- Ключ берём из Vault (service_role_key), как у adv-ops-tick.
select cron.unschedule(jobname) from cron.job where jobname in ('ad-routines-zevina', 'ad-routines-morning', 'ad-routines-evening');

select cron.schedule('ad-routines-zevina', '7 3 * * *', $cron$
    select net.http_post(url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/ad-routines',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)),
        body := '{"step":"zevina"}'::jsonb, timeout_milliseconds := 150000);
$cron$);

select cron.schedule('ad-routines-morning', '8 4 * * *', $cron$
    select net.http_post(url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/ad-routines',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)),
        body := '{"step":"morning"}'::jsonb, timeout_milliseconds := 150000);
$cron$);

select cron.schedule('ad-routines-evening', '5 12 * * *', $cron$
    select net.http_post(url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/ad-routines',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)),
        body := '{"step":"evening"}'::jsonb, timeout_milliseconds := 150000);
$cron$);
