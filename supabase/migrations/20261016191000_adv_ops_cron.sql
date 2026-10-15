-- Догон очереди adv_ops: каждую минуту отправляем то, что не ушло сразу (закрытая вкладка, лимиты WB, сбой сети).
-- Ключ берём из Vault (service_role_key), а не зашиваем в команду: при смене ключа достаточно обновить секрет.
select cron.unschedule('adv-ops-tick') where exists (select 1 from cron.job where jobname = 'adv-ops-tick');
select cron.schedule('adv-ops-tick', '* * * * *', $cron$
    select net.http_post(
        url := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/adv-ops-run',
        headers := jsonb_build_object('Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
$cron$);
