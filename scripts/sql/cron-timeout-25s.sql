-- Фоновые задания базы вызывают функции через pg_net, у которого ожидание по умолчанию 5 секунд.
-- 29.10.2026 поиск адреса функций стал занимать 5+ секунд, запросы обрывались (в том числе смена фото в А/Б тестах).
-- Этот скрипт добавляет ожидание 25 секунд ко всем заданиям с одним net.http_post и переводит пересчёт
-- витрины дашборда на раз в 5 минут. Применять в SQL-редакторе Supabase от имени владельца базы.
-- Не применён: автоматическое выполнение из сессии Claude запрещено правилами доступа.
do $$
declare r record; n int := 0;
begin
    for r in
        select jobid, command from cron.job
        where command ~ 'net\.http_post\('
          and command !~ 'timeout_milliseconds'
          and (length(command) - length(replace(command, 'net.http_post(', ''))) / length('net.http_post(') = 1
    loop
        perform cron.alter_job(r.jobid, command := regexp_replace(r.command, '\)\s*;?\s*$', E',\n timeout_milliseconds := 25000\n);'));
        n := n + 1;
    end loop;
    perform cron.alter_job((select jobid from cron.job where jobname = 'dash-daily-recent'), schedule := '*/5 * * * *');
    raise notice 'обновлено заданий: %', n;
end $$;
