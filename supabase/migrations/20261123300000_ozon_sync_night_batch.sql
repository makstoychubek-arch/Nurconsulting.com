-- Ночной пакет Ozon (владелец, 23 ноября 2026): сервер выгружает и считает вчерашний день ночью, днём синхронизация не тратит силы,
-- сайт показывает готовое. Время UTC (Бишкек = UTC+6): всё готово к 07:00 по Бишкеку, к 11:00 с запасом.
-- Прежние дневные задачи (каждые 30 минут, 2, 3, 6 часов) снимаются. Команда берётся у существующей задачи (с тем же заголовком авторизации).
do $$
declare
    base text;
    spec record;
begin
    select command into base from cron.job where jobname = 'ozon-sync-30m' limit 1;
    if base is null then
        select command into base from cron.job where jobname like 'ozon-night-%' limit 1;
    end if;
    if base is null then
        raise notice 'базовая задача ozon не найдена, расписание не менялось';
        return;
    end if;
    -- убираем дневные
    perform cron.unschedule(jobname) from cron.job where jobname in ('ozon-sync-30m','ozon-sync-accruals-2h','ozon-sync-ads-funnel-2h','ozon-sync-finance-6h','ozon-sync-products-6h','ozon-sync-returns-bal-3h');
    base := replace(base, '{"parts":["stocks","postings"],"days":3}', '__BODY__');
    for spec in
        select * from (values
            ('ozon-night-postings',  '10 21 * * *', '{"parts":["stocks","postings"],"days":5}'),
            ('ozon-night-returns',   '20 21 * * *', '{"parts":["returns","balance"],"days":30}'),
            ('ozon-night-accruals',  '35 21 * * *', '{"parts":["accruals"],"days":75}'),
            ('ozon-night-ads',       '55 21 * * *', '{"parts":["ads","funnel"],"days":10}'),
            ('ozon-night-finance',   '15 22 * * *', '{"parts":["finance"],"days":60}'),
            ('ozon-night-products',  '35 22 * * *', '{"parts":["products"]}'),
            -- повтор на случай сбоя Ozon ночью
            ('ozon-night-retry-a',   '30 0 * * *',  '{"parts":["postings","returns","accruals"],"days":5}'),
            ('ozon-night-retry-b',   '50 0 * * *',  '{"parts":["ads","funnel","finance"],"days":10}')
        ) as t(jobname, sched, body)
    loop
        perform cron.unschedule(jobname) from cron.job where jobname = spec.jobname;
        perform cron.schedule(spec.jobname, spec.sched, replace(base, '__BODY__', spec.body));
    end loop;
end $$;
