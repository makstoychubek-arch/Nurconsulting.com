-- Ozon: по расписанию синхронизировались только stocks, postings, finance и products.
-- Реклама, воронка, возвраты, баланс и начисления не обновлялись (последнее обновление 14 ноября), из-за чего в РНП Ozon
-- расход рекламы, показы, клики и начисления отставали. Добавляем задачи; команда берётся у существующей ozon-sync-30m
-- (с тем же заголовком авторизации), секреты в репозиторий не попадают.
do $$
declare
    base text;
    spec record;
begin
    select command into base from cron.job where jobname = 'ozon-sync-30m' limit 1;
    if base is null then
        raise notice 'ozon-sync-30m не найден, задачи не добавлены';
        return;
    end if;
    for spec in
        select * from (values
            ('ozon-sync-ads-funnel-2h',  '12 */2 * * *', '{"parts":["ads","funnel"],"days":10}'),
            ('ozon-sync-returns-bal-3h', '42 */3 * * *', '{"parts":["returns","balance"],"days":30}'),
            ('ozon-sync-accruals-2h',    '52 */2 * * *', '{"parts":["accruals"],"days":75}')
        ) as t(jobname, sched, body)
    loop
        if not exists (select 1 from cron.job where jobname = spec.jobname) then
            perform cron.schedule(
                spec.jobname, spec.sched,
                replace(base, '{"parts":["stocks","postings"],"days":3}', spec.body)
            );
        end if;
    end loop;
end $$;
