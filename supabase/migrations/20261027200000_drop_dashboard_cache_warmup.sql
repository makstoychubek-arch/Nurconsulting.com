-- Прогрев кэша каждые 4 минуты оказался вредным: сканировал ~300 МБ при буфере базы 224 МБ и вытеснял нужные страницы.
select cron.unschedule(jobid) from cron.job where jobname = 'dashboard-cache-warmup';
drop function if exists public.warm_dashboard_cache();
