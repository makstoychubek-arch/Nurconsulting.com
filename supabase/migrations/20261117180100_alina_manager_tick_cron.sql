-- Раз в минуту проверяем обращения без ответа дольше 10 минут (функция alina-manager-tick).
-- Команда берётся у рабочего расписания orders-rescan-10m (там заголовок авторизации), как у alina-queue-tick.
do $$
declare
    template text;
begin
    select command into strict template
    from cron.job where jobname = 'orders-rescan-10m' and active;
    if template not like '%/functions/v1/orders-rescan%' or template like '%REPLACE_ME%' then
        raise exception 'Alina manager tick cron authorization template is unavailable';
    end if;
    perform cron.schedule('alina-manager-tick-1m', '* * * * *',
        replace(template, '/functions/v1/orders-rescan', '/functions/v1/alina-manager-tick'));
end;
$$;
