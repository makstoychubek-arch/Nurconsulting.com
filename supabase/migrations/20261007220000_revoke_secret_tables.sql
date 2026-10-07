-- Аудит безопасности: таблицы секретов доступны только service_role (RLS и так закрывает строки,
-- здесь снимаем и права на уровне таблицы как вторую линию защиты).
revoke all on public.cabinet_secrets from anon, authenticated;
revoke all on public.telegram_bot_secrets from anon, authenticated;
revoke all on public.tg_login_tokens from anon, authenticated;
