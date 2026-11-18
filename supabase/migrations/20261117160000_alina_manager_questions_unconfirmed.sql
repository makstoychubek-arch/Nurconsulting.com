-- Разрешаем состояние unconfirmed (Telegram не ответил вовремя, неизвестно, дошло ли сообщение).
-- Для таблицы, уже созданной прошлой миграцией: строки не трогаем, меняем только проверку.
-- Идемпотентно: повторный запуск ничего не ломает.
alter table public.alina_manager_questions
  drop constraint if exists alina_manager_questions_delivery_state_check;
alter table public.alina_manager_questions
  add constraint alina_manager_questions_delivery_state_check
  check (delivery_state in ('pending', 'sending', 'sent', 'unconfirmed'));
