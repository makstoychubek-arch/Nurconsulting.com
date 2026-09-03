-- Ежедневный отчёт продаж для кабинета Elium (07:08 Бишкек = 01:08 UTC).
-- Остальные кабинеты уже имеют отдельные jobs.

select cron.unschedule(jobid) from cron.job where jobname = 'daily-sales-report-07-elium';

select cron.schedule(
  'daily-sales-report-07-elium',
  '8 1 * * *',
  $$
  select net.http_post(
    url     := 'https://fiukyfyhotctvfdidktx.supabase.co/functions/v1/daily-sales-report',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpdWt5Znlob3RjdHZmZGlka3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMwMTk3NywiZXhwIjoyMDk3ODc3OTc3fQ.kGFuucW3-daQXaYH-LwviXQbIH3K2Z1qn5jFYWyeMZQ"}'::jsonb,
    body    := '{"cabinets":["Elium"]}'::jsonb
  );
  $$
);
