-- Чистка мусора: Telegram-каналы «Новости WB» и «Блокировки карточек» убраны полностью (по слову владельца, 12 ноября 2026).
-- Расписания, таблицы дедупликации и следы в журнале. Сами функции (blockings-watch, marketplace-news-watch,
-- wb-news-notify, wb-news-read) удалены из Supabase отдельно, их код убран из репозитория.

select cron.unschedule(jobname)
from cron.job
where jobname in ('blockings-watch-20min', 'marketplace-news-watch-hourly', 'wb-news-notify-hourly');

drop table if exists public.card_block_states;
drop table if exists public.marketplace_news_sent;
drop table if exists public.wb_news_sent;
drop table if exists public.wb_news_state;

delete from public.notification_log
where event_type ~* '^(blockings|card_blocked|card_unblocked|news|wb_news|marketplace_news)';

delete from public.telegram_channel_mutes where channel in ('news', 'blockings');
