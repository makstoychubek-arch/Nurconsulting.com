-- Каналы Telegram «Склад» и «Триггеры» больше не используются.
-- Чаты в Telegram удаляет владелец; здесь только код и мьюты.

delete from public.telegram_channel_mutes
where channel in ('warehouse', 'triggers');

select 'dropped unused telegram warehouse/triggers mutes' as status;
