-- Статусы в таблице «Раздачи Пижам»: ручная смена статуса Алины принимается ботом (alina-status-watch), поэтому смотрим таблицу каждую минуту.
select cron.alter_job((select jobid from cron.job where jobname = 'alina-status-watch-10m'), schedule := '* * * * *');
