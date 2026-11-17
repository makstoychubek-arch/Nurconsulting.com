-- Обращения к менеджерам: время создания (для напоминания), логин и текст сообщения в группе
-- (чтобы дописать «Ответил: …»), кто ответил, когда отправлено напоминание. Идемпотентно, строки не трогаем.
alter table public.alina_manager_questions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists client_login text,
  add column if not exists group_text text,
  add column if not exists reminded_at timestamptz,
  add column if not exists answered_by bigint,
  add column if not exists answered_by_name text;

create index if not exists alina_manager_questions_due_idx
  on public.alina_manager_questions (created_at)
  where delivery_state = 'pending' and reminded_at is null;
