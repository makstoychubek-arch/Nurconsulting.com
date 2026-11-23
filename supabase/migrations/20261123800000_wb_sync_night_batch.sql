-- Ночной пакет WB (владелец, 23 ноября 2026): заказы, остатки и реклама WB выгружаются и считаются ночью (по Бишкеку 03:30–07:15, время UTC ниже),
-- днём синхронизация не тратит силы, сайт показывает готовое за вчера. Прежние задачи auto-sync (каждые 4 часа) и advertising-sync (каждый час) снимаются.
-- Остаются: sync_campaigns (список кампаний для живого управления рекламой), sync-queue-tick (ручное «обновить»), ночные задачи РНП и giveaways-sync.
do $$
declare
    base_auto text;
    base_ads text;
    s record;
begin
    select command into base_auto from cron.job where jobname = 'auto-sync-4h' limit 1;
    if base_auto is null then select command into base_auto from cron.job where jobname = 'auto-sync-night-1' limit 1; end if;
    select command into base_ads from cron.job where jobname = 'advertising-sync-6h' limit 1;
    if base_ads is null then select command into base_ads from cron.job where jobname = 'advertising-sync-night-1' limit 1; end if;
    if base_auto is null or base_ads is null then
        raise notice 'базовые задачи WB не найдены, расписание не менялось';
        return;
    end if;
    perform cron.unschedule(jobname) from cron.job where jobname in ('auto-sync-4h', 'advertising-sync-6h');
    for s in select * from (values
        ('auto-sync-night-1', '30 21 * * *'), ('auto-sync-night-2', '0 22 * * *'), ('auto-sync-night-3', '30 22 * * *'), ('auto-sync-night-4', '0 23 * * *'),
        ('auto-sync-night-5', '30 23 * * *'), ('auto-sync-night-6', '0 0 * * *'), ('auto-sync-night-7', '30 0 * * *'), ('auto-sync-night-8', '0 1 * * *')
    ) as t(jobname, sched) loop
        perform cron.unschedule(jobname) from cron.job where jobname = s.jobname;
        perform cron.schedule(s.jobname, s.sched, base_auto);
    end loop;
    for s in select * from (values
        ('advertising-sync-night-1', '45 21 * * *'), ('advertising-sync-night-2', '45 22 * * *'), ('advertising-sync-night-3', '45 23 * * *'), ('advertising-sync-night-4', '15 1 * * *')
    ) as t(jobname, sched) loop
        perform cron.unschedule(jobname) from cron.job where jobname = s.jobname;
        perform cron.schedule(s.jobname, s.sched, base_ads);
    end loop;
end $$;
