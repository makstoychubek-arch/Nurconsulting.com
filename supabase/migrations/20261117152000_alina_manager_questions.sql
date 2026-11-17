create table public.alina_manager_questions (
  group_id bigint not null,
  group_message_id bigint not null,
  client_chat_id bigint not null,
  business_connection_id text not null,
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'sending', 'sent', 'unconfirmed')),
  primary key (group_id, group_message_id)
);
alter table public.alina_manager_questions enable row level security;
revoke all on public.alina_manager_questions from public, anon, authenticated;
grant select, insert, update on public.alina_manager_questions to service_role;

-- unconfirmed: Telegram не ответил за таймаут, неизвестно, дошло ли сообщение. Автоматически не повторяется.
