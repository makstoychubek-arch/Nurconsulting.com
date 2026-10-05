-- Кабинет SAAI удалён, данных в базе не осталось — убираем его cron-задание.
-- content_publish_tick вызывал функцию content-publish-tick, которой нет (404 каждые 5 минут).
-- Если функцию выложат, задание нужно создать заново отдельной миграцией.
-- Safe to re-run.
do $$
declare j text;
begin
    foreach j in array array['daily-sales-report-07-saai', 'content_publish_tick'] loop
        if exists (select 1 from cron.job where jobname = j) then
            perform cron.unschedule(j);
        end if;
    end loop;
end $$;
