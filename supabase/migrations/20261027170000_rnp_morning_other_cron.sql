-- РНП клиентских кабинетов (Полотбек, МАРС и новые): утреннее заполнение и воронка WB без Telegram команды.
-- Копируем рабочие задания Baza, подменяя группу, чтобы ключ службы не лежал в репозитории.
select cron.schedule('rnp-morning-other-08-bishkek', '30 2 * * *',
  replace((select command from cron.job where jobname = 'rnp-morning-baza-07-bishkek'), '"group":"baza"', '"group":"other"'));
select cron.schedule('rnp-morning-funnel-other-11-bishkek', '30 5 * * *',
  replace((select command from cron.job where jobname = 'rnp-morning-funnel-baza-11-bishkek'), '"group":"baza"', '"group":"other"'));
select cron.schedule('rnp-morning-funnel-evening-other', '30 13 * * *',
  replace((select command from cron.job where jobname = 'rnp-morning-funnel-evening-baza'), '"group":"baza"', '"group":"other"'));
