-- Штрафы за день: WB публикует дневной отчёт с задержкой. Повторяем запуск каждый час с 08:10 до 17:10 по Бишкеку
-- (журнал notification_log не даёт дублей), а в 18:10 последний запуск с final: он один раз сообщает,
-- что WB отчёт так и не выдал. Команды копируют основное задание (ключ уже лежит в нём, в репозиторий не кладём).
select cron.unschedule(jobname) from cron.job where jobname in ('daily-penalties-retry-hourly', 'daily-penalties-final-1810-bishkek');
select cron.schedule('daily-penalties-retry-hourly', '10 2-11 * * *', command)
  from cron.job where jobname = 'daily-penalties-report-07-bishkek';
select cron.schedule('daily-penalties-final-1810-bishkek', '10 12 * * *', replace(command, '''{}''::jsonb', '''{"final":true}''::jsonb'))
  from cron.job where jobname = 'daily-penalties-report-07-bishkek';
