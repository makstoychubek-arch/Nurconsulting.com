-- Напоминания Алины: проверка каждые 10 минут (функция alina-nudge). Расписание создано по образцу alina-manager-tick-1m.
-- select cron.schedule('alina-nudge-10m', '*/10 * * * *', replace(command, 'alina-manager-tick', 'alina-nudge')) from cron.job where jobname = 'alina-manager-tick-1m';
-- Кого не трогаем: alina_settings.nudgeSkip (список логинов).

-- Утренний план дня (25 ноября 2026): функция alina-daily-plan, 09:00 МСК = 06:00 UTC.
-- select cron.schedule('alina-daily-plan-0900msk', '0 6 * * *', replace(command, 'alina-manager-tick', 'alina-daily-plan')) from cron.job where jobname = 'alina-manager-tick-1m';
-- Состояние: alina_settings.dayPlan { day, status: pending|approved, message_id }. Согласие: реплай «ок» в группе менеджеров.
