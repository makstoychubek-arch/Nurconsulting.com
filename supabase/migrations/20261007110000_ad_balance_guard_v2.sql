-- Сторож: время остановки, паузы по балансу и запуск независимо друг от друга.
alter table public.ad_balance_guards alter column pause_below drop not null;
alter table public.ad_balance_guards alter column resume_hour_utc drop not null;
alter table public.ad_balance_guards add column if not exists stop_hour_utc integer check (stop_hour_utc between 0 and 23);
alter table public.ad_balance_guards add column if not exists paused_at timestamptz;
