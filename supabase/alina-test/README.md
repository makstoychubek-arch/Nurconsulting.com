# Живой тест Алины: вопрос менеджеру

Только для отдельного тестового проекта Supabase и тестового бота. Рабочий проект `fiukyfyhotctvfdidktx` и `telegram-router` не трогаются; код лежит вне `supabase/functions`, поэтому CI его не выкладывает.

1. Создать тестовый проект Supabase и выполнить `supabase/alina-test/setup.sql` в SQL Editor.
2. В Edge Functions → Secrets тестового проекта добавить `ALINA_BOT_TOKEN` (токен тестового бота) и `ALINA_TEST_WEBHOOK_SECRET` (случайная строка от 24 символов).
3. Выложить: `SUPABASE_ACCESS_TOKEN=… scripts/alina-test-deploy.sh <ref тестового проекта>`.
4. Зарегистрировать вебхук: `curl -X POST -H "x-alina-test-key: $SECRET" "https://<ref>.supabase.co/functions/v1/alina-manager-test?action=set-webhook"`, проверить: `?action=info` (покажет имя бота и ошибки доставки).
5. Тестовый бот добавлен в группу -4465341061 и подключён как чат-бот к Business-аккаунту, которому пишет @nurcon.
